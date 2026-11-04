// Primitivas de segurança: hash de senha (Argon2id), segredos de cookie, cifra de campo e
// HMAC do e-mail (DEC-084, DEC-085). Sem TOTP desde o IMP-005 (DEC-108).

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

// ───────────── Segredos de cookie ─────────────
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

// ───────────── Cifra de campo (AES-256-GCM) ─────────────
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
