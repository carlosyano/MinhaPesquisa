// Processamento das imagens recebidas (RF-006, RN-040, DEC-042, DEC-048).
// - PDF: contagem de páginas e renderização de cada página como imagem (pdfjs, sem execução de
//   JavaScript nem fontes do documento).
// - JPEG/PNG: orientação aplicada e recodificação em JPEG pelo sharp, o que descarta EXIF, GPS,
//   XMP, IPTC e perfis (RN-040). O que é guardado é sempre a imagem recodificada.
// - QR lido pelo jsqr; registro da imagem pelos 4 marcadores fiduciais dos cantos (DEC-048).

import { createCanvas } from '@napi-rs/canvas';
import jsQRPadrao from 'jsqr';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';

type LerQr = (dados: Uint8ClampedArray, largura: number, altura: number) => { data: string } | null;
const jsQR = ((jsQRPadrao as unknown as { default?: LerQr }).default ?? jsQRPadrao) as unknown as LerQr;

/** Limite de pixels por imagem (contra bombas de descompressão). */
const MAX_PIXELS = 60_000_000;
/** Escala de renderização do PDF: 2 ≈ 144 dpi, suficiente para QR e leitura. */
const ESCALA_PDF = 2;
/** Maior lado usado na detecção de QR e marcadores. */
const LADO_ANALISE = 1800;

/** Opções de leitura de PDF não confiável: sem fontes do documento nem do sistema (o pdfjs 6 não usa eval). */
function abrirPdf(bytes: Buffer) {
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: 0,
  });
}

/** Número de páginas; PDF que não abre é tratado como tipo não permitido pelo chamador. */
export async function contarPaginasPdf(bytes: Buffer): Promise<number | null> {
  const tarefa = abrirPdf(bytes);
  try {
    return (await tarefa.promise).numPages;
  } catch {
    return null;
  } finally {
    await tarefa.destroy();
  }
}

/** Renderiza cada página do PDF como PNG (sem metadados). */
export async function renderizarPdf(bytes: Buffer): Promise<Buffer[]> {
  const tarefa = abrirPdf(bytes);
  try {
    const pdf = await tarefa.promise;
    const saida: Buffer[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      const vp = pagina.getViewport({ scale: ESCALA_PDF });
      const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvas: canvas as never, canvasContext: ctx as never, viewport: vp } as never).promise;
      saida.push(await canvas.encode('png'));
      pagina.cleanup();
    }
    return saida;
  } finally {
    await tarefa.destroy();
  }
}

/** Recodifica em JPEG com a orientação aplicada e sem nenhum metadado (RN-040). */
export async function normalizarImagem(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 90, mozjpeg: false })
    .toBuffer();
}

export interface Analise {
  qr: string | null;
  registroOk: boolean;
}

/** Lê o QR e confere os marcadores dos cantos na imagem já normalizada. */
export async function analisarPagina(jpeg: Buffer): Promise<Analise> {
  const { data, info } = await sharp(jpeg, { limitInputPixels: MAX_PIXELS })
    .resize({ width: LADO_ANALISE, height: LADO_ANALISE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
  const qr = jsQR(rgba, info.width, info.height);
  return { qr: qr?.data ?? null, registroOk: marcadoresPresentes(rgba, info.width, info.height) };
}

/**
 * Marcador fiducial (DEC-048): quadrado escuro e cheio em cada canto, dentro dos 8% externos
 * da largura e da altura. O PDF gerado põe os marcadores ali e mantém o resto do conteúdo fora.
 */
export function marcadoresPresentes(rgba: Uint8ClampedArray, largura: number, altura: number): boolean {
  const lx = Math.floor(largura * 0.08);
  const ly = Math.floor(altura * 0.08);
  const cantos: [number, number][] = [
    [0, 0],
    [largura - lx, 0],
    [0, altura - ly],
    [largura - lx, altura - ly],
  ];
  return cantos.every(([x0, y0]) => quadradoEscuro(rgba, largura, x0, y0, lx, ly));
}

function quadradoEscuro(rgba: Uint8ClampedArray, largura: number, x0: number, y0: number, w: number, h: number): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  let escuros = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * largura + x) * 4;
      const luz = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      if (luz < 90) {
        escuros++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (escuros === 0) return false;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const proporcao = bw / bh;
  const preenchimento = escuros / (bw * bh);
  return bw >= w * 0.15 && bh >= h * 0.1 && proporcao > 0.6 && proporcao < 1.6 && preenchimento > 0.6;
}
