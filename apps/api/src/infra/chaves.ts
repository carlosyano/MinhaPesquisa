// Chave mestra local (DEC-114, substitui o envelope no KMS da DEC-041). Gerada na instalação,
// guardada cifrada pelo DPAPI do Windows (escopo da máquina) e com uma cópia cifrada pela senha
// de recuperação, que acompanha o backup para restaurar em outro notebook (DEC-117). As chaves
// de uso (HMAC do e-mail, cifra de campo, backup) saem dela por HKDF e nunca são gravadas.

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, scrypt as scryptCb, type ScryptOptions } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { senhaAceita } from './cripto.js';

export const ARQUIVO_DPAPI = 'chave-mestra.dpapi';
export const ARQUIVO_RECUPERACAO = 'chave-mestra.recuperacao';

export interface ChavesDerivadas {
  hmacEmail: Buffer;
  cifraCampo: Buffer;
  backup: Buffer;
}

function exigirMestra(mestra: Buffer): void {
  if (mestra.length !== 32) throw new Error('a chave mestra deve ter 32 bytes');
}

export function novaChaveMestra(): Buffer {
  return randomBytes(32);
}

/** Subchaves por HKDF-SHA256, uma por finalidade (rótulos fixos). */
export function derivarChaves(mestra: Buffer): ChavesDerivadas {
  exigirMestra(mestra);
  const d = (rotulo: string) => Buffer.from(hkdfSync('sha256', mestra, Buffer.alloc(0), `minhapesquisa/${rotulo}/v1`, 32));
  return { hmacEmail: d('hmac-email'), cifraCampo: d('cifra-campo'), backup: d('backup') };
}

// ───────────────────── cópia com a senha de recuperação ─────────────────────

// Pacote: "MPK1" | sal (16) | iv (12) | etiqueta (16) | mestra cifrada (32). scrypt N=2^15.
const MAGICO = Buffer.from('MPK1');
const SCRYPT: ScryptOptions = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const TAMANHO_PACOTE = 4 + 16 + 12 + 16 + 32;

function scrypt(senha: string, sal: Buffer): Promise<Buffer> {
  return new Promise((ok, erro) => scryptCb(senha.normalize('NFC'), sal, 32, SCRYPT, (e, k) => (e ? erro(e) : ok(k))));
}

/** Cifra a mestra com a senha de recuperação (scrypt + AES-256-GCM). Senha fraca é recusada. */
export async function embrulharComSenha(mestra: Buffer, senha: string): Promise<Buffer> {
  exigirMestra(mestra);
  if (!senhaAceita(senha)) throw new Error('senha de recuperação fora da política (RN-048)');
  const sal = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', await scrypt(senha, sal), iv);
  c.setAAD(Buffer.concat([MAGICO, sal]));
  const cifrada = Buffer.concat([c.update(mestra), c.final()]);
  return Buffer.concat([MAGICO, sal, iv, c.getAuthTag(), cifrada]);
}

export async function desembrulharComSenha(pacote: Buffer, senha: string): Promise<Buffer> {
  if (pacote.length !== TAMANHO_PACOTE || !pacote.subarray(0, 4).equals(MAGICO)) throw new Error('cópia da chave inválida');
  const sal = pacote.subarray(4, 20);
  const d = createDecipheriv('aes-256-gcm', await scrypt(senha, sal), pacote.subarray(20, 32), { authTagLength: 16 });
  d.setAAD(Buffer.concat([MAGICO, sal]));
  d.setAuthTag(pacote.subarray(32, 48));
  try {
    return Buffer.concat([d.update(pacote.subarray(48)), d.final()]);
  } catch {
    throw new Error('senha de recuperação errada ou cópia da chave alterada');
  }
}

// ───────────────────────────── guarda em arquivo ─────────────────────────────

/** Proteção da mestra em repouso no notebook: DPAPI em produção, sintético nos testes. */
export interface ProtetorChave {
  proteger(bytes: Buffer): Promise<Buffer>;
  desproteger(bytes: Buffer): Promise<Buffer>;
}

export async function chaveGuardada(dir: string): Promise<boolean> {
  return existsSync(join(dir, ARQUIVO_DPAPI));
}

/** Grava a mestra protegida e a cópia de recuperação. Nunca sobrescreve uma chave existente. */
export async function guardarChave(dir: string, mestra: Buffer, protetor: ProtetorChave, senhaRecuperacao: string): Promise<void> {
  if (existsSync(join(dir, ARQUIVO_DPAPI)) || existsSync(join(dir, ARQUIVO_RECUPERACAO))) {
    throw new Error('já existe uma chave mestra guardada nesta pasta');
  }
  const recuperacao = await embrulharComSenha(mestra, senhaRecuperacao);
  const protegida = await protetor.proteger(mestra);
  await writeFile(join(dir, ARQUIVO_RECUPERACAO), recuperacao, { flag: 'wx', mode: 0o600 });
  await writeFile(join(dir, ARQUIVO_DPAPI), protegida, { flag: 'wx', mode: 0o600 });
}

export async function carregarChave(dir: string, protetor: ProtetorChave): Promise<Buffer> {
  const mestra = await protetor.desproteger(await readFile(join(dir, ARQUIVO_DPAPI)));
  exigirMestra(mestra);
  return mestra;
}

// ─────────────────────────────── DPAPI ───────────────────────────────

// ProtectedData pelo Windows PowerShell 5.1, que vem no Windows. Os bytes vão e voltam em
// base64 pela entrada e saída padrão, nunca pela linha de comando.
const SCRIPT_DPAPI = (operacao: 'Protect' | 'Unprotect') =>
  `$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;` +
  `$b=[Convert]::FromBase64String([Console]::In.ReadToEnd().Trim());` +
  `$r=[System.Security.Cryptography.ProtectedData]::${operacao}($b,[Text.Encoding]::UTF8.GetBytes('minhapesquisa/local'),` +
  `[System.Security.Cryptography.DataProtectionScope]::LocalMachine);[Console]::Out.Write([Convert]::ToBase64String($r))`;

function powershell(script: string, entrada: Buffer): Promise<Buffer> {
  return new Promise((ok, erro) => {
    const p = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
      (e, saida) => (e ? erro(new Error('DPAPI indisponível ou chave de outra máquina')) : ok(Buffer.from(saida.trim(), 'base64'))),
    );
    p.stdin?.end(entrada.toString('base64'));
  });
}

/** DPAPI do Windows no escopo da máquina (DEC-114). Protege a mestra e os segredos locais. */
export const protetorDpapi: ProtetorChave = {
  proteger: (b) => powershell(SCRIPT_DPAPI('Protect'), b),
  desproteger: (b) => powershell(SCRIPT_DPAPI('Unprotect'), b),
};
