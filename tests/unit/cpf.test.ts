// CPF lido do papel (RN-012, CA-002): normalização para o formato canônico de 11 dígitos
// (REQ §5.4) antes do HMAC e validação dos dígitos verificadores. Função pura, no escopo da
// mutação (DEC-052). CPFs sintéticos.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cpfValido, normalizarCpf } from '../../apps/api/src/regras/cpf.js';

function comDigitos(base: number[]): string {
  const d = [...base];
  for (const n of [9, 10]) {
    const soma = d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0);
    d.push(((soma * 10) % 11) % 10);
  }
  return d.join('');
}

describe('normalizarCpf (REQ §5.4)', () => {
  // @trace CA-002, RN-012, REQ §5.4
  it.each([
    ['123.456.789-09', '12345678909'],
    ['12345678909', '12345678909'],
    [' 123 456 789 09 ', '12345678909'],
    ['529.982.247-25', '52998224725'],
  ])('%j → %j', (lido, canonico) => {
    expect(normalizarCpf(lido)).toBe(canonico);
  });

  // @trace RN-012
  it.each(['1234567890', '123456789012', '123.456.789-0X', 'abc', ''])('%j não é um CPF de 11 dígitos → null', (lido) => {
    expect(normalizarCpf(lido)).toBeNull();
  });
});

describe('cpfValido (RN-012)', () => {
  // @trace RN-012, CA-002, CA-014b, CA-032
  it.each(['12345678909', '52998224725', '11144477735', '98765432100'])('%s tem dígitos verificadores válidos', (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  // @trace RN-012, CA-002
  it.each(['12345678900', '52998224700', '11144477734'])('%s tem dígitos verificadores inválidos', (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  // @trace RN-012
  it('propriedade: os dígitos calculados validam, e trocar qualquer um dos dois invalida', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 9, maxLength: 9 }), fc.integer({ min: 9, max: 10 }), fc.integer({ min: 1, max: 9 }), (base, pos, delta) => {
        fc.pre(new Set(base).size > 1);
        const cpf = comDigitos(base);
        expect(cpfValido(cpf)).toBe(true);
        const trocado = cpf.slice(0, pos) + String((Number(cpf[pos]) + delta) % 10) + cpf.slice(pos + 1);
        expect(cpfValido(trocado)).toBe(false);
      }),
    );
  });
});
