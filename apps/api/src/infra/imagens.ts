// Processamento das imagens recebidas (RF-006, RN-040, DEC-042, DEC-048).
// - PDF: contagem de páginas e renderização de cada página como imagem (pdfjs, sem execução de
//   JavaScript nem fontes do documento).
// - JPEG/PNG: orientação aplicada e recodificação em JPEG pelo sharp, o que descarta EXIF, GPS,
//   XMP, IPTC e perfis (RN-040). O que é guardado é sempre a imagem recodificada.
// - QR lido pelo jsqr; registro da imagem pelos 4 marcadores fiduciais dos cantos (DEC-048).

import { createCanvas } from '@napi-rs/canvas';
import jsQRPadrao from 'jsqr';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';

type LerQr = (dados: Uint8ClampedArray, largura: number, altura: number) => { data: string } | null;
const jsQR = ((jsQRPadrao as unknown as { default?: LerQr }).default ?? jsQRPadrao) as unknown as LerQr;

/** Limite de pixels por imagem (contra bombas de descompressão). */
const MAX_PIXELS = 60_000_000;
/**
 * Escala de renderização do PDF: 3 ≈ 216 dpi. Com 2 (144 dpi), o QR de um scan de 1 bit a
 * 300 dpi fica serrilhado demais e não é lido.
 */
const ESCALA_PDF = 3;
/** Maior lado usado na detecção de QR e marcadores. */
const LADO_ANALISE = 1800;

/**
 * Decodificadores WASM do pdfjs (JBIG2, CCITT e JPEG 2000). Sem eles a imagem do scan é
 * descartada com um aviso e a página sai em branco: scanner em preto e branco grava CCITT G4.
 * No Node, o pdfjs lê do disco: caminho de pasta (não URL file://) terminado em "/", que ele
 * exige mesmo no Windows.
 */
const PASTA_WASM = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/wasm/jbig2.wasm')) + '/';

/** Opções de leitura de PDF não confiável: sem fontes do documento nem do sistema (o pdfjs 6 não usa eval). */
function abrirPdf(bytes: Buffer) {
  return pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: 0,
    wasmUrl: PASTA_WASM,
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

/**
 * Outros lados tentados quando o QR não é lido em LADO_ANALISE: num scan de 1 bit, o serrilhado
 * depende da escala, e o mesmo QR que falha a 1800 px é lido a 1200 ou 2100.
 */
const LADOS_QR_EXTRA = [1200, 2100];

async function rgbaNoLado(jpeg: Buffer, lado: number) {
  const { data, info } = await sharp(jpeg, { limitInputPixels: MAX_PIXELS })
    .resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), largura: info.width, altura: info.height };
}

/** Lê o QR e confere os marcadores dos cantos na imagem já normalizada. */
export async function analisarPagina(jpeg: Buffer): Promise<Analise> {
  const { rgba, largura, altura } = await rgbaNoLado(jpeg, LADO_ANALISE);
  const registroOk = marcadoresPresentes(rgba, largura, altura);
  let qr = jsQR(rgba, largura, altura)?.data ?? null;
  // Só insiste em página com os marcadores: papel que não é do formulário não paga as tentativas.
  for (const lado of registroOk ? LADOS_QR_EXTRA : []) {
    if (qr) break;
    const r = await rgbaNoLado(jpeg, lado);
    qr = jsQR(r.rgba, r.largura, r.altura)?.data ?? null;
  }
  return { qr, registroOk };
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

/**
 * O marcador é o maior bloco escuro (8-conexo) da janela do canto. Medir só esse bloco ignora
 * o que o scanner deixa na borda (linha pontilhada, poeira), que de outro modo alarga a caixa.
 */
function quadradoEscuro(rgba: Uint8ClampedArray, largura: number, x0: number, y0: number, w: number, h: number): boolean {
  const escuro = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * largura + x0 + x) * 4;
      if (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2] < 90) escuro[y * w + x] = 1;
    }
  }
  let melhor = { n: 0, bw: 0, bh: 0 };
  const pilha: number[] = [];
  for (let inicio = 0; inicio < escuro.length; inicio++) {
    if (escuro[inicio] !== 1) continue;
    escuro[inicio] = 2;
    pilha.push(inicio);
    let n = 0;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    while (pilha.length) {
      const p = pilha.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      n++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const vx = x + dx;
          const vy = y + dy;
          if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
          const v = vy * w + vx;
          if (escuro[v] === 1) {
            escuro[v] = 2;
            pilha.push(v);
          }
        }
      }
    }
    if (n > melhor.n) melhor = { n, bw: maxX - minX + 1, bh: maxY - minY + 1 };
  }
  if (melhor.n === 0) return false;
  const { n, bw, bh } = melhor;
  const proporcao = bw / bh;
  const preenchimento = n / (bw * bh);
  return bw >= w * 0.15 && bh >= h * 0.1 && proporcao > 0.6 && proporcao < 1.6 && preenchimento > 0.6;
}
