// Guarda de etapa do MFA (CA-026b, RF-002, DEC-050, DEC-082): os 7 exemplos do CA.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { Cliente, chaveIdempotencia } from '../../support/cliente.js';
import { SENHA, emailSintetico, entrar, pessoa, tenantComAdmin, ultimoToken, type TenantPronto } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { codigoTotp, segredoDaUri } from '../../support/totp.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

/** Usuário criado pelo admin, ainda em pendente_convite; devolve e-mail, id e token do convite. */
async function convidado(t: TenantPronto) {
  const adminC = await entrar(h, t.admin);
  const email = emailSintetico('convidado');
  const r = await adminC.post('/admin/users', {
    corpo: { email, nome: 'Convidado Fictício', perfis: ['digitalizador'] },
    headers: { 'idempotency-key': chaveIdempotencia() },
  });
  expect(r.status, r.texto).toBe(201);
  return { email, usuarioId: r.corpo.id as string, token: ultimoToken(h, email, 'convite'), adminC };
}

async function preSessaoCadastro(token: string): Promise<Cliente> {
  const c = new Cliente(h.baseUrl);
  const r = await c.post('/auth/invites/accept', { corpo: { token, senha: SENHA } });
  expect(r.status, r.texto).toBe(200);
  expect(r.corpo).toEqual({ etapa: 'mfa_cadastro' });
  return c;
}

describe('CA-026b — cadastro de MFA só na etapa de cadastro', () => {
  // @trace CA-026b, CA-035, RF-002
  it('exemplo 1: primeiro acesso cadastra o MFA e cria a sessão plena', async () => {
    const t = await tenantComAdmin(h);
    const u = await convidado(t);
    const c = await preSessaoCadastro(u.token);

    const inicio = await c.post('/auth/mfa/setup/start');
    expect(inicio.status, inicio.texto).toBe(200);
    expect(inicio.corpo.otpauth_uri).toMatch(/^otpauth:\/\/totp\//);
    const segredo = segredoDaUri(inicio.corpo.otpauth_uri);
    expect(inicio.corpo.segredo_base32).toBe(segredo);

    const fim = await c.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(segredo, h.clock.now()) } });
    expect(fim.status, fim.texto).toBe(200);
    expect(c.temCookie('mp_session')).toBe(true);
    expect((await c.get('/auth/session')).status).toBe(200);
    expect(await h.inspect.usuario(u.usuarioId)).toMatchObject({ mfa_ativo: true, situacao: 'ativo' });
  });

  // @trace CA-026b, RF-002
  it('exemplo 2: com mfa_ativo = true, startMfaSetup na etapa mfa_verificacao → ERR-018 e segredo mantido', async () => {
    const t = await tenantComAdmin(h);
    const antes = await h.inspect.usuario(t.admin.usuarioId);
    const atacante = new Cliente(h.baseUrl);
    expect((await atacante.post('/auth/login', { corpo: { email: t.admin.email, senha: t.admin.senha } })).corpo).toEqual({
      etapa: 'mfa_verificacao',
    });

    esperarErro(await atacante.post('/auth/mfa/setup/start'), 'ERR-018');
    const depois = await h.inspect.usuario(t.admin.usuarioId);
    expect(depois.impressao_segredo_totp).toBe(antes.impressao_segredo_totp);
    expect(depois.mfa_ativo).toBe(true);
    expect(atacante.temCookie('mp_session')).toBe(false);
  });

  // @trace CA-026b, RF-002
  it('exemplo 3: com mfa_ativo = true, setupMfa com qualquer código → ERR-018 e nenhuma sessão', async () => {
    const t = await tenantComAdmin(h);
    const atacante = new Cliente(h.baseUrl);
    await atacante.post('/auth/login', { corpo: { email: t.admin.email, senha: t.admin.senha } });

    // Nem o código válido do segredo atual passa pelo setupMfa.
    const r = await atacante.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(t.admin.segredoTotp, h.clock.now()) } });
    esperarErro(r, 'ERR-018');
    expect(atacante.temCookie('mp_session')).toBe(false);
    expect((await h.inspect.sessoesAtivas(t.admin.usuarioId)).filter((s) => s.tipo === 'plena')).toEqual([]);
  });

  // @trace CA-026b, CA-035, RF-002
  it('exemplo 4: duas pré-sessões em mfa_cadastro; após a primeira concluir, a segunda recebe ERR-018', async () => {
    const t = await tenantComAdmin(h);
    const u = await convidado(t);
    const primeira = await preSessaoCadastro(u.token);
    const segunda = await preSessaoCadastro(u.token);

    const inicio = await primeira.post('/auth/mfa/setup/start');
    const segredo = segredoDaUri(inicio.corpo.otpauth_uri);
    expect((await primeira.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(segredo, h.clock.now()) } })).status).toBe(200);
    const impressao = (await h.inspect.usuario(u.usuarioId)).impressao_segredo_totp;

    esperarErro(await segunda.post('/auth/mfa/setup/start'), 'ERR-018');
    expect((await h.inspect.usuario(u.usuarioId)).impressao_segredo_totp).toBe(impressao);
    expect((await h.inspect.sessoesAtivas(u.usuarioId)).filter((s) => s.tipo === 'pre_sessao')).toEqual([]);
  });

  // @trace CA-026b, RF-002
  it('exemplo 5: com mfa_ativo = false e pré-sessão em mfa_cadastro, verifyMfa → ERR-018', async () => {
    const t = await tenantComAdmin(h);
    const u = await convidado(t);
    const c = await preSessaoCadastro(u.token);
    esperarErro(await c.post('/auth/mfa/verify', { corpo: { codigo: '123456' } }), 'ERR-018');
    expect(c.temCookie('mp_session')).toBe(false);
  });

  // @trace CA-026b, CA-037b, RF-002, DEC-082
  it('exemplo 6: após reset, a pré-sessão criada pelo link aceita startMfaSetup', async () => {
    const t = await tenantComAdmin(h);
    const adminC = await entrar(h, t.admin);
    const alvo = await pessoa(h, t.tenantId, ['digitalizador'], 'reset');
    expect((await adminC.post(`/admin/users/${alvo.usuarioId}/mfa-reset`)).status).toBe(204);

    const c = new Cliente(h.baseUrl);
    const aceite = await c.post('/auth/mfa-reset/accept', { corpo: { token: ultimoToken(h, alvo.email, 'reset_mfa'), senha: alvo.senha } });
    expect(aceite.status, aceite.texto).toBe(200);
    expect(aceite.corpo).toEqual({ etapa: 'mfa_cadastro' });
    expect((await c.post('/auth/mfa/setup/start')).status).toBe(200);
  });

  // @trace CA-026b, CA-037b, RF-002, DEC-082
  it('exemplo 7: após reset, sem usar o link, login com a senha correta → ERR-013 sem pré-sessão', async () => {
    const t = await tenantComAdmin(h);
    const adminC = await entrar(h, t.admin);
    const alvo = await pessoa(h, t.tenantId, ['digitalizador'], 'reset');
    expect((await adminC.post(`/admin/users/${alvo.usuarioId}/mfa-reset`)).status).toBe(204);

    const c = new Cliente(h.baseUrl);
    esperarErro(await c.post('/auth/login', { corpo: { email: alvo.email, senha: alvo.senha } }), 'ERR-013');
    expect(c.temCookie('mp_pre_session')).toBe(false);
    expect(await h.inspect.sessoesAtivas(alvo.usuarioId)).toEqual([]);
  });

  // @trace CA-026b, RF-002, Bloco P P.4
  it('a etapa nunca vem do cliente: campo extra no login → ERR-001', async () => {
    const t = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);
    const r = await c.post('/auth/login', { corpo: { email: t.admin.email, senha: t.admin.senha, etapa: 'mfa_cadastro' } });
    esperarErro(r, 'ERR-001');
    expect(c.temCookie('mp_pre_session')).toBe(false);
  });
});
