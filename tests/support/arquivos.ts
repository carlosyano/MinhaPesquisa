// Arquivos sintéticos para os testes de PDF e upload (IA-TEST do IMP-002).
//
// As páginas "impressas" saem do próprio PDF que a API gera (generatePdf): a página é
// renderizada como imagem, como num scanner, e o QR é lido aqui de forma independente. Assim
// os testes não conhecem o formato do QR (identificador opaco, CA-028) e não dependem do
// código da API para montar as imagens.
//
// Bibliotecas só de teste: pdfjs-dist (renderização e texto), @napi-rs/canvas (desenho e
// codificação JPEG/PNG), jsqr (leitura de QR), qrcode (QR forjado), pdf-lib (montagem de
// PDF), piexifjs (gravação de EXIF/GPS) e exifr (leitura de metadados).

import { createCanvas, loadImage } from '@napi-rs/canvas';
import exifr from 'exifr';
import jsQRPadrao from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import piexif from 'piexifjs';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';

// jsqr é CommonJS: conforme o carregador, o padrão é a função ou o objeto com `default`.
type LerQr = (dados: Uint8ClampedArray, largura: number, altura: number) => {
  data: string;
  location: { topLeftCorner: Ponto; topRightCorner: Ponto; bottomLeftCorner: Ponto; bottomRightCorner: Ponto };
} | null;
const jsQR = ((jsQRPadrao as unknown as { default?: LerQr }).default ?? jsQRPadrao) as unknown as LerQr;

export const MB = 1024 * 1024;

/** Arquivo de teste antimalware padrão da EICAR (68 bytes); inofensivo por definição. */
export const EICAR = Buffer.from(
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  'latin1',
);

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface PaginaRenderizada {
  numero: number;
  /** Página renderizada em PNG (escala 2, cerca de 144 dpi). */
  png: Buffer;
  largura: number;
  altura: number;
  /** QR lido da imagem renderizada; null se não houver QR legível. */
  qr: { conteudo: string; caixa: Caixa } | null;
  /** Texto extraído da página do PDF. */
  texto: string;
}

/** Luminância (0 a 255) de cada pixel de uma página renderizada. */
export async function luminancias(png: Buffer): Promise<{ largura: number; altura: number; em(x: number, y: number): number }> {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  return {
    largura: img.width,
    altura: img.height,
    em(x, y) {
      const i = (Math.round(y) * img.width + Math.round(x)) * 4;
      return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    },
  };
}

/** Renderiza cada página do PDF, lê o QR e extrai o texto. */
export async function lerPdf(bytes: Buffer): Promise<PaginaRenderizada[]> {
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const pdf = await tarefa.promise;
  const paginas: PaginaRenderizada[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const p = await pdf.getPage(n);
    const vp = p.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await p.render({ canvas: canvas as never, canvasContext: ctx as never, viewport: vp } as never).promise;
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const q = jsQR(new Uint8ClampedArray(dados.data), dados.width, dados.height);
    const conteudo = await p.getTextContent();
    paginas.push({
      numero: n,
      png: await canvas.encode('png'),
      largura: canvas.width,
      altura: canvas.height,
      qr: q ? { conteudo: q.data, caixa: caixaDoQr(q.location) } : null,
      texto: conteudo.items.map((i) => ('str' in i ? i.str : '')).join(' '),
    });
  }
  await tarefa.destroy();
  return paginas;
}

function caixaDoQr(l: { topLeftCorner: Ponto; topRightCorner: Ponto; bottomLeftCorner: Ponto; bottomRightCorner: Ponto }): Caixa {
  const xs = [l.topLeftCorner.x, l.topRightCorner.x, l.bottomLeftCorner.x, l.bottomRightCorner.x];
  const ys = [l.topLeftCorner.y, l.topRightCorner.y, l.bottomLeftCorner.y, l.bottomRightCorner.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, largura: Math.max(...xs) - x, altura: Math.max(...ys) - y };
}
interface Ponto {
  x: number;
  y: number;
}

/** A página como foto/scan em JPEG, sem alteração. */
export async function jpeg(p: PaginaRenderizada, qualidade = 85): Promise<Buffer> {
  return redesenhar(p, () => undefined, 'jpeg', qualidade);
}

/** A página como PNG, sem alteração. */
export async function png(p: PaginaRenderizada): Promise<Buffer> {
  return redesenhar(p, () => undefined, 'png');
}

/** QR danificado: a área do QR (com margem) é coberta de branco. Os marcadores ficam. */
export async function semQr(p: PaginaRenderizada): Promise<Buffer> {
  const caixa = exigirQr(p);
  return redesenhar(p, (ctx) => {
    const m = caixa.largura * 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(caixa.x - m, caixa.y - m, caixa.largura + 2 * m, caixa.altura + 2 * m);
  }, 'jpeg');
}

/** Troca o QR da página por outro QR legível com o conteúdo dado, no mesmo lugar. */
export async function comQr(p: PaginaRenderizada, conteudo: string): Promise<Buffer> {
  const caixa = exigirQr(p);
  const lado = Math.round(Math.max(caixa.largura, caixa.altura) * 1.2);
  const qr = await loadImage(await QRCode.toBuffer(conteudo, { margin: 2, width: lado, errorCorrectionLevel: 'M' }));
  return redesenhar(p, (ctx) => {
    const m = caixa.largura * 0.15;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(caixa.x - m, caixa.y - m, caixa.largura + 2 * m, caixa.altura + 2 * m);
    const cx = caixa.x + caixa.largura / 2;
    const cy = caixa.y + caixa.altura / 2;
    ctx.drawImage(qr, cx - lado / 2, cy - lado / 2, lado, lado);
  }, 'jpeg');
}

/**
 * Conteúdo de QR legível que não aponta para nenhuma versão: mesmo formato do original, com a
 * maior sequência alfanumérica trocada por outra de mesmo tamanho (QR forjado, T-14, CA-039).
 */
export function conteudoForjado(original: string): string {
  const seqs = [...original.matchAll(/[A-Za-z0-9]+/g)].sort((a, b) => b[0].length - a[0].length);
  const alvo = seqs[0];
  if (!alvo || alvo[0].length < 4) throw new Error(`conteúdo de QR sem trecho opaco para forjar: ${original}`);
  const trocar = (c: string) => {
    const alfabeto = /[0-9]/.test(c) ? '0123456789' : /[a-z]/.test(c) ? 'abcdefghijklmnopqrstuvwxyz' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let n = c;
    while (n === c) n = alfabeto[randomBytes(1)[0] % alfabeto.length];
    return n;
  };
  const novo = [...alvo[0]].map(trocar).join('');
  return original.slice(0, alvo.index) + novo + original.slice((alvo.index ?? 0) + alvo[0].length);
}

function exigirQr(p: PaginaRenderizada): Caixa {
  if (!p.qr) throw new Error(`a página ${p.numero} do PDF gerado não tem QR legível`);
  return p.qr.caixa;
}

type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

async function redesenhar(p: PaginaRenderizada, desenho: (ctx: Ctx) => void, formato: 'jpeg' | 'png', qualidade = 85): Promise<Buffer> {
  const canvas = createCanvas(p.largura, p.altura);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(await loadImage(p.png), 0, 0);
  desenho(ctx);
  return formato === 'jpeg' ? canvas.encode('jpeg', qualidade) : canvas.encode('png');
}

/** PDF com as imagens dadas (JPEG ou PNG), uma por página, em A4. */
export async function pdfDeImagens(imagens: Buffer[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (const img of imagens) {
    const emb = img[0] === 0xff ? await doc.embedJpg(img) : await doc.embedPng(img);
    const pagina = doc.addPage([595.28, 841.89]);
    pagina.drawImage(emb, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  return Buffer.from(await doc.save());
}

/** Novo PDF com as páginas do original na ordem pedida (números a partir de 1; pode repetir). */
export async function paginasDoPdf(original: Buffer, numeros: number[]): Promise<Buffer> {
  const fonte = await PDFDocument.load(original);
  const doc = await PDFDocument.create();
  const copias = await doc.copyPages(fonte, numeros.map((n) => n - 1));
  for (const c of copias) doc.addPage(c);
  return Buffer.from(await doc.save());
}

/** PDF em branco com `paginas` páginas (sem QR). */
export async function pdfEmBranco(paginas: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([595.28, 841.89]);
  return Buffer.from(await doc.save());
}

/**
 * Aumenta o PDF até pelo menos `tamanho` bytes com um anexo de bytes aleatórios
 * (incompressível), mantendo o PDF válido e com as mesmas páginas.
 */
export async function inflarPdf(original: Buffer, tamanho: number): Promise<Buffer> {
  const doc = await PDFDocument.load(original);
  const falta = Math.max(0, tamanho - original.length) + 64 * 1024;
  doc.attach(randomBytes(falta), 'preenchimento.bin', { mimeType: 'application/octet-stream' });
  const saida = Buffer.from(await doc.save({ useObjectStreams: false }));
  if (saida.length < tamanho) throw new Error(`inflarPdf: ${saida.length} < ${tamanho}`);
  return saida;
}

/** JPEG válido seguido de bytes até `tamanho` (o tamanho é verificado antes do conteúdo, DEC-042). */
export function jpegComTamanho(img: Buffer, tamanho: number): Buffer {
  return Buffer.concat([img, Buffer.alloc(Math.max(0, tamanho - img.length))]);
}

/** Executável Windows sintético: assinatura "MZ" e cabeçalho PE, preenchido até `tamanho`. */
export function executavel(tamanho: number): Buffer {
  const b = Buffer.alloc(tamanho);
  b.write('MZ', 0, 'latin1');
  b.writeUInt32LE(0x80, 0x3c);
  b.write('PE\0\0', 0x80, 'latin1');
  return b;
}

/** Acrescenta EXIF com fabricante, modelo, data e GPS (foto de celular sintética, RN-040). */
export function comGps(img: Buffer): Buffer {
  const exif = piexif.dump({
    '0th': { [piexif.ImageIFD.Make]: 'Fabricante Ficticio', [piexif.ImageIFD.Model]: 'Celular Teste' },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2026:11:02 09:30:00' },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: 'S',
      [piexif.GPSIFD.GPSLatitude]: [[23, 1], [33, 1], [0, 1]],
      [piexif.GPSIFD.GPSLongitudeRef]: 'W',
      [piexif.GPSIFD.GPSLongitude]: [[46, 1], [38, 1], [0, 1]],
    },
  });
  return Buffer.from(piexif.insert(exif, img.toString('binary')), 'binary');
}

/** Metadados legíveis da imagem (EXIF, GPS, XMP, IPTC); objeto vazio quando não há nenhum. */
export async function metadados(img: Buffer): Promise<Record<string, unknown>> {
  const m = await exifr.parse(img, { tiff: true, exif: true, gps: true, xmp: true, iptc: true, icc: false, jfif: false });
  return (m as Record<string, unknown> | undefined) ?? {};
}
