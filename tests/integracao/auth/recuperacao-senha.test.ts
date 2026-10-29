// Recuperação de senha (CA-037, RF-002).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { Cliente } from '../../support/cliente.js';
import { MINUTO, OUTRA_SENHA, emailSintetico, entrar, tenantComAdmin, ultimoToken } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

const pedir = (email: string) => new Cliente(h.baseUrl).post('/auth/password/reset', { corpo: { email } });
const confirmar = (token: string, nova_senha = OUTRA_SENHA) =>
  new Cliente(h.baseUrl).post('/auth/password/reset/confirm', { corpo: { token, nova_senha } });

describe('CA-037 — recuperação de senha', () => {
  // @trace CA-037, RF-002
  it('a resposta é a mesma exista ou não a conta; só a conta existente recebe e-mail', async () => {
    const { admin } = await tenantComAdmin(h);
    const ninguem = emailSintetico('ninguem');
    const existente = await pedir(admin.email);
    const inexistente = await pedir(ninguem);
    expect(existente.status).toBe(202);
    expect(semCorrelacao(existente)).toEqual(semCorrelacao(inexistente));
    expect(h.mail.enviados().filter((m) => m.para === admin.email && m.tipo === 'recuperacao_senha')).toHaveLength(1);
    expect(h.mail.enviados().filter((m) => m.para === ninguem)).toHaveLength(0);
  });

  // @trace CA-037, RF-002
  it('o link troca a senha, encerra as sessões e não pode ser reutilizado', async () => {
    const { admin } = await tenantComAdmin(h);
    const sessaoAntiga = await entrar(h, admin);
    await pedir(admin.email);
    const token = ultimoToken(h, admin.email, 'recuperacao_senha');

    await h.clock.advance(59 * MINUTO);
    expect((await confirmar(token)).status).toBe(204);
    esperarErro(await sessaoAntiga.get('/auth/session'), 'ERR-015');

    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: admin.email, senha: admin.senha } }), 'ERR-013');
    await entrar(h, { ...admin, senha: OUTRA_SENHA });

    esperarErro(await confirmar(token, 'Ou7roValor9k'), 'ERR-011');
  });

  // @trace CA-037, RF-002, ERR-011
  it('link com mais de 60 min → ERR-011 e a senha não muda', async () => {
    const { admin } = await tenantComAdmin(h);
    await pedir(admin.email);
    const token = ultimoToken(h, admin.email, 'recuperacao_senha');
    await h.clock.advance(61 * MINUTO);
    esperarErro(await confirmar(token), 'ERR-011');
    await entrar(h, admin);
  });

  // @trace CA-037, RF-002, Bloco P P.2
  it('nova senha fora da política → ERR-001 e o link continua válido', async () => {
    const { admin } = await tenantComAdmin(h);
    await pedir(admin.email);
    const token = ultimoToken(h, admin.email, 'recuperacao_senha');
    esperarErro(await confirmar(token, 'semmaiusculas1'), 'ERR-001');
    expect((await confirmar(token)).status).toBe(204);
  });
});
