// Login, bloqueio por tentativas, MFA obrigatório, sessões e CSRF (RF-002, CA-026).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { Cliente, chaveIdempotencia } from '../../support/cliente.js';
import { MINUTO, SENHA, SENHA_ERRADA, emailSintetico, entrar, pessoa, tenantComAdmin } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { codigoErrado, codigoTotp } from '../../support/totp.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

describe('CA-026 — autenticação', () => {
  // @trace CA-026, RF-002, DEC-025, DEC-050
  it('senha correta cria só a pré-sessão; o MFA é obrigatório antes da sessão plena', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);

    const login = await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } });
    expect(login.status).toBe(200);
    expect(login.corpo).toEqual({ etapa: 'mfa_verificacao' });
    expect(c.temCookie('mp_pre_session')).toBe(true);
    expect(c.temCookie('mp_session')).toBe(false);

    // A pré-sessão não abre rotas fora de /auth/mfa/*.
    esperarErro(await c.get('/auth/session'), 'ERR-015');
    esperarErro(await c.get('/admin/users'), 'ERR-015');

    const mfa = await c.post('/auth/mfa/verify', { corpo: { codigo: codigoTotp(admin.segredoTotp, h.clock.now()) } });
    expect(mfa.status).toBe(200);
    expect(mfa.corpo).toMatchObject({ usuario_id: admin.usuarioId, perfis: ['admin_tenant'] });

    const sessao = await c.get('/auth/session');
    expect(sessao.status).toBe(200);
    expect(sessao.corpo.usuario_id).toBe(admin.usuarioId);
  });

  // @trace CA-026, RF-002
  it('senha errada e conta inexistente recebem a mesma resposta ERR-013', async () => {
    const { admin } = await tenantComAdmin(h);
    const errada = await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
    const inexistente = await new Cliente(h.baseUrl).post('/auth/login', {
      corpo: { email: emailSintetico('ninguem'), senha: SENHA_ERRADA },
    });
    esperarErro(errada, 'ERR-013');
    esperarErro(inexistente, 'ERR-013');
    expect(semCorrelacao(errada)).toEqual(semCorrelacao(inexistente));
  });

  // @trace CA-026, RF-002, ERR-014
  it('5 falhas em 15 min bloqueiam por 15 min, inclusive a senha correta', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 5; i++) {
      esperarErro(await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } }), 'ERR-013');
      await h.clock.advance(MINUTO);
    }
    const bloqueado = await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } });
    esperarErro(bloqueado, 'ERR-014');
    expect(c.temCookie('mp_pre_session')).toBe(false);

    // O bloqueio vale por e-mail, não por cliente (IP).
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } }), 'ERR-014');

    await h.clock.advance(15 * MINUTO);
    const liberado = await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } });
    expect(liberado.status).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('4 falhas em 15 min não bloqueiam', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 4; i++) {
      await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
    }
    expect((await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } })).status).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('falhas fora da janela de 15 min não somam para o bloqueio', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 4; i++) await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
    await h.clock.advance(16 * MINUTO);
    await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
    expect((await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } })).status).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('o bloqueio de e-mail inexistente responde igual ao de conta existente', async () => {
    const { admin } = await tenantComAdmin(h);
    const ninguem = emailSintetico('ninguem');
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 5; i++) {
      await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
      await c.post('/auth/login', { corpo: { email: ninguem, senha: SENHA_ERRADA } });
    }
    const existente = await c.post('/auth/login', { corpo: { email: admin.email, senha: SENHA_ERRADA } });
    const inexistente = await c.post('/auth/login', { corpo: { email: ninguem, senha: SENHA_ERRADA } });
    esperarErro(existente, 'ERR-014');
    esperarErro(inexistente, 'ERR-014');
    expect(semCorrelacao(existente)).toEqual(semCorrelacao(inexistente));
    expect(existente.headers.get('retry-after')).toBe(inexistente.headers.get('retry-after'));
  });

  // @trace CA-026, RF-002, ERR-012
  it('código MFA errado → ERR-012 e conta como falha de login: 5 códigos errados bloqueiam', async () => {
    // Se o acerto da senha zerasse a contagem, quem tem a senha testaria códigos sem limite.
    const { admin } = await tenantComAdmin(h);
    for (let i = 0; i < 5; i++) {
      const c = new Cliente(h.baseUrl);
      expect((await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } })).status).toBe(200);
      esperarErro(await c.post('/auth/mfa/verify', { corpo: { codigo: codigoErrado(admin.segredoTotp, h.clock.now()) } }), 'ERR-012');
      expect(c.temCookie('mp_session')).toBe(false);
    }
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } }), 'ERR-014');
  });

  // @trace CA-026, RF-002, ERR-013
  it('usuário inativo ou com convite pendente recebe o mesmo ERR-013, sem pré-sessão', async () => {
    const t = await tenantComAdmin(h);
    const adminC = await entrar(h, t.admin);
    const alvo = await pessoa(h, t.tenantId, ['digitalizador'], 'inativo');
    const etag = (await adminC.get(`/admin/users/${alvo.usuarioId}`)).headers.get('etag')!;
    expect(
      (await adminC.patch(`/admin/users/${alvo.usuarioId}`, { corpo: { ativo: false }, headers: { 'if-match': etag } })).status,
    ).toBe(200);

    const c = new Cliente(h.baseUrl);
    const inativo = await c.post('/auth/login', { corpo: { email: alvo.email, senha: alvo.senha } });
    esperarErro(inativo, 'ERR-013');
    expect(c.temCookie('mp_pre_session')).toBe(false);

    const pendenteEmail = emailSintetico('pendente');
    const criado = await adminC.post('/admin/users', {
      corpo: { email: pendenteEmail, nome: 'Pendente Fictício', perfis: ['analista'] },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(criado.status, criado.texto).toBe(201);
    const pendente = await c.post('/auth/login', { corpo: { email: pendenteEmail, senha: SENHA } });
    esperarErro(pendente, 'ERR-013');
    expect(semCorrelacao(pendente)).toEqual(semCorrelacao(inativo));
    expect(c.temCookie('mp_pre_session')).toBe(false);
  });
});

describe('RF-002 — sessões', () => {
  // @trace RF-002, ERR-021
  it('a quarta sessão ativa é recusada com ERR-021', async () => {
    const { admin } = await tenantComAdmin(h);
    for (let i = 0; i < 3; i++) await entrar(h, admin);
    const c = new Cliente(h.baseUrl);
    expect((await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } })).status).toBe(200);
    const quarta = await c.post('/auth/mfa/verify', { corpo: { codigo: codigoTotp(admin.segredoTotp, h.clock.now()) } });
    esperarErro(quarta, 'ERR-021');
    expect(c.temCookie('mp_session')).toBe(false);
  });

  // @trace RF-002, ERR-015
  it('30 min sem uso encerram a sessão', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = await entrar(h, admin);
    await h.clock.advance(29 * MINUTO);
    expect((await c.get('/auth/session')).status).toBe(200);
    await h.clock.advance(29 * MINUTO);
    expect((await c.get('/auth/session')).status).toBe(200);
    await h.clock.advance(31 * MINUTO);
    esperarErro(await c.get('/auth/session'), 'ERR-015');
  });

  // @trace RF-002, ERR-015
  it('a sessão termina em 24 h mesmo com uso contínuo', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = await entrar(h, admin);
    // Uso a cada 25 min mantém a sessão viva por inatividade até 23 h 45 min.
    for (let i = 0; i < 57; i++) {
      await h.clock.advance(25 * MINUTO);
      expect((await c.get('/auth/session')).status, `uso ${i + 1}`).toBe(200);
    }
    // Mais 16 min: só 16 min sem uso, mas já passou de 24 h desde a criação.
    await h.clock.advance(16 * MINUTO);
    esperarErro(await c.get('/auth/session'), 'ERR-015');
  });

  // @trace RF-002, DEC-050
  it('a pré-sessão expira em 5 min', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = new Cliente(h.baseUrl);
    expect((await c.post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } })).status).toBe(200);
    await h.clock.advance(5 * MINUTO + 1000);
    const mfa = await c.post('/auth/mfa/verify', { corpo: { codigo: codigoTotp(admin.segredoTotp, h.clock.now()) } });
    esperarErro(mfa, 'ERR-015');
  });

  // @trace RF-002, DEC-044
  it('logout invalida a sessão no servidor', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = await entrar(h, admin);
    const cookie = c.cookies.get('mp_session')!;
    expect((await c.post('/auth/logout')).status).toBe(204);

    // Mesmo reapresentando o cookie antigo, a sessão não volta.
    const reuso = new Cliente(h.baseUrl);
    reuso.cookies.set('mp_session', cookie);
    esperarErro(await reuso.get('/auth/session'), 'ERR-015');
  });

  // @trace RF-002, ERR-016, Bloco P P.2
  it('mutação sem token CSRF → ERR-016, sem efeito', async () => {
    const { admin } = await tenantComAdmin(h);
    const c = await entrar(h, admin);
    esperarErro(await c.post('/auth/logout', { csrf: false }), 'ERR-016');
    expect((await c.get('/auth/session')).status).toBe(200);
  });
});
