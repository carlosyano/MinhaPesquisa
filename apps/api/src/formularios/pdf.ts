// PDF imprimível e mapa de layout (CA-028, DEC-005, DEC-048, DEC-094, DEC-105, DEC-106).
// O mesmo cálculo de layout gera o PDF e o mapa gravado na publicação, para que a leitura
// (IMP-003) recorte exatamente onde a pergunta foi impressa.
//
// Página A4 em pontos; áreas reservadas e altura dos blocos em layout.ts (DEC-143).
// O CPF sai em 11 caixas, uma por dígito, dentro da mesma área de resposta dos outros campos
// de uma linha; o mapa grava a região de cada caixa para a leitura dígito a dígito.

import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Pergunta, RegraEntrada } from '../regras/formularios.js';
import { conteudoQr } from '../regras/upload.js';
import { A, ALTURA_RESPOSTA, CAIXA_TERMO_TOPO, L, MARGEM_X, posicionar, quebrar, RODAPE, seguro, TAM_ENUNCIADO, TAM_OPCAO, type Bloco } from './layout.js';

const MARCADOR = 20;
const BORDA_MARCADOR = 17;
const QR_LADO = 72;
const QR_X = 440;
const QR_Y_TOPO = 30;

export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface MapaLayout {
  total_paginas: number;
  perguntas: { codigo: string; pagina: number; regiao: Regiao; caixas?: Regiao[] }[];
  assinatura: { pagina: 1; regiao: Regiao };
}

export interface DadosPdf {
  nomeFormulario: string;
  numeroVersao: number;
  qrCodigo: string;
  totalPaginas: number;
  perguntas: Pergunta[];
  regras: RegraEntrada[];
  termo: string;
}

const CAIXAS_CPF = 11;
const LADO_CAIXA_CPF = 18;
const VAO_CAIXA_CPF = 4;

const normalizar = (r: Regiao): Regiao => ({
  x: +(r.x / L).toFixed(4),
  y: +((A - r.y - r.altura) / A).toFixed(4), // y normalizado a partir do topo, como na imagem
  largura: +(r.largura / L).toFixed(4),
  altura: +(r.altura / A).toFixed(4),
});

/** Área de resposta abaixo das linhas do enunciado, em pontos (origem no canto inferior esquerdo). */
function areaResposta(bloco: Bloco, topo: number): Regiao {
  const h = ALTURA_RESPOSTA[bloco.pergunta.tipo] ?? 22;
  const base = topo - TAM_ENUNCIADO - bloco.linhasTexto.length * 14;
  return { x: MARGEM_X + 12, y: base - h + 6, largura: 300, altura: h - 4 };
}

/** As 11 caixas do CPF, da esquerda para a direita, alinhadas à base da área de resposta (DEC-106). */
function caixasCpf(area: Regiao): Regiao[] {
  return Array.from({ length: CAIXAS_CPF }, (_, i) => ({
    x: area.x + i * (LADO_CAIXA_CPF + VAO_CAIXA_CPF),
    y: area.y,
    largura: LADO_CAIXA_CPF,
    altura: LADO_CAIXA_CPF,
  }));
}

const REGIAO_ASSINATURA: Regiao = { x: MARGEM_X, y: RODAPE, largura: 300, altura: 40 };

/** Mapa de layout gravado na publicação (DEC-048), com coordenadas normalizadas de 0 a 1. */
export async function mapaLayout(d: Omit<DadosPdf, 'termo' | 'qrCodigo' | 'nomeFormulario' | 'numeroVersao'>): Promise<MapaLayout> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pos = posicionar(fonte, d.perguntas, d.regras, d.totalPaginas);
  const perguntas: MapaLayout['perguntas'] = [];
  for (const [pagina, lista] of pos) {
    for (const { bloco, topo } of lista) {
      perguntas.push({
        codigo: bloco.pergunta.codigo,
        pagina,
        regiao: normalizar({ x: MARGEM_X, y: topo - bloco.altura, largura: L - 2 * MARGEM_X, altura: bloco.altura }),
        ...(bloco.pergunta.tipo === 'cpf' ? { caixas: caixasCpf(areaResposta(bloco, topo)).map(normalizar) } : {}),
      });
    }
  }
  return { total_paginas: d.totalPaginas, perguntas, assinatura: { pagina: 1, regiao: normalizar(REGIAO_ASSINATURA) } };
}

function marcadores(p: PDFPage): void {
  const preto = rgb(0, 0, 0);
  for (const [x, y] of [
    [BORDA_MARCADOR, A - BORDA_MARCADOR - MARCADOR],
    [L - BORDA_MARCADOR - MARCADOR, A - BORDA_MARCADOR - MARCADOR],
    [BORDA_MARCADOR, BORDA_MARCADOR],
    [L - BORDA_MARCADOR - MARCADOR, BORDA_MARCADOR],
  ]) {
    p.drawRectangle({ x, y, width: MARCADOR, height: MARCADOR, color: preto });
  }
}

/** Gera o PDF da versão publicada. */
export async function gerarPdf(d: DadosPdf): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setProducer('MinhaPesquisa');
  doc.setCreator('MinhaPesquisa');
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const pos = posicionar(fonte, d.perguntas, d.regras, d.totalPaginas);

  for (let n = 1; n <= d.totalPaginas; n++) {
    const p = doc.addPage([L, A]);
    marcadores(p);
    const qr = await doc.embedPng(
      await QRCode.toBuffer(conteudoQr(d.qrCodigo, n), { errorCorrectionLevel: 'M', margin: 2, width: 300 }),
    );
    p.drawImage(qr, { x: QR_X, y: A - QR_Y_TOPO - QR_LADO, width: QR_LADO, height: QR_LADO });
    p.drawText(seguro(negrito, d.nomeFormulario).slice(0, 60), { x: MARGEM_X, y: A - 60, size: 14, font: negrito });
    p.drawText(`Versão ${d.numeroVersao} - Página ${n} de ${d.totalPaginas}`, { x: MARGEM_X, y: A - 80, size: 9, font: fonte });

    for (const { bloco, topo } of pos.get(n) ?? []) {
      let y = topo - TAM_ENUNCIADO;
      for (const l of bloco.linhasTexto) {
        p.drawText(l, { x: MARGEM_X, y, size: TAM_ENUNCIADO, font: fonte });
        y -= 14;
      }
      if (bloco.opcoes.length) {
        for (const o of bloco.opcoes) {
          p.drawText(seguro(fonte, o), { x: MARGEM_X + 12, y: y - 2, size: TAM_OPCAO, font: fonte });
          y -= 15;
        }
      } else {
        const h = ALTURA_RESPOSTA[bloco.pergunta.tipo] ?? 22;
        const area = areaResposta(bloco, topo);
        const borda = { borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.8 };
        if (bloco.pergunta.tipo === 'cpf') {
          for (const c of caixasCpf(area)) p.drawRectangle({ x: c.x, y: c.y, width: c.largura, height: c.altura, ...borda });
        } else {
          p.drawRectangle({ x: area.x, y: area.y, width: area.largura, height: area.altura, ...borda });
        }
        if (bloco.pergunta.unidade) {
          p.drawText(seguro(fonte, bloco.pergunta.unidade), { x: MARGEM_X + 318, y: y - h / 2, size: TAM_OPCAO, font: fonte });
        }
      }
    }

    if (n === 1) {
      const largura = L - 2 * MARGEM_X;
      p.drawRectangle({ x: MARGEM_X - 4, y: RODAPE + 50, width: largura + 8, height: CAIXA_TERMO_TOPO - RODAPE - 50, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.8 });
      let y = CAIXA_TERMO_TOPO - 14;
      for (const l of quebrar(fonte, d.termo, 8, largura - 8)) {
        if (y < RODAPE + 56) break; // o termo cabe em 1000 caracteres (seção 2.9); nunca invade a assinatura
        p.drawText(l, { x: MARGEM_X, y, size: 8, font: fonte });
        y -= 10;
      }
      p.drawLine({ start: { x: MARGEM_X, y: RODAPE + 8 }, end: { x: MARGEM_X + 300, y: RODAPE + 8 }, thickness: 0.8 });
      p.drawText('Assinatura do respondente', { x: MARGEM_X, y: RODAPE - 4, size: 9, font: fonte });
    }
  }
  return Buffer.from(await doc.save());
}
