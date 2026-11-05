// Montagem da versão importada (RN-049, RN-050, DEC-138, DEC-139, DEC-143, DEC-144, DEC-149) como
// funções puras: validação da saída do extrator, ajustes com aviso, campos padronizados, códigos
// pela transformação T e distribuição pela altura do PDF. Nada aqui conhece banco nem provedor.

import { CAMPOS_RN050, CODIGOS_RESERVADOS, padronizar, semColisao, type CampoPadrao } from './campos-padrao.js';
import type { OpcaoEntrada, PerguntaEntrada } from './formularios.js';

export const TIPOS_PERGUNTA = ['escolha_unica', 'multipla_escolha', 'escala', 'matriz', 'numero', 'data', 'sim_nao', 'cpf', 'texto_curto', 'texto_livre'] as const;
export const CAMPOS_LIDOS = ['nome', 'data_nascimento', 'cpf', 'data_aplicacao', 'local_aplicacao', 'endereco', 'aplicador'] as const;
export type CampoLido = (typeof CAMPOS_LIDOS)[number];

/** Uma pergunta como o extrator a devolve: só o que está impresso (RN-049). */
export interface PerguntaLida {
  enunciado: string;
  /** Um dos 10 tipos do ENT-007 ou `desconhecido`. */
  tipo: string;
  opcoes?: string[];
  linhas?: string[];
  faixa?: { min: number; max: number } | null;
  campo_padrao?: CampoLido | null;
}

export type MotivoAviso = 'descartada' | 'tipo_incerto' | 'texto_cortado' | 'campo_repetido' | 'nao_cabe';

export interface Aviso {
  pagina: number;
  /** Ordem da pergunta na página do original, a partir de 1. */
  posicao: number;
  motivo: MotivoAviso;
}

const LIMITE_ENUNCIADO = 2000;
const LIMITE_ROTULO = 200;
const LIMITE_CODIGO = 40;

// ───────────────────────────── validação da saída (RN-037) ─────────────────────────────

const ehTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Confere a saída do extrator contra o formato da RN-049. Devolve a mensagem do primeiro desvio
 * (texto fixo, nunca conteúdo lido) ou as perguntas: qualquer desvio é falha da chamada.
 */
export function validarEstrutura(bruto: unknown): { perguntas: PerguntaLida[] } | { erro: string } {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray((bruto as { perguntas?: unknown }).perguntas)) return { erro: 'sem lista de perguntas' };
  const perguntas: PerguntaLida[] = [];
  for (const item of (bruto as { perguntas: unknown[] }).perguntas) {
    if (!item || typeof item !== 'object') return { erro: 'pergunta não é objeto' };
    const { enunciado, tipo, opcoes, linhas, faixa, campo_padrao, ...extra } = item as Record<string, unknown>;
    if (Object.keys(extra).length) return { erro: 'propriedade fora do formato' };
    if (typeof enunciado !== 'string') return { erro: 'enunciado não é texto' };
    if (typeof tipo !== 'string' || !(tipo === 'desconhecido' || (TIPOS_PERGUNTA as readonly string[]).includes(tipo))) return { erro: 'tipo fora do formato' };
    if (opcoes !== undefined && !ehTextos(opcoes)) return { erro: 'opções fora do formato' };
    if (linhas !== undefined && !ehTextos(linhas)) return { erro: 'linhas fora do formato' };
    if (faixa !== undefined && faixa !== null) {
      const f = faixa as Record<string, unknown>;
      if (typeof faixa !== 'object' || !ehNumero(f.min) || !ehNumero(f.max) || Object.keys(f).length !== 2) return { erro: 'faixa fora do formato' };
    }
    if (campo_padrao !== undefined && campo_padrao !== null && !(CAMPOS_LIDOS as readonly string[]).includes(campo_padrao as string)) return { erro: 'campo_padrao fora do formato' };
    perguntas.push({
      enunciado,
      tipo,
      ...(opcoes !== undefined ? { opcoes: opcoes as string[] } : {}),
      ...(linhas !== undefined ? { linhas: linhas as string[] } : {}),
      ...(faixa !== undefined ? { faixa: faixa as PerguntaLida['faixa'] } : {}),
      ...(campo_padrao !== undefined ? { campo_padrao: campo_padrao as CampoLido | null } : {}),
    });
  }
  return { perguntas };
}

// ───────────────────────────── transformação T ─────────────────────────────

/**
 * Transformação T da RN-049: sem a numeração do início (só no enunciado), sem acentos, cada
 * sequência fora de A-Z e 0-9 vira `_`, sem `_` nas pontas, cortado em 40.
 */
export function transformar(texto: string, enunciado: boolean): string {
  const s = enunciado ? texto.replace(/^\s*\d+[.)-]/, '') : texto;
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITE_CODIGO)
    .replace(/_+$/, '');
}

// ───────────────────────────── montagem ─────────────────────────────

/** Campos que a importação reconhece além dos 5 da RN-050 (DEC-149, DEC-152); não são obrigatórios nem injetados. */
const CAMPOS_DEC149: Record<'endereco' | 'aplicador', CampoPadrao> = {
  endereco: { codigo: 'ENDERECO', tipo: 'texto_curto', enunciado: 'Endereço do respondente', campo_respondente: 'endereco', campo_aplicacao: null, sensibilidade: 'identificacao' },
  aplicador: { codigo: 'APLICADOR', tipo: 'texto_curto', enunciado: 'Nome do aplicador', campo_respondente: null, campo_aplicacao: 'aplicador', sensibilidade: 'identificacao' },
};

const campoDe = (c: CampoLido): CampoPadrao =>
  c === 'endereco' || c === 'aplicador' ? CAMPOS_DEC149[c] : CAMPOS_RN050.find((x) => (x.campo_respondente ?? x.campo_aplicacao) === c)!;

/** Pergunta comum depois dos ajustes da tabela, ainda sem código, ordem nem página. */
interface Ajustada {
  pagina: number;
  posicao: number;
  enunciado: string;
  tipo: string;
  opcoes: string[];
  linhas: string[];
  faixa: { min: number; max: number } | null;
  /** Campo da DEC-149 reconhecido (endereço ou aplicador), que fica entre as comuns. */
  campo: CampoPadrao | null;
}

/** Medida da altura do bloco no PDF e base de cada página (DEC-143), do módulo de layout. */
export interface Medida {
  altura(p: PerguntaEntrada): number;
  /** Topo da área das perguntas, igual em todas as páginas. */
  topo: number;
  limiteInferior(pagina: number): number;
}

export interface VersaoImportada {
  perguntas: PerguntaEntrada[];
  avisos: Aviso[];
  /** Perguntas lidas que entraram na versão (as reconhecidas contam; as injetadas não). */
  lidas: number;
}

function cortar(texto: string, limite: number, aviso: () => void): string {
  if (texto.length <= limite) return texto;
  aviso();
  return texto.slice(0, limite);
}

function faixaValida(f: PerguntaLida['faixa']): { min: number; max: number } | null {
  return f && ehNumero(f.min) && ehNumero(f.max) && f.min <= f.max ? { min: f.min, max: f.max } : null;
}

/** Ajustes da tabela da RN-049 para uma pergunta comum; `null` quando descartada. */
function ajustar(q: PerguntaLida, pagina: number, posicao: number, avisar: (m: MotivoAviso) => void): Ajustada | null {
  const enunciado = q.enunciado.trim();
  if (!enunciado) {
    avisar('descartada');
    return null;
  }
  const rotulos = (lista: string[] | undefined) => {
    const saida: string[] = [];
    for (const r of lista ?? []) {
      if (!r.trim()) avisar('tipo_incerto');
      else saida.push(cortar(r.trim(), LIMITE_ROTULO, () => avisar('texto_cortado')));
    }
    return saida;
  };
  let tipo = q.tipo;
  if (!(TIPOS_PERGUNTA as readonly string[]).includes(tipo)) {
    avisar('tipo_incerto');
    tipo = 'texto_curto';
  }
  let opcoes: string[] = [];
  let linhas: string[] = [];
  let faixa: Ajustada['faixa'] = null;
  if (tipo === 'escolha_unica' || tipo === 'multipla_escolha') {
    opcoes = rotulos(q.opcoes);
    if (!opcoes.length) avisar('tipo_incerto');
    if (!opcoes.length) tipo = 'texto_curto';
  } else if (tipo === 'matriz') {
    linhas = rotulos(q.linhas);
    opcoes = rotulos(q.opcoes);
    if (!linhas.length || !opcoes.length) {
      avisar('tipo_incerto');
      tipo = 'texto_curto';
      linhas = [];
      opcoes = [];
    }
  } else if (tipo === 'escala') {
    faixa = faixaValida(q.faixa);
    if (!faixa) {
      avisar('tipo_incerto');
      tipo = 'numero';
    }
  } else if (tipo === 'numero') {
    faixa = faixaValida(q.faixa);
  }
  return { pagina, posicao, enunciado: cortar(enunciado, LIMITE_ENUNCIADO, () => avisar('texto_cortado')), tipo, opcoes, linhas, faixa, campo: null };
}

/** Opções ou linhas com códigos pela transformação T, únicos na pergunta (RN-019). */
function itens(rotulos: string[], prefixo: 'opcao' | 'linha'): OpcaoEntrada[] {
  const usados = new Set<string>();
  return rotulos.map((rotulo, i) => ({ codigo: semColisao(transformar(rotulo, false).toLowerCase() || `${prefixo}_${i + 1}`, usados), rotulo, ordem: i + 1 }));
}

/**
 * Monta a versão 1 a partir das páginas lidas, na ordem do envio (RN-049): ajustes com aviso,
 * passo 1 (RN-050 e DEC-149), códigos (passo 2), sensibilidade `saude` sem regras de salto (passo 3)
 * e distribuição pelas páginas do PDF (passo 4).
 */
export function montarVersao(paginas: readonly (readonly PerguntaLida[])[], medida: Medida): VersaoImportada {
  const avisos: Aviso[] = [];
  const reconhecidas = new Map<CampoLido, PerguntaLida>();
  const comuns: Ajustada[] = [];

  paginas.forEach((lidas, i) => {
    lidas.forEach((q, j) => {
      const pagina = i + 1;
      const posicao = j + 1;
      const avisar = (motivo: MotivoAviso) => {
        if (!avisos.some((a) => a.pagina === pagina && a.posicao === posicao && a.motivo === motivo)) avisos.push({ pagina, posicao, motivo });
      };
      const c = q.campo_padrao ?? null;
      if (c && !reconhecidas.has(c)) {
        reconhecidas.set(c, q);
        if (c === 'endereco' || c === 'aplicador') {
          const enunciado = q.enunciado.trim().slice(0, LIMITE_ENUNCIADO) || CAMPOS_DEC149[c].enunciado;
          comuns.push({ pagina, posicao, enunciado, tipo: 'texto_curto', opcoes: [], linhas: [], faixa: null, campo: CAMPOS_DEC149[c] });
        }
        return;
      }
      if (c) avisar('campo_repetido');
      const a = ajustar(q, pagina, posicao, avisar);
      if (a) comuns.push(a);
    });
  });

  // Passo 1: os 5 campos, reconhecidos (com o enunciado do original) ou injetados.
  const cinco = CAMPOS_RN050.map((c, i) => {
    const lida = [...reconhecidas.entries()].find(([k]) => campoDe(k) === c)?.[1];
    // O passo 1 não passa pela tabela de ajustes: sem aviso, como as opções descartadas.
    const enunciado = lida?.enunciado.trim().slice(0, LIMITE_ENUNCIADO) || c.enunciado;
    return padronizar({ codigo: c.codigo, tipo: c.tipo, enunciado, ordem: i + 1, pagina: 1 }, c);
  });

  // Passo 4 (com a medida da DEC-143): os 5 no início da página 1; as demais na ordem do original.
  let pagina = 1;
  let y = medida.topo;
  for (const p of cinco) y -= medida.altura(p);
  const usados = new Set([...CODIGOS_RESERVADOS, ...comuns.flatMap((p) => (p.campo ? [p.campo.codigo] : []))]);
  const perguntas: PerguntaEntrada[] = [...cinco];
  for (const a of comuns) {
    // Endereço e aplicador são opcionais no formulário (DEC-152).
    const base: PerguntaEntrada = a.campo
      ? { ...padronizar({ codigo: a.campo.codigo, tipo: a.tipo, enunciado: a.enunciado, ordem: perguntas.length + 1, pagina }, a.campo), obrigatorio: false }
      : {
          codigo: '',
          tipo: a.tipo,
          enunciado: a.enunciado,
          ordem: perguntas.length + 1,
          pagina,
          sensibilidade: 'saude', // DEC-138
          ...(a.opcoes.length ? { opcoes: itens(a.opcoes, 'opcao') } : {}),
          ...(a.linhas.length ? { linhas: itens(a.linhas, 'linha') } : {}),
          ...(a.faixa ? { valor_min: a.faixa.min, valor_max: a.faixa.max } : {}),
        };
    if (base.tipo === 'multipla_escolha' && !base.opcoes!.some((o) => o.codigo === 'nenhuma_das_anteriores')) {
      base.opcoes = [...base.opcoes!, { codigo: 'nenhuma_das_anteriores', rotulo: 'Nenhuma das anteriores', ordem: base.opcoes!.length + 1 }];
    }
    if (base.tipo === 'sim_nao') delete base.opcoes; // opções fixas sim e nao (RN-047)
    const altura = medida.altura(base);
    if (altura > medida.topo - medida.limiteInferior(2)) {
      avisos.push({ pagina: a.pagina, posicao: a.posicao, motivo: 'nao_cabe' });
      continue;
    }
    if (y - altura < medida.limiteInferior(pagina)) {
      pagina += 1;
      y = medida.topo;
    }
    y -= altura;
    // Passo 2: códigos pela transformação T, com sufixo quando já usados (inclusive os reservados).
    if (!a.campo) base.codigo = semColisao(transformar(a.enunciado, true).toUpperCase() || `P${a.pagina}_${a.posicao}`, usados);
    perguntas.push({ ...base, pagina });
  }

  avisos.sort((x, z) => x.pagina - z.pagina || x.posicao - z.posicao);
  return { perguntas, avisos, lidas: reconhecidas.size + perguntas.length - cinco.length - comuns.filter((p) => p.campo).length };
}
