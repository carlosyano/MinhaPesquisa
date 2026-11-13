// Conteúdo do QR `PPPPP.FFF.VV.X/Y` (DEC-218, DEC-220 (2), CA-028, CA-061, CA-063). IA-TEST do IMP-010.
// `conteudoQr` e `lerConteudoQr` ficam em `apps/api/src/regras/upload.ts`. A assinatura nova é uma
// escolha técnica do IA-TEST (a DEC-220 não a fixa): objeto com `projeto`, `formulario`, `versao`, `pagina` e
// `total`, números inteiros. O módulo é carregado por especificador em variável para o typecheck não depender
// do código que muda no IA-DEV.

import { describe, expect, it } from 'vitest';

interface Qr {
  projeto: number;
  formulario: number;
  versao: number;
  pagina: number;
  total: number;
}
interface Modulo {
  conteudoQr(q: Qr): string;
  lerConteudoQr(c: string): Qr | null;
}
const MODULO = '../../apps/api/src/regras/upload.js';
const carregar = async (): Promise<Modulo> => (await import(/* @vite-ignore */ MODULO)) as Modulo;

describe('conteudoQr (DEC-218)', () => {
  // @trace CA-028, DEC-218
  it('monta com zeros à esquerda: 5 dígitos do projeto, 3 do formulário, 2 da versão', async () => {
    const { conteudoQr } = await carregar();
    expect(conteudoQr({ projeto: 1, formulario: 2, versao: 1, pagina: 3, total: 4 })).toBe('00001.002.01.3/4');
    expect(conteudoQr({ projeto: 99999, formulario: 999, versao: 99, pagina: 12, total: 50 })).toBe('99999.999.99.12/50');
  });
});

describe('lerConteudoQr (DEC-218, DEC-187)', () => {
  // @trace CA-061, DEC-218
  it('lê o formato novo e devolve os números', async () => {
    const { lerConteudoQr } = await carregar();
    expect(lerConteudoQr('00001.002.01.3/4')).toEqual({ projeto: 1, formulario: 2, versao: 1, pagina: 3, total: 4 });
    expect(lerConteudoQr('99999.999.99.50/50')).toEqual({ projeto: 99999, formulario: 999, versao: 99, pagina: 50, total: 50 });
  });

  // @trace CA-004, DEC-218, DEC-187
  it.each([
    ['MP1.ABCDEFGHIJKLMNOPQRSTUVWXYZ.2', 'formato anterior à v2.9 (MP1.), contado como ausente'],
    ['1.2.1.3/4', 'sem zeros à esquerda'],
    ['000001.002.01.3/4', 'projeto com 6 dígitos'],
    ['00001.02.01.3/4', 'formulário com 2 dígitos'],
    ['00001.002.1.3/4', 'versão com 1 dígito'],
    ['00001.002.01.0/4', 'página 0'],
    ['00001.002.01.3/0', 'total 0'],
    ['00001.002.01.5/4', 'X maior que Y'],
    ['00001.002.01.3/1000', 'total com 4 dígitos'],
    ['00001.002.01.3-4', 'barra trocada'],
    [' 00001.002.01.3/4', 'espaço antes'],
    ['00001.002.01.3/4 ', 'espaço depois'],
    ['00001.002.01.3/4\n', 'quebra de linha depois'],
    ['https://exemplo.test/00001.002.01.3/4', 'URL'],
    ['', 'vazio'],
  ])('%s → null (%s)', async (conteudo) => {
    const { lerConteudoQr } = await carregar();
    expect(lerConteudoQr(conteudo)).toBeNull();
  });

  // @trace DEC-218
  it('ida e volta: o que conteudoQr monta, lerConteudoQr lê', async () => {
    const { conteudoQr, lerConteudoQr } = await carregar();
    for (const q of [
      { projeto: 1, formulario: 1, versao: 1, pagina: 1, total: 1 },
      { projeto: 37, formulario: 8, versao: 12, pagina: 2, total: 9 },
      { projeto: 99999, formulario: 999, versao: 99, pagina: 999, total: 999 },
    ]) {
      expect(lerConteudoQr(conteudoQr(q))).toEqual(q);
    }
  });
});
