// PDF imprimível e mapa de layout (CA-028, DEC-005, DEC-048, DEC-094).
// O mesmo cálculo de layout gera o PDF e o mapa gravado na publicação, para que a leitura
// (IMP-003) recorte exatamente onde a pergunta foi impressa.
//
// Página A4 em pontos. Áreas reservadas:
// - marcadores fiduciais: quadrados de 20 pt a 17 pt das bordas, nos 4 cantos;
// - QR: 72 pt no alto à direita, fora das colunas dos cantos;
// - termo de consentimento e assinatura: caixa fixa no pé da página 1, para que o tamanho do
//   termo do tenant não mude a posição das perguntas.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import type { Pergunta, RegraEntrada } from '../regras/formularios.js';
import { conteudoQr } from '../regras/upload.js';

const L = 595.28;
const A = 841.89;
const MARCADOR = 20;
const BORDA_MARCADOR = 17;
const MARGEM_X = 57; // 20 mm
const TOPO = 120; // abaixo do cabeçalho e do QR
const QR_LADO = 72;
const QR_X = 440;
const QR_Y_TOPO = 30;
const CAIXA_TERMO_TOPO = 260; // pé da página 1: termo + assinatura (distância da base)
const RODAPE = 80;

export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface MapaLayout {
  total_paginas: number;
  perguntas: { codigo: string; pagina: number; regiao: Regiao }[];
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

interface Bloco {
  pergunta: Pergunta;
  linhasTexto: string[];
  opcoes: string[];
  altura: number;
}

const TAM_ENUNCIADO = 11;
const TAM_OPCAO = 10;
const ALTURA_RESPOSTA: Record<string, number> = {
  texto_curto: 22,
  texto_livre: 60,
  numero: 22,
  data: 22,
  cpf: 22,
};

/** Troca caracteres fora do WinAnsi (fonte padrão) por "?", sem quebrar a geração. */
function seguro(fonte: PDFFont, texto: string): string {
  let s = '';
  for (const c of texto.normalize('NFC')) {
    try {
      fonte.widthOfTextAtSize(c, 10);
      s += c;
    } catch {
      s += '?';
    }
  }
  return s;
}

function quebrar(fonte: PDFFont, texto: string, tamanho: number, largura: number): string[] {
  const palavras = seguro(fonte, texto).split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function instrucaoSalto(p: Pergunta, regras: RegraEntrada[], perguntas: Pergunta[]): string | null {
  const r = regras.find((x) => x.pergunta_destino_codigo === p.codigo);
  if (!r) return null;
  const origem = perguntas.find((x) => x.codigo === r.pergunta_origem_codigo);
  const opcao = origem?.opcoes?.find((o) => o.codigo === r.opcao_codigo);
  return `Responda somente se marcou "${opcao?.rotulo ?? r.opcao_codigo}" na pergunta ${origem?.ordem ?? ''}.`;
}

function blocos(fonte: PDFFont, d: DadosPdf, pagina: number): Bloco[] {
  const larguraTexto = L - 2 * MARGEM_X;
  return d.perguntas
    .filter((p) => p.pagina === pagina)
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => {
      const instrucao = instrucaoSalto(p, d.regras, d.perguntas);
      const linhasTexto = quebrar(fonte, `${p.ordem}. ${p.enunciado}`, TAM_ENUNCIADO, larguraTexto);
      if (instrucao) linhasTexto.push(...quebrar(fonte, instrucao, TAM_OPCAO, larguraTexto));
      let opcoes: string[] = [];
      if (p.tipo === 'matriz') {
        opcoes = (p.linhas ?? []).map((l) => `${l.rotulo}:  ${(p.opcoes ?? []).map((o) => `( ) ${o.rotulo}`).join('   ')}`);
      } else if (p.opcoes?.length) {
        opcoes = p.opcoes.map((o) => `${p.tipo === 'multipla_escolha' ? '[ ]' : '( )'} ${o.rotulo}`);
      }
      const resposta = opcoes.length ? opcoes.length * 15 : (ALTURA_RESPOSTA[p.tipo] ?? 22);
      return { pergunta: p, linhasTexto, opcoes, altura: linhasTexto.length * 14 + resposta + 14 };
    });
}

/** Layout das perguntas: posições em pontos (origem no canto inferior esquerdo, como no PDF). */
function posicionar(fonte: PDFFont, d: DadosPdf) {
  const porPagina = new Map<number, { bloco: Bloco; topo: number }[]>();
  for (let n = 1; n <= d.totalPaginas; n++) {
    let y = A - TOPO;
    const lista: { bloco: Bloco; topo: number }[] = [];
    for (const b of blocos(fonte, d, n)) {
      lista.push({ bloco: b, topo: y });
      y -= b.altura;
    }
    porPagina.set(n, lista);
  }
  return porPagina;
}

const normalizar = (r: Regiao): Regiao => ({
  x: +(r.x / L).toFixed(4),
  y: +((A - r.y - r.altura) / A).toFixed(4), // y normalizado a partir do topo, como na imagem
  largura: +(r.largura / L).toFixed(4),
  altura: +(r.altura / A).toFixed(4),
});

const REGIAO_ASSINATURA: Regiao = { x: MARGEM_X, y: RODAPE, largura: 300, altura: 40 };

/** Mapa de layout gravado na publicação (DEC-048), com coordenadas normalizadas de 0 a 1. */
export async function mapaLayout(d: Omit<DadosPdf, 'termo' | 'qrCodigo' | 'nomeFormulario' | 'numeroVersao'>): Promise<MapaLayout> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pos = posicionar(fonte, { ...d, termo: '', qrCodigo: '', nomeFormulario: '', numeroVersao: 0 });
  const perguntas: MapaLayout['perguntas'] = [];
  for (const [pagina, lista] of pos) {
    for (const { bloco, topo } of lista) {
      perguntas.push({
        codigo: bloco.pergunta.codigo,
        pagina,
        regiao: normalizar({ x: MARGEM_X, y: topo - bloco.altura, largura: L - 2 * MARGEM_X, altura: bloco.altura }),
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
  const pos = posicionar(fonte, d);

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
        p.drawRectangle({ x: MARGEM_X + 12, y: y - h + 6, width: 300, height: h - 4, borderColor: rgb(0.4, 0.4, 0.4), borderWidth: 0.8 });
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
