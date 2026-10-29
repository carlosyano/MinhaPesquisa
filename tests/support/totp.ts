// TOTP (RFC 6238: SHA-1, passo de 30 s, 6 dígitos) sem dependência externa, para gerar
// códigos a partir do segredo conhecido no relógio do harness (PLANO §10.2).

import { createHmac } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(segredo: string): Buffer {
  const limpo = segredo.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = '';
  for (const c of limpo) {
    const v = ALFABETO.indexOf(c);
    if (v < 0) throw new Error('segredo base32 inválido');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codigoTotp(segredoBase32: string, em: Date): string {
  const contador = Math.floor(em.getTime() / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const hmac = createHmac('sha1', base32(segredoBase32)).update(msg).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const n = (hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000;
  return n.toString().padStart(6, '0');
}

/** Um código de 6 dígitos garantidamente diferente do válido no instante (e vizinhos). */
export function codigoErrado(segredoBase32: string, em: Date): string {
  const validos = new Set([-30_000, 0, 30_000].map((d) => codigoTotp(segredoBase32, new Date(em.getTime() + d))));
  for (let i = 0; ; i++) {
    const c = String(i).padStart(6, '0');
    if (!validos.has(c)) return c;
  }
}

export function segredoDaUri(otpauthUri: string): string {
  const s = new URL(otpauthUri).searchParams.get('secret');
  if (!s) throw new Error('otpauth_uri sem secret');
  return s;
}
