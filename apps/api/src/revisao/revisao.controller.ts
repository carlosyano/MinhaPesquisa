// RF-008: cota, fila, revisão humana, conclusão, nova leitura, descarte e reabertura (CA-007,
// CA-008, CA-014, CA-020, CA-021, CA-030, CA-032, CA-033, CA-041, CA-042; RN-013, RN-043;
// FL-001, FL-002; DEC-020, DEC-064, DEC-077, DEC-078, DEC-079, DEC-112).
//
// Sem reserva da aplicação (DEC-112): a gravação concorrente é recusada pelo If-Match (ERR-017).
// A auditoria leva o campo afetado, nunca o valor nem o motivo (RN-027, CA-008).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { etag, projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { chaveRecorte } from '../infra/armazenamento.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { DIA, MINUTO, somar } from '../infra/relogio.js';
import {
  aplicacaoNoEscopo,
  cadastroPorCpf,
  candidatosNome,
  ehPapelAntigo,
  carregarItens,
  carregarRegras,
  corpoAplicacao,
  cotaDoTenant,
  cpfDaAplicacao,
  cpfExibido,
  divergencias,
  ehComplemento,
  ESTADOS_EDICAO,
  ESTADOS_REVISAO,
  gravarItem,
  iniciarLeitura,
  limiteConfianca,
  reais,
  travarCpf,
  valorEfetivo,
  Avaliacao,
  type Item,
  type LinhaAplicacao,
} from '../leitura/dominio.js';
import { recortar } from '../leitura/worker.js';
import { ehUuid, Nucleo, type SessaoAtiva } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';
import { cpfValido } from '../regras/cpf.js';
import { canonizar, MAX_COMPLEMENTO, opcaoMarcada, RESOLVIDOS, valorNoSchema, type EstadoItem } from '../regras/leitura.js';
import { normalizarNome } from '../regras/papel-antigo.js';
import { anonimizarSemAplicacao, reverterCadastro, versaoDoCadastro, vincular, vincularSemCpf, type ManterCadastro } from './respondentes.js';

type Acao = 'confirmar' | 'corrigir' | 'em_branco' | 'ilegivel' | 'rasurado' | 'nao_se_aplica';

interface RevisaoPatch {
  itens: { item_id: string; acao: Acao; valor_final?: string | null }[];
}

interface Conclusao {
  assinatura: 'presente' | 'ausente';
  manter_cadastro?: ManterCadastro;
  respondente_id?: string | null;
}

const ESTADO_DA_ACAO: Record<Exclude<Acao, 'confirmar' | 'corrigir'>, EstadoItem> = {
  em_branco: 'em_branco',
  ilegivel: 'ilegivel',
  rasurado: 'rasurado',
  nao_se_aplica: 'nao_se_aplica',
};

/** Itens sobre os quais o revisor age: os lidos, salvo os que esperam a condição de salto (FL-002). */
const REVISAVEIS: ReadonlySet<EstadoItem> = new Set(['a_revisar', ...RESOLVIDOS]);

/** Confirmados voltam à revisão na reabertura, com o valor final preservado (FL-002). */
const REABRIR: ReadonlySet<EstadoItem> = new Set(['confirmado_automaticamente', 'confirmado', 'corrigido']);

const ESTADOS_APLICACAO = new Set([
  'identificacao_pendente', 'aguardando_cota', 'em_leitura', 'erro_leitura', 'em_revisao', 'aguardando_cpf', 'sem_assinatura', 'concluida', 'descartada',
]);

/** Validade do registro do descarte na lista de eliminações (ENT-019). */
const VALIDADE_LISTA = 180 * DIA;

/** Campo afetado de um item na auditoria (CA-008): o atributo do respondente ou da aplicação. */
const campoDe = (i: Item) => i.campo_respondente ?? i.campo_aplicacao ?? (i.opcao_codigo ? `${i.codigo}.${i.opcao_codigo}` : i.codigo).toLowerCase();

@Controller()
export class RevisaoController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private async corpo(tx: Executor, id: string, extra: Parameters<typeof corpoAplicacao>[3] = {}) {
    const a = await aplicacaoNoEscopo(tx, id);
    return { a, corpo: await corpoAplicacao(this.n, tx, a, extra) };
  }

  // ───────────────────────────── getQuotaStatus ─────────────────────────────

  @Get('tenant/quota')
  async getQuotaStatus(@Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const c = await cotaDoTenant(this.n, tx, s.tenantId);
      const aguardando = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM aplicacao WHERE estado = 'aguardando_cota'`))!.n;
      return { teto: reais(c.teto), consumido: reais(c.consumido), periodo_inicio: c.inicio, periodo_fim: c.fim, atingido: c.atingido, aplicacoes_aguardando: aguardando };
    });
  }

  // ───────────────────────────── listReviewQueue ─────────────────────────────

  @Get('projects/:projectId/review-queue')
  async listReviewQueue(@Param('projectId') projetoId: string, @Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      await projetoNoEscopo(tx, projetoId);
      const { pagina, limite } = paginacao(q);
      if (q.estado !== undefined && !ESTADOS_APLICACAO.has(q.estado)) throw new ErroApi('ERR-001', { campos: ['estado'] });
      const estado = q.estado ?? null;
      const total = (await linha<{ n: number }>(
        tx,
        sql`SELECT count(*)::int AS n FROM aplicacao WHERE projeto_id = ${projetoId} AND (${estado}::text IS NULL OR estado = ${estado})`,
      ))!.n;
      const as = await linhas<{ id: string; estado: string; criada_em: Date }>(
        tx,
        sql`SELECT id, estado, criada_em FROM aplicacao
             WHERE projeto_id = ${projetoId} AND (${estado}::text IS NULL OR estado = ${estado})
             ORDER BY criada_em, id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      );
      return { itens: as.map((a) => ({ id: a.id, estado: a.estado, criada_em: new Date(a.criada_em).toISOString() })), meta: { pagina, limite, total } };
    });
  }

  // ───────────────────────────── getApplication / openReview ─────────────────────────────

  @Get('applications/:applicationId')
  async getApplication(@Param('applicationId') id: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const r = await this.n.comAtor(s, (tx) => this.corpo(tx, id));
    res.header('ETag', etag(r.a.versao));
    return r.corpo;
  }

  /** Exibe o CPF completo e o cadastro existente do mesmo CPF, com auditoria (RN-013, CA-014). */
  @Post('applications/:applicationId/review/open')
  @HttpCode(200)
  async openReview(@Param('applicationId') id: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      if (!ESTADOS_REVISAO.has(a.estado)) throw new ErroApi('ERR-018');
      await tx.execute(sql`UPDATE aplicacao SET cpf_exibido_em = ${this.n.agora()} WHERE id = ${id}`);
      const cpf = cpfDaAplicacao(await carregarItens(this.n, tx, id));
      const existente = cpf ? await cadastroPorCpf(this.n, tx, cpf) : undefined;
      await this.n.auditar(tx, s, 'EXIBICAO_CPF', 'Aplicacao', id, { cadastro_existente: !!existente });
      const r = await this.corpo(tx, id, { cadastro_existente: existente ?? null });
      const candidatos = (r.corpo as { candidatos_nome?: unknown[] }).candidatos_nome;
      if (candidatos) await this.n.auditar(tx, s, 'LISTAR_CANDIDATOS_NOME', 'Aplicacao', id, { candidatos: candidatos.length }); // DEC-176
      return r;
    });
    res.header('ETag', etag(r.a.versao));
    return r.corpo;
  }

  // ───────────────────────────── getItemImage ─────────────────────────────

  /** Recorte do campo para a revisão lado a lado (CA-007), gerado na primeira consulta. */
  @Get('applications/:applicationId/items/:itemId/image')
  async getItemImage(@Param('applicationId') id: string, @Param('itemId') itemId: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id);
      if (!ESTADOS_EDICAO.has(a.estado)) throw new ErroApi('ERR-018');
      if (!ehUuid(itemId)) throw naoEncontrado('ItemResposta', null);
      const i = (await carregarItens(this.n, tx, id)).find((x) => x.id === itemId);
      if (!i) throw naoEncontrado('ItemResposta', itemId);
      const pagina = await linha<{ chave_storage: string }>(
        tx,
        sql`SELECT chave_storage FROM pagina_aplicacao
             WHERE aplicacao_id = ${id} AND tipo = 'formulario' AND numero_pagina = ${i.pagina} AND expurgada_em IS NULL
             ORDER BY ordem_envio LIMIT 1`,
      );
      if (!pagina) throw naoEncontrado('PaginaAplicacao', null);
      const chave = chaveRecorte(s.tenantId, id, i.id);
      const armazenamento = this.n.config.armazenamento;
      if ((await armazenamento.contar(chave)) === 0) {
        await armazenamento.gravar(chave, await recortar(await armazenamento.ler(pagina.chave_storage), [i]), 'image/jpeg');
      }
      const expira = somar(this.n.agora(), 5 * MINUTO); // DEC-034
      await this.n.auditar(tx, s, 'VER_IMAGEM', 'ItemResposta', i.id);
      // O recorte do CPF é exibição completa: fora da revisão aberta, é auditado à parte (DEC-126).
      if (i.tipo === 'cpf' && !cpfExibido(a)) await this.n.auditar(tx, s, 'EXIBICAO_CPF', 'Aplicacao', id, { recorte: true });
      return {
        url: await armazenamento.urlAssinada(chave, expira),
        expira_em: expira.toISOString(),
        regiao: i.regiao ?? null,
      };
    });
  }

  // ───────────────────────────── saveReview ─────────────────────────────

  @Patch('applications/:applicationId/review')
  async saveReview(
    @Param('applicationId') id: string,
    @Body() corpo: RevisaoPatch,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      this.validar('saveReview', corpo);
      if (!ESTADOS_EDICAO.has(a.estado)) throw new ErroApi('ERR-018');
      if (ifMatch !== etag(a.versao)) throw new ErroApi('ERR-017');
      const ids = corpo.itens.map((x) => x.item_id);
      if (new Set(ids).size !== ids.length) throw new ErroApi('ERR-001', { campos: ['itens'] });

      const itens = await carregarItens(this.n, tx, id);
      const porId = new Map(itens.map((i) => [i.id, i]));
      const av = new Avaliacao(itens, await carregarRegras(tx, a.versao_id!), await limiteConfianca(tx, s.tenantId, a.projeto_id));
      const antes = av.decisoes();
      const fixos = new Set(ids);
      const pedidos = corpo.itens.map((x) => {
        const i = porId.get(x.item_id);
        if (!i) throw naoEncontrado('ItemResposta', x.item_id); // item de outra aplicação (RN-002)
        return { i, x };
      });
      // As perguntas antes dos seus complementos; cada complemento é validado depois da pré-regra 1b (DEC-203 (8)).
      const agidos: { i: Item; acao: Acao; valorAntes: string | null }[] = [];
      for (const { i, x } of pedidos.filter((p) => !ehComplemento(p.i))) {
        if (!REVISAVEIS.has(i.estado)) throw new ErroApi('ERR-018');
        const valorAntes = valorEfetivo(i);
        this.aplicarAcao(i, x);
        i.revisor_id = s.usuarioId;
        av.alterados.add(i);
        agidos.push({ i, acao: x.acao, valorAntes });
      }
      for (const { i } of agidos) av.propagar(i, antes, fixos);
      for (const { i, valorAntes } of agidos) av.reavaliarComplementos(i, valorAntes);
      for (const { i, x } of pedidos.filter((p) => ehComplemento(p.i))) {
        if (!REVISAVEIS.has(i.estado)) throw new ErroApi('ERR-018'); // complemento com a pergunta não resolvida (FL-002)
        const pergunta = itens.find((p) => p.pergunta_id === i.pergunta_id && !ehComplemento(p) && !p.linha_id)!;
        this.aplicarAcaoComplemento(i, x, opcaoMarcada(valorEfetivo(pergunta), i.opcao_codigo!));
        i.revisao_reaberta = false;
        av.alterados.add(i);
        agidos.push({ i, acao: x.acao, valorAntes: null });
      }
      for (const i of av.alterados) await gravarItem(this.n, tx, i, fixos.has(i.id) ? s.usuarioId : null);
      for (const { i, acao } of agidos) {
        if (acao === 'corrigir') await this.n.auditar(tx, s, 'CORRECAO_CAMPO', 'ItemResposta', i.id, undefined, campoDe(i));
        else await this.n.auditar(tx, s, 'REVISAO_ITEM', 'ItemResposta', i.id, { acao }, campoDe(i));
      }

      // Em aguardando_cpf, um CPF válido devolve a aplicação à revisão (FL-001).
      const cpf = cpfDaAplicacao(itens);
      const estado = a.estado === 'aguardando_cpf' && cpf ? 'em_revisao' : a.estado;
      const aviso = estado === a.estado ? a.aviso : null;
      await tx.execute(sql`
        UPDATE aplicacao SET estado = ${estado}, aviso = ${aviso}, cpf_hash = ${cpf ? this.n.hmac(cpf) : null}, versao = versao + 1
         WHERE id = ${id}`);
      return this.corpo(tx, id);
    });
    res.header('ETag', etag(r.a.versao));
    return r.corpo;
  }

  /** Ação do revisor sobre um item (FL-002); `valor_ia` nunca muda (RN-010). */
  private aplicarAcao(i: Item, x: RevisaoPatch['itens'][number]): void {
    const valido = (v: string) => (i.tipo === 'cpf' ? cpfValido(v) : valorNoSchema(i, v)); // RN-012, CA-006
    switch (x.acao) {
      case 'confirmar':
        // Só o valor lido preenchido e no schema se confirma; o resto se corrige ou se marca (DEC-128).
        // No CPF basta o formato: o dígito verificador inválido leva a aguardando_cpf na conclusão (FL-001).
        if (i.valor_ia === null || !valorNoSchema(i, i.valor_ia)) throw new ErroApi('ERR-001', { campos: ['acao'] });
        i.valor_final = i.valor_ia;
        i.estado = 'confirmado';
        return;
      case 'corrigir': {
        const v = canonizar(i.tipo, x.valor_final ?? null);
        if (v === null || !valido(v)) throw new ErroApi('ERR-001', { campos: ['valor_final'] });
        i.valor_final = v;
        i.estado = 'corrigido';
        return;
      }
      default:
        if (x.acao === 'nao_se_aplica' && i.tipo === 'cpf') throw new ErroApi('ERR-001', { campos: ['acao'] }); // FL-001
        i.valor_final = null;
        i.estado = ESTADO_DA_ACAO[x.acao];
    }
  }

  /**
   * Ação sobre o item de complemento (FL-002, DEC-203 (8)): texto de até 200 caracteres (regra 7);
   * com a opção não marcada, só `nao_se_aplica` (DEC-205).
   */
  private aplicarAcaoComplemento(i: Item, x: RevisaoPatch['itens'][number], marcada: boolean): void {
    const recusar = () => new ErroApi('ERR-001', { campos: ['item_id'] });
    if (!marcada && x.acao !== 'nao_se_aplica') throw recusar();
    const texto = (v: string | null | undefined) => {
      const t = v?.trim() ?? '';
      return t === '' ? null : t;
    };
    switch (x.acao) {
      case 'confirmar': {
        const v = texto(i.valor_ia);
        if (v === null || v.length > MAX_COMPLEMENTO) throw recusar();
        i.valor_final = v;
        i.estado = 'confirmado';
        return;
      }
      case 'corrigir': {
        const v = texto(x.valor_final);
        if (v === null || v.length > MAX_COMPLEMENTO) throw recusar();
        i.valor_final = v;
        i.estado = 'corrigido';
        return;
      }
      default:
        i.valor_final = null;
        i.estado = ESTADO_DA_ACAO[x.acao];
    }
  }

  // ───────────────────────────── confirmApplication ─────────────────────────────

  @Post('applications/:applicationId/confirm')
  @HttpCode(200)
  async confirmApplication(
    @Param('applicationId') id: string,
    @Body() corpo: Conclusao,
    @Headers('idempotency-key') chave: string | undefined,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: Requisicao,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      this.validar('confirmApplication', corpo);
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      await this.n.idempotente(tx, s, 'confirmApplication', chave, { id, ...corpo }, async () => {
        if (!ESTADOS_EDICAO.has(a.estado)) throw new ErroApi('ERR-018');
        if (ifMatch !== etag(a.versao)) throw new ErroApi('ERR-017');
        await this.concluir(tx, s, a, corpo);
        return { status: 200, recursoId: id };
      });
      return (await this.corpo(tx, id)).corpo;
    });
  }

  /** Precedência da conclusão (FL-001), com 1a, 3a e 4 do papel antigo (DEC-172, DEC-176). */
  private async concluir(tx: Executor, s: SessaoAtiva, a: LinhaAplicacao, corpo: Conclusao): Promise<void> {
    const itens = await carregarItens(this.n, tx, a.id);
    // 1. Item não resolvido → ERR-022.
    if (itens.some((i) => !RESOLVIDOS.has(i.estado))) throw new ErroApi('ERR-022');
    const papelAntigo = await ehPapelAntigo(tx, a);
    const cpf = cpfDaAplicacao(itens);
    // 1a. respondente_id só no papel antigo sem CPF válido.
    if (corpo.respondente_id !== undefined && (!papelAntigo || cpf)) throw new ErroApi('ERR-001', { campos: ['respondente_id'] });
    // 2. CPF ausente, ilegível ou inválido → aguardando_cpf com aviso ERR-006 (fora do papel antigo).
    if (!cpf && !papelAntigo) {
      await tx.execute(sql`UPDATE aplicacao SET estado = 'aguardando_cpf', aviso = 'ERR-006', versao = versao + 1 WHERE id = ${a.id}`);
      await this.n.auditar(tx, s, 'CONCLUSAO_SEM_CPF', 'Aplicacao', a.id);
      return;
    }
    // 3. Nome, nascimento (fora do papel antigo), data ou local sem valor → ERR-006 (DEC-020, DEC-079, DEC-172).
    const valor = (f: (i: Item) => boolean) => {
      const i = itens.find(f);
      return i ? valorEfetivo(i) : null;
    };
    const obrigatorios = {
      nome: valor((i) => i.campo_respondente === 'nome'),
      data_nascimento: valor((i) => i.campo_respondente === 'data_nascimento'),
      data_aplicacao: valor((i) => i.campo_aplicacao === 'data_aplicacao'),
      local_aplicacao: valor((i) => i.campo_aplicacao === 'local_aplicacao'),
    };
    const faltam = Object.entries(obrigatorios)
      .filter(([k, v]) => v === null && !(papelAntigo && k === 'data_nascimento'))
      .map(([k]) => k);
    if (faltam.length) throw new ErroApi('ERR-006', { campos: faltam });

    let escolhas: ManterCadastro = {};
    if (cpf) {
      // Escolha para cada divergência do cadastro (CA-014), lida já com o CPF travado (DEC-131).
      await travarCpf(this.n, tx, cpf);
      const manter = corpo.manter_cadastro ?? {};
      const div = divergencias(itens, await cadastroPorCpf(this.n, tx, cpf));
      const semEscolha = div.filter((d) => manter[d] === undefined);
      if (semEscolha.length) throw new ErroApi('ERR-001', { campos: semEscolha.map((d) => `manter_cadastro.${d}`) });
      escolhas = Object.fromEntries(div.map((d) => [d, manter[d]]));
    } else {
      // 3a. Papel antigo sem CPF válido: escolha entre os candidatos pelo nome, calculados agora (DEC-176).
      await travarCpf(this.n, tx, `nome:${normalizarNome(obrigatorios.nome!)}`); // a mesma trava, pelo nome
      const candidatos = (await candidatosNome(tx, { ...a, cpf_exibido_em: this.n.agora(), estado: 'em_revisao' }, itens, true)) ?? [];
      const id = corpo.respondente_id;
      const valido = candidatos.length ? id === null || candidatos.some((c) => c.respondente_id === id) : id === undefined || id === null;
      if (!valido) throw new ErroApi('ERR-001', { campos: ['respondente_id'] });
    }

    await tx.execute(sql`
      UPDATE aplicacao SET data_aplicacao = ${obrigatorios.data_aplicacao}::date, local_aplicacao = ${this.n.cifrar(obrigatorios.local_aplicacao)},
                           cpf_hash = ${cpf ? this.n.hmac(cpf) : null}
       WHERE id = ${a.id}`);
    // 4. Papel antigo → concluida com a assinatura informada (DEC-172); fora dele, assinatura ausente →
    // sem_assinatura, sem vincular (DEC-064); presente → concluida.
    if (corpo.assinatura === 'ausente' && !papelAntigo) {
      await tx.execute(sql`
        UPDATE aplicacao SET estado = 'sem_assinatura', aviso = NULL, assinatura = 'ausente', manter_cadastro = ${JSON.stringify(escolhas)}::jsonb,
                             cadastro_versao = ${await versaoDoCadastro(this.n, tx, itens)}, cpf_exibido_em = NULL, versao = versao + 1
         WHERE id = ${a.id}`);
      await this.n.auditar(tx, s, 'CONCLUSAO_SEM_ASSINATURA', 'Aplicacao', a.id);
      return;
    }
    const respondenteId = cpf ? await vincular(this.n, tx, s, a.id, itens, escolhas) : await vincularSemCpf(this.n, tx, s, a.id, itens, corpo.respondente_id ?? null);
    await tx.execute(sql`
      UPDATE aplicacao SET estado = 'concluida', aviso = NULL, assinatura = ${corpo.assinatura}, respondente_id = ${respondenteId},
                           respondente_anterior_id = NULL, manter_cadastro = ${JSON.stringify(escolhas)}::jsonb,
                           concluida_em = ${this.n.agora()}, cpf_exibido_em = NULL, versao = versao + 1
       WHERE id = ${a.id}`);
    await this.n.auditar(tx, s, 'CONCLUIR_APLICACAO', 'Aplicacao', a.id, { respondente_id: respondenteId });
  }

  // ───────────────────────────── retryReading ─────────────────────────────

  @Post('applications/:applicationId/retry')
  @HttpCode(202)
  async retryReading(@Param('applicationId') id: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      await this.n.idempotente(tx, s, 'retryReading', chave, { id }, async () => {
        if (a.estado !== 'erro_leitura') throw new ErroApi('ERR-018');
        const estado = await iniciarLeitura(this.n, tx, s.tenantId, id); // em_leitura, ou aguardando_cota (FL-001)
        await this.n.auditar(tx, s, 'REPETIR_LEITURA', 'Aplicacao', id, { estado });
        return { status: 202, recursoId: id };
      });
      return (await this.corpo(tx, id)).corpo;
    });
  }

  // ───────────────────────────── discardApplication ─────────────────────────────

  /** Apaga imagens e valores lidos (DEC-077), registra na ListaEliminacoes e audita sem o motivo. */
  @Post('applications/:applicationId/discard')
  @HttpCode(200)
  async discardApplication(@Param('applicationId') id: string, @Body() corpo: { motivo: string }, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const apagar: string[] = [];
    const r = await this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      this.validar('discardApplication', corpo);
      await this.n.idempotente(tx, s, 'discardApplication', chave, { id, ...corpo }, async () => {
        if (a.estado === 'concluida' || a.estado === 'descartada') throw new ErroApi('ERR-018');
        const agora = this.n.agora();
        // O nome do arquivo sai junto com a imagem (DEC-203 (5), DEC-206).
        const paginas = await linhas<{ chave_storage: string }>(
          tx,
          sql`UPDATE pagina_aplicacao SET expurgada_em = ${agora}, nome_arquivo = NULL WHERE aplicacao_id = ${id} AND expurgada_em IS NULL RETURNING chave_storage`,
        );
        const itens = await linhas<{ id: string }>(
          tx,
          sql`UPDATE item_resposta SET valor_ia = NULL, valor_final = NULL, confianca = NULL WHERE aplicacao_id = ${id} RETURNING id`,
        );
        apagar.push(...paginas.map((p) => p.chave_storage), ...itens.map((i) => chaveRecorte(s.tenantId, id, i.id)));
        await tx.execute(sql`UPDATE tarefa_leitura SET situacao = 'cancelada' WHERE aplicacao_id = ${id} AND situacao = 'pendente'`);
        await tx.execute(sql`
          UPDATE aplicacao SET estado = 'descartada', aviso = NULL, motivo_descarte = ${this.n.cifrar(corpo.motivo)},
                               local_aplicacao = NULL, data_aplicacao = NULL, cpf_hash = NULL, manter_cadastro = NULL,
                               respondente_anterior_id = NULL, cpf_exibido_em = NULL, versao = versao + 1
           WHERE id = ${id}`);
        // Aplicação reaberta descartada: o respondente da conclusão anterior segue a DEC-078 (DEC-130).
        if (a.respondente_anterior_id) await anonimizarSemAplicacao(this.n, tx, s, a.respondente_anterior_id, id);
        await tx.execute(sql`
          INSERT INTO lista_eliminacoes (id, tenant_id, motivo, aplicacao_id, eliminado_em, valido_ate)
          VALUES (${this.n.id()}, ${s.tenantId}, 'descarte_aplicacao', ${id}, ${agora}, ${somar(agora, VALIDADE_LISTA)})`);
        await this.n.auditar(tx, s, 'DESCARTAR_APLICACAO', 'Aplicacao', id, { estado_anterior: a.estado, imagens: paginas.length });
        return { status: 200, recursoId: id };
      });
      return (await this.corpo(tx, id)).corpo;
    });
    await Promise.allSettled(apagar.map((k) => this.n.config.armazenamento.apagar(k)));
    return r;
  }

  // ───────────────────────────── reopenApplication ─────────────────────────────

  /**
   * De `concluida`: sai do vínculo (refeito na nova conclusão), reverte as alterações de cadastro
   * desta aplicação e devolve os itens confirmados à revisão (CA-042). De `sem_assinatura`: corrige
   * a conferência e volta a `em_revisao` preservando os itens (FL-001).
   */
  @Post('applications/:applicationId/reopen')
  @HttpCode(200)
  async reopenApplication(@Param('applicationId') id: string, @Body() corpo: { motivo: string }, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const a = await aplicacaoNoEscopo(tx, id, true);
      this.validar('reopenApplication', corpo);
      await this.n.idempotente(tx, s, 'reopenApplication', chave, { id, ...corpo }, async () => {
        if (a.estado !== 'concluida' && a.estado !== 'sem_assinatura') throw new ErroApi('ERR-018');
        if (a.estado === 'concluida') {
          const itens = await carregarItens(this.n, tx, id);
          // Os complementos são avaliados com a pergunta como estava antes da reabertura (DEC-203 (10)).
          const perguntas = new Map(itens.filter((i) => !ehComplemento(i) && !i.linha_id).map((i) => [i.pergunta_id, { ...i }]));
          for (const i of itens) {
            if (ehComplemento(i)) {
              if (this.reabrirComplemento(i, perguntas.get(i.pergunta_id)!)) await gravarItem(this.n, tx, i);
              continue;
            }
            if (!REABRIR.has(i.estado)) continue;
            i.valor_final = valorEfetivo(i);
            i.estado = 'a_revisar';
            await gravarItem(this.n, tx, i);
          }
          await reverterCadastro(this.n, tx, s, id);
        }
        await tx.execute(sql`
          UPDATE aplicacao SET estado = 'em_revisao', aviso = NULL, motivo_reabertura = ${this.n.cifrar(corpo.motivo)},
                               respondente_anterior_id = coalesce(respondente_id, respondente_anterior_id), respondente_id = NULL,
                               concluida_em = NULL, manter_cadastro = NULL, cadastro_versao = NULL, cpf_exibido_em = NULL,
                               assinatura = CASE WHEN estado = 'sem_assinatura' THEN 'nao_conferida' ELSE assinatura END,
                               versao = versao + 1
           WHERE id = ${id}`);
        await this.n.auditar(tx, s, 'REABRIR_APLICACAO', 'Aplicacao', id, { estado_anterior: a.estado });
        return { status: 200, recursoId: id };
      });
      return (await this.corpo(tx, id)).corpo;
    });
  }

  /**
   * Linhas de reabertura do item de complemento (FL-002), no lugar da pré-regra 1b: com a opção
   * marcada no valor final preservado da pergunta, `a_revisar` com a marca `revisao_reaberta`; sem
   * ela, volta a `a_revisar` só o que tinha texto lido com a pergunta vinda da leitura ou do worker
   * (DEC-205, DEC-209). Devolve se o item mudou.
   */
  private reabrirComplemento(c: Item, pergunta: Item): boolean {
    const marcada = opcaoMarcada(valorEfetivo(pergunta), c.opcao_codigo!);
    const daLeitura =
      pergunta.estado === 'confirmado_automaticamente' || pergunta.estado === 'confirmado' || (pergunta.estado === 'nao_se_aplica' && pergunta.revisor_id === null);
    const textoLido = c.valor_ia !== null && c.valor_ia.trim() !== '';
    if (!marcada && !(daLeitura && textoLido)) return false;
    c.valor_final = valorEfetivo(c);
    c.estado = 'a_revisar';
    c.revisao_reaberta = true;
    return true;
  }
}
