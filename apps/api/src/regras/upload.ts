// Regras do upload (RF-006) como funções puras: validação de arquivo (DEC-029, DEC-042),
// leitura do conteúdo do QR e tabela de criação da FL-001.

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

/** Conteúdo do QR impresso: "MP1.<código opaco da versão>.<página>" (CA-028, DEC-048). */
export function conteudoQr(qrCodigo: string, pagina: number): string {
  return `MP1.${qrCodigo}.${pagina}`;
}

const FORMATO_QR = /^MP1\.([A-Z2-7]{26})\.([1-9][0-9]{0,2})$/;

export function lerConteudoQr(conteudo: string): { codigo: string; pagina: number } | null {
  const m = FORMATO_QR.exec(conteudo);
  return m ? { codigo: m[1], pagina: Number(m[2]) } : null;
}

/** Página como lida no envio. `qr` null = sem QR legível. */
export interface PaginaLida {
  qr: string | null;
  registroOk: boolean;
}

/** Versão a que um código de QR se refere, se existir no tenant. */
export interface VersaoDoQr {
  versaoId: string;
  projetoId: string;
  totalPaginas: number;
}

export type Criacao =
  | { estado: 'em_leitura'; aviso: null; versaoId: string }
  | { estado: 'identificacao_pendente'; aviso: 'ERR-004' | 'ERR-039'; versaoId: null };

/**
 * Tabela de criação da FL-001, na ordem: (1) sem QR legível ou sem registro → ERR-004;
 * (2) QR que não aponta para versão publicada deste projeto e tenant → ERR-039; (3) páginas
 * faltantes, repetidas, de outro formulário ou além do total → ERR-004; (5) em_leitura.
 * A linha 4 (teto de custo de IA) entra com a cota, no IMP-003.
 */
export function classificarCriacao(
  paginas: readonly PaginaLida[],
  projetoId: string,
  resolver: (codigo: string) => VersaoDoQr | undefined,
): Criacao {
  const pendente = (aviso: 'ERR-004' | 'ERR-039'): Criacao => ({ estado: 'identificacao_pendente', aviso, versaoId: null });
  if (paginas.length === 0 || paginas.some((p) => p.qr === null || !p.registroOk)) return pendente('ERR-004');

  const lidas: { versao: VersaoDoQr; pagina: number }[] = [];
  for (const p of paginas) {
    const c = lerConteudoQr(p.qr!);
    const v = c ? resolver(c.codigo) : undefined;
    if (!c || !v || v.projetoId !== projetoId) return pendente('ERR-039');
    lidas.push({ versao: v, pagina: c.pagina });
  }

  const versoes = new Set(lidas.map((l) => l.versao.versaoId));
  if (versoes.size !== 1) return pendente('ERR-004');
  const versao = lidas[0].versao;
  if (!paginasCompletas(lidas.map((l) => l.pagina), versao.totalPaginas)) return pendente('ERR-004');
  return { estado: 'em_leitura', aviso: null, versaoId: versao.versaoId };
}

/** Exatamente as páginas 1..total, cada uma uma vez. */
export function paginasCompletas(numeros: readonly number[], total: number): boolean {
  if (numeros.length !== total) return false;
  const ordenados = [...numeros].sort((a, b) => a - b);
  return ordenados.every((n, i) => n === i + 1);
}
