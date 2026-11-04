// Login com senha local, bloqueio por tentativas, sessões e CSRF (RF-002, CA-026, DEC-108).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { Cliente } from '../../support/cliente.js';
import { MINUTO, SENHA_ERRADA, emailSintetico, entrar, tenantComUsuaria } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

describe('CA-026 — autenticação', () => {
  // @trace CA-026, RF-002, DEC-108
  it('com a senha certa a sessão é criada direto, sem MFA nem pré-sessão', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = new Cliente(h.baseUrl);

    const login = await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } });
    expect(login.status, login.texto).toBe(200);
    expect(login.corpo).toEqual({ usuario_id: usuaria.usuarioId, nome: usuaria.nome, expira_em: expect.any(String) });
    const expira = new Date(login.corpo.expira_em).getTime() - h.clock.now().getTime();
    expect(expira).toBeGreaterThan(0);
    expect(expira).toBeLessThanOrEqual(24 * 60 * MINUTO);
    expect(c.temCookie('mp_session')).toBe(true);
    expect(c.temCookie('mp_pre_session')).toBe(false);

    const sessao = await c.get('/auth/session');
    expect(sessao.status, sessao.texto).toBe(200);
    expect(sessao.corpo).toMatchObject({ usuario_id: usuaria.usuarioId, nome: usuaria.nome });
  });

  // @trace CA-026, RF-002, DEC-108, DEC-109
  it('as rotas de MFA, convite, recuperação por e-mail e administração de usuários não existem', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = await entrar(h, usuaria);
    const retiradas: [string, string][] = [
      ['POST', '/auth/mfa/verify'],
      ['POST', '/auth/mfa/setup'],
      ['POST', '/auth/password/reset'],
      ['POST', '/auth/password/reset/confirm'],
      ['POST', '/auth/invite/accept'],
      ['GET', '/admin/users'],
      ['GET', '/admin/individual-access-grants'],
    ];
    for (const [metodo, caminho] of retiradas) {
      const r = await c.requisitar(metodo, caminho, metodo === 'GET' ? {} : { corpo: {} });
      expect(r.status, `${metodo} ${caminho}`).toBe(404);
    }
  });

  // @trace CA-026, RF-002
  it('senha errada e conta inexistente recebem a mesma resposta ERR-013', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const errada = await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
    const inexistente = await new Cliente(h.baseUrl).post('/auth/login', {
      corpo: { email: emailSintetico('ninguem'), senha: SENHA_ERRADA },
    });
    esperarErro(errada, 'ERR-013');
    esperarErro(inexistente, 'ERR-013');
    expect(semCorrelacao(errada)).toEqual(semCorrelacao(inexistente));
  });

  // @trace CA-026, RF-002, ERR-014
  it('5 falhas em 15 min bloqueiam por 15 min, inclusive a senha correta', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 5; i++) {
      esperarErro(await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } }), 'ERR-013');
      await h.clock.advance(MINUTO);
    }
    const bloqueado = await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } });
    esperarErro(bloqueado, 'ERR-014');
    expect(c.temCookie('mp_session')).toBe(false);

    // O bloqueio vale por e-mail, não por cliente (IP).
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } }), 'ERR-014');

    await h.clock.advance(15 * MINUTO);
    const liberado = await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } });
    expect(liberado.status, liberado.texto).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('4 falhas em 15 min não bloqueiam', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 4; i++) {
      await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
    }
    expect((await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } })).status).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('falhas fora da janela de 15 min não somam para o bloqueio', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 4; i++) await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
    await h.clock.advance(16 * MINUTO);
    await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
    expect((await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } })).status).toBe(200);
  });

  // @trace CA-026, RF-002, ERR-014
  it('o bloqueio de e-mail inexistente responde igual ao de conta existente', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const ninguem = emailSintetico('ninguem');
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 5; i++) {
      await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
      await c.post('/auth/login', { corpo: { email: ninguem, senha: SENHA_ERRADA } });
    }
    const existente = await c.post('/auth/login', { corpo: { email: usuaria.email, senha: SENHA_ERRADA } });
    const inexistente = await c.post('/auth/login', { corpo: { email: ninguem, senha: SENHA_ERRADA } });
    esperarErro(existente, 'ERR-014');
    esperarErro(inexistente, 'ERR-014');
    expect(semCorrelacao(existente)).toEqual(semCorrelacao(inexistente));
    expect(existente.headers.get('retry-after')).toBe(inexistente.headers.get('retry-after'));
  });
});

describe('RF-002 — sessões', () => {
  // @trace RF-002, ERR-021
  it('a quarta sessão ativa é recusada com ERR-021, sem cookie de sessão', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    for (let i = 0; i < 3; i++) await entrar(h, usuaria);
    const c = new Cliente(h.baseUrl);
    esperarErro(await c.post('/auth/login', { corpo: { email: usuaria.email, senha: usuaria.senha } }), 'ERR-021');
    expect(c.temCookie('mp_session')).toBe(false);
    expect(await h.inspect.sessoesAtivas(usuaria.usuarioId)).toBe(3);
  });

  // @trace RF-002, ERR-015
  it('30 min sem uso encerram a sessão', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = await entrar(h, usuaria);
    await h.clock.advance(29 * MINUTO);
    expect((await c.get('/auth/session')).status).toBe(200);
    await h.clock.advance(29 * MINUTO);
    expect((await c.get('/auth/session')).status).toBe(200);
    await h.clock.advance(31 * MINUTO);
    esperarErro(await c.get('/auth/session'), 'ERR-015');
  });

  // @trace RF-002, ERR-015
  it('a sessão termina em 24 h mesmo com uso contínuo', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = await entrar(h, usuaria);
    // Uso a cada 25 min mantém a sessão viva por inatividade até 23 h 45 min.
    for (let i = 0; i < 57; i++) {
      await h.clock.advance(25 * MINUTO);
      expect((await c.get('/auth/session')).status, `uso ${i + 1}`).toBe(200);
    }
    // Mais 16 min: só 16 min sem uso, mas já passou de 24 h desde a criação.
    await h.clock.advance(16 * MINUTO);
    esperarErro(await c.get('/auth/session'), 'ERR-015');
  });

  // @trace RF-002, DEC-044
  it('logout invalida a sessão no servidor', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = await entrar(h, usuaria);
    const cookie = c.cookies.get('mp_session')!;
    expect((await c.post('/auth/logout')).status).toBe(204);

    // Mesmo reapresentando o cookie antigo, a sessão não volta.
    const reuso = new Cliente(h.baseUrl);
    reuso.cookies.set('mp_session', cookie);
    esperarErro(await reuso.get('/auth/session'), 'ERR-015');
    expect(await h.inspect.sessoesAtivas(usuaria.usuarioId)).toBe(0);
  });

  // @trace RF-002, ERR-016, Bloco P P.2
  it('mutação sem token CSRF → ERR-016, sem efeito', async () => {
    const { usuaria } = await tenantComUsuaria(h);
    const c = await entrar(h, usuaria);
    esperarErro(await c.post('/auth/logout', { csrf: false }), 'ERR-016');
    expect((await c.get('/auth/session')).status).toBe(200);
  });
});
