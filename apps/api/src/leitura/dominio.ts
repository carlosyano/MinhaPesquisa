// Domínio da leitura e da revisão (RF-007, RF-008, FL-001, FL-002), compartilhado pelo worker e
// pelos controladores: cota de IA do mês (CA-030, DEC-051, DEC-058), itens com a pergunta de
// cada um, reavaliação das regras de salto e o corpo `Application` do contrato.

import { parametro, projetoNoEscopo } from '../escopo.js';
import { naoEncontrado } from '../infra/erros.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ehUuid, type Nucleo } from '../nucleo.js';
import { cpfValido, mascararCpf } from '../regras/cpf.js';
import { decisaoSalto, estadoAposLeitura, type DecisaoSalto, type EstadoItem, type SaltoItem, type TipoPergunta } from '../regras/leitura.js';

export const ESTADOS_REVISAO = new Set(['em_revisao', 'aguardando_cpf', 'sem_assinatura']);
export const ESTADOS_EDICAO = new Set(['em_revisao', 'aguardando_cpf']);

// ───────────────────────────── cota de IA ─────────────────────────────

const FUSO = 'America/Sao_Paulo';
const dois = (n: number) => String(n).padStart(2, '0');

/** Mês civil em America/Sao_Paulo (DEC-058): primeiro e último dia. */
export function competencia(agora: Date): { inicio: string; fim: string } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit' }).formatToParts(agora);
  const ano = Number(partes.find((p) => p.type === 'year')!.value);
  const mes = Number(partes.find((p) => p.type === 'month')!.value);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return { inicio: `${ano}-${dois(mes)}-01`, fim: `${ano}-${dois(mes)}-${dois(ultimo)}` };
}

export interface Cota {
  inicio: string;
  fim: string;
  /** Valores em reais, como texto decimal exato (numeric do banco). */
  teto: string;
  consumido: string;
  atingido: boolean;
  /** Cotação do dólar do mês; null quando não foi cadastrada (nenhuma leitura é feita). */
  cotacao: string | null;
}

export async function cotaDoTenant(n: Nucleo, tx: Executor, tenantId: string): Promise<Cota> {
  const { inicio, fim } = competencia(n.agora());
  const teto = await parametro(tx, 'custo_ia_teto', tenantId, null);
  const r = await linha<{ consumido: string; atingido: boolean; cotacao: string | null }>(
    tx,
    sql`SELECT coalesce((SELECT valor_reais FROM consumo_ia WHERE tenant_id = ${tenantId} AND competencia = ${inicio}::date), 0)::text AS consumido,
               coalesce((SELECT valor_reais FROM consumo_ia WHERE tenant_id = ${tenantId} AND competencia = ${inicio}::date), 0) >= ${teto}::numeric AS atingido,
               (SELECT valor FROM parametro_configuracao
                 WHERE chave = 'cotacao_usd_brl' AND competencia = ${inicio}::date AND projeto_id IS NULL
                   AND (tenant_id IS NULL OR tenant_id = ${tenantId})
                 ORDER BY (tenant_id IS NOT NULL) DESC LIMIT 1) AS cotacao`,
  );
  return { inicio, fim, teto, consumido: r!.consumido, atingido: r!.atingido, cotacao: r!.cotacao };
}

export const reais = (v: string) => Number(v).toFixed(2);

/**
 * Reserva atômica do custo estimado antes da chamada (DEC-051): só grava se o consumido, com a
 * reserva, não passar do teto. Devolve false quando não cabe.
 */
export async function reservar(tx: Executor, tenantId: string, cota: Cota, estimadoUsd: number): Promise<boolean> {
  await tx.execute(sql`
    INSERT INTO consumo_ia (tenant_id, competencia, valor_reais) VALUES (${tenantId}, ${cota.inicio}::date, 0)
    ON CONFLICT (tenant_id, competencia) DO NOTHING`);
  const r = await linhas(
    tx,
    sql`UPDATE consumo_ia SET valor_reais = valor_reais + round(${String(estimadoUsd)}::numeric * ${cota.cotacao}::numeric, 6)
         WHERE tenant_id = ${tenantId} AND competencia = ${cota.inicio}::date
           AND valor_reais < ${cota.teto}::numeric
           AND valor_reais + round(${String(estimadoUsd)}::numeric * ${cota.cotacao}::numeric, 6) <= ${cota.teto}::numeric
         RETURNING tenant_id`,
  );
  return r.length === 1;
}

/** Troca a reserva pelo custo real (sucesso) ou a devolve (falha, `realUsd` 0). */
export async function ajustar(tx: Executor, tenantId: string, inicio: string, cotacao: string, estimadoUsd: number, realUsd: number): Promise<void> {
  await tx.execute(sql`
    UPDATE consumo_ia
       SET valor_reais = greatest(0, valor_reais
             + round(${String(realUsd)}::numeric * ${cotacao}::numeric, 6)
             - round(${String(estimadoUsd)}::numeric * ${cotacao}::numeric, 6))
     WHERE tenant_id = ${tenantId} AND competencia = ${inicio}::date`);
}

// ───────────────────────────── itens ─────────────────────────────

export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Item {
  id: string;
  pergunta_id: string;
  linha_id: string | null;
  codigo: string;
  linha_codigo: string | null;
  tipo: TipoPergunta;
  pagina: number;
  ordem: number;
  campo_respondente: string | null;
  campo_aplicacao: string | null;
  sensibilidade: string;
  opcoes: string[];
  valor_min: number | null;
  valor_max: number | null;
  /** Decifrados (DEC-041) quando a pergunta tem campo_respondente. */
  valor_ia: string | null;
  confianca: number | null;
  valor_final: string | null;
  estado: EstadoItem;
  regiao: Regiao | null;
}

export interface Regra {
  origem: string;
  destino: string;
  opcao: string;
}

export const chaveItem = (i: Pick<Item, 'codigo' | 'linha_codigo'>) => (i.linha_codigo ? `${i.codigo}.${i.linha_codigo}` : i.codigo);

/** O valor fica cifrado quando a pergunta é campo do respondente (ENT-011). */
const cifrado = (i: Pick<Item, 'campo_respondente'>) => i.campo_respondente !== null;

export async function carregarItens(n: Nucleo, tx: Executor, aplicacaoId: string): Promise<Item[]> {
  const r = await linhas<Omit<Item, 'confianca' | 'valor_min' | 'valor_max' | 'regiao'> & {
    confianca: string | null;
    valor_min: string | null;
    valor_max: string | null;
    regiao_imagem: Regiao | null;
  }>(
    tx,
    sql`SELECT i.id, i.pergunta_id, i.linha_id, p.codigo, l.codigo AS linha_codigo, p.tipo, p.pagina, p.ordem,
               p.campo_respondente, p.campo_aplicacao, p.sensibilidade, p.valor_min, p.valor_max,
               coalesce((SELECT array_agg(o.codigo ORDER BY o.ordem) FROM opcao o WHERE o.pergunta_id = p.id), '{}') AS opcoes,
               i.valor_ia, i.confianca, i.valor_final, i.estado, i.regiao_imagem
          FROM item_resposta i
          JOIN pergunta p ON p.id = i.pergunta_id
          LEFT JOIN linha_matriz l ON l.id = i.linha_id
         WHERE i.aplicacao_id = ${aplicacaoId}
         ORDER BY p.ordem, l.ordem NULLS FIRST, i.id`,
  );
  return r.map(({ regiao_imagem, ...i }) => ({
    ...i,
    valor_ia: cifrado(i) ? n.decifrar(i.valor_ia) : i.valor_ia,
    valor_final: cifrado(i) ? n.decifrar(i.valor_final) : i.valor_final,
    confianca: i.confianca === null ? null : Number(i.confianca),
    valor_min: i.valor_min === null ? null : Number(i.valor_min),
    valor_max: i.valor_max === null ? null : Number(i.valor_max),
    regiao: regiao_imagem,
  }));
}

export async function carregarRegras(tx: Executor, versaoId: string): Promise<Regra[]> {
  return linhas<Regra>(
    tx,
    sql`SELECT pergunta_origem_id AS origem, pergunta_destino_id AS destino, opcao_codigo AS opcao
          FROM regra_salto WHERE versao_id = ${versaoId} ORDER BY posicao`,
  );
}

/** Grava valores e estado do item (cifrando os campos do respondente). */
export async function gravarItem(n: Nucleo, tx: Executor, i: Item, revisor?: string): Promise<void> {
  const c = (v: string | null) => (cifrado(i) ? n.cifrar(v) : v);
  await tx.execute(sql`
    UPDATE item_resposta
       SET valor_ia = ${c(i.valor_ia)}, confianca = ${i.confianca}, valor_final = ${c(i.valor_final)}, estado = ${i.estado},
           regiao_imagem = ${i.regiao ? JSON.stringify(i.regiao) : null}::jsonb,
           revisor_id = coalesce(${revisor ?? null}::uuid, revisor_id),
           revisado_em = CASE WHEN ${revisor ?? null}::uuid IS NULL THEN revisado_em ELSE ${n.agora()}::timestamptz END
     WHERE id = ${i.id}`);
}

/** Valor que vale para o item: o final nos estados resolvidos com valor; o lido no automático. */
export function valorEfetivo(i: Pick<Item, 'estado' | 'valor_ia' | 'valor_final'>): string | null {
  if (i.estado === 'confirmado' || i.estado === 'corrigido') return i.valor_final;
  if (i.estado === 'confirmado_automaticamente') return i.valor_final ?? i.valor_ia;
  return null;
}

/**
 * Avaliação dos itens de uma aplicação pela FL-002, com as regras de salto da versão. Mantém o
 * estado em memória; quem chama grava os itens devolvidos em `alterados`.
 */
export class Avaliacao {
  private readonly porPergunta = new Map<string, Item[]>();
  private readonly regraDoDestino = new Map<string, Regra>();
  private readonly destinosDa = new Map<string, string[]>();
  readonly alterados = new Set<Item>();

  constructor(
    readonly itens: Item[],
    regras: Regra[],
    private readonly limite: number,
  ) {
    for (const i of itens) this.porPergunta.set(i.pergunta_id, [...(this.porPergunta.get(i.pergunta_id) ?? []), i]);
    for (const r of regras) {
      this.regraDoDestino.set(r.destino, r);
      this.destinosDa.set(r.origem, [...(this.destinosDa.get(r.origem) ?? []), r.destino]);
    }
  }

  salto(i: Item): SaltoItem | null {
    const r = this.regraDoDestino.get(i.pergunta_id);
    const origem = r && this.porPergunta.get(r.origem)?.[0];
    if (!r || !origem) return null;
    return { estadoOrigem: origem.estado, valorOrigem: valorEfetivo(origem), opcaoMostrar: r.opcao };
  }

  /** Decisão que a origem impõe a este item pela regra de que ele é destino; null sem regra. */
  private decisaoDe(i: Item): DecisaoSalto | null {
    const s = this.salto(i);
    return s ? decisaoSalto(s) : null;
  }

  private estadoPelaLeitura(i: Item, valor: string | null): EstadoItem {
    return estadoAposLeitura({
      tipo: i.tipo,
      valor,
      confianca: i.confianca ?? 0,
      limite: this.limite,
      opcoes: i.opcoes,
      valor_min: i.valor_min,
      valor_max: i.valor_max,
      salto: this.salto(i),
    });
  }

  private mudar(i: Item, estado: EstadoItem): boolean {
    if (i.estado === estado) return false;
    i.estado = estado;
    if (estado === 'confirmado_automaticamente') i.valor_final = i.valor_ia;
    this.alterados.add(i);
    return true;
  }

  private destinos(origem: Item): Item[] {
    return (this.destinosDa.get(origem.pergunta_id) ?? []).flatMap((d) => this.porPergunta.get(d) ?? []);
  }

  /** Fim da leitura dos itens dados (worker): FL-002 em ordem, depois os destinos que aguardavam. */
  lidos(lidos: Item[]): void {
    for (const i of [...lidos].sort((a, b) => a.ordem - b.ordem)) {
      this.mudar(i, this.estadoPelaLeitura(i, i.valor_ia));
      this.alterados.add(i);
      this.propagar(i, new Map());
    }
  }

  /**
   * Reavalia os destinos de uma origem alterada (FL-002, "condição de salto resolvida" e "condição
   * de salto muda"). `antes` guarda, por destino, a decisão da regra antes da revisão: destinos em
   * aguardando_condicao são sempre reavaliados, os demais só quando a decisão muda. Um destino já
   * resolvido que passa a "mostrar" vai para revisão humana, nunca para confirmação automática.
   * Itens em `fixos` receberam uma ação do revisor na mesma gravação, que prevalece.
   */
  propagar(origem: Item, antes: Map<string, DecisaoSalto | null>, fixos: ReadonlySet<string> = new Set()): void {
    for (const d of this.destinos(origem)) {
      if (d.estado === 'pendente_leitura' || fixos.has(d.id)) continue;
      const mudou = antes.has(d.id) && antes.get(d.id) !== this.decisaoDe(d);
      if (d.estado !== 'aguardando_condicao' && !mudou) continue;
      const antesDosFilhos = new Map(this.destinos(d).map((x) => [x.id, this.decisaoDe(x)]));
      const valor = d.estado === 'confirmado' || d.estado === 'corrigido' ? d.valor_final : d.valor_ia;
      let novo = this.estadoPelaLeitura(d, valor);
      // Condição de salto muda: a_revisar ou nao_se_aplica (FL-002, CA-020).
      if (d.estado !== 'aguardando_condicao' && novo !== 'nao_se_aplica' && novo !== 'aguardando_condicao') novo = 'a_revisar';
      if (this.mudar(d, novo)) this.propagar(d, antesDosFilhos, fixos);
    }
  }

  /** Decisão da regra de cada destino antes de uma revisão. */
  decisoes(): Map<string, DecisaoSalto | null> {
    return new Map(this.itens.map((i) => [i.id, this.decisaoDe(i)]));
  }
}

export async function limiteConfianca(tx: Executor, tenantId: string, projetoId: string): Promise<number> {
  return Number(await parametro(tx, 'limite_confianca', tenantId, projetoId));
}

// ───────────────────────────── aplicação ─────────────────────────────

export interface LinhaAplicacao {
  id: string;
  tenant_id: string;
  projeto_id: string;
  versao_id: string | null;
  estado: string;
  aviso: string | null;
  assinatura: string;
  versao: number;
  respondente_id: string | null;
  respondente_anterior_id: string | null;
  manter_cadastro: Record<string, 'existente' | 'aplicacao'> | null;
  cadastro_versao: number | null;
  cpf_exibido_em: Date | null;
  criada_em: Date;
}

export const COLUNAS_APLICACAO = sql.raw(
  `id, tenant_id, projeto_id, versao_id, estado, aviso, assinatura, versao, respondente_id, respondente_anterior_id,
   manter_cadastro, cadastro_versao, cpf_exibido_em, criada_em`,
);

/** Atributos do cadastro que o formulário pode trazer (CA-014). */
export const ATRIBUTOS = ['nome', 'data_nascimento', 'endereco'] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export interface Cadastro {
  id: string;
  nome: string;
  data_nascimento: string | null;
  endereco: string | null;
  versao: number;
}

/** CPF canônico e válido do item de CPF resolvido; null se ausente, ilegível ou inválido. */
export function cpfDaAplicacao(itens: Item[]): string | null {
  const i = itens.find((x) => x.campo_respondente === 'cpf');
  const v = i ? valorEfetivo(i) : null;
  return v && cpfValido(v) ? v : null;
}

export async function cadastroPorCpf(n: Nucleo, tx: Executor, cpf: string): Promise<Cadastro | undefined> {
  const r = await linha<Cadastro & { data_nascimento: string | null }>(
    tx,
    sql`SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento, endereco, versao
          FROM respondente WHERE cpf_hash = ${n.hmac(cpf)} AND NOT anonimizado`,
  );
  return r;
}

/** Valores dos atributos do cadastro lidos na aplicação (campo_respondente), quando informados. */
export function atributosLidos(itens: Item[]): Partial<Record<Atributo, string>> {
  const out: Partial<Record<Atributo, string>> = {};
  for (const a of ATRIBUTOS) {
    const i = itens.find((x) => x.campo_respondente === a);
    const v = i ? valorEfetivo(i) : null;
    if (v !== null) out[a] = v;
  }
  return out;
}

/** Atributos em que o valor lido difere do cadastro existente (CA-014). */
export function divergencias(itens: Item[], existente: Cadastro | undefined): Atributo[] {
  if (!existente) return [];
  const lidos = atributosLidos(itens);
  return ATRIBUTOS.filter((a) => lidos[a] !== undefined && lidos[a] !== existente[a]);
}

interface LinhaPagina {
  id: string;
  tipo: 'formulario' | 'assinatura';
  numero_pagina: number | null;
  registro_ok: boolean;
}

/** Corpo `Application` do contrato. CPF mascarado até a revisão ser aberta (RN-013). */
export async function corpoAplicacao(n: Nucleo, tx: Executor, a: LinhaAplicacao, extra: { cadastro_existente?: Cadastro | null } = {}) {
  const paginas = await linhas<LinhaPagina>(
    tx,
    sql`SELECT id, tipo, numero_pagina, registro_ok FROM pagina_aplicacao
         WHERE aplicacao_id = ${a.id} AND expurgada_em IS NULL ORDER BY ordem_envio, id`,
  );
  const itens = await carregarItens(n, tx, a.id);
  const exibir = a.cpf_exibido_em !== null;
  const mascarar = (i: Item, v: string | null) => (i.tipo !== 'cpf' || exibir || v === null ? v : /^\d{11}$/.test(v) ? mascararCpf(v) : '***');
  const cpf = cpfDaAplicacao(itens);
  const div = cpf && ESTADOS_REVISAO.has(a.estado) ? divergencias(itens, await cadastroPorCpf(n, tx, cpf)) : [];
  const c = extra.cadastro_existente;
  return {
    id: a.id,
    projeto_id: a.projeto_id,
    versao_id: a.versao_id,
    estado: a.estado,
    assinatura: a.assinatura,
    aviso: a.aviso,
    divergencias_cadastro: div,
    paginas: paginas.map((p) => ({ imagem_id: p.id, numero_pagina: p.numero_pagina, tipo: p.tipo, registro_ok: p.registro_ok })),
    cadastro_existente: c ? { nome: c.nome, data_nascimento: c.data_nascimento, endereco: c.endereco } : null,
    itens: itens.map((i) => ({
      id: i.id,
      pergunta_codigo: i.codigo,
      linha_codigo: i.linha_codigo,
      valor_ia: mascarar(i, i.valor_ia),
      confianca: i.confianca,
      valor_final: mascarar(i, i.valor_final),
      estado: i.estado,
    })),
  };
}

/** Pede a leitura da aplicação pelo outbox (só IDs, DEC-088); o worker cria itens e tarefas. */
export async function solicitarLeitura(n: Nucleo, tx: Executor, tenantId: string, aplicacaoId: string): Promise<void> {
  await tx.execute(sql`
    INSERT INTO outbox (id, tenant_id, tipo, payload, criado_em)
    VALUES (${n.id()}, ${tenantId}, 'leitura.solicitada', ${JSON.stringify({ aplicacao_id: aplicacaoId })}::jsonb, ${n.agora()})`);
}

/**
 * Estado de quem vai ser lido (FL-001): `aguardando_cota` com aviso ERR-003 se o teto do mês já
 * foi atingido; senão `em_leitura`, com a leitura solicitada.
 */
export async function iniciarLeitura(n: Nucleo, tx: Executor, tenantId: string, aplicacaoId: string): Promise<'em_leitura' | 'aguardando_cota'> {
  const cota = await cotaDoTenant(n, tx, tenantId);
  if (cota.atingido) {
    await tx.execute(sql`UPDATE aplicacao SET estado = 'aguardando_cota', aviso = 'ERR-003', versao = versao + 1 WHERE id = ${aplicacaoId}`);
    return 'aguardando_cota';
  }
  await tx.execute(sql`UPDATE aplicacao SET estado = 'em_leitura', aviso = NULL, versao = versao + 1 WHERE id = ${aplicacaoId}`);
  await solicitarLeitura(n, tx, tenantId, aplicacaoId);
  return 'em_leitura';
}

/** Aplicação do tenant da sessão (RLS) num projeto do escopo; senão 404 auditado (PLANO §6.1). */
export async function aplicacaoNoEscopo(tx: Executor, id: string, bloquear = false): Promise<LinhaAplicacao> {
  if (!ehUuid(id)) throw naoEncontrado('Aplicacao', null);
  const a = await linha<LinhaAplicacao>(
    tx,
    bloquear
      ? sql`SELECT ${COLUNAS_APLICACAO} FROM aplicacao WHERE id = ${id} FOR UPDATE`
      : sql`SELECT ${COLUNAS_APLICACAO} FROM aplicacao WHERE id = ${id}`,
  );
  if (!a) throw naoEncontrado('Aplicacao', id);
  try {
    await projetoNoEscopo(tx, a.projeto_id);
  } catch {
    throw naoEncontrado('Aplicacao', id);
  }
  return a;
}
