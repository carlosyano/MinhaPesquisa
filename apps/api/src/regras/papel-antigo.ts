// Regras da CHG-017 como funções puras (RN-052, DEC-171, DEC-174, DEC-176, DEC-178, DEC-179,
// DEC-188): conferência das páginas ao fim da localização, folga e sobreposição das regiões, perguntas
// `nao_consta` e o nome normalizado do vínculo sem CPF. Nada aqui conhece banco nem provedor.

import { ErroApi } from '../infra/erros.js';
import { paginasCompletas } from './upload.js';

export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

// ───────────────────────────── conferência das páginas ─────────────────────────────

export interface FolhaLocalizada {
  id: string;
  /** Página do QR legível da folha, da versão da aplicação. */
  paginaQr: number | null;
  /** O que a localização indicou (DEC-178). */
  paginaLocalizada: number | null;
  confianca: number | null;
  /** Página gravada; depois do `identifyApplication`, a informada pela usuária. */
  numeroPagina: number | null;
}

export interface Conferencia {
  total: number;
  /** Páginas da versão sem perguntas (DEC-181, DEC-188). */
  semPerguntas: ReadonlySet<number>;
  limite: number;
  /** Páginas informadas no `identifyApplication`: sem conferência com o QR nem pela confiança (RN-052, item 3a). */
  informadas: boolean;
}

/**
 * Conferência do item 3 da RN-052 quando todas as folhas estão localizadas: devolve a página de
 * cada folha, ou null quando a aplicação vai a `identificacao_pendente` (folha não reconhecida, salvo
 * a eliminação da DEC-188, página divergente do QR, ou páginas faltantes, repetidas ou além do total).
 */
export function conferirPaginas(folhas: readonly FolhaLocalizada[], c: Conferencia): Map<string, number> | null {
  const paginas = new Map<string, number>();
  if (c.informadas) {
    for (const f of folhas) if (f.numeroPagina !== null) paginas.set(f.id, f.numeroPagina);
  } else {
    const soltas: FolhaLocalizada[] = [];
    for (const f of folhas) {
      const reconhecida = f.paginaLocalizada !== null && f.paginaLocalizada >= 1 && f.paginaLocalizada <= c.total && (f.confianca ?? 0) >= c.limite;
      if (f.paginaQr !== null) {
        if (!reconhecida || f.paginaLocalizada !== f.paginaQr) return null; // DEC-171
        paginas.set(f.id, f.paginaQr);
      } else if (reconhecida) {
        paginas.set(f.id, f.paginaLocalizada!);
      } else {
        soltas.push(f);
      }
    }
    if (soltas.length) {
      const usadas = new Set(paginas.values());
      const faltam = Array.from({ length: c.total }, (_, i) => i + 1).filter((n) => !usadas.has(n));
      if (soltas.length !== 1 || faltam.length !== 1 || !c.semPerguntas.has(faltam[0])) return null;
      paginas.set(soltas[0].id, faltam[0]); // por eliminação (DEC-188)
    }
  }
  return paginas.size === folhas.length && paginasCompletas([...paginas.values()], c.total) ? paginas : null;
}

// ───────────────────────────── regiões ─────────────────────────────

/** Folga do recorte da tela de revisão, de cada lado, em fração da imagem. */
export const FOLGA = 0.02;

/** Região com a folga, limitada à imagem. */
export function comFolga(r: Regiao): Regiao {
  const x = Math.max(0, r.x - FOLGA);
  const y = Math.max(0, r.y - FOLGA);
  return { x, y, largura: Math.min(1, r.x + r.largura + FOLGA) - x, altura: Math.min(1, r.y + r.altura + FOLGA) - y };
}

/** Menor região que contém as dadas (as linhas de uma matriz saem num só recorte). */
export function envoltoria(rs: readonly Regiao[]): Regiao {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, largura: Math.max(...rs.map((r) => r.x + r.largura)) - x, altura: Math.max(...rs.map((r) => r.y + r.altura)) - y };
}

// ───────────────────────────── perguntas que não constam ─────────────────────────────

/** Marcações das perguntas que PODEM ser `nao_consta` no papel antigo (DEC-179): o nome, não. */
export function podeNaoConstar(p: { campo_respondente?: string | null; campo_aplicacao?: string | null }): boolean {
  return p.campo_respondente === 'cpf' || p.campo_respondente === 'data_nascimento' || p.campo_aplicacao === 'data_aplicacao' || p.campo_aplicacao === 'local_aplicacao';
}

/**
 * Gravação do rascunho (DEC-179, DEC-181, ENT-006): `nao_consta` só no papel antigo e nas perguntas
 * de CPF, data de nascimento, data e local; `total_paginas` só no papel antigo e não menor que a
 * maior página das perguntas. Lança ERR-001 com os códigos das perguntas ou `total_paginas`.
 */
export function validarPapelAntigo(
  perguntas: readonly { codigo: string; ordem: number; pagina: number; nao_consta?: boolean; campo_respondente?: string | null; campo_aplicacao?: string | null }[],
  papelAntigo: boolean,
  totalPaginas: number | null,
): void {
  const campos = [...perguntas]
    .sort((a, b) => a.ordem - b.ordem)
    .filter((p) => p.nao_consta && (!papelAntigo || !podeNaoConstar(p)))
    .map((p) => p.codigo);
  if (campos.length) throw new ErroApi('ERR-001', { campos });
  if (totalPaginas !== null && (!papelAntigo || totalPaginas < Math.max(1, ...perguntas.map((p) => p.pagina)))) {
    throw new ErroApi('ERR-001', { campos: ['total_paginas'] });
  }
}

// ───────────────────────────── vínculo pelo nome ─────────────────────────────

/** Nome normalizado (DEC-176): sem acento, sem diferença de maiúsculas, espaços das pontas e repetidos. */
export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
