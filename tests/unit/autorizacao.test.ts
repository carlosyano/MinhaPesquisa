// Regras de sessão, CSRF e paginação do RF-002 como funções puras, base do teste de mutação
// (DEC-052). Desde o IMP-005 não há perfis, concessões nem MFA (DEC-108, DEC-109): as regras
// correspondentes saem de apps/api/src/regras/autorizacao.ts.

import { describe, expect, it } from 'vitest';
import { csrfValido, limiteSessoesAtingido, paginacao } from '../../apps/api/src/regras/autorizacao.js';

function erro(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { errId?: string }).errId;
  }
  return undefined;
}

describe('sessões (RF-002)', () => {
  // @trace RF-002, ERR-021
  it('limite de 3 sessões ativas', () => {
    expect(limiteSessoesAtingido(2)).toBe(false);
    expect(limiteSessoesAtingido(3)).toBe(true);
    expect(limiteSessoesAtingido(4)).toBe(true);
  });

  // @trace DEC-044, Bloco P P.2, ERR-016
  it('CSRF: cookie igual ao cabeçalho e Origin permitida', () => {
    const ok = ['http://127.0.0.1:8080'];
    expect(csrfValido('abc', 'abc', 'http://127.0.0.1:8080', ok)).toBe(true);
    expect(csrfValido('abc', 'abd', 'http://127.0.0.1:8080', ok)).toBe(false);
    expect(csrfValido(undefined, undefined, 'http://127.0.0.1:8080', ok)).toBe(false);
    expect(csrfValido('', '', 'http://127.0.0.1:8080', ok)).toBe(false);
    expect(csrfValido('abc', 'abc', 'https://mal.exemplo.test', ok)).toBe(false);
    expect(csrfValido('abc', 'abc', undefined, ok)).toBe(false);
  });
});

describe('paginação (PLANO §5.1)', () => {
  // @trace PLANO §5.1, ERR-001
  it('padrão 20, máximo 100, página ≥ 1', () => {
    expect(paginacao({})).toEqual({ pagina: 1, limite: 20 });
    expect(paginacao({ pagina: '3', limite: '100' })).toEqual({ pagina: 3, limite: 100 });
    for (const q of [{ pagina: '0' }, { pagina: '1.5' }, { limite: '0' }, { limite: '101' }, { limite: 'x' }]) {
      expect(erro(() => paginacao(q))).toBe('ERR-001');
    }
  });
});
