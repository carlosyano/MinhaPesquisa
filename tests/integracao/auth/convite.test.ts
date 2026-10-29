// Primeiro acesso por convite (CA-035, RF-001, RF-002, DEC-032).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { Cliente, chaveIdempotencia } from '../../support/cliente.js';
import { HORA, MINUTO, OUTRA_SENHA, SENHA, emailSintetico, entrar, pessoa, tenantComAdmin, ultimoToken } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { codigoTotp, segredoDaUri } from '../../support/totp.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

async function tenantNovo() {
  const emailAdmin = emailSintetico('primeiro.admin');
  const { tenantId, adminId } = await h.seed.tenant({ nome: 'Tenant Convite', emailAdmin, nomeAdmin: 'Admin Fictício' });
  return { tenantId, adminId, emailAdmin, token: ultimoToken(h, emailAdmin, 'convite') };
}

async function aceitar(token: string, senha = SENHA) {
  const c = new Cliente(h.baseUrl);
  const r = await c.post('/auth/invites/accept', { corpo: { token, senha } });
  return { c, r };
}

async function cadastrarMfa(c: Cliente) {
  const inicio = await c.post('/auth/mfa/setup/start');
  expect(inicio.status, inicio.texto).toBe(200);
  const segredo = segredoDaUri(inicio.corpo.otpauth_uri);
  const fim = await c.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(segredo, h.clock.now()) } });
  expect(fim.status, fim.texto).toBe(200);
  return segredo;
}

describe('CA-035 — primeiro acesso do tenant', () => {
  // @trace CA-035, RF-002, DEC-032
  it('o primeiro administrador define a senha e cadastra o MFA dentro de 24 h', async () => {
    const t = await tenantNovo();
    expect(await h.inspect.usuario(t.adminId)).toMatchObject({ situacao: 'pendente_convite', mfa_ativo: false });

    await h.clock.advance(23 * HORA + 59 * MINUTO);
    const { c, r } = await aceitar(t.token);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toEqual({ etapa: 'mfa_cadastro' });
    await cadastrarMfa(c);

    const sessao = await c.get('/auth/session');
    expect(sessao.status).toBe(200);
    expect(sessao.corpo).toMatchObject({ usuario_id: t.adminId, perfis: ['admin_tenant'] });
    expect(await h.inspect.usuario(t.adminId)).toMatchObject({ situacao: 'ativo', mfa_ativo: true });
  });

  // @trace CA-035, RF-002
  it('o convite só é consumido no setupMfa: pré-sessão expirada → o mesmo convite redefine a senha', async () => {
    const t = await tenantNovo();
    const primeira = await aceitar(t.token, SENHA);
    expect(primeira.r.status).toBe(200);
    await h.clock.advance(6 * MINUTO);
    esperarErro(await primeira.c.post('/auth/mfa/setup/start'), 'ERR-015');

    const segunda = await aceitar(t.token, OUTRA_SENHA);
    expect(segunda.r.status, segunda.r.texto).toBe(200);
    const segredo = await cadastrarMfa(segunda.c);
    await h.clock.advance(30_000);

    // Vale a senha da segunda chamada.
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: t.emailAdmin, senha: SENHA } }), 'ERR-013');
    await entrar(h, { usuarioId: t.adminId, email: t.emailAdmin, senha: OUTRA_SENHA, segredoTotp: segredo });
  });

  // @trace CA-035, RF-002, ERR-011
  it('convite já usado → ERR-011', async () => {
    const t = await tenantNovo();
    const { c } = await aceitar(t.token);
    await cadastrarMfa(c);
    esperarErro((await aceitar(t.token)).r, 'ERR-011');
  });

  // @trace CA-035, RF-002, ERR-011, DEC-032
  it('convite com mais de 24 h → ERR-011, mesma resposta de token inexistente', async () => {
    const t = await tenantNovo();
    await h.clock.advance(24 * HORA + MINUTO);
    const vencido = (await aceitar(t.token)).r;
    esperarErro(vencido, 'ERR-011');
    const inexistente = (await aceitar('x'.repeat(43))).r;
    esperarErro(inexistente, 'ERR-011');
    expect(semCorrelacao(vencido)).toEqual(semCorrelacao(inexistente));
    expect(await h.inspect.usuario(t.adminId)).toMatchObject({ situacao: 'pendente_convite' });
  });

  // @trace CA-035, RF-001, DEC-032
  it('inviteUser reenvia o convite vencido e invalida o anterior', async () => {
    const t = await tenantComAdmin(h);
    const adminC = await entrar(h, t.admin);
    const email = emailSintetico('analista');
    const criado = await adminC.post('/admin/users', {
      corpo: { email, nome: 'Analista Fictícia', perfis: ['analista'] },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(criado.status, criado.texto).toBe(201);
    expect(criado.corpo).toMatchObject({ situacao: 'pendente_convite', mfa_ativo: false });
    const antigo = ultimoToken(h, email, 'convite');

    await h.clock.advance(25 * HORA);
    const adminC2 = await entrar(h, t.admin);
    const reenvio = await adminC2.post(`/admin/users/${criado.corpo.id}/invite`, { headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(reenvio.status, reenvio.texto).toBe(202);
    const novo = ultimoToken(h, email, 'convite');
    expect(novo).not.toBe(antigo);

    esperarErro((await aceitar(antigo)).r, 'ERR-011');
    expect((await aceitar(novo)).r.status).toBe(200);
  });

  // @trace CA-035, RF-001, ERR-018
  it('inviteUser para usuário já ativo → ERR-018', async () => {
    const t = await tenantComAdmin(h);
    const adminC = await entrar(h, t.admin);
    const ativo = await pessoa(h, t.tenantId, ['digitalizador'], 'ativo');
    esperarErro(
      await adminC.post(`/admin/users/${ativo.usuarioId}/invite`, { headers: { 'idempotency-key': chaveIdempotencia() } }),
      'ERR-018',
    );
  });

  // @trace CA-035, RF-002, Bloco P P.2
  it('senha fora da política no aceite → ERR-001 e o convite continua válido', async () => {
    const t = await tenantNovo();
    for (const fraca of ['semmaiusculas1', 'SEMMINUSCULAS1', 'SemDigitosAqui', 'Curta1a']) {
      const { r } = await aceitar(t.token, fraca);
      esperarErro(r, 'ERR-001');
    }
    expect((await aceitar(t.token)).r.status).toBe(200);
  });
});
