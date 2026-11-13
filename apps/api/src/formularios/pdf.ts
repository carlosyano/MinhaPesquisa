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
import {
  A,
  ALTURA_OPCAO,
  ALTURA_RESPOSTA,
  CAIXA_TERMO_TOPO,
  L,
  LINHA_COMPLEMENTO,
  MARGEM_X,
  posicionar,
  quebrar,
  RODAPE,
  seguro,
  TAM_ENUNCIADO,
  TAM_OPCAO,
  VAO_COMPLEMENTO,
  type Bloco,
} from './layout.js';

const MARCADOR = 20;
const BORDA_MARCADOR = 17;
const QR_LADO = 72;
// Canto inferior direito, 10 pt dentro da margem para não encostar no marcador do canto (DEC-219).
const QR_X = L - MARGEM_X - 10 - QR_LADO;
const QR_Y_BASE = 40;

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
  nomeProjeto: string;
  nomeFormulario: string;
  codigoProjeto: number;
  codigoFormulario: number;
  numeroVersao: number;
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
export async function mapaLayout(d: Pick<DadosPdf, 'totalPaginas' | 'perguntas' | 'regras'>): Promise<MapaLayout> {
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
      await QRCode.toBuffer(conteudoQr({ projeto: d.codigoProjeto, formulario: d.codigoFormulario, versao: d.numeroVersao, pagina: n, total: d.totalPaginas }), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
      }),
    );
    p.drawImage(qr, { x: QR_X, y: QR_Y_BASE, width: QR_LADO, height: QR_LADO });
    // Cabeçalho: projeto em negrito a 14 pt e, logo abaixo, o formulário a 11 pt (DEC-219).
    p.drawText(seguro(negrito, d.nomeProjeto).slice(0, 60), { x: MARGEM_X, y: A - 50, size: 14, font: negrito });
    p.drawText(seguro(fonte, d.nomeFormulario).slice(0, 80), { x: MARGEM_X, y: A - 68, size: 11, font: fonte });
    const rodape = `Projeto: ${String(d.codigoProjeto).padStart(5, '0')} · Formulário: ${String(d.codigoFormulario).padStart(3, '0')} · Versão: ${String(d.numeroVersao).padStart(2, '0')} · Página ${n}/${d.totalPaginas}`;
    p.drawText(seguro(fonte, rodape), { x: MARGEM_X, y: 48, size: 8, font: fonte });

    for (const { bloco, topo } of pos.get(n) ?? []) {
      let y = topo - TAM_ENUNCIADO;
      for (const l of bloco.linhasTexto) {
        p.drawText(l, { x: MARGEM_X, y, size: TAM_ENUNCIADO, font: fonte });
        y -= 14;
      }
      if (bloco.opcoes.length) {
        for (const [k, o] of bloco.opcoes.entries()) {
          const texto = seguro(fonte, o);
          p.drawText(texto, { x: MARGEM_X + 12, y: y - 2, size: TAM_OPCAO, font: fonte });
          // Linha para escrever ao lado da opção com complemento, dentro do bloco (DEC-202, DEC-203 (6)).
          const c = bloco.complementos[k];
          if (c) {
            if (c.quebra) y -= ALTURA_OPCAO;
            const x = c.quebra ? MARGEM_X + 24 : MARGEM_X + 12 + fonte.widthOfTextAtSize(texto, TAM_OPCAO) + VAO_COMPLEMENTO;
            p.drawLine({ start: { x, y: y - 3 }, end: { x: x + LINHA_COMPLEMENTO, y: y - 3 }, thickness: 0.8 });
          }
          y -= ALTURA_OPCAO;
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
