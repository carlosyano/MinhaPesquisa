// Arquivos da exportação (DEC-165, DEC-166) sem biblioteca externa: CSV para o Excel em português
// e XLSX mínimo (uma planilha `Dados`, texto em linha e número), num zip escrito aqui.

import { crc32, deflateRawSync } from 'node:zlib';
import { neutralizarCsv, type Celula } from '../regras/exportacao.js';

/** Marca de ordem de bytes do UTF-8, para o Excel abrir o CSV com acentos (DEC-165 (1)). */
const BOM = String.fromCharCode(0xfeff);

/**
 * CSV da DEC-165 (1): UTF-8 com BOM, `;`, CRLF e aspas duplas no campo com `;`, aspas ou quebra de
 * linha. Texto que viraria fórmula recebe o apóstrofo; números saem como estão (DEC-166).
 */
export function gerarCsv(cabecalho: readonly string[], linhas: Celula[][]): Buffer {
  const campo = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const celula = (c: Celula) => campo('texto' in c ? neutralizarCsv(c.texto) : c.numero);
  const texto = [cabecalho.map(campo).join(';'), ...linhas.map((l) => l.map(celula).join(';'))].map((l) => `${l}\r\n`).join('');
  return Buffer.from(BOM + texto, 'utf8');
}

/** Tira os caracteres que o XML 1.0 não aceita e escapa os especiais. */
function xml(texto: string): string {
  return texto
    .replace(/[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function coluna(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/**
 * XLSX da DEC-165 (2): planilha `Dados` com o cabeçalho na linha 1; texto como string em linha
 * (nunca fórmula, DEC-166) e os valores de `escala` e `numero` como número. Célula vazia é omitida.
 */
export function gerarXlsx(cabecalho: readonly string[], linhas: Celula[][], agora: Date): Buffer {
  const todas: Celula[][] = [cabecalho.map((texto) => ({ texto })), ...linhas];
  const corpo = todas
    .map((l, r) => {
      const celulas = l
        .map((c, k) => {
          const ref = `${coluna(k)}${r + 1}`;
          if ('numero' in c) return `<c r="${ref}"><v>${xml(c.numero)}</v></c>`;
          return c.texto === '' ? '' : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(c.texto)}</t></is></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${celulas}</row>`;
    })
    .join('');
  const ns = 'http://schemas.openxmlformats.org';
  const arquivos: [string, string][] = [
    [
      '[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ],
    [
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships">` +
        '<sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ],
    [
      'xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${ns}/spreadsheetml/2006/main">` +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ],
    [
      'xl/worksheets/sheet1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetData>${corpo}</sheetData></worksheet>`,
    ],
  ];
  return zip(arquivos, agora);
}

/** Zip com deflate (sem zip64: a exportação de um notebook fica bem abaixo de 4 GB). */
function zip(arquivos: [string, string][], agora: Date): Buffer {
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | Math.floor(agora.getSeconds() / 2);
  const data = ((Math.max(1980, agora.getFullYear()) - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const [nome, conteudo] of arquivos) {
    const original = Buffer.from(conteudo, 'utf8');
    const dados = deflateRawSync(original);
    const n = Buffer.from(nome, 'utf8');
    const crc = crc32(original);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(data, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(original.length, 22);
    local.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(hora, 12);
    c.writeUInt16LE(data, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(dados.length, 20);
    c.writeUInt32LE(original.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(deslocamento, 42);
    partes.push(local, n, dados);
    central.push(c, n);
    deslocamento += local.length + n.length + dados.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, diretorio, fim]);
}

export const TIPO_ARQUIVO = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;
