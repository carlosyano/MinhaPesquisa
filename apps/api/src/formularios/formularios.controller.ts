// RF-004: formulários, versões, publicação e PDF (CA-001, CA-028, CA-036, TS-006; RN-017,
// RN-021, RN-042, RN-047; DEC-048, DEC-094 a DEC-097).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { NUCLEO } from '../auth/auth.controller.js';
import { etag, parametro, projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { ehUuid, Nucleo, type SessaoAtiva } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';
import {
  normalizarConteudo,
  pendenciasPublicacao,
  totalPaginas,
  type Pergunta,
  type PerguntaEntrada,
  type RegraEntrada,
} from '../regras/formularios.js';
import { gerarPdf, mapaLayout } from './pdf.js';

interface LinhaFormulario {
  id: string;
  projeto_id: string;
  nome: string;
  criado_em: Date;
}

interface LinhaVersao {
  id: string;
  formulario_id: string;
  numero: number;
  status: 'rascunho' | 'publicada';
  publicada_em: Date | null;
  criada_em: Date;
  qr_codigo: string | null;
  versao: number;
}

interface Conteudo {
  perguntas: PerguntaEntrada[];
  regras_salto: RegraEntrada[];
}

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Identificador opaco do QR: 128 bits aleatórios em base32 (26 caracteres), sem relação com IDs. */
export function novoCodigoQr(): string {
  const b = randomBytes(16);
  let bits = 0;
  let valor = 0;
  let s = '';
  for (const byte of b) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      s += ALFABETO_BASE32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) s += ALFABETO_BASE32[(valor << (5 - bits)) & 31];
  return s;
}

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

@Controller()
export class FormulariosController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private async formulario(tx: Executor, s: SessaoAtiva, id: string): Promise<LinhaFormulario> {
    if (!ehUuid(id)) throw naoEncontrado('Formulario', null);
    const f = await linha<LinhaFormulario>(tx, sql`SELECT id, projeto_id, nome, criado_em FROM formulario WHERE id = ${id}`);
    if (!f) throw naoEncontrado('Formulario', id);
    try {
      await projetoNoEscopo(tx, f.projeto_id);
    } catch {
      throw naoEncontrado('Formulario', id);
    }
    return f;
  }

  private async versao(tx: Executor, s: SessaoAtiva, formId: string, versaoId: string, bloquear = false) {
    const f = await this.formulario(tx, s, formId);
    if (!ehUuid(versaoId)) throw naoEncontrado('Versao', null);
    const v = await linha<LinhaVersao>(
      tx,
      bloquear
        ? sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao FROM versao
               WHERE id = ${versaoId} AND formulario_id = ${formId} FOR UPDATE`
        : sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao FROM versao
               WHERE id = ${versaoId} AND formulario_id = ${formId}`,
    );
    if (!v) throw naoEncontrado('Versao', versaoId);
    return { f, v };
  }

  private resumo(v: LinhaVersao) {
    return {
      id: v.id,
      formulario_id: v.formulario_id,
      numero: v.numero,
      status: v.status,
      publicada_em: iso(v.publicada_em),
      criada_em: new Date(v.criada_em).toISOString(),
    };
  }

  /** Conteúdo gravado da versão, no formato do contrato (VersionContent). */
  async conteudo(tx: Executor, versaoId: string): Promise<{ perguntas: Pergunta[]; regras_salto: RegraEntrada[] }> {
    const ps = await linhas<Omit<Pergunta, 'opcoes' | 'linhas'> & { id: string; valor_min: string | null; valor_max: string | null }>(
      tx,
      sql`SELECT id, codigo, tipo, enunciado, ordem, pagina, obrigatorio, campo_respondente, campo_aplicacao, sensibilidade,
                 valor_min, valor_max, unidade
            FROM pergunta WHERE versao_id = ${versaoId} ORDER BY ordem, codigo`,
    );
    const ops = await linhas<{ pergunta_id: string; codigo: string; rotulo: string; ordem: number }>(
      tx,
      sql`SELECT o.pergunta_id, o.codigo, o.rotulo, o.ordem FROM opcao o JOIN pergunta p ON p.id = o.pergunta_id
           WHERE p.versao_id = ${versaoId} ORDER BY o.ordem, o.codigo`,
    );
    const lms = await linhas<{ pergunta_id: string; codigo: string; rotulo: string; ordem: number }>(
      tx,
      sql`SELECT l.pergunta_id, l.codigo, l.rotulo, l.ordem FROM linha_matriz l JOIN pergunta p ON p.id = l.pergunta_id
           WHERE p.versao_id = ${versaoId} ORDER BY l.ordem, l.codigo`,
    );
    const regras = await linhas<RegraEntrada>(
      tx,
      sql`SELECT o.codigo AS pergunta_origem_codigo, d.codigo AS pergunta_destino_codigo, r.opcao_codigo
            FROM regra_salto r JOIN pergunta o ON o.id = r.pergunta_origem_id JOIN pergunta d ON d.id = r.pergunta_destino_id
           WHERE r.versao_id = ${versaoId} ORDER BY r.posicao`,
    );
    const perguntas = ps.map((p): Pergunta => {
      const opcoes = ops.filter((o) => o.pergunta_id === p.id).map(({ codigo, rotulo, ordem }) => ({ codigo, rotulo, ordem }));
      const linhasM = lms.filter((l) => l.pergunta_id === p.id).map(({ codigo, rotulo, ordem }) => ({ codigo, rotulo, ordem }));
      return {
        codigo: p.codigo,
        tipo: p.tipo,
        enunciado: p.enunciado,
        ordem: p.ordem,
        pagina: p.pagina,
        obrigatorio: p.obrigatorio,
        campo_respondente: p.campo_respondente,
        campo_aplicacao: p.campo_aplicacao,
        sensibilidade: p.sensibilidade,
        linhas: p.tipo === 'matriz' ? linhasM : null,
        valor_min: p.valor_min === null ? null : Number(p.valor_min),
        valor_max: p.valor_max === null ? null : Number(p.valor_max),
        unidade: p.unidade,
        opcoes: opcoes.length || ['escolha_unica', 'multipla_escolha', 'escala', 'matriz', 'sim_nao'].includes(p.tipo) ? opcoes : null,
      };
    });
    return { perguntas, regras_salto: regras };
  }

  /** Serialização do contrato: sem chaves nulas onde o schema não aceita nulo. */
  private paraContrato(c: { perguntas: Pergunta[]; regras_salto: RegraEntrada[] }) {
    return {
      perguntas: c.perguntas.map((p) => {
        const { linhas: lm, opcoes, ...resto } = p;
        return { ...resto, ...(lm ? { linhas: lm } : {}), ...(opcoes ? { opcoes } : {}) };
      }),
      regras_salto: c.regras_salto,
    };
  }

  private async corpoVersao(tx: Executor, v: LinhaVersao) {
    return { resumo: this.resumo(v), conteudo: this.paraContrato(await this.conteudo(tx, v.id)) };
  }

  private async gravarConteudo(tx: Executor, s: SessaoAtiva, versaoId: string, perguntas: Pergunta[], regras: RegraEntrada[]) {
    await tx.execute(sql`DELETE FROM regra_salto WHERE versao_id = ${versaoId}`);
    await tx.execute(sql`DELETE FROM pergunta WHERE versao_id = ${versaoId}`);
    const ids = new Map<string, string>();
    for (const p of perguntas) {
      const id = this.n.id();
      ids.set(p.codigo, id);
      await tx.execute(sql`
        INSERT INTO pergunta (id, tenant_id, versao_id, codigo, tipo, enunciado, ordem, pagina, obrigatorio,
                              campo_respondente, campo_aplicacao, sensibilidade, valor_min, valor_max, unidade)
        VALUES (${id}, ${s.tenantId}, ${versaoId}, ${p.codigo}, ${p.tipo}, ${p.enunciado}, ${p.ordem}, ${p.pagina},
                ${p.obrigatorio}, ${p.campo_respondente}, ${p.campo_aplicacao}, ${p.sensibilidade},
                ${p.valor_min}, ${p.valor_max}, ${p.unidade})`);
      for (const o of p.opcoes ?? []) {
        await tx.execute(sql`
          INSERT INTO opcao (id, tenant_id, pergunta_id, codigo, rotulo, ordem)
          VALUES (${this.n.id()}, ${s.tenantId}, ${id}, ${o.codigo}, ${o.rotulo}, ${o.ordem})`);
      }
      for (const l of p.linhas ?? []) {
        await tx.execute(sql`
          INSERT INTO linha_matriz (id, tenant_id, pergunta_id, codigo, rotulo, ordem)
          VALUES (${this.n.id()}, ${s.tenantId}, ${id}, ${l.codigo}, ${l.rotulo}, ${l.ordem})`);
      }
    }
    for (const [posicao, r] of regras.entries()) {
      await tx.execute(sql`
        INSERT INTO regra_salto (id, tenant_id, versao_id, pergunta_origem_id, pergunta_destino_id, opcao_codigo, posicao, criado_em)
        VALUES (${this.n.id()}, ${s.tenantId}, ${versaoId}, ${ids.get(r.pergunta_origem_codigo)}, ${ids.get(r.pergunta_destino_codigo)},
                ${r.opcao_codigo}, ${posicao + 1}, ${this.n.agora()})`);
    }
  }

  private async resumoFormulario(tx: Executor, f: LinhaFormulario) {
    const vs = await linhas<LinhaVersao>(
      tx,
      sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao FROM versao
           WHERE formulario_id = ${f.id} ORDER BY numero`,
    );
    return { id: f.id, nome: f.nome, projeto_id: f.projeto_id, criado_em: new Date(f.criado_em).toISOString(), versoes: vs.map((v) => this.resumo(v)) };
  }

  // ───────────────────────────── formulários ─────────────────────────────

  @Get('projects/:projectId/forms')
  async listForms(@Param('projectId') projetoId: string, @Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    const { pagina, limite } = paginacao(q);
    return this.n.comAtor(s, async (tx) => {
      await projetoNoEscopo(tx, projetoId);
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM formulario WHERE projeto_id = ${projetoId}`))!.n;
      const fs = await linhas<LinhaFormulario>(
        tx,
        sql`SELECT id, projeto_id, nome, criado_em FROM formulario WHERE projeto_id = ${projetoId}
             ORDER BY criado_em, id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      );
      const itens = [];
      for (const f of fs) itens.push(await this.resumoFormulario(tx, f));
      return { itens, meta: { pagina, limite, total } };
    });
  }

  @Post('forms')
  @HttpCode(201)
  async createForm(
    @Body() corpo: { nome: string; projeto_id: string },
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('createForm', corpo);
    return this.n.comAtor(s, async (tx) => {
      await projetoNoEscopo(tx, corpo.projeto_id);
      const feito = await this.n.idempotente(tx, s, 'createForm', chave, corpo, async () => {
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO formulario (id, tenant_id, projeto_id, nome, criado_em)
          VALUES (${id}, ${s.tenantId}, ${corpo.projeto_id}, ${corpo.nome}, ${this.n.agora()})`);
        const versaoId = this.n.id();
        await tx.execute(sql`
          INSERT INTO versao (id, tenant_id, formulario_id, numero, status, criada_em)
          VALUES (${versaoId}, ${s.tenantId}, ${id}, 1, 'rascunho', ${this.n.agora()})`);
        await this.n.auditar(tx, s, 'CRIAR_FORMULARIO', 'Formulario', id);
        return { status: 201, recursoId: id };
      });
      return this.resumoFormulario(tx, await this.formulario(tx, s, feito.recursoId));
    });
  }

  @Post('forms/:formId/versions')
  @HttpCode(201)
  async createVersion(
    @Param('formId') formId: string,
    @Body() corpo: { copiar_de_versao_id?: string } | undefined,
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const c = corpo ?? {};
    const r = await this.n.comAtor(s, async (tx) => {
      await this.formulario(tx, s, formId);
      this.validar('createVersion', c);
      const feito = await this.n.idempotente(tx, s, 'createVersion', chave, { formId, ...c }, async () => {
        let origem: { perguntas: Pergunta[]; regras_salto: RegraEntrada[] } | null = null;
        if (c.copiar_de_versao_id) origem = await this.conteudo(tx, (await this.versao(tx, s, formId, c.copiar_de_versao_id)).v.id);
        await tx.execute(sql`SELECT id FROM formulario WHERE id = ${formId} FOR UPDATE`);
        const numero = (await linha<{ n: number }>(tx, sql`SELECT coalesce(max(numero), 0)::int + 1 AS n FROM versao WHERE formulario_id = ${formId}`))!.n;
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO versao (id, tenant_id, formulario_id, numero, status, criada_em)
          VALUES (${id}, ${s.tenantId}, ${formId}, ${numero}, 'rascunho', ${this.n.agora()})`);
        if (origem) await this.gravarConteudo(tx, s, id, origem.perguntas, origem.regras_salto);
        await this.n.auditar(tx, s, 'CRIAR_VERSAO', 'Versao', id, { numero });
        return { status: 201, recursoId: id };
      });
      const { v } = await this.versao(tx, s, formId, feito.recursoId);
      return { v, corpo: await this.corpoVersao(tx, v) };
    });
    res.header('ETag', etag(r.v.versao));
    return r.corpo;
  }

  @Get('forms/:formId/versions/:versionId')
  async getVersion(@Param('formId') formId: string, @Param('versionId') versaoId: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const { v } = await this.versao(tx, s, formId, versaoId);
      return { v, corpo: await this.corpoVersao(tx, v) };
    });
    res.header('ETag', etag(r.v.versao));
    return r.corpo;
  }

  @Put('forms/:formId/versions/:versionId')
  async updateVersion(
    @Param('formId') formId: string,
    @Param('versionId') versaoId: string,
    @Body() corpo: Conteudo,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const { v } = await this.versao(tx, s, formId, versaoId, true);
      if (v.status === 'publicada') throw new ErroApi('ERR-009');
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      if (ifMatch !== etag(v.versao)) throw new ErroApi('ERR-017');
      this.validar('updateVersion', corpo);
      const perguntas = normalizarConteudo(corpo.perguntas, corpo.regras_salto);
      await this.gravarConteudo(tx, s, versaoId, perguntas, corpo.regras_salto);
      await tx.execute(sql`UPDATE versao SET versao = versao + 1 WHERE id = ${versaoId}`);
      await this.n.auditar(tx, s, 'ALTERAR_VERSAO', 'Versao', versaoId);
      const { v: nova } = await this.versao(tx, s, formId, versaoId);
      return { v: nova, corpo: await this.corpoVersao(tx, nova) };
    });
    res.header('ETag', etag(r.v.versao));
    return r.corpo;
  }

  @Post('forms/:formId/versions/:versionId/publish')
  @HttpCode(200)
  async publishVersion(@Param('formId') formId: string, @Param('versionId') versaoId: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const { v } = await this.versao(tx, s, formId, versaoId, true);
      if (v.status === 'publicada') throw new ErroApi('ERR-009');
      const c = await this.conteudo(tx, versaoId);
      const faltam = pendenciasPublicacao(c.perguntas);
      if (faltam.length) throw new ErroApi('ERR-036', { campos: faltam, substituir: faltam.join(', ') });
      const mapa = await mapaLayout({ totalPaginas: totalPaginas(c.perguntas), perguntas: c.perguntas, regras: c.regras_salto });
      await tx.execute(sql`
        UPDATE versao SET status = 'publicada', publicada_em = ${this.n.agora()}, qr_codigo = ${novoCodigoQr()},
                          mapa_layout = ${JSON.stringify(mapa)}::jsonb, versao = versao + 1
         WHERE id = ${versaoId}`);
      await this.n.auditar(tx, s, 'PUBLICAR_VERSAO', 'Versao', versaoId);
      const { v: nova } = await this.versao(tx, s, formId, versaoId);
      return this.corpoVersao(tx, nova);
    });
  }

  @Get('forms/:formId/versions/:versionId/pdf')
  async generatePdf(@Param('formId') formId: string, @Param('versionId') versaoId: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const dados = await this.n.comAtor(s, async (tx) => {
      const { f, v } = await this.versao(tx, s, formId, versaoId);
      if (v.status !== 'publicada' || !v.qr_codigo) throw new ErroApi('ERR-018');
      const c = await this.conteudo(tx, versaoId);
      return {
        nomeFormulario: f.nome,
        numeroVersao: v.numero,
        qrCodigo: v.qr_codigo,
        totalPaginas: totalPaginas(c.perguntas),
        perguntas: c.perguntas,
        regras: c.regras_salto,
        termo: await parametro(tx, 'termo_consentimento', s.tenantId, f.projeto_id),
      };
    });
    const pdf = await gerarPdf(dados);
    res.header('Content-Type', 'application/pdf');
    res.header('Content-Disposition', 'attachment; filename="formulario.pdf"');
    return pdf;
  }
}
