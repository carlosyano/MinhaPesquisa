// Chave mestra local (DEC-114): derivação das subchaves por HKDF, cópia cifrada com a senha de
// recuperação e guarda em arquivo pelo protetor do Windows (DPAPI). O DPAPI real só existe no
// Windows; aqui um protetor sintético faz o papel dele, para testar o formato e as recusas.

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ARQUIVO_DPAPI,
  ARQUIVO_RECUPERACAO,
  carregarChave,
  chaveGuardada,
  derivarChaves,
  desembrulharComSenha,
  embrulharComSenha,
  guardarChave,
  novaChaveMestra,
  type ProtetorChave,
} from '../../apps/api/src/infra/chaves.js';

const SENHA_RECUPERACAO = 'Recuperacao7Sintetica';
const mestra = Buffer.alloc(32, 0x5a);

/** Protetor sintético: inverte e mascara os bytes, para o arquivo nunca conter a chave em claro. */
const protetor: ProtetorChave = {
  async proteger(b) {
    return Buffer.concat([Buffer.from('fake-dpapi:'), Buffer.from(b.map((x) => x ^ 0xff))]);
  },
  async desproteger(b) {
    const prefixo = Buffer.from('fake-dpapi:');
    if (!b.subarray(0, prefixo.length).equals(prefixo)) throw new Error('não protegido por este protetor');
    return Buffer.from(b.subarray(prefixo.length).map((x) => x ^ 0xff));
  },
};

describe('derivação das subchaves (HKDF, DEC-114)', () => {
  // @trace DEC-114, RNF-003
  it('é determinística, com subchaves de 32 bytes diferentes entre si e da mestra', () => {
    const a = derivarChaves(mestra);
    const b = derivarChaves(Buffer.from(mestra));
    expect(a).toEqual(b);
    const todas = [a.hmacEmail, a.cifraCampo, a.backup];
    for (const k of todas) {
      expect(k).toHaveLength(32);
      expect(k.equals(mestra)).toBe(false);
    }
    expect(new Set(todas.map((k) => k.toString('hex'))).size).toBe(3);
  });

  // @trace DEC-114
  it('outra mestra gera outras subchaves', () => {
    const a = derivarChaves(mestra);
    const b = derivarChaves(Buffer.alloc(32, 0x5b));
    expect(a.hmacEmail.equals(b.hmacEmail)).toBe(false);
    expect(a.cifraCampo.equals(b.cifraCampo)).toBe(false);
    expect(a.backup.equals(b.backup)).toBe(false);
  });

  // @trace DEC-114
  it.each([0, 16, 31, 33, 64])('mestra de %i bytes é recusada', (n) => {
    expect(() => derivarChaves(Buffer.alloc(n, 1))).toThrow();
  });

  // @trace DEC-114
  it('a mestra nova tem 32 bytes aleatórios', () => {
    const a = novaChaveMestra();
    expect(a).toHaveLength(32);
    expect(a.equals(novaChaveMestra())).toBe(false);
  });
});

describe('cópia da mestra cifrada com a senha de recuperação (DEC-114)', () => {
  // @trace DEC-114, DEC-117
  it('ida e volta só com a senha certa, sem a mestra em claro e com sal aleatório', async () => {
    const pacote = await embrulharComSenha(mestra, SENHA_RECUPERACAO);
    expect(pacote.includes(mestra)).toBe(false);
    expect((await desembrulharComSenha(pacote, SENHA_RECUPERACAO)).equals(mestra)).toBe(true);
    await expect(desembrulharComSenha(pacote, 'Recuperacao7SinteticA')).rejects.toThrow();
    expect((await embrulharComSenha(mestra, SENHA_RECUPERACAO)).equals(pacote)).toBe(false);
  });

  // @trace DEC-114
  it('qualquer byte alterado ou o pacote truncado é recusado', async () => {
    const pacote = await embrulharComSenha(mestra, SENHA_RECUPERACAO);
    for (const i of [0, Math.floor(pacote.length / 2), pacote.length - 1]) {
      const alterado = Buffer.from(pacote);
      alterado[i] ^= 0x01;
      await expect(desembrulharComSenha(alterado, SENHA_RECUPERACAO)).rejects.toThrow();
    }
    await expect(desembrulharComSenha(pacote.subarray(0, pacote.length - 1), SENHA_RECUPERACAO)).rejects.toThrow();
  });

  // @trace DEC-114, RN-048
  it.each([
    ['curta', 'Ab1defghi'],
    ['sem maiúscula', 'semmaiusculas1'],
    ['sem dígito', 'SemDigitoAlgum'],
  ])('senha de recuperação %s é recusada', async (_caso, senha) => {
    await expect(embrulharComSenha(mestra, senha)).rejects.toThrow();
  });
});

describe('guarda da mestra em arquivo (DPAPI, DEC-114)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mp-chaves-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // @trace DEC-114, CA-035
  it('grava a mestra protegida e a cópia de recuperação, sem a mestra em claro', async () => {
    expect(await chaveGuardada(dir)).toBe(false);
    await guardarChave(dir, mestra, protetor, SENHA_RECUPERACAO);
    expect(await chaveGuardada(dir)).toBe(true);
    expect((await readdir(dir)).sort()).toEqual([ARQUIVO_DPAPI, ARQUIVO_RECUPERACAO].sort());

    const dpapi = await readFile(join(dir, ARQUIVO_DPAPI));
    const recuperacao = await readFile(join(dir, ARQUIVO_RECUPERACAO));
    expect(dpapi.includes(mestra)).toBe(false);
    expect(recuperacao.includes(mestra)).toBe(false);

    expect((await carregarChave(dir, protetor)).equals(mestra)).toBe(true);
    expect((await desembrulharComSenha(recuperacao, SENHA_RECUPERACAO)).equals(mestra)).toBe(true);
  });

  // @trace DEC-114, CA-035
  it('não sobrescreve uma chave já guardada', async () => {
    await guardarChave(dir, mestra, protetor, SENHA_RECUPERACAO);
    const antes = await readFile(join(dir, ARQUIVO_DPAPI));
    await expect(guardarChave(dir, Buffer.alloc(32, 1), protetor, SENHA_RECUPERACAO)).rejects.toThrow();
    expect((await readFile(join(dir, ARQUIVO_DPAPI))).equals(antes)).toBe(true);
    expect((await carregarChave(dir, protetor)).equals(mestra)).toBe(true);
  });

  // @trace DEC-114, RN-048
  it('senha de recuperação fraca não grava nada', async () => {
    await expect(guardarChave(dir, mestra, protetor, 'fraca')).rejects.toThrow();
    expect(await readdir(dir)).toEqual([]);
  });

  // @trace DEC-114
  it('sem chave guardada, ou protegida por outro protetor, não carrega', async () => {
    await expect(carregarChave(dir, protetor)).rejects.toThrow();
    await guardarChave(dir, mestra, protetor, SENHA_RECUPERACAO);
    const outro: ProtetorChave = {
      proteger: protetor.proteger,
      async desproteger() {
        throw new Error('outro usuário do Windows');
      },
    };
    await expect(carregarChave(dir, outro)).rejects.toThrow();
  });
});
