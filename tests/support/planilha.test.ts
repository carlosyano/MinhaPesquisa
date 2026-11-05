// Autoteste da leitura de CSV e XLSX (não depende da API): garante que `planilha.ts` lê o que os
// testes vermelhos do IMP-007 supõem e recusa CSV fora da DEC-165.

import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BOM, lerCsv, lerXlsx, lerZip, valores } from './planilha.js';

/** Zip mínimo, com a 1ª entrada guardada e as demais em deflate, como os geradores fazem. */
function zip(arquivos: Record<string, string>): Buffer {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let deslocamento = 0;
  Object.entries(arquivos).forEach(([nome, conteudo], i) => {
    const original = Buffer.from(conteudo, 'utf8');
    const metodo = i === 0 ? 0 : 8;
    const dados = metodo === 0 ? original : deflateRawSync(original);
    const n = Buffer.from(nome, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(crc32(original), 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(original.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(crc32(original), 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(original.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(deslocamento, 42);
    locais.push(local, n, dados);
    centrais.push(central, n);
    deslocamento += local.length + n.length + dados.length;
  });
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

const WORKBOOK = `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Outra" sheetId="1" r:id="rId1"/><sheet name="Dados" sheetId="2" r:id="rId2"/></sheets></workbook>`;
const RELS = `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Target="/xl/worksheets/sheet2.xml" Id="rId2"/></Relationships>`;
const SHARED = `<?xml version="1.0"?><sst><si><t>CPF</t></si><si><r><t>Maria </t></r><r><t xml:space="preserve">da Silva</t></r></si><si><t>'=SOMA(A1)</t></si></sst>`;
const SHEET2 = `<?xml version="1.0"?><worksheet><cols><col min="1" max="3"/></cols><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Nome &amp; sobrenome</t></is></c><c r="C1" t="str"><v>Peso</v></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>52998224725</t></is></c><c r="B2" t="s"><v>1</v></c><c r="C2"><v>72.5</v></c></row>
<row r="4"><c r="A4" t="s"><v>2</v></c><c r="C4"><f>1+1</f><v>2</v></c></row>
</sheetData></worksheet>`;

describe('apoio: leitura de planilhas', () => {
  // @trace DEC-165
  it('lerXlsx acha a planilha pelo nome e distingue texto, número, fórmula e célula vazia', () => {
    const x = lerXlsx(
      zip({
        '[Content_Types].xml': '<Types/>',
        'xl/workbook.xml': WORKBOOK,
        'xl/_rels/workbook.xml.rels': RELS,
        'xl/sharedStrings.xml': SHARED,
        'xl/worksheets/sheet1.xml': '<worksheet><sheetData/></worksheet>',
        'xl/worksheets/sheet2.xml': SHEET2,
      }),
    );
    expect(x.planilhas).toEqual(['Outra', 'Dados']);
    expect(x.linhas).toHaveLength(4);
    expect(x.linhas[0]).toEqual([
      { tipo: 'texto', valor: 'CPF' },
      { tipo: 'texto', valor: 'Nome & sobrenome' },
      { tipo: 'texto', valor: 'Peso' },
    ]);
    expect(x.linhas[1]).toEqual([
      { tipo: 'texto', valor: '52998224725' },
      { tipo: 'texto', valor: 'Maria da Silva' },
      { tipo: 'numero', valor: '72.5' },
    ]);
    expect(x.linhas[2].every((c) => c.tipo === 'vazia')).toBe(true);
    expect(x.linhas[3][0]).toEqual({ tipo: 'texto', valor: "'=SOMA(A1)" });
    expect(x.linhas[3][1].tipo).toBe('vazia');
    expect(x.linhas[3][2].tipo).toBe('formula');
    expect(valores(x.linhas)[1]).toEqual(['52998224725', 'Maria da Silva', '72.5']);
  });

  // @trace DEC-165
  it('lerXlsx falha sem a planilha pedida; lerZip falha com bytes que não são zip', () => {
    const z = zip({ 'xl/workbook.xml': WORKBOOK.replace('Dados', 'Planilha1'), 'xl/_rels/workbook.xml.rels': RELS });
    expect(() => lerXlsx(z)).toThrow(/sem a planilha Dados/);
    expect(() => lerZip(Buffer.from('ID;CPF\r\n'))).toThrow(/não é um zip/);
  });

  // @trace DEC-165
  it('lerCsv lê o formato da DEC-165: BOM, `;`, CRLF e aspas duplas com `;`, aspas e quebra de linha', () => {
    const csv = Buffer.from(`${BOM}A;B;C\r\n"x;y";"diz ""oi""";"linha 1\r\nlinha 2"\r\n;;\r\n`, 'utf8');
    expect(lerCsv(csv)).toEqual([
      ['A', 'B', 'C'],
      ['x;y', 'diz "oi"', 'linha 1\r\nlinha 2'],
      ['', '', ''],
    ]);
  });

  // @trace DEC-165
  it('lerCsv recusa CSV sem BOM ou com linhas terminadas só em LF', () => {
    expect(() => lerCsv(Buffer.from('A;B\r\n', 'utf8'))).toThrow(/BOM/);
    expect(() => lerCsv(Buffer.from(`${BOM}A;B\n1;2\n`, 'utf8'))).toThrow(/CRLF/);
  });
});
