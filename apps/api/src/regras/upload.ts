// Regras do upload (RF-006) como funções puras: validação de arquivo (DEC-029, DEC-042),
// leitura do conteúdo do QR e tabela de criação da FL-001 (REQ v2.9, CHG-019).

export type TipoArquivo = 'jpeg' | 'png' | 'pdf';

export const LIMITE_BYTES = 20 * 1024 * 1024; // DEC-029
export const LIMITE_PAGINAS = 50; // DEC-029

export const MOTIVO = {
  tamanho: 'excede o limite de 20 MB',
  paginas: 'excede o limite de 50 páginas',
  tipo: 'tipo de arquivo não permitido',
  malware: 'risco de segurança detectado',
} as const;

/** Tipo pela assinatura do conteúdo (magic bytes), nunca pelo nome nem pelo MIME declarado. */
export function tipoPorConteudo(b: Buffer): TipoArquivo | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  return null;
}

/** O que o QR `PPPPP.FFF.VV.X/Y` carrega (DEC-218): códigos do projeto e do formulário, versão e página sobre o total. */
export interface QrLido {
  projeto: number;
  formulario: number;
  versao: number;
  pagina: number;
  total: number;
}

const zeros = (n: number, largura: number) => String(n).padStart(largura, '0');

/** Conteúdo do QR impresso: "PPPPP.FFF.VV.X/Y", com zeros à esquerda (CA-028, DEC-218). */
export function conteudoQr(q: QrLido): string {
  return `${zeros(q.projeto, 5)}.${zeros(q.formulario, 3)}.${zeros(q.versao, 2)}.${q.pagina}/${q.total}`;
}

// Só o que decodifica nesse formato, com 1 ≤ X ≤ Y, conta como QR legível; o `MP1.` impresso antes da
// v2.9 e qualquer outro conteúdo contam como ausente (DEC-187, DEC-218).
const FORMATO_QR = /^(\d{5})\.(\d{3})\.(\d{2})\.([1-9]\d{0,2})\/([1-9]\d{0,2})$/;

export function lerConteudoQr(conteudo: string): QrLido | null {
  const m = FORMATO_QR.exec(conteudo);
  if (!m) return null;
  const [projeto, formulario, versao, pagina, total] = m.slice(1).map(Number);
  if (projeto < 1 || formulario < 1 || versao < 1 || pagina > total) return null;
  return { projeto, formulario, versao, pagina, total };
}

/** Códigos de projeto e de formulário da primeira folha cujo QR é de outro (ERR-045, DEC-215, DEC-224). */
export function primeiroQrDivergente(paginas: readonly PaginaLida[], projeto: number, formulario: number): QrLido | null {
  for (const p of paginas) {
    const q = p.qr ? lerConteudoQr(p.qr) : null;
    if (q && (q.projeto !== projeto || q.formulario !== formulario)) return q;
  }
  return null;
}

/** Página como lida no envio. `qr` null = sem QR legível no formato do MinhaPesquisa (DEC-187). */
export interface PaginaLida {
  qr: string | null;
}

/** Versão publicada do formulário escolhido a que um QR ou a escolha do envio se refere. */
export interface VersaoDoQr {
  versaoId: string;
  totalPaginas: number;
  papelAntigo: boolean;
}

/** Versão escolhida no envio (DEC-169): ausente, ou informada e resolvida (undefined = inválida). */
export type Escolhida = { informada: false } | { informada: true; versao: VersaoDoQr | undefined };

export type Criacao =
  | { estado: 'em_leitura'; aviso: null; versaoId: string; origemQr: boolean }
  | { estado: 'identificacao_pendente'; aviso: 'ERR-004' | 'ERR-039'; versaoId: string | null; origemQr: boolean };

/**
 * Tabela de criação da FL-001 (REQ v2.9), depois da conferência do projeto e do formulário (ordem 0,
 * ERR-045): (1) QR legível de versão inexistente, não publicada ou de papel antigo, ou com o total `Y`
 * diferente do `total_paginas` → ERR-039; (2) sem QR legível de versão válida e sem versão escolhida →
 * ERR-004; (3) sem esse QR e versão escolhida inválida → ERR-039; (4) versões diferentes, página de QR
 * repetida, ou número de folhas diferente do total da versão → ERR-004; (6) em_leitura. A linha 5
 * (teto de custo) é da cota (`iniciarLeitura`). Com QR legível válido, a versão do QR vale para todas
 * as folhas (DEC-180); a escolhida só vale sem ele, e a de papel antigo nunca com QR legível (DEC-184).
 * O `resolver` devolve a versão publicada do formulário escolhido com o número do QR.
 */
export function classificarCriacao(
  paginas: readonly PaginaLida[],
  resolver: (numeroVersao: number) => VersaoDoQr | undefined,
  escolhida: Escolhida = { informada: false },
): Criacao {
  const lidas = paginas.flatMap((p) => {
    const c = p.qr ? lerConteudoQr(p.qr) : null;
    return c ? [{ qr: c, versao: resolver(c.versao) }] : [];
  });
  const guardada = escolhida.informada && escolhida.versao && !(lidas.length && escolhida.versao.papelAntigo) ? escolhida.versao.versaoId : null;
  if (lidas.some((l) => !l.versao || l.versao.papelAntigo || l.qr.total !== l.versao.totalPaginas)) {
    return { estado: 'identificacao_pendente', aviso: 'ERR-039', versaoId: guardada, origemQr: false };
  }

  if (lidas.length) {
    const versao = lidas[0].versao!;
    const pendente: Criacao = { estado: 'identificacao_pendente', aviso: 'ERR-004', versaoId: versao.versaoId, origemQr: true };
    if (new Set(lidas.map((l) => l.versao!.versaoId)).size !== 1) return pendente;
    const numeros = lidas.map((l) => l.qr.pagina);
    if (new Set(numeros).size !== numeros.length || paginas.length !== versao.totalPaginas) return pendente;
    return { estado: 'em_leitura', aviso: null, versaoId: versao.versaoId, origemQr: true };
  }

  if (!escolhida.informada) return { estado: 'identificacao_pendente', aviso: 'ERR-004', versaoId: null, origemQr: false };
  if (!escolhida.versao) return { estado: 'identificacao_pendente', aviso: 'ERR-039', versaoId: null, origemQr: false };
  const versao = escolhida.versao;
  // Linha 4 também com a versão escolhida (FL-001, CA-052 exemplo 2); conflito com o CA-053 exemplo 9 na Q-083.
  if (paginas.length !== versao.totalPaginas) return { estado: 'identificacao_pendente', aviso: 'ERR-004', versaoId: versao.versaoId, origemQr: false };
  return { estado: 'em_leitura', aviso: null, versaoId: versao.versaoId, origemQr: false };
}

/** Exatamente as páginas 1..total, cada uma uma vez. */
export function paginasCompletas(numeros: readonly number[], total: number): boolean {
  if (numeros.length !== total) return false;
  const ordenados = [...numeros].sort((a, b) => a - b);
  return ordenados.every((n, i) => n === i + 1);
}
