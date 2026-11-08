// Medida de altura das perguntas no PDF (DEC-143, PLANO §4.8): o mesmo cálculo dos blocos serve
// ao PDF e ao mapa de layout (pdf.ts), à verificação de que a pergunta cabe na página, na gravação
// e na publicação, e à distribuição em páginas da importação (RN-049).
//
// Página A4 em pontos. Áreas reservadas:
// - marcadores fiduciais: quadrados de 20 pt a 17 pt das bordas, nos 4 cantos;
// - QR: 72 pt no alto à direita, fora das colunas dos cantos;
// - termo de consentimento e assinatura: caixa fixa no pé da página 1, para que o tamanho do
//   termo do tenant não mude a posição das perguntas.

import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib';
import type { Pergunta, RegraEntrada } from '../regras/formularios.js';

export const L = 595.28;
export const A = 841.89;
export const MARGEM_X = 57; // 20 mm
export const TOPO = 120; // abaixo do cabeçalho e do QR
export const CAIXA_TERMO_TOPO = 260; // pé da página 1: termo + assinatura (distância da base)
export const RODAPE = 80;

export const TAM_ENUNCIADO = 11;
export const TAM_OPCAO = 10;
export const ALTURA_RESPOSTA: Record<string, number> = {
  texto_curto: 22,
  texto_livre: 60,
  numero: 22,
  data: 22,
  cpf: 22,
};

/** Base da área das perguntas: acima do termo na página 1, acima do rodapé nas demais. */
export const limiteInferior = (pagina: number) => (pagina === 1 ? CAIXA_TERMO_TOPO : RODAPE);

/** Altura disponível para perguntas numa página inteira. */
export const areaUtil = (pagina: number) => A - TOPO - limiteInferior(pagina);

/** Bloco de uma pergunta: linhas do enunciado, opções e altura total, em pontos. */
export interface Bloco {
  pergunta: Pergunta;
  linhasTexto: string[];
  opcoes: string[];
  /**
   * Por opção, a linha para escrever ao lado da opção com complemento (DEC-202, DEC-203 (6)): null
   * sem complemento; `quebra` quando rótulo e linha não cabem na largura e a linha vai para baixo.
   */
  complementos: ({ quebra: boolean } | null)[];
  altura: number;
}

/** Linha para escrever depois do rótulo da opção com complemento: 40 mm (DEC-203 (6)). */
export const LINHA_COMPLEMENTO = 113.4;
/** Vão entre o rótulo e a linha para escrever. */
export const VAO_COMPLEMENTO = 6;
/** Altura de uma linha de opção. */
export const ALTURA_OPCAO = 15;

/** Troca caracteres fora do WinAnsi (fonte padrão) por "?", sem quebrar a geração. */
export function seguro(fonte: PDFFont, texto: string): string {
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

export function quebrar(fonte: PDFFont, texto: string, tamanho: number, largura: number): string[] {
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

function instrucaoSalto(p: Pergunta, regras: readonly RegraEntrada[], perguntas: readonly Pergunta[]): string | null {
  const r = regras.find((x) => x.pergunta_destino_codigo === p.codigo);
  if (!r) return null;
  const origem = perguntas.find((x) => x.codigo === r.pergunta_origem_codigo);
  const opcao = origem?.opcoes?.find((o) => o.codigo === r.opcao_codigo);
  return `Responda somente se marcou "${opcao?.rotulo ?? r.opcao_codigo}" na pergunta ${origem?.ordem ?? ''}.`;
}

/** Bloco impresso de uma pergunta, com a instrução de salto quando ela é destino de uma regra. */
export function bloco(fonte: PDFFont, p: Pergunta, regras: readonly RegraEntrada[] = [], perguntas: readonly Pergunta[] = []): Bloco {
  const larguraTexto = L - 2 * MARGEM_X;
  const instrucao = instrucaoSalto(p, regras, perguntas);
  const linhasTexto = quebrar(fonte, `${p.ordem}. ${p.enunciado}`, TAM_ENUNCIADO, larguraTexto);
  if (instrucao) linhasTexto.push(...quebrar(fonte, instrucao, TAM_OPCAO, larguraTexto));
  let opcoes: string[] = [];
  let complementos: Bloco['complementos'] = [];
  if (p.tipo === 'matriz') {
    opcoes = (p.linhas ?? []).map((l) => `${l.rotulo}:  ${(p.opcoes ?? []).map((o) => `( ) ${o.rotulo}`).join('   ')}`);
    complementos = opcoes.map(() => null);
  } else if (p.opcoes?.length) {
    opcoes = p.opcoes.map((o) => `${p.tipo === 'multipla_escolha' ? '[ ]' : '( )'} ${o.rotulo}`);
    const larguraOpcao = larguraTexto - 12;
    complementos = p.opcoes.map((o, k) =>
      o.com_complemento ? { quebra: fonte.widthOfTextAtSize(seguro(fonte, opcoes[k]), TAM_OPCAO) + VAO_COMPLEMENTO + LINHA_COMPLEMENTO > larguraOpcao } : null,
    );
  }
  const quebras = complementos.filter((c) => c?.quebra).length;
  const resposta = opcoes.length ? (opcoes.length + quebras) * ALTURA_OPCAO : (ALTURA_RESPOSTA[p.tipo] ?? 22);
  return { pergunta: p, linhasTexto, opcoes, complementos, altura: linhasTexto.length * 14 + resposta + 14 };
}

/** Layout das perguntas por página: topo de cada bloco em pontos (origem no canto inferior esquerdo, como no PDF). */
export function posicionar(fonte: PDFFont, perguntas: readonly Pergunta[], regras: readonly RegraEntrada[], totalPaginas: number) {
  const porPagina = new Map<number, { bloco: Bloco; topo: number }[]>();
  for (let n = 1; n <= totalPaginas; n++) {
    let y = A - TOPO;
    const lista: { bloco: Bloco; topo: number }[] = [];
    for (const p of perguntas.filter((x) => x.pagina === n).sort((a, b) => a.ordem - b.ordem)) {
      const b = bloco(fonte, p, regras, perguntas);
      lista.push({ bloco: b, topo: y });
      y -= b.altura;
    }
    porPagina.set(n, lista);
  }
  return porPagina;
}

/** Códigos das perguntas que passam da base da sua página (DEC-143), na ordem das perguntas. */
export function naoCabem(fonte: PDFFont, perguntas: readonly Pergunta[], regras: readonly RegraEntrada[]): string[] {
  const total = Math.max(1, ...perguntas.map((p) => p.pagina));
  const fora: Pergunta[] = [];
  for (const [pagina, lista] of posicionar(fonte, perguntas, regras, total)) {
    for (const { bloco: b, topo } of lista) if (topo - b.altura < limiteInferior(pagina)) fora.push(b.pergunta);
  }
  return fora.sort((a, b) => a.ordem - b.ordem).map((p) => p.codigo);
}

let fonte: Promise<PDFFont> | undefined;

/** Fonte do PDF (Helvetica), só para medir, compartilhada pelas verificações de altura. */
export function fonteDeMedida(): Promise<PDFFont> {
  fonte ??= PDFDocument.create().then((doc) => doc.embedFont(StandardFonts.Helvetica));
  return fonte;
}
