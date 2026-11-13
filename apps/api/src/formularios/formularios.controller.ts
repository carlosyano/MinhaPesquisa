// RF-004: formulários, versões, publicação e PDF (CA-001, CA-028, CA-036, TS-006; RN-017,
// RN-021, RN-042, RN-047; DEC-048, DEC-094 a DEC-097). Desde o IMP-006, os 5 campos da RN-050 em
// todo rascunho (CA-048, DEC-135, DEC-145, DEC-147), a altura das perguntas (DEC-143) e a recusa
// de formulário novo em projeto arquivado (DEC-146).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { NUCLEO } from '../auth/auth.controller.js';
import { etag, parametro, projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { ehUuid, Nucleo, type SessaoAtiva } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';
import { cincoCampos, padronizarCopia, reaplicarCampos } from '../regras/campos-padrao.js';
import {
  normalizarConteudo,
  pendenciasPublicacao,
  totalPaginas,
  type Pergunta,
  type PerguntaEntrada,
  type RegraEntrada,
} from '../regras/formularios.js';
import { validarPapelAntigo } from '../regras/papel-antigo.js';
import { criarFormularioRascunho, gravarConteudo, lerConteudo } from './conteudo.js';
import { fonteDeMedida, naoCabem } from './layout.js';
import { gerarPdf, mapaLayout } from './pdf.js';

interface LinhaFormulario {
  id: string;
  codigo: number;
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
  papel_antigo: boolean;
  total_paginas: number | null;
}

interface Conteudo {
  perguntas: PerguntaEntrada[];
  regras_salto: RegraEntrada[];
  papel_antigo?: boolean;
  total_paginas?: number | null;
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

/** Pergunta gravada como entrada das regras de conteúdo (sem os nulos do formato de leitura). */
const entrada = (p: Pergunta): PerguntaEntrada => ({ ...p, linhas: p.linhas ?? undefined, opcoes: p.opcoes ?? undefined });

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
    const f = await linha<LinhaFormulario>(tx, sql`SELECT id, codigo, projeto_id, nome, criado_em FROM formulario WHERE id = ${id}`);
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
        ? sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao, papel_antigo, total_paginas FROM versao
               WHERE id = ${versaoId} AND formulario_id = ${formId} FOR UPDATE`
        : sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao, papel_antigo, total_paginas FROM versao
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
      papel_antigo: v.papel_antigo,
      criada_em: new Date(v.criada_em).toISOString(),
    };
  }

  /** Conteúdo gravado da versão, no formato do contrato (VersionContent). */
  conteudo(tx: Executor, versaoId: string): Promise<{ perguntas: Pergunta[]; regras_salto: RegraEntrada[] }> {
    return lerConteudo(tx, versaoId);
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
    return {
      resumo: this.resumo(v),
      // `total_paginas` só no papel antigo (VersionContent); na oficial é sempre a maior página.
      conteudo: { ...this.paraContrato(await this.conteudo(tx, v.id)), papel_antigo: v.papel_antigo, total_paginas: v.papel_antigo ? v.total_paginas : null },
    };
  }

  private async gravarConteudo(tx: Executor, s: SessaoAtiva, versaoId: string, perguntas: Pergunta[], regras: RegraEntrada[]) {
    await gravarConteudo(this.n, tx, s.tenantId, versaoId, perguntas, regras);
  }

  private async resumoFormulario(tx: Executor, f: LinhaFormulario) {
    const vs = await linhas<LinhaVersao>(
      tx,
      sql`SELECT id, formulario_id, numero, status, publicada_em, criada_em, qr_codigo, versao, papel_antigo, total_paginas FROM versao
           WHERE formulario_id = ${f.id} ORDER BY numero`,
    );
    return { id: f.id, codigo: String(f.codigo).padStart(3, '0'), nome: f.nome, projeto_id: f.projeto_id, criado_em: new Date(f.criado_em).toISOString(), versoes: vs.map((v) => this.resumo(v)) };
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
        sql`SELECT id, codigo, projeto_id, nome, criado_em FROM formulario WHERE projeto_id = ${projetoId}
             ORDER BY criado_em DESC, id DESC LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, // mais recente primeiro (DEC-150)
      );
      const itens = [];
      for (const f of fs) itens.push(await this.resumoFormulario(tx, f));
      return { itens, meta: { pagina, limite, total } };
    });
  }

  @Post('forms')
  @HttpCode(201)
  async createForm(
    @Body() corpo: { nome: string; projeto_id: string; papel_antigo?: boolean },
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('createForm', corpo);
    return this.n.comAtor(s, async (tx) => {
      const p = await projetoNoEscopo(tx, corpo.projeto_id, true);
      if (p.status !== 'ativo') throw new ErroApi('ERR-001', { campos: ['projeto'] }); // DEC-146
      const feito = await this.n.idempotente(tx, s, 'createForm', chave, corpo, async () => {
        const { formId: id, versaoId } = await criarFormularioRascunho(this.n, tx, { tenantId: s.tenantId, projetoId: corpo.projeto_id, nome: corpo.nome });
        await this.gravarConteudo(tx, s, versaoId, normalizarConteudo(cincoCampos(), []), []); // DEC-135
        if (corpo.papel_antigo) await tx.execute(sql`UPDATE versao SET papel_antigo = true WHERE id = ${versaoId}`); // DEC-175
        await this.n.auditar(tx, s, 'CRIAR_FORMULARIO', 'Formulario', id, { papel_antigo: !!corpo.papel_antigo });
        return { status: 201, recursoId: id };
      });
      return this.resumoFormulario(tx, await this.formulario(tx, s, feito.recursoId));
    });
  }

  @Post('forms/:formId/versions')
  @HttpCode(201)
  async createVersion(
    @Param('formId') formId: string,
    @Body() corpo: { copiar_de_versao_id?: string; papel_antigo?: boolean } | undefined,
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
        let marcaOrigem: Pick<LinhaVersao, 'papel_antigo' | 'total_paginas'> | null = null;
        if (c.copiar_de_versao_id) {
          const { v: vo } = await this.versao(tx, s, formId, c.copiar_de_versao_id);
          origem = await this.conteudo(tx, vo.id);
          marcaOrigem = vo;
        }
        // A marca vem do pedido ou da origem; o total só se copia entre versões de papel antigo, e
        // fora dele a marca `nao_consta` sai das perguntas copiadas (DEC-179, DEC-189).
        const papelAntigo = c.papel_antigo ?? marcaOrigem?.papel_antigo ?? false;
        const total = papelAntigo && marcaOrigem?.papel_antigo ? marcaOrigem.total_paginas : null;
        if (origem && !papelAntigo) origem = { ...origem, perguntas: origem.perguntas.map((p) => ({ ...p, nao_consta: false })) };
        await tx.execute(sql`SELECT id FROM formulario WHERE id = ${formId} FOR UPDATE`);
        const numero = (await linha<{ n: number }>(tx, sql`SELECT coalesce(max(numero), 0)::int + 1 AS n FROM versao WHERE formulario_id = ${formId}`))!.n;
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO versao (id, tenant_id, formulario_id, numero, status, criada_em, papel_antigo, total_paginas)
          VALUES (${id}, ${s.tenantId}, ${formId}, ${numero}, 'rascunho', ${this.n.agora()}, ${papelAntigo}, ${total})`);
        // Sem origem, só os 5 campos (DEC-135); com origem, a cópia padronizada (DEC-145, DEC-147).
        const copia = origem ? padronizarCopia(origem.perguntas.map(entrada), origem.regras_salto) : { perguntas: cincoCampos(), regras: [] };
        await this.gravarConteudo(tx, s, id, normalizarConteudo(copia.perguntas, copia.regras), copia.regras);
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
      // RN-050: a reaplicação vem antes das demais validações, inclusive a das regras de salto.
      const perguntas = normalizarConteudo(reaplicarCampos(corpo.perguntas), corpo.regras_salto);
      // Marca ausente = mantém; total ausente = mantém, e desmarcar o apaga (DEC-175, DEC-181).
      const papelAntigo = corpo.papel_antigo ?? v.papel_antigo;
      const total = corpo.total_paginas !== undefined ? corpo.total_paginas : papelAntigo ? v.total_paginas : null;
      validarPapelAntigo(perguntas, papelAntigo, total);
      if (!papelAntigo) {
        const fora = naoCabem(await fonteDeMedida(), perguntas, corpo.regras_salto);
        if (fora.length) throw new ErroApi('ERR-001', { campos: fora }); // DEC-143; não vale no papel antigo (DEC-181)
      }
      await this.gravarConteudo(tx, s, versaoId, perguntas, corpo.regras_salto);
      await tx.execute(sql`UPDATE versao SET papel_antigo = ${papelAntigo}, total_paginas = ${total}, versao = versao + 1 WHERE id = ${versaoId}`);
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
      const faltam = pendenciasPublicacao(c.perguntas, v.papel_antigo);
      if (!v.papel_antigo) {
        for (const codigo of naoCabem(await fonteDeMedida(), c.perguntas, c.regras_salto)) if (!faltam.includes(codigo)) faltam.push(codigo); // DEC-143
      }
      if (faltam.length) throw new ErroApi('ERR-036', { campos: faltam, substituir: faltam.join(', ') });
      // Papel antigo: o total informado ou a maior página, sem mapa de layout (DEC-181, ENT-006).
      const total = v.papel_antigo ? (v.total_paginas ?? totalPaginas(c.perguntas)) : totalPaginas(c.perguntas);
      const mapa = v.papel_antigo ? null : await mapaLayout({ totalPaginas: total, perguntas: c.perguntas, regras: c.regras_salto });
      await tx.execute(sql`
        UPDATE versao SET status = 'publicada', publicada_em = ${this.n.agora()}, qr_codigo = ${novoCodigoQr()},
                          mapa_layout = ${mapa === null ? null : JSON.stringify(mapa)}::jsonb, total_paginas = ${total}, versao = versao + 1
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
      if (v.status !== 'publicada' || !v.qr_codigo || v.papel_antigo) throw new ErroApi('ERR-018'); // papel antigo não tem PDF (DEC-175)
      const c = await this.conteudo(tx, versaoId);
      const projeto = await projetoNoEscopo(tx, f.projeto_id);
      return {
        nomeProjeto: projeto.nome,
        nomeFormulario: f.nome,
        codigoProjeto: projeto.codigo,
        codigoFormulario: f.codigo,
        numeroVersao: v.numero,
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
