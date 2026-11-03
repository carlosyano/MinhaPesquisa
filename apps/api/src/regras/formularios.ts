// Regras do conteúdo de versões (RF-004) como funções puras, para teste sem banco e mutação
// (DEC-052): RN-017, RN-019, RN-021 (DEC-095), RN-047 (DEC-096, DEC-097).

import { ErroApi } from '../infra/erros.js';

export interface OpcaoEntrada {
  codigo: string;
  rotulo: string;
  ordem: number;
}

export interface PerguntaEntrada {
  codigo: string;
  tipo: string;
  enunciado: string;
  ordem: number;
  pagina: number;
  obrigatorio?: boolean;
  campo_respondente?: string | null;
  campo_aplicacao?: string | null;
  sensibilidade?: string;
  linhas?: OpcaoEntrada[];
  valor_min?: number | null;
  valor_max?: number | null;
  unidade?: string | null;
  opcoes?: OpcaoEntrada[];
}

export interface RegraEntrada {
  pergunta_origem_codigo: string;
  pergunta_destino_codigo: string;
  opcao_codigo: string;
}

export interface Pergunta {
  codigo: string;
  tipo: string;
  enunciado: string;
  ordem: number;
  pagina: number;
  obrigatorio: boolean;
  campo_respondente: string | null;
  campo_aplicacao: string | null;
  sensibilidade: 'identificacao' | 'saude' | 'outro';
  linhas: OpcaoEntrada[] | null;
  valor_min: number | null;
  valor_max: number | null;
  unidade: string | null;
  opcoes: OpcaoEntrada[] | null;
}

/** Opções fixas de sim/não (RN-047). */
export const OPCOES_SIM_NAO: readonly OpcaoEntrada[] = [
  { codigo: 'sim', rotulo: 'Sim', ordem: 1 },
  { codigo: 'nao', rotulo: 'Não', ordem: 2 },
];

const TIPOS_COM_OPCOES = new Set(['escolha_unica', 'multipla_escolha', 'escala', 'matriz', 'sim_nao']);
const TIPOS_ORIGEM_SALTO = new Set(['sim_nao', 'escolha_unica']);

function invalido(campo: string): ErroApi {
  return new ErroApi('ERR-001', { campos: [campo] });
}

function semRepetir<T>(itens: readonly T[], chave: (x: T) => string, campo: string): void {
  const vistos = new Set<string>();
  for (const x of itens) {
    const k = chave(x);
    if (vistos.has(k)) throw invalido(campo);
    vistos.add(k);
  }
}

/** A pergunta é de identificação do respondente ou do aplicador (RN-039, RN-047). */
export function ehIdentificacao(p: { campo_respondente?: string | null; campo_aplicacao?: string | null }): boolean {
  return !!p.campo_respondente || p.campo_aplicacao === 'aplicador';
}

/**
 * Normaliza e valida o conteúdo de um rascunho (o schema do contrato já foi aplicado).
 * Lança ERR-001 com o campo do problema.
 */
export function normalizarConteudo(perguntas: readonly PerguntaEntrada[], regras: readonly RegraEntrada[]): Pergunta[] {
  semRepetir(perguntas, (p) => p.codigo, 'perguntas');
  const saida = perguntas.map((p): Pergunta => {
    let sensibilidade: Pergunta['sensibilidade'];
    if (ehIdentificacao(p)) sensibilidade = 'identificacao';
    else if (p.sensibilidade === 'identificacao') throw invalido('sensibilidade'); // DEC-097
    else sensibilidade = (p.sensibilidade as 'saude' | 'outro' | undefined) ?? 'saude';

    let opcoes: OpcaoEntrada[] | null = null;
    if (p.tipo === 'sim_nao') opcoes = OPCOES_SIM_NAO.map((o) => ({ ...o }));
    else if (TIPOS_COM_OPCOES.has(p.tipo)) opcoes = [...(p.opcoes ?? [])].sort((a, b) => a.ordem - b.ordem);
    else if (p.opcoes?.length) throw invalido('opcoes');
    if (opcoes) semRepetir(opcoes, (o) => o.codigo, 'opcoes');

    let linhas: OpcaoEntrada[] | null = null;
    if (p.tipo === 'matriz') linhas = [...(p.linhas ?? [])].sort((a, b) => a.ordem - b.ordem);
    else if (p.linhas?.length) throw invalido('linhas');
    if (linhas) semRepetir(linhas, (l) => l.codigo, 'linhas');

    if (p.valor_min !== null && p.valor_min !== undefined && p.valor_max !== null && p.valor_max !== undefined && p.valor_min > p.valor_max) throw invalido('valor_min');

    return {
      codigo: p.codigo,
      tipo: p.tipo,
      enunciado: p.enunciado,
      ordem: p.ordem,
      pagina: p.pagina,
      obrigatorio: p.obrigatorio ?? false,
      campo_respondente: p.campo_respondente ?? null,
      campo_aplicacao: p.campo_aplicacao ?? null,
      sensibilidade,
      linhas,
      valor_min: p.valor_min ?? null,
      valor_max: p.valor_max ?? null,
      unidade: p.unidade ?? null,
      opcoes,
    };
  });
  validarRegrasSalto(saida, regras);
  return saida;
}

/**
 * DEC-095: origem sim_nao ou escolha_unica; opção existente na origem; origem ≠ destino;
 * destino depois da origem; uma regra por destino; sem ciclo.
 */
export function validarRegrasSalto(perguntas: readonly Pergunta[], regras: readonly RegraEntrada[]): void {
  const por = new Map(perguntas.map((p) => [p.codigo, p]));
  const destinos = new Set<string>();
  const arestas = new Map<string, string[]>();
  for (const r of regras) {
    const origem = por.get(r.pergunta_origem_codigo);
    const destino = por.get(r.pergunta_destino_codigo);
    if (!origem || !destino) throw invalido('regras_salto');
    if (origem.codigo === destino.codigo) throw invalido('regras_salto');
    if (!TIPOS_ORIGEM_SALTO.has(origem.tipo)) throw invalido('regras_salto');
    if (!(origem.opcoes ?? []).some((o) => o.codigo === r.opcao_codigo)) throw invalido('regras_salto');
    if (destino.ordem <= origem.ordem) throw invalido('regras_salto');
    if (destinos.has(destino.codigo)) throw invalido('regras_salto');
    destinos.add(destino.codigo);
    arestas.set(origem.codigo, [...(arestas.get(origem.codigo) ?? []), destino.codigo]);
  }
  if (temCiclo(arestas)) throw invalido('regras_salto');
}

export function temCiclo(arestas: ReadonlyMap<string, readonly string[]>): boolean {
  const estado = new Map<string, 1 | 2>(); // 1 = visitando, 2 = concluído
  const visitar = (no: string): boolean => {
    const e = estado.get(no);
    if (e === 1) return true;
    if (e === 2) return false;
    estado.set(no, 1);
    for (const prox of arestas.get(no) ?? []) if (visitar(prox)) return true;
    estado.set(no, 2);
    return false;
  };
  for (const no of arestas.keys()) if (visitar(no)) return true;
  return false;
}

/** Campos da RN-017, na ordem em que são listados no ERR-036. */
export const CAMPOS_PUBLICACAO = ['nome', 'data_nascimento', 'cpf', 'data_aplicacao', 'local_aplicacao'] as const;

/**
 * O que impede a publicação (ERR-036): campos da RN-017 ausentes e, depois, códigos das
 * perguntas fora da estrutura da RN-047 (DEC-096). Lista vazia = pode publicar.
 */
export function pendenciasPublicacao(perguntas: readonly Pergunta[]): string[] {
  const tem = (f: (p: Pergunta) => boolean) => perguntas.some(f);
  const faltam: string[] = [];
  if (!tem((p) => p.campo_respondente === 'nome')) faltam.push('nome');
  if (!tem((p) => p.campo_respondente === 'data_nascimento')) faltam.push('data_nascimento');
  if (!tem((p) => p.campo_respondente === 'cpf' && p.tipo === 'cpf')) faltam.push('cpf');
  if (!tem((p) => p.campo_aplicacao === 'data_aplicacao')) faltam.push('data_aplicacao');
  if (!tem((p) => p.campo_aplicacao === 'local_aplicacao')) faltam.push('local_aplicacao');
  for (const p of [...perguntas].sort((a, b) => a.ordem - b.ordem)) {
    const semLinhas = p.tipo === 'matriz' && !(p.linhas?.length && p.opcoes?.length);
    const semNenhuma = p.tipo === 'multipla_escolha' && !(p.opcoes ?? []).some((o) => o.codigo === 'nenhuma_das_anteriores');
    if (semLinhas || semNenhuma) faltam.push(p.codigo);
  }
  return faltam;
}

/** Total de páginas impressas da versão (a maior página usada; no mínimo 1). */
export function totalPaginas(perguntas: readonly { pagina: number }[]): number {
  return Math.max(1, ...perguntas.map((p) => p.pagina));
}
