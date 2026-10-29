// Primitivas de segurança: hash de senha (Argon2id), TOTP, segredos de cookie e de token,
// cifra do segredo TOTP e HMAC do e-mail (DEC-050, DEC-084, DEC-085).

import { Algorithm, hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SENHAS_VAZADAS } from '../dados/senhas-vazadas.js';

// ───────────── Senha (Argon2id, OWASP: m=19 MiB, t=2, p=1 — DEC-085) ─────────────
const ARGON = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashSenha(senha: string): Promise<string> {
  return argonHash(senha, ARGON);
}

/** Hash de referência para gastar o mesmo tempo quando a conta não existe (sem oráculo). */
let hashFicticio: Promise<string> | undefined;

export async function conferirSenha(hashGuardado: string | undefined, senha: string): Promise<boolean> {
  hashFicticio ??= hashSenha(randomBytes(16).toString('hex'));
  const alvo = hashGuardado?.startsWith('$argon2id$') ? hashGuardado : await hashFicticio;
  const ok = await argonVerify(alvo, senha).catch(() => false);
  return ok && alvo === hashGuardado;
}

/** Valor de senha_hash de usuário que ainda não definiu senha: nunca confere. */
export const SENHA_INDEFINIDA = '!pendente';

const VAZADAS = new Set(SENHAS_VAZADAS);

/** Política do Bloco P P.2: 10 a 72, minúscula, maiúscula, dígito, fora da lista de vazadas. */
export function senhaAceita(senha: string): boolean {
  return (
    senha.length >= 10 &&
    senha.length <= 72 &&
    /[a-z]/.test(senha) &&
    /[A-Z]/.test(senha) &&
    /\d/.test(senha) &&
    !VAZADAS.has(senha.toLowerCase())
  );
}

// ───────────── Segredos de cookie e de link ─────────────
export function segredoAleatorio(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(valor: string): Buffer {
  return createHash('sha256').update(valor).digest();
}

export function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hmacEmail(chave: Buffer, email: string): Buffer {
  return createHmac('sha256', chave).update(normalizarEmail(email)).digest();
}

// ───────────── Cifra do segredo TOTP (AES-256-GCM) ─────────────
export function cifrar(chave: Buffer, texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave, iv, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

export function decifrar(chave: Buffer, valor: string): string {
  const bruto = Buffer.from(valor.slice(3), 'base64');
  const d = createDecipheriv('aes-256-gcm', chave, bruto.subarray(0, 12), { authTagLength: 16 });
  d.setAuthTag(bruto.subarray(12, 28));
  return Buffer.concat([d.update(bruto.subarray(28)), d.final()]).toString('utf8');
}

// ───────────── TOTP (RFC 6238: SHA-1, 6 dígitos, 30 s, ±1 passo — DEC-085) ─────────────
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function novoSegredoTotp(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let s = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) s += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return s;
}

function base32ParaBytes(s: string): Buffer {
  let bits = '';
  for (const c of s.toUpperCase()) bits += BASE32.indexOf(c).toString(2).padStart(5, '0');
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

function codigoNoPasso(segredo: string, passo: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(passo));
  const h = createHmac('sha1', base32ParaBytes(segredo)).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  return ((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

/**
 * Devolve o passo aceito, ou null. Recusa passo já usado ou anterior ao último aceito
 * (anti-reuso, DEC-085).
 */
export function conferirTotp(segredo: string, codigo: string, agora: Date, ultimoPasso: number | null): number | null {
  const atual = Math.floor(agora.getTime() / 30_000);
  for (const passo of [atual - 1, atual, atual + 1]) {
    if (ultimoPasso !== null && passo <= ultimoPasso) continue;
    if (iguais(codigoNoPasso(segredo, passo), codigo)) return passo;
  }
  return null;
}

export function uriOtpauth(segredo: string, email: string): string {
  const rotulo = encodeURIComponent(`MinhaPesquisa:${email}`);
  return `otpauth://totp/${rotulo}?secret=${segredo}&issuer=MinhaPesquisa&algorithm=SHA1&digits=6&period=30`;
}
