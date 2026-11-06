// RF-006 e RF-013: upload, montagem da aplicação, identificação manual e imagem da página
// (CA-003, CA-004, CA-013, CA-027, CA-029, CA-039, CA-040, CA-052, CA-057; RN-029, RN-040, RN-052;
// DEC-029, DEC-034, DEC-042, DEC-048, DEC-098 a DEC-100, DEC-169, DEC-179 a DEC-187, DEC-192; FL-001).
//
// O envio inteiro é validado e processado em memória antes de gravar qualquer coisa: um
// arquivo recusado recusa o envio e nada é gravado (CA-029).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import type { Multipart } from '@fastify/multipart';
import { createHash } from 'node:crypto';
import { NUCLEO } from '../auth/auth.controller.js';
import { parametro, projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao } from '../http.js';
import { chaveImagem } from '../infra/armazenamento.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { analisarPagina, contarPaginasPdf, normalizarImagem, renderizarPdf } from '../infra/imagens.js';
import { MINUTO, somar } from '../infra/relogio.js';
import { aplicacaoNoEscopo, corpoAplicacao, ESTADOS_REVISAO, hoje, iniciarLeitura, type LinhaAplicacao } from '../leitura/dominio.js';
import { ehUuid, Nucleo, type SessaoAtiva } from '../nucleo.js';
import { anexarAssinatura } from '../revisao/respondentes.js';
import {
  classificarCriacao,
  LIMITE_BYTES,
  LIMITE_PAGINAS,
  lerConteudoQr,
  MOTIVO,
  paginasCompletas,
  tipoPorConteudo,
  type Criacao,
  type Escolhida,
  type VersaoDoQr,
} from '../regras/upload.js';

interface PaginaProcessada {
  jpeg: Buffer;
  sha256: Buffer;
  /** Só o QR no formato do MinhaPesquisa (DEC-187); outro QR conta como ausente. */
  qr: string | null;
  /** QR de outro formato na folha: auditado sem o conteúdo (DEC-187). */
  qrOutro: boolean;
  registroOk: boolean;
}

interface LinhaPagina {
  id: string;
  tipo: 'formulario' | 'assinatura';
  numero_pagina: number | null;
  qr_codigo: string | null;
  registro_ok: boolean;
  chave_storage: string;
  pagina_localizada: number | null;
  confianca_localizacao: string | null;
  localizada_em: Date | null;
  regiao_assinatura: unknown;
}

interface Identificar {
  versao_id: string;
  paginas: { imagem_id: string; numero_pagina?: number; descartar?: boolean }[];
}

/** Versão, data e local do envio (UploadRequest; DEC-169, DEC-179). */
interface Envio {
  versaoId?: string;
  data?: string;
  local?: string;
}

const CAMPOS_ENVIO = ['versao_id', 'data_aplicacao', 'local_aplicacao'];

const recusa = (motivo: string) => new ErroApi('ERR-029', { motivo, substituir: motivo });

type ReqMultipart = Requisicao & { isMultipart(): boolean; parts(): AsyncIterableIterator<Multipart> };

/** O que um envio multipart pode ter: o nome do campo dos arquivos e os campos de texto aceitos. */
interface FormatoEnvio {
  arquivos: string;
  textos?: string[];
  maxArquivos?: number;
}

const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;

@Controller()
export class UploadController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  // ───────────────────────────── processamento dos arquivos ─────────────────────────────

  /**
   * Lê e valida cada arquivo na ordem da DEC-042, parando no primeiro motivo: (1) tamanho,
   * durante o recebimento; (2) antimalware; (3) tipo pelo conteúdo; (4) páginas. Depois
   * normaliza (sem metadados) e analisa cada página.
   */
  private async processarArquivos(req: Requisicao, formato: FormatoEnvio = { arquivos: 'arquivos' }, textos: Record<string, string> = {}): Promise<PaginaProcessada[]> {
    const r = req as ReqMultipart;
    if (typeof r.isMultipart !== 'function' || !r.isMultipart()) throw new ErroApi('ERR-001', { campos: [formato.arquivos] });
    const paginas: PaginaProcessada[] = [];
    let arquivos = 0;
    try {
      for await (const parte of r.parts()) {
        if (parte.type === 'field') {
          if (!formato.textos?.includes(parte.fieldname) || typeof parte.value !== 'string') throw new ErroApi('ERR-001', { campos: [parte.fieldname] });
          textos[parte.fieldname] = parte.value;
          continue;
        }
        if (parte.fieldname !== formato.arquivos) throw new ErroApi('ERR-001', { campos: [parte.fieldname] });
        arquivos++;
        if (formato.maxArquivos && arquivos > formato.maxArquivos) throw new ErroApi('ERR-001', { campos: [formato.arquivos] });
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
          const doSistema = a.qr !== null && lerConteudoQr(a.qr) !== null;
          paginas.push({
            jpeg,
            sha256: createHash('sha256').update(jpeg).digest(),
            qr: doSistema ? a.qr : null,
            qrOutro: a.qr !== null && !doSistema,
            registroOk: a.registroOk,
          });
        }
      }
    } catch (e) {
      const codigo = (e as { code?: string }).code;
      if (codigo === 'FST_REQ_FILE_TOO_LARGE') throw recusa(MOTIVO.tamanho);
      if (codigo === 'FST_FILES_LIMIT' || codigo === 'FST_FIELDS_LIMIT' || codigo === 'FST_PARTS_LIMIT') throw new ErroApi('ERR-001', { campos: [formato.arquivos] });
      throw e;
    }
    if (arquivos === 0) throw new ErroApi('ERR-001', { campos: [formato.arquivos] });
    return paginas;
  }

  /** Versão, data e local do envio; data futura ou fora do formato → ERR-001, antes de gravar (DEC-182). */
  private lerEnvio(textos: Record<string, string>): Envio {
    const campos: string[] = [];
    const versaoId = textos.versao_id;
    if (versaoId !== undefined && !ehUuid(versaoId)) campos.push('versao_id');
    const data = textos.data_aplicacao;
    if (data !== undefined && (!dataValida(data) || data > hoje(this.n.agora()))) campos.push('data_aplicacao');
    const local = textos.local_aplicacao;
    if (local !== undefined && (local.trim().length < 1 || local.length > 200)) campos.push('local_aplicacao');
    if (campos.length) throw new ErroApi('ERR-001', { campos });
    return { versaoId, data, local };
  }

  // ───────────────────────────── consultas ─────────────────────────────

  private async aplicacao(tx: Executor, _s: SessaoAtiva, id: string, bloquear = false): Promise<LinhaAplicacao> {
    return aplicacaoNoEscopo(tx, id, bloquear);
  }

  private async paginas(tx: Executor, aplicacaoId: string): Promise<LinhaPagina[]> {
    return linhas<LinhaPagina>(
      tx,
      sql`SELECT id, tipo, numero_pagina, qr_codigo, registro_ok, chave_storage, pagina_localizada,
                 confianca_localizacao::text AS confianca_localizacao, localizada_em, regiao_assinatura
            FROM pagina_aplicacao WHERE aplicacao_id = ${aplicacaoId} AND expurgada_em IS NULL ORDER BY ordem_envio, id`,
    );
  }

  /** Versões publicadas do tenant pelos códigos dos QR (a RLS esconde as de outros tenants). */
  private async resolverQrs(tx: Executor, conteudos: (string | null)[]): Promise<Map<string, VersaoDoQr>> {
    const codigos = [...new Set(conteudos.map((c) => (c ? lerConteudoQr(c)?.codigo : undefined)).filter((c): c is string => !!c))];
    const mapa = new Map<string, VersaoDoQr & { qrCodigo: string }>();
    if (!codigos.length) return mapa;
    const vs = await linhas<{ qr_codigo: string; id: string; projeto_id: string; total: number; papel_antigo: boolean }>(
      tx,
      sql`SELECT v.qr_codigo, v.id, f.projeto_id, v.total_paginas AS total, v.papel_antigo
            FROM versao v JOIN formulario f ON f.id = v.formulario_id
           WHERE v.status = 'publicada' AND v.qr_codigo IN (SELECT jsonb_array_elements_text(${JSON.stringify(codigos)}::jsonb))`,
    );
    for (const v of vs) mapa.set(v.qr_codigo, { versaoId: v.id, projetoId: v.projeto_id, totalPaginas: v.total, papelAntigo: v.papel_antigo, qrCodigo: v.qr_codigo });
    return mapa;
  }

  /** Versão escolhida no envio, se publicada no tenant (DEC-169); inválida = undefined. */
  private async resolverEscolhida(tx: Executor, versaoId: string | null | undefined): Promise<Escolhida> {
    if (!versaoId) return { informada: false };
    const v = await linha<{ id: string; projeto_id: string; total: number; papel_antigo: boolean }>(
      tx,
      sql`SELECT v.id, f.projeto_id, v.total_paginas AS total, v.papel_antigo
            FROM versao v JOIN formulario f ON f.id = v.formulario_id WHERE v.id = ${versaoId} AND v.status = 'publicada'`,
    );
    return { informada: true, versao: v ? { versaoId: v.id, projetoId: v.projeto_id, totalPaginas: v.total, papelAntigo: v.papel_antigo } : undefined };
  }

  private corpoPagina(p: LinhaPagina) {
    return { imagem_id: p.id, numero_pagina: p.numero_pagina, tipo: p.tipo, registro_ok: p.registro_ok };
  }

  private corpoAplicacao(tx: Executor, a: LinhaAplicacao) {
    return corpoAplicacao(this.n, tx, a);
  }

  /** Página do QR da folha quando o QR é da versão da aplicação; senão a página vem da localização. */
  private paginaDoQr(qr: string | null, resolvidas: Map<string, VersaoDoQr>, versaoId: string | null): number | null {
    const lido = qr ? lerConteudoQr(qr) : null;
    return lido && versaoId && resolvidas.get(lido.codigo)?.versaoId === versaoId ? lido.pagina : null;
  }

  /** Grava as imagens; se algo falhar depois, o chamador apaga as que gravou. */
  private async gravarPaginas(tx: Executor, s: SessaoAtiva, aplicacaoId: string, paginas: PaginaProcessada[], resolvidas: Map<string, VersaoDoQr>, versaoId: string | null, gravadas: string[]): Promise<void> {
    const ordem = (await linha<{ n: number }>(tx, sql`SELECT coalesce(max(ordem_envio), 0)::int AS n FROM pagina_aplicacao WHERE aplicacao_id = ${aplicacaoId}`))!.n;
    for (const [i, p] of paginas.entries()) {
      const id = this.n.id();
      const chave = chaveImagem(s.tenantId, aplicacaoId, id);
      await this.n.config.armazenamento.gravar(chave, p.jpeg, 'image/jpeg');
      gravadas.push(chave);
      await tx.execute(sql`
        INSERT INTO pagina_aplicacao (id, tenant_id, aplicacao_id, tipo, numero_pagina, ordem_envio, qr_codigo, chave_storage,
                                      sha256, registro_ok, criado_em)
        VALUES (${id}, ${s.tenantId}, ${aplicacaoId}, 'formulario', ${this.paginaDoQr(p.qr, resolvidas, versaoId)}, ${ordem + i + 1},
                ${p.qr?.slice(0, 200) ?? null}, ${chave}, ${p.sha256}, ${p.registroOk}, ${this.n.agora()})`);
    }
  }

  /**
   * Aplica o resultado da tabela de criação: estado, aviso, versão, origem, outbox e auditoria. Versão
   * nova refaz a localização de todas as folhas (RN-052, item 3a).
   */
  private async aplicarEstado(tx: Executor, s: SessaoAtiva, aplicacaoId: string, c: Criacao, anterior: string | null = null): Promise<void> {
    await tx.execute(sql`
      UPDATE aplicacao SET estado = ${c.estado}, aviso = ${c.aviso}, versao_id = ${c.versaoId}, origem_qr = ${c.origemQr}, versao = versao + 1
       WHERE id = ${aplicacaoId}`);
    if (c.versaoId !== anterior) {
      await tx.execute(sql`
        UPDATE pagina_aplicacao SET localizada_em = NULL, pagina_localizada = NULL, confianca_localizacao = NULL, regioes = NULL, regiao_assinatura = NULL
         WHERE aplicacao_id = ${aplicacaoId} AND tipo = 'formulario'`);
    }
    // Pronta para ler: em_leitura, ou aguardando_cota com aviso ERR-003 se o teto do mês foi atingido.
    if (c.estado === 'em_leitura') await iniciarLeitura(this.n, tx, s.tenantId, aplicacaoId);
    if (c.aviso === 'ERR-039') await this.n.auditar(tx, s, 'QR_FORA_DE_CONTEXTO', 'Aplicacao', aplicacaoId); // CA-039, DEC-100
  }

  /** O padrão de data e local do projeto muda no próprio envio, só com o que vier (DEC-192). */
  private async atualizarPadrao(tx: Executor, projetoId: string, e: Envio): Promise<void> {
    if (e.data === undefined && e.local === undefined) return;
    await tx.execute(sql`
      UPDATE projeto SET padrao_data_aplicacao = coalesce(${e.data ?? null}::date, padrao_data_aplicacao),
                         padrao_local_aplicacao = coalesce(${this.n.cifrar(e.local ?? null)}, padrao_local_aplicacao)
       WHERE id = ${projetoId}`);
  }

  /** Presença de QR de outro formato, sem o conteúdo (DEC-187). */
  private async auditarQrOutro(tx: Executor, s: SessaoAtiva, aplicacaoId: string, paginas: PaginaProcessada[]): Promise<void> {
    const n = paginas.filter((p) => p.qrOutro).length;
    if (n) await this.n.auditar(tx, s, 'QR_OUTRO_FORMATO', 'Aplicacao', aplicacaoId, { folhas: n });
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
    const textos: Record<string, string> = {};
    const paginas = await this.processarArquivos(req, { arquivos: 'arquivos', textos: CAMPOS_ENVIO }, textos);
    const envio = this.lerEnvio(textos);

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const p = await projetoNoEscopo(tx, projetoId, true);
        if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] });
        const impressao = { projetoId, arquivos: paginas.map((x) => x.sha256.toString('hex')), ...envio };
        const feito = await this.n.idempotente(tx, s, 'uploadImages', chave, impressao, async () => {
          const id = this.n.id();
          // Data e local ficam gravados até a localização confirmar a versão e as páginas (DEC-186).
          await tx.execute(sql`
            INSERT INTO aplicacao (id, tenant_id, projeto_id, estado, criada_em, criada_por, data_aplicacao, local_aplicacao)
            VALUES (${id}, ${s.tenantId}, ${projetoId}, 'identificacao_pendente', ${this.n.agora()}, ${s.usuarioId},
                    ${envio.data ?? null}::date, ${this.n.cifrar(envio.local ?? null)})`);
          const resolvidas = await this.resolverQrs(tx, paginas.map((x) => x.qr));
          const c = classificarCriacao(paginas, projetoId, (codigo) => resolvidas.get(codigo), await this.resolverEscolhida(tx, envio.versaoId));
          await this.gravarPaginas(tx, s, id, paginas, resolvidas, c.versaoId, gravadas);
          await this.aplicarEstado(tx, s, id, c);
          await this.atualizarPadrao(tx, projetoId, envio);
          await this.auditarQrOutro(tx, s, id, paginas);
          await this.n.auditar(tx, s, 'UPLOAD_APLICACAO', 'Aplicacao', id, { paginas: paginas.length, estado: c.estado, origem_qr: c.origemQr });
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
    const textos: Record<string, string> = {};
    const novas = await this.processarArquivos(req, { arquivos: 'arquivos', textos: CAMPOS_ENVIO }, textos);
    const envio = this.lerEnvio(textos);

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const a = await this.aplicacao(tx, s, id, true);
        if (a.estado !== 'identificacao_pendente') throw new ErroApi('ERR-018');
        const impressao = { aplicacaoId: id, arquivos: novas.map((x) => x.sha256.toString('hex')), ...envio };
        await this.n.idempotente(tx, s, 'addApplicationPages', chave, impressao, async () => {
          const existentes = (await this.paginas(tx, id)).filter((p) => p.tipo === 'formulario');
          const todas = [...existentes.map((p) => ({ qr: p.qr_codigo })), ...novas];
          const resolvidas = await this.resolverQrs(tx, todas.map((x) => x.qr));
          // A versão do pedido substitui a escolhida no envio (DEC-169); data e local, só o que vier (DEC-185).
          const c = classificarCriacao(todas, a.projeto_id, (codigo) => resolvidas.get(codigo), await this.resolverEscolhida(tx, envio.versaoId ?? a.versao_id));
          await this.gravarPaginas(tx, s, id, novas, resolvidas, c.versaoId, gravadas);
          // Páginas já gravadas ganham o número quando o QR é da versão da aplicação.
          for (const p of existentes) {
            await tx.execute(sql`UPDATE pagina_aplicacao SET numero_pagina = ${this.paginaDoQr(p.qr_codigo, resolvidas, c.versaoId)} WHERE id = ${p.id}`);
          }
          await tx.execute(sql`
            UPDATE aplicacao SET data_aplicacao = coalesce(${envio.data ?? null}::date, data_aplicacao),
                                 local_aplicacao = coalesce(${this.n.cifrar(envio.local ?? null)}, local_aplicacao)
             WHERE id = ${id}`);
          await this.aplicarEstado(tx, s, id, c, a.versao_id);
          await this.atualizarPadrao(tx, a.projeto_id, envio);
          await this.auditarQrOutro(tx, s, id, novas);
          await this.n.auditar(tx, s, 'ACRESCENTAR_PAGINAS', 'Aplicacao', id, { paginas: novas.length, estado: c.estado, origem_qr: c.origemQr });
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
          ? await linha<{ projeto_id: string; status: string; total: number; papel_antigo: boolean; qr_codigo: string | null }>(
              tx,
              sql`SELECT f.projeto_id, v.status, v.total_paginas AS total, v.papel_antigo, v.qr_codigo
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
        // A conferência com o QR considera só as folhas mantidas (FL-001).
        const qrs = imagens.filter((i) => mantidas.some((m) => m.imagem_id === i.id) && i.qr_codigo !== null);
        const resolvidas = await this.resolverQrs(tx, qrs.map((i) => i.qr_codigo));
        const validos = qrs.flatMap((i) => {
          const versao = resolvidas.get(lerConteudoQr(i.qr_codigo!)!.codigo);
          return versao && versao.projetoId === a.projeto_id ? [versao] : [];
        });
        // Versão diferente da do QR legível e válido (DEC-180); papel antigo com QR legível (DEC-184).
        if (validos.some((x) => x.versaoId !== corpo.versao_id) || (v.papel_antigo && qrs.length > 0)) throw foraDeContexto;
        if (!coerente || mantidas.some((p) => p.numero_pagina === undefined) || !paginasCompletas(mantidas.map((p) => p.numero_pagina!), v.total)) {
          throw new ErroApi('ERR-004');
        }

        // A página informada prevalece; só a folha cuja página mudou ou não tinha sido reconhecida é
        // localizada de novo, só para as regiões (RN-052, item 3a). Versão nova: todas (aplicarEstado).
        const limite = Number(await parametro(tx, 'limite_confianca_localizacao', s.tenantId, a.projeto_id));
        for (const p of corpo.paginas) {
          const img = imagens.find((i) => i.id === p.imagem_id)!;
          if (p.descartar) {
            await tx.execute(sql`DELETE FROM pagina_aplicacao WHERE id = ${p.imagem_id}`);
            removidas.push(img.chave_storage);
            continue;
          }
          const reconhecida = img.pagina_localizada === p.numero_pagina && Number(img.confianca_localizacao ?? 0) >= limite;
          const informadaAntes = a.paginas_informadas && img.numero_pagina === p.numero_pagina;
          const manter = img.localizada_em !== null && (reconhecida || informadaAntes);
          await tx.execute(sql`
            UPDATE pagina_aplicacao SET numero_pagina = ${p.numero_pagina!},
                   localizada_em = CASE WHEN ${manter} THEN localizada_em END,
                   regioes = CASE WHEN ${manter} THEN regioes END
             WHERE id = ${p.imagem_id}`);
        }
        await tx.execute(sql`UPDATE aplicacao SET paginas_informadas = true WHERE id = ${id}`);
        const origemQr = validos.length > 0;
        await this.aplicarEstado(tx, s, id, { estado: 'em_leitura', aviso: null, versaoId: corpo.versao_id, origemQr }, a.versao_id);
        await this.n.auditar(tx, s, 'IDENTIFICAR_APLICACAO', 'Aplicacao', id, { descartadas: removidas.length, origem_qr: origemQr });
        return { status: 200, recursoId: id };
      });
      return this.corpoAplicacao(tx, await this.aplicacao(tx, s, id));
    });
    await this.apagarObjetos(removidas);
    return r;
  }

  // ───────────────────────────── attachSignaturePage ─────────────────────────────

  /**
   * Página 1 assinada de uma aplicação em sem_assinatura (CA-044, RN-044): com QR legível, confere a
   * versão e a página; sem ele, vale a confirmação da usuária, sem chamada à IA (DEC-183). Grava a
   * imagem como `assinatura` (a página 1 original fica) e conclui sem reler.
   */
  @Post('applications/:applicationId/signature')
  @HttpCode(200)
  async attachSignaturePage(@Param('applicationId') id: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    if (!chave || chave.length < 16 || chave.length > 64) throw new ErroApi('ERR-001', { campos: ['Idempotency-Key'] });
    await this.n.comAtor(s, async (tx) => {
      const a = await this.aplicacao(tx, s, id);
      if (a.estado !== 'sem_assinatura') throw new ErroApi('ERR-018');
    });
    const textos: Record<string, string> = {};
    const paginas = await this.processarArquivos(req, { arquivos: 'arquivo', textos: ['assinatura'], maxArquivos: 1 }, textos);
    if (textos.assinatura !== 'presente') throw new ErroApi('ERR-001', { campos: ['assinatura'] });
    if (paginas.length !== 1) throw new ErroApi('ERR-004');
    const [p] = paginas;

    const gravadas: string[] = [];
    try {
      return await this.n.comAtor(s, async (tx) => {
        const a = await this.aplicacao(tx, s, id, true);
        await this.n.idempotente(tx, s, 'attachSignaturePage', chave, { id, arquivo: p.sha256.toString('hex') }, async () => {
          if (a.estado !== 'sem_assinatura') throw new ErroApi('ERR-018');
          const v = await linha<{ qr_codigo: string }>(tx, sql`SELECT qr_codigo FROM versao WHERE id = ${a.versao_id}`);
          const lido = p.qr ? lerConteudoQr(p.qr) : null;
          if (!v || (lido && (lido.codigo !== v.qr_codigo || lido.pagina !== 1))) throw new ErroApi('ERR-004');
          const imagemId = this.n.id();
          const chaveObjeto = chaveImagem(s.tenantId, id, imagemId);
          await this.n.config.armazenamento.gravar(chaveObjeto, p.jpeg, 'image/jpeg');
          gravadas.push(chaveObjeto);
          const ordem = (await linha<{ n: number }>(tx, sql`SELECT coalesce(max(ordem_envio), 0)::int AS n FROM pagina_aplicacao WHERE aplicacao_id = ${id}`))!.n;
          await tx.execute(sql`
            INSERT INTO pagina_aplicacao (id, tenant_id, aplicacao_id, tipo, numero_pagina, ordem_envio, qr_codigo, chave_storage,
                                          sha256, registro_ok, criado_em)
            VALUES (${imagemId}, ${s.tenantId}, ${id}, 'assinatura', 1, ${ordem + 1}, ${p.qr?.slice(0, 200) ?? null}, ${chaveObjeto},
                    ${p.sha256}, ${p.registroOk}, ${this.n.agora()})`);
          await anexarAssinatura(this.n, tx, s, a);
          return { status: 200, recursoId: id };
        });
        return this.corpoAplicacao(tx, await this.aplicacao(tx, s, id));
      });
    } catch (e) {
      await this.apagarObjetos(gravadas);
      throw e;
    }
  }

  // ───────────────────────────── getPageImage ─────────────────────────────

  @Get('applications/:applicationId/pages/:pageId/image')
  async getPageImage(@Param('applicationId') id: string, @Param('pageId') paginaId: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await this.aplicacao(tx, s, id);
      // Sem reserva (DEC-112): identificação e estados de revisão (contrato, getPageImage).
      if (a.estado !== 'identificacao_pendente' && !ESTADOS_REVISAO.has(a.estado)) throw new ErroApi('ERR-018');
      if (!ehUuid(paginaId)) throw naoEncontrado('PaginaAplicacao', null);
      const todas = await this.paginas(tx, id);
      const p = todas.find((x) => x.id === paginaId);
      if (!p) throw naoEncontrado('PaginaAplicacao', paginaId);
      const expira = somar(this.n.agora(), 5 * MINUTO); // DEC-034
      // A região da assinatura vem da localização da página 1, nula quando não achada (DEC-174 (5)).
      let regiao: unknown = null;
      if (p.numero_pagina === 1) {
        const formulario = p.tipo === 'formulario' ? p : todas.find((x) => x.tipo === 'formulario' && x.numero_pagina === 1);
        regiao = formulario?.regiao_assinatura ?? null;
      }
      await this.n.auditar(tx, s, 'VER_IMAGEM', 'PaginaAplicacao', p.id); // DEC-099
      return { url: await this.n.config.armazenamento.urlAssinada(p.chave_storage, expira), expira_em: expira.toISOString(), regiao_assinatura: regiao };
    });
  }
}
