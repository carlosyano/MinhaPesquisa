// Leitura dos arquivos da exportação (IA-TEST do IMP-007, DEC-165) sem depender da biblioteca que
// o IA-DEV escolher para gerá-los: CSV pelo formato fixado na DEC-165 (1) e XLSX pelo próprio
// formato (zip com XML), lendo só o que os testes precisam: a planilha pelo nome, o tipo de cada
// célula (texto, número ou fórmula) e o valor guardado nela. Autoteste em `planilha.test.ts`.

import { inflateRawSync } from 'node:zlib';

export const BOM = '﻿';

/**
 * CSV da DEC-165 (1): UTF-8 com BOM, separador `;`, linhas terminadas em CRLF e aspas duplas (RFC
 * 4180) no campo com `;`, aspas ou quebra de linha. Falha se o arquivo não seguir esse formato.
 */
export function lerCsv(bytes: Buffer): string[][] {
  const texto = bytes.toString('utf8');
  if (!texto.startsWith(BOM)) throw new Error('CSV sem BOM UTF-8 (DEC-165)');
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  let i = BOM.length;
  for (; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') {
      if (campo !== '') throw new Error(`aspas no meio do campo na linha ${linhas.length + 1}`);
      aspas = true;
    } else if (c === ';') {
      linha.push(campo);
      campo = '';
    } else if (c === '\r') {
      if (texto[i + 1] !== '\n') throw new Error(`CR sem LF fora de aspas na linha ${linhas.length + 1}`);
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
      i++;
    } else if (c === '\n') {
      throw new Error(`linha ${linhas.length + 1} terminada só em LF (DEC-165: CRLF)`);
    } else campo += c;
  }
  if (aspas) throw new Error('aspas não fechadas');
  if (campo !== '' || linha.length > 0) linhas.push([...linha, campo]);
  return linhas;
}

/** Célula do XLSX: texto, número ou fórmula (que a exportação nunca deve gravar, DEC-161). */
export interface Celula {
  tipo: 'texto' | 'numero' | 'formula' | 'vazia';
  valor: string;
}

export interface Xlsx {
  /** Nomes das planilhas, na ordem do arquivo. */
  planilhas: string[];
  /** Linhas da planilha pedida, completadas com células vazias até a maior linha. */
  linhas: Celula[][];
}

/** Lê a planilha `nome` (padrão `Dados`, DEC-165 (2)) de um XLSX. */
export function lerXlsx(bytes: Buffer, nome = 'Dados'): Xlsx {
  const zip = lerZip(bytes);
  const xml = (caminho: string): string => {
    const b = zip.get(caminho);
    if (!b) throw new Error(`XLSX sem ${caminho}`);
    return b.toString('utf8');
  };
  const planilhas = [...xml('xl/workbook.xml').matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)].map((m) => atributos(m[1]));
  const alvo = planilhas.find((p) => p.name === nome);
  if (!alvo) throw new Error(`XLSX sem a planilha ${nome}; tem ${planilhas.map((p) => p.name).join(', ')}`);
  const rid = Object.entries(alvo).find(([k]) => k === 'r:id' || k.endsWith(':id'))?.[1];
  const rel = [...xml('xl/_rels/workbook.xml.rels').matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)]
    .map((m) => atributos(m[1]))
    .find((r) => r.Id === rid);
  if (!rel) throw new Error(`XLSX sem a relação ${rid}`);
  const caminho = rel.Target.startsWith('/') ? rel.Target.slice(1) : `xl/${rel.Target}`;

  const compartilhados = zip.has('xl/sharedStrings.xml')
    ? [...xml('xl/sharedStrings.xml').matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textos(m[1]))
    : [];

  const dados = /<(?:\w+:)?sheetData\b[^>]*>([\s\S]*?)<\/(?:\w+:)?sheetData>/.exec(xml(caminho))?.[1] ?? '';
  const porLinha = new Map<number, Map<number, Celula>>();
  let ultimaLinha = 0;
  for (const r of dados.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const numero = Number(atributos(r[1]).r ?? ultimaLinha + 1);
    ultimaLinha = numero;
    const celulas = new Map<number, Celula>();
    let ultimaColuna = -1;
    for (const c of (r[2] ?? '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const a = atributos(c[1]);
      const coluna = a.r ? indiceColuna(a.r) : ultimaColuna + 1;
      ultimaColuna = coluna;
      celulas.set(coluna, celula(a.t, c[2] ?? '', compartilhados));
    }
    porLinha.set(numero, celulas);
  }
  const largura = Math.max(0, ...[...porLinha.values()].map((l) => Math.max(-1, ...l.keys()) + 1));
  const linhas: Celula[][] = [];
  for (let n = 1; n <= ultimaLinha; n++) {
    const l = porLinha.get(n) ?? new Map<number, Celula>();
    linhas.push(Array.from({ length: largura }, (_, i) => l.get(i) ?? { tipo: 'vazia', valor: '' }));
  }
  return { planilhas: planilhas.map((p) => p.name), linhas };
}

/** Só os valores, com a célula vazia como `''`, para comparar com as linhas do CSV. */
export function valores(linhas: Celula[][]): string[][] {
  return linhas.map((l) => l.map((c) => c.valor));
}

function celula(t: string | undefined, corpo: string, compartilhados: string[]): Celula {
  if (/<(?:\w+:)?f\b/.test(corpo)) return { tipo: 'formula', valor: /<(?:\w+:)?f\b[^>]*>([\s\S]*?)<\/(?:\w+:)?f>/.exec(corpo)?.[1] ?? '' };
  const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(corpo)?.[1];
  switch (t) {
    case 's':
      return { tipo: 'texto', valor: compartilhados[Number(v)] ?? '' };
    case 'inlineStr':
      return { tipo: 'texto', valor: textos(corpo) };
    case 'str':
      return { tipo: 'texto', valor: desescapar(v ?? '') };
    case 'b':
    case 'e':
      throw new Error(`célula do tipo ${t} não é esperada na exportação`);
    default:
      return v === undefined ? { tipo: 'vazia', valor: '' } : { tipo: 'numero', valor: v };
  }
}

/** Concatena os `<t>` de um `<si>` ou `<is>` (texto rico vem em vários `<r><t>`). */
function textos(xml: string): string {
  return [...xml.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?t\b[^>]*\/>/g)].map((m) => desescapar(m[1] ?? '')).join('');
}

function atributos(texto: string): Record<string, string> {
  const a: Record<string, string> = {};
  for (const m of texto.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) a[m[1]] = desescapar(m[3] ?? m[4]);
  return a;
}

function desescapar(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function indiceColuna(ref: string): number {
  const letras = /^([A-Z]+)/.exec(ref)?.[1];
  if (!letras) throw new Error(`referência de célula inválida: ${ref}`);
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

/** Entradas de um zip (sem zip64), pelo diretório central; métodos 0 (guardado) e 8 (deflate). */
export function lerZip(bytes: Buffer): Map<string, Buffer> {
  let fim = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('não é um zip (sem o fim do diretório central)');
  const total = bytes.readUInt16LE(fim + 10);
  let p = bytes.readUInt32LE(fim + 16);
  const entradas = new Map<string, Buffer>();
  for (let n = 0; n < total; n++) {
    if (bytes.readUInt32LE(p) !== 0x02014b50) throw new Error('diretório central corrompido');
    const metodo = bytes.readUInt16LE(p + 10);
    const comprimido = bytes.readUInt32LE(p + 20);
    const tamNome = bytes.readUInt16LE(p + 28);
    const tamExtra = bytes.readUInt16LE(p + 30);
    const tamComentario = bytes.readUInt16LE(p + 32);
    const local = bytes.readUInt32LE(p + 42);
    const nome = bytes.subarray(p + 46, p + 46 + tamNome).toString('utf8');
    if (bytes.readUInt32LE(local) !== 0x04034b50) throw new Error(`cabeçalho local corrompido em ${nome}`);
    const inicio = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const dados = bytes.subarray(inicio, inicio + comprimido);
    if (metodo === 0) entradas.set(nome, Buffer.from(dados));
    else if (metodo === 8) entradas.set(nome, inflateRawSync(dados));
    else throw new Error(`método de compressão ${metodo} não suportado em ${nome}`);
    p += 46 + tamNome + tamExtra + tamComentario;
  }
  return entradas;
}
