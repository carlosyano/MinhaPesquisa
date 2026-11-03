// Autoteste dos geradores de arquivos (não depende da API): garante que a leitura de QR, o QR
// danificado, o QR forjado, o GPS e o tamanho dos arquivos fazem o que os testes vermelhos do
// IMP-002 supõem.

import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import {
  EICAR,
  MB,
  comGps,
  comQr,
  conteudoForjado,
  executavel,
  inflarPdf,
  jpeg,
  jpegComTamanho,
  lerPdf,
  metadados,
  paginasDoPdf,
  pdfDeImagens,
  pdfEmBranco,
  semQr,
} from './arquivos.js';

async function pdfComQr(conteudos: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (const c of conteudos) {
    const p = doc.addPage([595.28, 841.89]);
    p.drawImage(await doc.embedPng(await QRCode.toBuffer(c, { margin: 2, width: 240 })), { x: 420, y: 680, width: 130, height: 130 });
    p.drawText(`Pagina de teste ${c}`, { x: 50, y: 780, size: 12 });
  }
  return Buffer.from(await doc.save());
}

describe('apoio: arquivos sintéticos', () => {
  // @trace DEC-042, CA-028
  it('lerPdf lê o QR e o texto de cada página', async () => {
    const paginas = await lerPdf(await pdfComQr(['opaco-aaa1-1', 'opaco-aaa1-2']));
    expect(paginas.map((p) => p.qr?.conteudo)).toEqual(['opaco-aaa1-1', 'opaco-aaa1-2']);
    expect(paginas[0].texto).toContain('Pagina de teste');
  });

  // @trace CA-004, CA-039
  it('semQr torna o QR ilegível; comQr troca o conteúdo; conteudoForjado mantém o formato', async () => {
    const [p] = await lerPdf(await pdfComQr(['MP1.Xy7Qa9Lm3Pz.2']));
    const [danificada] = await lerPdf(await pdfDeImagens([await semQr(p)]));
    expect(danificada.qr).toBeNull();
    const forjado = conteudoForjado(p.qr!.conteudo);
    expect(forjado).not.toBe(p.qr!.conteudo);
    expect(forjado).toHaveLength(p.qr!.conteudo.length);
    const [trocada] = await lerPdf(await pdfDeImagens([await comQr(p, forjado)]));
    expect(trocada.qr?.conteudo).toBe(forjado);
  });

  // @trace RN-040
  it('comGps grava GPS que metadados() lê; o JPEG renderizado sai sem metadados', async () => {
    const [p] = await lerPdf(await pdfComQr(['gps-1']));
    const limpo = await jpeg(p);
    expect(await metadados(limpo)).toEqual({});
    const m = await metadados(comGps(limpo));
    expect(m.latitude).toBeCloseTo(-23.55, 1);
    expect(m.Make).toBe('Fabricante Ficticio');
  });

  // @trace CA-029, CA-040
  it('tamanhos e páginas dos arquivos de limite', async () => {
    expect(EICAR.length).toBe(68);
    expect(executavel(2 * MB).subarray(0, 2).toString('latin1')).toBe('MZ');
    const branco = await pdfEmBranco(51);
    expect((await PDFDocument.load(branco)).getPageCount()).toBe(51);
    const grande = await inflarPdf(branco, 18 * MB);
    expect(grande.length).toBeGreaterThanOrEqual(18 * MB);
    expect(grande.length).toBeLessThan(20 * MB);
    expect((await PDFDocument.load(grande)).getPageCount()).toBe(51);
    const quatro = await paginasDoPdf(await pdfComQr(['a1', 'a2', 'a3', 'a4']), [1, 2, 4, 4]);
    expect((await lerPdf(quatro)).map((p) => p.qr?.conteudo)).toEqual(['a1', 'a2', 'a4', 'a4']);
    const c = createCanvas(10, 10);
    const pequeno = await c.encode('jpeg');
    expect(jpegComTamanho(pequeno, 25 * MB).length).toBe(25 * MB);
  });
});
