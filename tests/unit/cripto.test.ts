// Testes unitários das primitivas de segurança (Bloco P P.2, DEC-084, DEC-085), rápidos o
// bastante para o teste de mutação (DEC-052). Importam o código-fonte direto.

import { describe, expect, it } from 'vitest';
import {
  cifrar,
  conferirSenha,
  conferirTotp,
  decifrar,
  hashSenha,
  hmacEmail,
  iguais,
  normalizarEmail,
  novoSegredoTotp,
  SENHA_INDEFINIDA,
  senhaAceita,
  uriOtpauth,
} from '../../apps/api/src/infra/cripto.js';
import { codigoTotp } from '../support/totp.js';

const SEGREDO = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const T = new Date(1_111_111_109_000); // passo 37037036
const PASSO = Math.floor(T.getTime() / 30_000);

describe('política de senha (Bloco P P.2, DEC-084)', () => {
  // @trace RF-002, DEC-084
  it.each([
    ['Qv7mLt2pRx9w', true],
    ['Aa1aaaaaaa', true], // 10 caracteres
    ['Aa1' + 'a'.repeat(69), true], // 72 caracteres
    ['Aa1aaaaaa', false], // 9
    ['Aa1' + 'a'.repeat(70), false], // 73
    ['semmaiusculas1', false],
    ['SEMMINUSCULAS1', false],
    ['SemDigitosAqui', false],
    ['Primetime21', false], // vazada (lista em minúsculas)
    ['PRIMEtime21', false], // vazada, comparação sem diferenciar maiúsculas
  ])('%s → %s', (senha, esperado) => {
    expect(senhaAceita(senha)).toBe(esperado);
  });
});

describe('hash de senha (Argon2id, DEC-085)', () => {
  // @trace DEC-085
  it('gera Argon2id com os parâmetros da DEC-085 e confere só a senha certa', async () => {
    const h = await hashSenha('Qv7mLt2pRx9w');
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(await conferirSenha(h, 'Qv7mLt2pRx9w')).toBe(true);
    expect(await conferirSenha(h, 'Qv7mLt2pRx9W')).toBe(false);
  });

  // @trace CA-026, DEC-085
  it('conta inexistente ou sem senha definida nunca confere', async () => {
    expect(await conferirSenha(undefined, 'Qv7mLt2pRx9w')).toBe(false);
    expect(await conferirSenha(SENHA_INDEFINIDA, SENHA_INDEFINIDA)).toBe(false);
  });
});

describe('TOTP (RFC 6238, DEC-085)', () => {
  // @trace DEC-085, CA-026
  it('aceita o passo atual e ±1, recusa ±2 e devolve o passo aceito', () => {
    for (const d of [-1, 0, 1]) {
      const c = codigoTotp(SEGREDO, new Date(T.getTime() + d * 30_000));
      expect(conferirTotp(SEGREDO, c, T, null)).toBe(PASSO + d);
    }
    for (const d of [-2, 2]) {
      expect(conferirTotp(SEGREDO, codigoTotp(SEGREDO, new Date(T.getTime() + d * 30_000)), T, null)).toBeNull();
    }
  });

  // @trace DEC-085, B-N9
  it('anti-reuso: recusa passo igual ou anterior ao último aceito', () => {
    const c = codigoTotp(SEGREDO, T);
    expect(conferirTotp(SEGREDO, c, T, PASSO)).toBeNull();
    expect(conferirTotp(SEGREDO, c, T, PASSO + 1)).toBeNull();
    expect(conferirTotp(SEGREDO, c, T, PASSO - 1)).toBe(PASSO);
  });

  // @trace DEC-085
  it('recusa código de outro segredo e formato errado', () => {
    expect(conferirTotp(novoSegredoTotp(), codigoTotp(SEGREDO, T), T, null)).toBeNull();
    expect(conferirTotp(SEGREDO, '12345', T, null)).toBeNull();
  });

  // @trace DEC-050
  it('segredo novo: 32 caracteres base32 (160 bits), diferente a cada chamada', () => {
    const a = novoSegredoTotp();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(novoSegredoTotp()).not.toBe(a);
  });

  // @trace DEC-050
  it('URI otpauth com segredo, emissor e parâmetros', () => {
    const u = new URL(uriOtpauth(SEGREDO, 'ana@exemplo.test'));
    expect(u.protocol).toBe('otpauth:');
    expect(u.searchParams.get('secret')).toBe(SEGREDO);
    expect(u.searchParams.get('issuer')).toBe('MinhaPesquisa');
    expect(u.searchParams.get('digits')).toBe('6');
    expect(u.searchParams.get('period')).toBe('30');
    expect(decodeURIComponent(u.pathname)).toContain('MinhaPesquisa:ana@exemplo.test');
  });
});

describe('cifra do segredo TOTP (AES-256-GCM, DEC-085)', () => {
  const chave = Buffer.alloc(32, 7);

  // @trace DEC-085
  it('ida e volta, IV aleatório e versão no prefixo', () => {
    const a = cifrar(chave, SEGREDO);
    expect(a.startsWith('v1:')).toBe(true);
    expect(cifrar(chave, SEGREDO)).not.toBe(a);
    expect(decifrar(chave, a)).toBe(SEGREDO);
  });

  // @trace DEC-085
  it('adulteração ou chave errada são detectadas', () => {
    const a = cifrar(chave, SEGREDO);
    const bruto = Buffer.from(a.slice(3), 'base64');
    bruto[bruto.length - 1] ^= 1;
    expect(() => decifrar(chave, 'v1:' + bruto.toString('base64'))).toThrow();
    expect(() => decifrar(Buffer.alloc(32, 8), a)).toThrow();
  });
});

describe('e-mail e comparação', () => {
  // @trace DEC-054, DEC-087
  it('normaliza o e-mail e o HMAC não depende de caixa nem de espaços', () => {
    const k = Buffer.alloc(32, 1);
    expect(normalizarEmail('  Ana@Exemplo.TEST ')).toBe('ana@exemplo.test');
    expect(hmacEmail(k, 'Ana@Exemplo.test ').equals(hmacEmail(k, 'ana@exemplo.test'))).toBe(true);
    expect(hmacEmail(k, 'ana@exemplo.test').equals(hmacEmail(Buffer.alloc(32, 2), 'ana@exemplo.test'))).toBe(false);
    expect(hmacEmail(k, 'ana@exemplo.test')).toHaveLength(32);
  });

  // @trace DEC-044
  it('comparação em tempo constante', () => {
    expect(iguais('abc', 'abc')).toBe(true);
    expect(iguais('abc', 'abd')).toBe(false);
    expect(iguais('abc', 'abcd')).toBe(false);
  });
});
