// Regras do upload (RF-006) como funções puras: validação de arquivo (DEC-029, DEC-042),
// leitura do conteúdo do QR e tabela de criação da FL-001 (REQ v2.7, CHG-017).

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

// O formato é a estrutura `MP1.<26 letras ou dígitos>.<página>` (DEC-187): um código fora do base32
// gerado é de versão inexistente (ERR-039), não de outro formato.
const FORMATO_QR = /^MP1\.([A-Z0-9]{26})\.([1-9][0-9]{0,2})$/;

export function lerConteudoQr(conteudo: string): { codigo: string; pagina: number } | null {
  const m = FORMATO_QR.exec(conteudo);
  return m ? { codigo: m[1], pagina: Number(m[2]) } : null;
}

/** Página como lida no envio. `qr` null = sem QR legível no formato do MinhaPesquisa (DEC-187). */
export interface PaginaLida {
  qr: string | null;
}

/** Versão publicada do tenant a que um código de QR ou a escolha do envio se refere. */
export interface VersaoDoQr {
  versaoId: string;
  projetoId: string;
  totalPaginas: number;
  papelAntigo: boolean;
}

/** Versão escolhida no envio (DEC-169): ausente, ou informada e resolvida (undefined = inválida). */
export type Escolhida = { informada: false } | { informada: true; versao: VersaoDoQr | undefined };

export type Criacao =
  | { estado: 'em_leitura'; aviso: null; versaoId: string; origemQr: boolean }
  | { estado: 'identificacao_pendente'; aviso: 'ERR-004' | 'ERR-039'; versaoId: string | null; origemQr: boolean };

/**
 * Tabela de criação da FL-001 (REQ v2.7), na ordem: (1) QR legível de versão inválida → ERR-039;
 * (2) sem QR legível de versão válida e sem versão escolhida → ERR-004; (3) sem esse QR e versão
 * escolhida inválida → ERR-039; (4) versões diferentes, página de QR repetida ou além do total, ou
 * número de folhas diferente do total da versão → ERR-004; (6) em_leitura. A linha 5 (teto de custo)
 * é da cota (`iniciarLeitura`). Com QR legível válido, a versão do QR vale para todas as folhas
 * (DEC-180); a escolhida só vale sem ele, e a de papel antigo nunca com QR legível (DEC-184).
 */
export function classificarCriacao(
  paginas: readonly PaginaLida[],
  projetoId: string,
  resolver: (codigo: string) => VersaoDoQr | undefined,
  escolhida: Escolhida = { informada: false },
): Criacao {
  const lidas = paginas.flatMap((p) => {
    const c = p.qr ? lerConteudoQr(p.qr) : null;
    return c ? [{ versao: resolver(c.codigo), pagina: c.pagina }] : [];
  });
  const valida = (v: VersaoDoQr | undefined): v is VersaoDoQr => !!v && v.projetoId === projetoId;
  const guardada = escolhida.informada && valida(escolhida.versao) && !(lidas.length && escolhida.versao.papelAntigo) ? escolhida.versao.versaoId : null;
  if (lidas.some((l) => !valida(l.versao))) return { estado: 'identificacao_pendente', aviso: 'ERR-039', versaoId: guardada, origemQr: false };

  if (lidas.length) {
    const versao = lidas[0].versao!;
    const pendente: Criacao = { estado: 'identificacao_pendente', aviso: 'ERR-004', versaoId: versao.versaoId, origemQr: true };
    if (new Set(lidas.map((l) => l.versao!.versaoId)).size !== 1) return pendente;
    const numeros = lidas.map((l) => l.pagina);
    if (new Set(numeros).size !== numeros.length || numeros.some((n) => n > versao.totalPaginas) || paginas.length !== versao.totalPaginas) return pendente;
    return { estado: 'em_leitura', aviso: null, versaoId: versao.versaoId, origemQr: true };
  }

  if (!escolhida.informada) return { estado: 'identificacao_pendente', aviso: 'ERR-004', versaoId: null, origemQr: false };
  if (!valida(escolhida.versao)) return { estado: 'identificacao_pendente', aviso: 'ERR-039', versaoId: null, origemQr: false };
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
