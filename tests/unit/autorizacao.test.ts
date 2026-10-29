// Regras de autorização e de estado do RF-001/RF-002 como funções puras, base do teste de
// mutação (DEC-052). Vermelho até o IA-DEV criar apps/api/src/regras/autorizacao.ts.

import { describe, expect, it } from 'vitest';
import {
  concessaoVigente,
  csrfValido,
  exigeOutroAdmin,
  exigirConcessivel,
  exigirEtapa,
  exigirPerfil,
  limiteSessoesAtingido,
  paginacao,
  proximaSituacao,
  validadeConcessao,
} from '../../apps/api/src/regras/autorizacao.js';

function erro(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { errId?: string }).errId;
  }
  return undefined;
}

const DIA = 86_400_000;
const AGORA = new Date('2026-11-02T12:00:00Z');

describe('perfil (RF-001, PLANO §6.1)', () => {
  // @trace RF-001, ERR-016
  it('admin_tenant passa; outros perfis → ERR-016; perfis são cumulativos (RN-003)', () => {
    expect(erro(() => exigirPerfil(['admin_tenant'], 'admin_tenant'))).toBeUndefined();
    expect(erro(() => exigirPerfil(['analista', 'admin_tenant'], 'admin_tenant'))).toBeUndefined();
    for (const p of [[], ['analista'], ['digitalizador'], ['analista_individual']]) {
      expect(erro(() => exigirPerfil(p, 'admin_tenant'))).toBe('ERR-016');
    }
  });
});

describe('concessão individual (CA-025, DEC-031, DEC-060, Q-030)', () => {
  // @trace CA-025, Q-030, ERR-018
  it('só para quem tem analista_individual', () => {
    expect(erro(() => exigirConcessivel(['analista_individual']))).toBeUndefined();
    expect(erro(() => exigirConcessivel(['analista', 'analista_individual']))).toBeUndefined();
    for (const p of [[], ['analista'], ['admin_tenant'], ['digitalizador']]) {
      expect(erro(() => exigirConcessivel(p))).toBe('ERR-018');
    }
  });

  // @trace CA-025, DEC-031
  it('vale exatamente 90 dias', () => {
    expect(validadeConcessao(AGORA).getTime() - AGORA.getTime()).toBe(90 * DIA);
  });

  // @trace CA-025, CA-038, ENT-015
  it('vigente = ativa, não revogada e dentro do prazo (não depende do job)', () => {
    const base = { ativo: true, revogado_em: null, valido_ate: new Date(AGORA.getTime() + 1) };
    expect(concessaoVigente(base, AGORA)).toBe(true);
    expect(concessaoVigente({ ...base, valido_ate: AGORA }, AGORA)).toBe(false);
    expect(concessaoVigente({ ...base, ativo: false }, AGORA)).toBe(false);
    expect(concessaoVigente({ ...base, revogado_em: AGORA }, AGORA)).toBe(false);
  });
});

describe('situação do usuário (RF-001)', () => {
  // @trace RF-001, ERR-018
  it('ativo/inativo trocam a situação; pendente_convite não muda pela edição', () => {
    expect(proximaSituacao('ativo', undefined)).toBe('ativo');
    expect(proximaSituacao('ativo', false)).toBe('inativo');
    expect(proximaSituacao('inativo', true)).toBe('ativo');
    expect(proximaSituacao('pendente_convite', undefined)).toBe('pendente_convite');
    expect(erro(() => proximaSituacao('pendente_convite', true))).toBe('ERR-018');
    expect(erro(() => proximaSituacao('pendente_convite', false))).toBe('ERR-018');
  });

  // @trace RF-001, ERR-018
  it('exige outro admin ativo só quando um admin ativo deixa de ser', () => {
    const admin = { situacao: 'ativo' as const, perfis: ['admin_tenant'] };
    expect(exigeOutroAdmin(admin, { situacao: 'inativo', perfis: ['admin_tenant'] })).toBe(true);
    expect(exigeOutroAdmin(admin, { situacao: 'ativo', perfis: ['analista'] })).toBe(true);
    expect(exigeOutroAdmin(admin, { situacao: 'ativo', perfis: ['admin_tenant', 'analista'] })).toBe(false);
    expect(exigeOutroAdmin({ situacao: 'pendente_convite', perfis: ['admin_tenant'] }, { situacao: 'pendente_convite', perfis: [] })).toBe(false);
    expect(exigeOutroAdmin({ situacao: 'ativo', perfis: ['analista'] }, { situacao: 'inativo', perfis: ['analista'] })).toBe(false);
  });
});

describe('MFA e sessões (RF-002, CA-026b)', () => {
  // @trace CA-026b, ERR-018
  it('operação de MFA só na etapa certa', () => {
    expect(erro(() => exigirEtapa('mfa_cadastro', 'mfa_cadastro'))).toBeUndefined();
    expect(erro(() => exigirEtapa('mfa_verificacao', 'mfa_cadastro'))).toBe('ERR-018');
    expect(erro(() => exigirEtapa('mfa_cadastro', 'mfa_verificacao'))).toBe('ERR-018');
  });

  // @trace RF-002, ERR-021
  it('limite de 3 sessões ativas', () => {
    expect(limiteSessoesAtingido(2)).toBe(false);
    expect(limiteSessoesAtingido(3)).toBe(true);
    expect(limiteSessoesAtingido(4)).toBe(true);
  });

  // @trace DEC-044, Bloco P P.2, ERR-016
  it('CSRF: cookie igual ao cabeçalho e Origin permitida', () => {
    const ok = ['https://app.exemplo.test'];
    expect(csrfValido('abc', 'abc', 'https://app.exemplo.test', ok)).toBe(true);
    expect(csrfValido('abc', 'abd', 'https://app.exemplo.test', ok)).toBe(false);
    expect(csrfValido(undefined, undefined, 'https://app.exemplo.test', ok)).toBe(false);
    expect(csrfValido('', '', 'https://app.exemplo.test', ok)).toBe(false);
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
