// Pasta local de imagens (DEC-113): mesma interface do armazenamento em memória (DEC-101), com
// os arquivos sob uma raiz e os links assinados de 5 min servidos só em 127.0.0.1 (RN-029,
// DEC-034). A expiração segue o relógio injetado.

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArmazenamentoEmDisco, caminhoNoDisco } from '../../apps/api/src/infra/armazenamento-disco.js';
import { chaveImagem } from '../../apps/api/src/infra/armazenamento.js';

const T = '0b6e7a52-4c1f-4d3e-9a51-6f1d2b3c4d5e';
const A = '7d2c9e10-8b3a-4f5e-a1b2-c3d4e5f60718';
const I = 'e1f2a3b4-c5d6-4e7f-8091-a2b3c4d5e6f7';

/** Lista os arquivos sob a pasta, com caminho relativo e barra normal. */
async function arquivos(dir: string): Promise<string[]> {
  const r = await readdir(dir, { recursive: true, withFileTypes: true });
  return r
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name).slice(dir.length + 1).replace(/\\/g, '/'))
    .sort();
}

describe('caminho da chave no disco (DEC-113)', () => {
  const raiz = resolve(tmpdir(), 'mp-raiz-sintetica');

  // @trace DEC-113, DEC-101
  it('a chave de imagem vira um caminho dentro da raiz', () => {
    const p = caminhoNoDisco(raiz, chaveImagem(T, A, I));
    expect(p.startsWith(raiz)).toBe(true);
    expect(p.replace(/\\/g, '/').endsWith(`tenant/${T}/aplicacao/${A}/${I}.jpg`)).toBe(true);
  });

  // @trace DEC-113, RN-029
  it.each([
    '',
    '../fora.jpg',
    'tenant/../../fora.jpg',
    `tenant/${T}/../outro/x.jpg`,
    '/absoluto.jpg',
    'C:\\Windows\\x.jpg',
    'tenant\\x.jpg',
    'tenant//x.jpg',
    'tenant/x.jpg/',
    './x.jpg',
    'tenant/%2e%2e/x.jpg',
    'tenant/x y.jpg',
    'tenant/x.jpg\0',
  ])('chave inválida %j é recusada', (chave) => {
    expect(() => caminhoNoDisco(raiz, chave)).toThrow();
  });
});

describe('armazenamento em disco (DEC-113)', () => {
  let dir: string;
  let agora: Date;
  let a: ArmazenamentoEmDisco;
  const chave = chaveImagem(T, A, I);
  const bytes = Buffer.from('jpeg sintético para o teste');

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mp-imagens-'));
    agora = new Date('2026-11-04T12:00:00Z');
    a = new ArmazenamentoEmDisco(dir, () => agora);
    await a.iniciar();
  });
  afterEach(async () => {
    await a.fechar();
    await rm(dir, { recursive: true, force: true });
  });

  // @trace DEC-113, RF-006
  it('grava só o arquivo final, sem temporários, e conta pelo prefixo', async () => {
    await a.gravar(chave, bytes, 'image/jpeg');
    await a.gravar(chaveImagem(T, A, 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f'), bytes, 'image/jpeg');
    expect(await arquivos(dir)).toEqual(
      [`tenant/${T}/aplicacao/${A}/${I}.jpg`, `tenant/${T}/aplicacao/${A}/f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f.jpg`].sort(),
    );
    expect(await a.contar(`tenant/${T}/`)).toBe(2);
    expect(await a.contar(`tenant/${A}/`)).toBe(0);
  });

  // @trace DEC-113, RN-029, DEC-034
  it('o link assinado serve o arquivo em 127.0.0.1 até expirar', async () => {
    await a.gravar(chave, bytes, 'image/jpeg');
    const url = await a.urlAssinada(chave, new Date(agora.getTime() + 5 * 60_000));
    expect(new URL(url).hostname).toBe('127.0.0.1');
    expect(url).not.toContain(dir);

    const r = await fetch(url);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await r.arrayBuffer()).equals(bytes)).toBe(true);

    agora = new Date(agora.getTime() + 5 * 60_000);
    expect((await fetch(url)).status).toBe(403);
  });

  // @trace DEC-113, RN-029
  it('link com assinatura alterada ou para outra chave é recusado', async () => {
    await a.gravar(chave, bytes, 'image/jpeg');
    const url = new URL(await a.urlAssinada(chave, new Date(agora.getTime() + 60_000)));
    const assinatura = url.searchParams.get('assinatura')!;
    const trocada = new URL(url);
    trocada.searchParams.set('assinatura', (assinatura[0] === '0' ? '1' : '0') + assinatura.slice(1));
    expect((await fetch(trocada)).status).toBe(403);

    const outra = new URL(url);
    outra.pathname = '/' + encodeURIComponent(chaveImagem(T, A, 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e1f'));
    expect((await fetch(outra)).status).toBe(403);
  });

  // @trace DEC-113, RN-030
  it('apagar remove o arquivo; o link deixa de servir e apagar de novo não falha', async () => {
    await a.gravar(chave, bytes, 'image/jpeg');
    const url = await a.urlAssinada(chave, new Date(agora.getTime() + 60_000));
    await a.apagar(chave);
    expect(await a.contar(`tenant/${T}/`)).toBe(0);
    expect(await arquivos(dir)).toEqual([]);
    expect((await fetch(url)).status).toBe(403);
    await a.apagar(chave);
  });

  // @trace DEC-113, RN-029
  it('chave inválida não grava nada, dentro nem fora da raiz', async () => {
    await expect(a.gravar('../fora.jpg', bytes, 'image/jpeg')).rejects.toThrow();
    await expect(a.gravar('tenant/../../fora.jpg', bytes, 'image/jpeg')).rejects.toThrow();
    expect(await arquivos(dir)).toEqual([]);
  });

  // @trace DEC-113
  it('gravar de novo a mesma chave substitui o conteúdo', async () => {
    await a.gravar(chave, bytes, 'image/jpeg');
    const novo = Buffer.from('outro jpeg sintético');
    await a.gravar(chave, novo, 'image/jpeg');
    const r = await fetch(await a.urlAssinada(chave, new Date(agora.getTime() + 60_000)));
    expect(Buffer.from(await r.arrayBuffer()).equals(novo)).toBe(true);
    expect(await a.contar(`tenant/${T}/`)).toBe(1);
  });
});
