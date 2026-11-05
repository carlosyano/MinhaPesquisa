// Campos obrigatórios padronizados em todo rascunho (RN-050, DEC-134, DEC-135, DEC-145, DEC-147)
// como funções puras: os 5 campos do rascunho novo, a reaplicação e as recusas da gravação e a
// padronização da cópia de versão.

import { ErroApi } from '../infra/erros.js';
import type { PerguntaEntrada, RegraEntrada } from './formularios.js';

export interface CampoPadrao {
  codigo: string;
  tipo: string;
  enunciado: string;
  campo_respondente: string | null;
  campo_aplicacao: string | null;
  sensibilidade: 'identificacao' | 'outro';
}

/** Tabela da RN-050, na ordem em que os campos nascem e em que as recusas são listadas. */
export const CAMPOS_RN050: readonly CampoPadrao[] = [
  { codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', campo_respondente: 'nome', campo_aplicacao: null, sensibilidade: 'identificacao' },
  { codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', campo_respondente: 'data_nascimento', campo_aplicacao: null, sensibilidade: 'identificacao' },
  { codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', campo_respondente: 'cpf', campo_aplicacao: null, sensibilidade: 'identificacao' },
  { codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', campo_respondente: null, campo_aplicacao: 'data_aplicacao', sensibilidade: 'outro' },
  { codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', campo_respondente: null, campo_aplicacao: 'local_aplicacao', sensibilidade: 'outro' },
];

export const CODIGOS_RESERVADOS: ReadonlySet<string> = new Set(CAMPOS_RN050.map((c) => c.codigo));

/** A pergunta tem a marcação do campo. */
export const marcada = (p: Pick<PerguntaEntrada, 'campo_respondente' | 'campo_aplicacao'>, c: CampoPadrao) =>
  c.campo_respondente ? p.campo_respondente === c.campo_respondente : p.campo_aplicacao === c.campo_aplicacao;

const temMarcacao = (p: PerguntaEntrada) => CAMPOS_RN050.some((c) => marcada(p, c));

/** O campo da RN-050 com código, tipo, obrigatoriedade e sensibilidade da tabela (DEC-145). */
export function padronizar<T extends PerguntaEntrada>(p: T, c: CampoPadrao): T {
  const { opcoes: _o, linhas: _l, ...resto } = p;
  return {
    ...resto,
    codigo: c.codigo,
    tipo: c.tipo,
    obrigatorio: true,
    campo_respondente: c.campo_respondente,
    campo_aplicacao: c.campo_aplicacao,
    sensibilidade: c.sensibilidade,
  } as T;
}

/** Os 5 campos com o enunciado padrão, no início da página 1 (ordem 1 a 5). */
export function cincoCampos(): PerguntaEntrada[] {
  return CAMPOS_RN050.map((c, i) => padronizar({ codigo: c.codigo, tipo: c.tipo, enunciado: c.enunciado, ordem: i + 1, pagina: 1 }, c));
}

/**
 * Gravação do rascunho (RN-050, DEC-145): recusa com ERR-001, com todas as violações juntas em
 * `campos` (na ordem da tabela e depois na ordem das perguntas), a falta ou a repetição de uma
 * marcação e um dos 5 códigos usado sem a marcação; sem violação, reaplica a cada pergunta marcada
 * o código, o tipo, a obrigatoriedade e a sensibilidade da tabela.
 */
export function reaplicarCampos(perguntas: readonly PerguntaEntrada[]): PerguntaEntrada[] {
  const campos: string[] = [];
  for (const c of CAMPOS_RN050) if (perguntas.filter((p) => marcada(p, c)).length !== 1) campos.push(c.codigo);
  for (const p of [...perguntas].sort((a, b) => a.ordem - b.ordem)) {
    if (CODIGOS_RESERVADOS.has(p.codigo) && !temMarcacao(p) && !campos.includes(p.codigo)) campos.push(p.codigo);
  }
  if (campos.length) throw new ErroApi('ERR-001', { campos });
  return perguntas.map((p) => {
    const c = CAMPOS_RN050.find((x) => marcada(p, x));
    return c ? padronizar(p, c) : p;
  });
}

/**
 * Código com sufixo `_2`, `_3`… quando já usado (RN-049, DEC-147), cortando antes o necessário
 * para caber em `limite` caracteres. Acrescenta o código escolhido a `usados`.
 */
export function semColisao(base: string, usados: Set<string>, limite = 40): string {
  let codigo = base;
  for (let n = 2; usados.has(codigo); n++) {
    const sufixo = `_${n}`;
    codigo = base.slice(0, limite - sufixo.length).replace(/_+$/, '') + sufixo;
  }
  usados.add(codigo);
  return codigo;
}

/**
 * Cópia de versão (RN-050, DEC-145, DEC-147): pergunta sem marcação com um dos 5 códigos ganha
 * sufixo; a primeira pergunta de cada marcação é padronizada; as que faltam são injetadas no início
 * da página 1. As regras de salto seguem os códigos novos.
 */
export function padronizarCopia(
  perguntas: readonly PerguntaEntrada[],
  regras: readonly RegraEntrada[],
): { perguntas: PerguntaEntrada[]; regras: RegraEntrada[] } {
  const ordenadas = [...perguntas].sort((a, b) => a.ordem - b.ordem);
  const renomear = new Map<string, string>();
  const usados = new Set([...ordenadas.map((p) => p.codigo), ...CODIGOS_RESERVADOS]);
  const primeiras = new Map<CampoPadrao, PerguntaEntrada>();
  for (const c of CAMPOS_RN050) {
    const p = ordenadas.find((x) => marcada(x, c));
    if (p) primeiras.set(c, p);
  }
  const saida = ordenadas.map((p) => {
    const c = CAMPOS_RN050.find((x) => primeiras.get(x) === p);
    if (c) {
      if (p.codigo !== c.codigo) renomear.set(p.codigo, c.codigo);
      return padronizar(p, c);
    }
    if (!CODIGOS_RESERVADOS.has(p.codigo)) return p;
    const novo = semColisao(p.codigo, usados);
    renomear.set(p.codigo, novo);
    return { ...p, codigo: novo };
  });
  const faltam = CAMPOS_RN050.filter((c) => !primeiras.has(c));
  const injetadas = faltam.map((c, i) => padronizar({ codigo: c.codigo, tipo: c.tipo, enunciado: c.enunciado, ordem: i + 1, pagina: 1 }, c));
  const deslocadas = saida.map((p) => ({ ...p, ordem: p.ordem + faltam.length }));
  const codigo = (x: string) => renomear.get(x) ?? x;
  return {
    perguntas: [...injetadas, ...deslocadas],
    regras: regras.map((r) => ({ ...r, pergunta_origem_codigo: codigo(r.pergunta_origem_codigo), pergunta_destino_codigo: codigo(r.pergunta_destino_codigo) })),
  };
}
