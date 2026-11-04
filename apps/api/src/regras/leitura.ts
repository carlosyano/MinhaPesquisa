// Estado do item de resposta ao fim da leitura (FL-002) como função pura, base do teste de
// mutação (DEC-052). A primeira regra que se aplica decide; a confiança é comparada no valor
// bruto e só a estritamente maior que o limite confirma (DEC-028, DEC-047).

import { normalizarCpf } from './cpf.js';

export type EstadoItem =
  | 'pendente_leitura'
  | 'aguardando_condicao'
  | 'confirmado_automaticamente'
  | 'a_revisar'
  | 'confirmado'
  | 'corrigido'
  | 'em_branco'
  | 'ilegivel'
  | 'rasurado'
  | 'nao_se_aplica';

export type TipoPergunta =
  | 'escolha_unica'
  | 'multipla_escolha'
  | 'escala'
  | 'matriz'
  | 'numero'
  | 'data'
  | 'sim_nao'
  | 'cpf'
  | 'texto_curto'
  | 'texto_livre';

/** Situação da origem da regra de salto de que o item é destino (RN-021). */
export interface SaltoItem {
  estadoOrigem: EstadoItem;
  /** Valor efetivo da origem (final, ou o lido quando confirmado automaticamente). */
  valorOrigem: string | null;
  /** A regra mostra o destino só quando a origem tem esta opção. */
  opcaoMostrar: string;
}

export interface EntradaItem {
  tipo: TipoPergunta;
  /** Valor lido no formato canônico (REQ §5.4); null em branco. */
  valor: string | null;
  confianca: number;
  limite: number;
  opcoes?: readonly string[];
  valor_min?: number | null;
  valor_max?: number | null;
  salto?: SaltoItem | null;
}

/** Itens que já não impedem a conclusão (FL-002, "item resolvido"). */
export const RESOLVIDOS: ReadonlySet<EstadoItem> = new Set([
  'confirmado_automaticamente',
  'confirmado',
  'corrigido',
  'em_branco',
  'ilegivel',
  'rasurado',
  'nao_se_aplica',
]);

const INDETERMINADA: ReadonlySet<EstadoItem> = new Set(['pendente_leitura', 'aguardando_condicao', 'a_revisar']);
const ORIGEM_RESOLVIDA: ReadonlySet<EstadoItem> = new Set(['confirmado_automaticamente', 'confirmado', 'corrigido']);
const SEM_VALOR: ReadonlySet<EstadoItem> = new Set(['em_branco', 'ilegivel', 'rasurado']);
const SEMPRE_REVISAR: ReadonlySet<TipoPergunta> = new Set(['cpf', 'texto_livre', 'texto_curto']);

export const NENHUMA = 'nenhuma_das_anteriores';
const OPCOES_SIM_NAO = ['sim', 'nao'];

/**
 * O que a origem decide para o destino: `aguardar` (regra 1), `pular` (regras 2 e 3),
 * `origem_pulada` (regra 4), `indeterminada` (regra 4a) ou `mostrar` (segue para as regras 5 a 9).
 */
export type DecisaoSalto = 'aguardar' | 'pular' | 'origem_pulada' | 'indeterminada' | 'mostrar';

export function decisaoSalto(s: SaltoItem): DecisaoSalto {
  if (INDETERMINADA.has(s.estadoOrigem)) return 'aguardar';
  if (s.estadoOrigem === 'nao_se_aplica') return 'origem_pulada';
  if (SEM_VALOR.has(s.estadoOrigem)) return 'indeterminada';
  if (ORIGEM_RESOLVIDA.has(s.estadoOrigem)) {
    const marcadas = (s.valorOrigem ?? '').split(';');
    return marcadas.includes(s.opcaoMostrar) ? 'mostrar' : 'pular';
  }
  return 'indeterminada';
}

const NUMERO = /^-?\d+(\.\d+)?$/;

function dataValida(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function naFaixa(n: number, min?: number | null, max?: number | null): boolean {
  return (min === null || min === undefined || n >= min) && (max === null || max === undefined || n <= max);
}

/** Valor no schema da pergunta (FL-002 regra 7, CA-006): tipo, faixa e opções. */
export function valorNoSchema(e: Pick<EntradaItem, 'tipo' | 'opcoes' | 'valor_min' | 'valor_max'>, valor: string): boolean {
  const opcoes = e.opcoes?.length ? e.opcoes : e.tipo === 'sim_nao' ? OPCOES_SIM_NAO : [];
  switch (e.tipo) {
    case 'escolha_unica':
    case 'sim_nao':
    case 'matriz':
      return opcoes.includes(valor);
    case 'multipla_escolha': {
      const marcadas = valor.split(';');
      if (new Set(marcadas).size !== marcadas.length || !marcadas.every((m) => opcoes.includes(m))) return false;
      return !(marcadas.includes(NENHUMA) && marcadas.length > 1);
    }
    case 'escala':
      if (opcoes.length) return opcoes.includes(valor);
      return /^-?\d+$/.test(valor) && naFaixa(Number(valor), e.valor_min, e.valor_max);
    case 'numero':
      return NUMERO.test(valor) && naFaixa(Number(valor), e.valor_min, e.valor_max);
    case 'data':
      return dataValida(valor);
    case 'cpf':
      return /^\d{11}$/.test(valor);
    case 'texto_curto':
    case 'texto_livre':
      return valor.length <= 2000;
  }
}

/** Estado do item pela ordem de avaliação da FL-002. */
export function estadoAposLeitura(e: EntradaItem): EstadoItem {
  const emBranco = e.valor === null || e.valor.trim() === '';
  if (e.salto) {
    const d = decisaoSalto(e.salto);
    if (d === 'aguardar') return 'aguardando_condicao'; // regra 1
    if (d === 'pular' || d === 'origem_pulada') return emBranco ? 'nao_se_aplica' : 'a_revisar'; // regras 2, 3 e 4
    if (d === 'indeterminada') return 'a_revisar'; // regra 4a
  }
  if (SEMPRE_REVISAR.has(e.tipo)) return 'a_revisar'; // regras 5 e 6
  if (emBranco) return 'a_revisar'; // regra 6a
  if (!valorNoSchema(e, e.valor!)) return 'a_revisar'; // regra 7
  return e.confianca > e.limite ? 'confirmado_automaticamente' : 'a_revisar'; // regras 8 e 9
}

/**
 * Formato canônico do valor lido (REQ §5.4): sem espaços nas pontas, múltipla escolha com os
 * códigos em ordem alfabética e CPF com 11 dígitos quando a máscara é reconhecível. O que não se
 * reconhece fica como veio, para a regra 7 mandar à revisão.
 */
export function canonizar(tipo: TipoPergunta, valor: string | null): string | null {
  if (valor === null) return null;
  const v = valor.trim();
  if (v === '') return null;
  if (tipo === 'multipla_escolha') return v.split(';').map((x) => x.trim()).sort().join(';');
  if (tipo === 'cpf') return normalizarCpf(v) ?? v;
  return v.slice(0, 2000);
}
