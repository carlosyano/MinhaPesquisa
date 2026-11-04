// RF-006: upload, montagem da aplicação, identificação manual e imagem da página
// (CA-003, CA-004, CA-013, CA-027, CA-029, CA-039, CA-040; RN-029, RN-040; DEC-029, DEC-034,
// DEC-042, DEC-048, DEC-098 a DEC-100; FL-001).
//
// O envio inteiro é validado e processado em memória antes de gravar qualquer coisa: um
// arquivo recusado recusa o envio e nada é gravado (CA-029).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { MultipartFile } from '@fastify/multipart';
import { createHash } from 'node:crypto';
import { NUCLEO } from '../auth/auth.controller.js';
import { projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao } from '../http.js';
import { chaveImagem } from '../infra/armazenamento.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { analisarPagina, contarPaginasPdf, normalizarImagem, renderizarPdf } from '../infra/imagens.js';
import { MINUTO, somar } from '../infra/relogio.js';
import { ehUuid, Nucleo, type SessaoAtiva } from '../nucleo.js';
import { classificarCriacao, LIMITE_BYTES, LIMITE_PAGINAS, lerConteudoQr, MOTIVO, paginasCompletas, tipoPorConteudo, type Criacao, type VersaoDoQr } from '../regras/upload.js';

interface PaginaProcessada {
  jpeg: Buffer;
  sha256: Buffer;
  qr: string | null;
  registroOk: boolean;
}

interface LinhaAplicacao {
  id: string;
  projeto_id: string;
  versao_id: string | null;
  estado: string;
  aviso: string | null;
  assinatura: string;
}

interface LinhaPagina {
  id: string;
  tipo: 'formulario' | 'assinatura';
  numero_pagina: number | null;
  qr_codigo: string | null;
  registro_ok: boolean;
  chave_storage: string;
}

interface Identificar {
  versao_id: string;
  paginas: { imagem_id: string; numero_pagina?: number; descartar?: boolean }[];
}

const recusa = (motivo: string) => new ErroApi('ERR-029', { motivo, substituir: motivo });

type ReqMultipart = Requisicao & { isMultipart(): boolean; files(): AsyncIterableIterator<MultipartFile> };

@Controller()
export class UploadController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  // ───────────────────────────── processamento dos arquivos ─────────────────────────────

  /**
   * Lê e valida cada arquivo na ordem da DEC-042, parando no primeiro motivo: (1) tamanho,
   * durante o recebimento; (2) antimalware; (3) tipo pelo conteúdo; (4) páginas. Depois
   * normaliza (sem metadados) e analisa cada página.
   */
  private async processarArquivos(req: Requisicao): Promise<PaginaProcessada[]> {
    const r = req as ReqMultipart;
    if (typeof r.isMultipart !== 'function' || !r.isMultipart()) throw new ErroApi('ERR-001', { campos: ['arquivos'] });
    const paginas: PaginaProcessada[] = [];
    let arquivos = 0;
    try {
      for await (const parte of r.files()) {
        if (parte.fieldname !== 'arquivos') throw new ErroApi('ERR-001', { campos: [parte.fieldname] });
        arquivos++;
        let bytes: Buffer;
        try {
          bytes = await parte.toBuffer();
        } catch (e) {
          if ((e as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw recusa(MOTIVO.tamanho);
          throw e;
        }
        if (bytes.length > LIMITE_BYTES || parte.file.truncated) throw recusa(MOTIVO.tamanho);
        if (!(await this.n.config.antimalware.limpo(bytes))) throw recusa(MOTIVO.malware);
        const tipo = tipoPorConteudo(bytes);
        if (!tipo) throw recusa(MOTIVO.tipo);
        let imagens: Buffer[];
        if (tipo === 'pdf') {
          const total = await contarPaginasPdf(bytes);
          if (total === null) throw recusa(MOTIVO.tipo);
          if (total > LIMITE_PAGINAS) throw recusa(MOTIVO.paginas);
          imagens = await renderizarPdf(bytes);
        } else {
          imagens = [bytes];
        }
        for (const img of imagens) {
          let jpeg: Buffer;
          try {
            jpeg = await normalizarImagem(img);
          } catch {
            throw recusa(MOTIVO.tipo); // imagem corrompida ou grande demais para decodificar
          }
          const a = await analisarPagina(jpeg);
          paginas.push({ jpeg, sha256: createHash('sha256').update(jpeg).digest(), qr: a.qr, registroOk: a.registroOk });
        }
      }
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === 'FST_REQ_FILE_TOO_LARGE') throw recusa(MOTIVO.tamanho);
      if (codigo === 'FST_FILES_LIMIT') throw new ErroApi('ERR-001', { campos: ['arquivos'] });
      throw e;
    }
    if (arquivos === 0) throw new ErroApi('ERR-001', { campos: ['arquivos'] });
    return paginas;
  }

  // ───────────────────────────── consultas ─────────────────────────────

  private async aplicacao(tx: Executor, s: SessaoAtiva, id: string, bloquear = false): Promise<LinhaAplicacao> {
    if (!ehUuid(id)) throw naoEncontrado('Aplicacao', null);
    const a = await linha<LinhaAplicacao>(
      tx,
      bloquear
        ? sql`SELECT id, projeto_id, versao_id, estado, aviso, assinatura FROM aplicacao WHERE id = ${id} FOR UPDATE`
        : sql`SELECT id, projeto_id, versao_id, estado, aviso, assinatura FROM aplicacao WHERE id = ${id}`,
    );
    if (!a) throw naoEncontrado('Aplicacao', id);
    try {
      await projetoNoEscopo(tx, a.projeto_id);
    } catch {
      throw naoEncontrado('Aplicacao', id);
    }
    return a;
  }

  private async paginas(tx: Executor, aplicacaoId: string): Promise<LinhaPagina[]> {
    return linhas<LinhaPagina>(
      tx,
      sql`SELECT id, tipo, numero_pagina, qr_codigo, registro_ok, chave_storage FROM pagina_aplicacao
           WHERE aplicacao_id = ${aplicacaoId} AND expurgada_em IS NULL ORDER BY ordem_envio, id`,
    );
  }

  /** Versões publicadas do tenant pelos códigos dos QR (a RLS esconde as de outros tenants). */
  private async resolverQrs(tx: Executor, conteudos: (string | null)[]): Promise<Map<string, VersaoDoQr>> {
    const codigos = [...new Set(conteudos.map((c) => (c ? lerConteudoQr(c)?.codigo : undefined)).filter((c): c is string => !!c))];
    const mapa = new Map<string, VersaoDoQr>();
    if (!codigos.length) return mapa;
    const vs = await linhas<{ qr_codigo: string; id: string; projeto_id: string; total: number }>(
      tx,
      sql`SELECT v.qr_codigo, v.id, f.projeto_id, (v.mapa_layout ->> 'total_paginas')::int AS total
            FROM versao v JOIN formulario f ON f.id = v.formulario_id
           WHERE v.status = 'publicada' AND v.qr_codigo IN (SELECT jsonb_array_elements_text(${JSON.stringify(codigos)}::jsonb))`,
    );
    for (const v of vs) mapa.set(v.qr_codigo, { versaoId: v.id, projetoId: v.projeto_id, totalPaginas: v.total });
    return mapa;
  }

  private corpoPagina(p: LinhaPagina) {
    return { imagem_id: p.id, numero_pagina: p.numero_pagina, tipo: p.tipo, registro_ok: p.registro_ok };
  }

  private async corpoAplicacao(tx: Executor, a: LinhaAplicacao) {
    return {
      id: a.id,
      projeto_id: a.projeto_id,
      versao_id: a.versao_id,
      estado: a.estado,
      assinatura: a.assinatura,
      aviso: a.aviso,
      divergencias_cadastro: [],
      paginas: (await this.paginas(tx, a.id)).map((p) => this.corpoPagina(p)),
      cadastro_existente: null,
      itens: [],
    };
  }

  /** Grava as imagens; se algo falhar depois, o chamador apaga as que gravou. */
  private async gravarPaginas(tx: Executor, s: SessaoAtiva, aplicacaoId: string, paginas: PaginaProcessada[], resolvidas: Map<string, VersaoDoQr>, gravadas: string[]): Promise<void> {
    const ordem = (await linha<{ n: number }>(tx, sql`SELECT coalesce(max(ordem_envio), 0)::int AS n FROM pagina_aplicacao WHERE aplicacao_id = ${aplicacaoId}`))!.n;
    for (const [i, p] of paginas.entries()) {
      const id = this.n.id();
      const chave = chaveImagem(s.tenantId, aplicacaoId, id);
      await this.n.config.armazenamento.gravar(chave, p.jpeg, 'image/jpeg');
      gravadas.push(chave);
      const lido = p.qr ? lerConteudoQr(p.qr) : null;
      const numero = lido && resolvidas.has(lido.codigo) ? lido.pagina : null;
      await tx.execute(sql`
        INSERT INTO pagina_aplicacao (id, tenant_id, aplicacao_id, tipo, numero_pagina, ordem_envio, qr_codigo, chave_storage,
                                      sha256, registro_ok, criado_em)
        VALUES (${id}, ${s.tenantId}, ${aplicacaoId}, 'formulario', ${numero}, ${ordem + i + 1}, ${p.qr?.slice(0, 200) ?? null},
                ${chave}, ${p.sha256}, ${p.registroOk}, ${this.n.agora()})`);
    }
  }

  /** Aplica o resultado da tabela de criação: estado, aviso, versão, outbox e auditoria. */
  private async aplicarEstado(tx: Executor, s: SessaoAtiva, aplicacaoId: string, c: Criacao): Promise<void> {
    await tx.execute(sql`
      UPDATE aplicacao SET estado = ${c.estado}, aviso = ${c.aviso}, versao_id = ${c.versaoId}, versao = versao + 1
       WHERE id = ${aplicacaoId}`);
    if (c.estado === 'em_leitura') {
      await tx.execute(sql`
        INSERT INTO outbox (id, tenant_id, tipo, payload, criado_em)
        VALUES (${this.n.id()}, ${s.tenantId}, 'leitura.solicitada', ${JSON.stringify({ aplicacao_id: aplicacaoId })}::jsonb, ${this.n.agora()})`);
    }
    if (c.aviso === 'ERR-039') await this.n.auditar(tx, s, 'QR_FORA_DE_CONTEXTO', 'Aplicacao', aplicacaoId); // CA-039
  }

  private async apagarObjetos(chaves: string[]): Promise<void> {
    await Promise.allSettled(chaves.map((k) => this.n.config.armazenamento.apagar(k)));
  }

  // ───────────────────────────── uploadImages ─────────────────────────────

  @Post('projects/:projectId/applications/upload')
  @HttpCode(202)
  async uploadImages(@Param('projectId') projetoId: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    if (!chave || chave.length < 16 || chave.length > 64) throw new ErroApi('ERR-001', { campos: ['Idempotency-Key'] });
    // Escopo, perfil e projeto ativo antes de receber os arquivos.
    await this.n.comAtor(s, async (tx) => {
      const p = await projetoNoEscopo(tx, projetoId);
      if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] }); // CA-027
    });
    const paginas = await this.processarArquivos(req);

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const p = await projetoNoEscopo(tx, projetoId, true);
        if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] });
        const impressao = { projetoId, arquivos: paginas.map((x) => x.sha256.toString('hex')) };
        const feito = await this.n.idempotente(tx, s, 'uploadImages', chave, impressao, async () => {
          const id = this.n.id();
          await tx.execute(sql`
            INSERT INTO aplicacao (id, tenant_id, projeto_id, estado, criada_em, criada_por)
            VALUES (${id}, ${s.tenantId}, ${projetoId}, 'identificacao_pendente', ${this.n.agora()}, ${s.usuarioId})`);
          const resolvidas = await this.resolverQrs(tx, paginas.map((x) => x.qr));
          await this.gravarPaginas(tx, s, id, paginas, resolvidas, gravadas);
          const c = classificarCriacao(paginas, projetoId, (codigo) => resolvidas.get(codigo));
          await this.aplicarEstado(tx, s, id, c);
          await this.n.auditar(tx, s, 'UPLOAD_APLICACAO', 'Aplicacao', id, { paginas: paginas.length, estado: c.estado });
          return { status: 202, recursoId: id };
        });
        const a = await this.aplicacao(tx, s, feito.recursoId);
        return {
          aplicacao_id: a.id,
          estado: a.estado,
          paginas: (await this.paginas(tx, a.id)).map((x) => this.corpoPagina(x)),
          aviso: a.aviso,
        };
      });
    } catch (e) {
      await this.apagarObjetos(gravadas);
      throw e;
    }
  }

  // ───────────────────────────── addApplicationPages ─────────────────────────────

  @Post('applications/:applicationId/pages')
  @HttpCode(200)
  async addApplicationPages(@Param('applicationId') id: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    if (!chave || chave.length < 16 || chave.length > 64) throw new ErroApi('ERR-001', { campos: ['Idempotency-Key'] });
    await this.n.comAtor(s, async (tx) => {
      const a = await this.aplicacao(tx, s, id);
      if (a.estado !== 'identificacao_pendente') throw new ErroApi('ERR-018');
    });
    const novas = await this.processarArquivos(req);

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const a = await this.aplicacao(tx, s, id, true);
        if (a.estado !== 'identificacao_pendente') throw new ErroApi('ERR-018');
        const impressao = { aplicacaoId: id, arquivos: novas.map((x) => x.sha256.toString('hex')) };
        await this.n.idempotente(tx, s, 'addApplicationPages', chave, impressao, async () => {
          const existentes = await this.paginas(tx, id);
          const todas = [...existentes.map((p) => ({ qr: p.qr_codigo, registroOk: p.registro_ok })), ...novas];
          const resolvidas = await this.resolverQrs(tx, todas.map((x) => x.qr));
          await this.gravarPaginas(tx, s, id, novas, resolvidas, gravadas);
          // Páginas já gravadas ganham o número quando o QR passa a resolver (ex.: versão agora conhecida).
          for (const p of existentes) {
            const lido = p.qr_codigo ? lerConteudoQr(p.qr_codigo) : null;
            if (lido && resolvidas.has(lido.codigo)) await tx.execute(sql`UPDATE pagina_aplicacao SET numero_pagina = ${lido.pagina} WHERE id = ${p.id}`);
          }
          const projeto = (await linha<{ projeto_id: string }>(tx, sql`SELECT projeto_id FROM aplicacao WHERE id = ${id}`))!.projeto_id;
          const c = classificarCriacao(todas, projeto, (codigo) => resolvidas.get(codigo));
          await this.aplicarEstado(tx, s, id, c);
          await this.n.auditar(tx, s, 'ACRESCENTAR_PAGINAS', 'Aplicacao', id, { paginas: novas.length, estado: c.estado });
          return { status: 200, recursoId: id };
        });
        return this.corpoAplicacao(tx, await this.aplicacao(tx, s, id));
      });
    } catch (e) {
      await this.apagarObjetos(gravadas);
      throw e;
    }
  }

  // ───────────────────────────── identifyApplication ─────────────────────────────

  @Post('applications/:applicationId/identify')
  @HttpCode(200)
  async identifyApplication(@Param('applicationId') id: string, @Body() corpo: Identificar, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const removidas: string[] = [];
    const r = await this.n.comAtor(s, async (tx) => {
      const a = await this.aplicacao(tx, s, id, true);
      const campos = this.n.contrato.validarCorpo('identifyApplication', corpo);
      if (campos) throw new ErroApi('ERR-001', { campos });
      await this.n.idempotente(tx, s, 'identifyApplication', chave, { id, ...corpo }, async () => {
        if (a.estado !== 'identificacao_pendente') throw new ErroApi('ERR-018');
        const foraDeContexto = new ErroApi('ERR-039', { auditar: { acao: 'VERSAO_FORA_DE_CONTEXTO', entidade: 'Aplicacao', registroId: id } });
        const v = ehUuid(corpo.versao_id)
          ? await linha<{ projeto_id: string; status: string; total: number }>(
              tx,
              sql`SELECT f.projeto_id, v.status, (v.mapa_layout ->> 'total_paginas')::int AS total
                    FROM versao v JOIN formulario f ON f.id = v.formulario_id WHERE v.id = ${corpo.versao_id}`,
            )
          : undefined;
        // Inexistente, de outro tenant (a RLS esconde), de outro projeto ou não publicada (DEC-100).
        if (!v || v.status !== 'publicada' || v.projeto_id !== a.projeto_id) throw foraDeContexto;

        const imagens = (await this.paginas(tx, id)).filter((p) => p.tipo === 'formulario');
        const ids = corpo.paginas.map((p) => p.imagem_id);
        const coerente =
          new Set(ids).size === ids.length && ids.length === imagens.length && imagens.every((i) => ids.includes(i.id));
        const mantidas = corpo.paginas.filter((p) => !p.descartar);
        if (!coerente || mantidas.some((p) => p.numero_pagina === undefined) || !paginasCompletas(mantidas.map((p) => p.numero_pagina!), v.total)) {
          throw new ErroApi('ERR-004');
        }
        for (const p of corpo.paginas) {
          if (p.descartar) {
            const img = imagens.find((i) => i.id === p.imagem_id)!;
            await tx.execute(sql`DELETE FROM pagina_aplicacao WHERE id = ${p.imagem_id}`);
            removidas.push(img.chave_storage);
          } else {
            await tx.execute(sql`UPDATE pagina_aplicacao SET numero_pagina = ${p.numero_pagina!} WHERE id = ${p.imagem_id}`);
          }
        }
        await this.aplicarEstado(tx, s, id, { estado: 'em_leitura', aviso: null, versaoId: corpo.versao_id });
        await this.n.auditar(tx, s, 'IDENTIFICAR_APLICACAO', 'Aplicacao', id, { descartadas: removidas.length });
        return { status: 200, recursoId: id };
      });
      return this.corpoAplicacao(tx, await this.aplicacao(tx, s, id));
    });
    await this.apagarObjetos(removidas);
    return r;
  }

  // ───────────────────────────── getPageImage ─────────────────────────────

  @Get('applications/:applicationId/pages/:pageId/image')
  async getPageImage(@Param('applicationId') id: string, @Param('pageId') paginaId: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await this.aplicacao(tx, s, id);
      if (!ehUuid(paginaId)) throw naoEncontrado('PaginaAplicacao', null);
      const p = (await this.paginas(tx, id)).find((x) => x.id === paginaId);
      if (!p) throw naoEncontrado('PaginaAplicacao', paginaId);
      // Sem reserva (DEC-112): a imagem só sai em identificacao_pendente até a revisão do IMP-003.
      if (a.estado !== 'identificacao_pendente') throw new ErroApi('ERR-018');
      const expira = somar(this.n.agora(), 5 * MINUTO); // DEC-034
      let regiao: unknown = null;
      if (p.numero_pagina === 1 && a.versao_id) {
        const m = await linha<{ r: unknown }>(tx, sql`SELECT mapa_layout -> 'assinatura' -> 'regiao' AS r FROM versao WHERE id = ${a.versao_id}`);
        regiao = m?.r ?? null;
      }
      await this.n.auditar(tx, s, 'VER_IMAGEM', 'PaginaAplicacao', p.id); // DEC-099
      return { url: await this.n.config.armazenamento.urlAssinada(p.chave_storage, expira), expira_em: expira.toISOString(), regiao_assinatura: regiao };
    });
  }
}
