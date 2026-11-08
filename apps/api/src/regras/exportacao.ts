// Formato longo da exportação (RN-051, DEC-153 a DEC-160, DEC-162, DEC-166): de uma aplicação já
// carregada às linhas da planilha, sem banco nem arquivo. A gravação em CSV ou XLSX fica em
// infra/planilha.ts.

import type { EstadoItem, TipoPergunta } from './leitura.js';

/** Cabeçalho da RN-051, nesta ordem (com `Arquivo` e `Complemento`, DEC-201). */
export const COLUNAS = [
  'ID_Aplicacao',
  'Arquivo',
  'CPF',
  'Nome',
  'Data_Aplicacao',
  'Codigo_Pergunta',
  'Codigo_Linha',
  'Codigo_Opcao_Valor',
  'Rotulo_Opcao_Valor',
  'Complemento',
  'Situacao',
] as const;

/**
 * Literal de array do PostgreSQL para UUIDs já validados (o `sql` expandiria um array JS em lista
 * de parâmetros).
 */
export const arrayUuid = (ids: readonly string[]) => `{${ids.join(',')}}`;

/** Célula: texto ou número (só os valores de `escala` e `numero`, DEC-165 (2)). */
export type Celula = { texto: string } | { numero: string };

export type Situacao = 'respondida' | 'em_branco' | 'ilegivel' | 'rasurado' | 'nao_se_aplica';

/** Item de resposta com o que a linha precisa da pergunta, na ordem da versão. */
export interface ItemExportado {
  pergunta_id: string;
  codigo: string;
  linha_codigo: string | null;
  /** Opção do item de complemento, que não gera linha própria (DEC-201). */
  opcao_codigo: string | null;
  pagina: number;
  /** Pergunta que o papel antigo não tem: sem arquivo (DEC-179, RN-051). */
  nao_consta: boolean;
  tipo: TipoPergunta;
  campo_respondente: string | null;
  campo_aplicacao: string | null;
  estado: EstadoItem;
  valor_final: string | null;
}

export interface AplicacaoExportada {
  id: string;
  cpf: string;
  nome: string;
  data_aplicacao: string;
  /** Itens já em ordem de página, ordem da pergunta e ordem da linha da matriz. */
  itens: ItemExportado[];
  /** Opções de cada pergunta (código → rótulo), na ordem da versão. */
  opcoes: Map<string, { codigo: string; rotulo: string }[]>;
  /** Nome do arquivo da folha de formulário de cada página da versão, quando guardado (DEC-198). */
  arquivos: Map<number, string>;
}

/** Complemento exportado: o valor final do item resolvido com valor (DEC-199, RN-051). */
const COM_VALOR = new Set<string>(['confirmado_automaticamente', 'confirmado', 'corrigido']);

const SEM_VALOR = new Set<string>(['em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica']);

/** Perguntas que já estão nas colunas ou ficam fora da planilha (DEC-162). */
export function foraDaPlanilha(i: Pick<ItemExportado, 'campo_respondente' | 'campo_aplicacao'>): boolean {
  return ['nome', 'data_nascimento', 'cpf'].includes(i.campo_respondente ?? '') || i.campo_aplicacao === 'data_aplicacao';
}

export function situacao(i: Pick<ItemExportado, 'estado' | 'valor_final'>): Situacao {
  if (SEM_VALOR.has(i.estado)) return i.estado as Situacao;
  return i.valor_final === null || i.valor_final === '' ? 'em_branco' : 'respondida';
}

/**
 * Linhas de uma aplicação (RN-051, regras 1 a 4): uma por opção marcada na múltipla escolha, na
 * ordem das opções da versão; uma por linha da matriz; uma nos demais tipos; e uma, com valor
 * vazio e a situação, no item sem resposta.
 */
export function linhasDaAplicacao(a: AplicacaoExportada): Celula[][] {
  const linhas: Celula[][] = [];
  const t = (texto: string): Celula => ({ texto });
  // O complemento vai na linha da sua opção (DEC-201), pela pergunta e pelo código da opção.
  const complemento = new Map<string, string>();
  for (const c of a.itens) if (c.opcao_codigo && COM_VALOR.has(c.estado) && c.valor_final) complemento.set(`${c.pergunta_id}|${c.opcao_codigo}`, c.valor_final);
  const linha = (i: ItemExportado, valor: Celula, rotulo: string, s: Situacao, opcao: string | null = null) =>
    linhas.push([
      t(a.id),
      t(i.nao_consta ? '' : (a.arquivos.get(i.pagina) ?? '')),
      t(a.cpf),
      t(a.nome),
      t(a.data_aplicacao),
      t(i.codigo),
      t(i.linha_codigo ?? ''),
      valor,
      t(rotulo),
      t(opcao === null ? '' : (complemento.get(`${i.pergunta_id}|${opcao}`) ?? '')),
      t(s),
    ]);
  for (const i of a.itens) {
    if (i.opcao_codigo || foraDaPlanilha(i)) continue;
    const s = situacao(i);
    if (s !== 'respondida') {
      linha(i, t(''), '', s);
      continue;
    }
    const opcoes = a.opcoes.get(i.pergunta_id) ?? [];
    const rotulo = (codigo: string) => opcoes.find((o) => o.codigo === codigo)?.rotulo ?? '';
    const valor = i.valor_final!;
    if (i.tipo === 'multipla_escolha') {
      const marcadas = new Set(valor.split(';'));
      for (const o of opcoes) if (marcadas.has(o.codigo)) linha(i, t(o.codigo), o.rotulo, s, o.codigo);
    } else if (i.tipo === 'escala' || i.tipo === 'numero') {
      linha(i, { numero: valor }, '', s);
    } else if (i.tipo === 'escolha_unica') {
      linha(i, t(valor), rotulo(valor), s, valor);
    } else if (i.tipo === 'sim_nao' || i.tipo === 'matriz') {
      linha(i, t(valor), rotulo(valor), s);
    } else {
      linha(i, t(valor), '', s);
    }
  }
  return linhas;
}

/**
 * Texto que o Excel leria como fórmula ao abrir o CSV: começa com `=`, `+`, `-`, `@`, tabulação ou
 * retorno de carro (DEC-166). Só o CSV recebe o apóstrofo; no XLSX a célula de texto não vira
 * fórmula.
 */
export function neutralizarCsv(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}
