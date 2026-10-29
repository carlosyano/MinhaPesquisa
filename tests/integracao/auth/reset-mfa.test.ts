// Reset de MFA pelo administrador (CA-037b, RF-001, RF-002, DEC-082, PLANO §4.5).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { Cliente } from '../../support/cliente.js';
import { HORA, MINUTO, SENHA_ERRADA, entrar, pessoa, tenantComAdmin, ultimoToken, type Pessoa, type TenantPronto } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { codigoTotp, segredoDaUri } from '../../support/totp.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

async function resetar(t: TenantPronto, alvo: Pessoa): Promise<string> {
  const adminC = await entrar(h, t.admin);
  const r = await adminC.post(`/admin/users/${alvo.usuarioId}/mfa-reset`);
  expect(r.status, r.texto).toBe(204);
  return ultimoToken(h, alvo.email, 'reset_mfa');
}

async function aceitar(token: string, senha: string) {
  const c = new Cliente(h.baseUrl);
  return { c, r: await c.post('/auth/mfa-reset/accept', { corpo: { token, senha } }) };
}

async function preparar() {
  const t = await tenantComAdmin(h);
  const alvo = await pessoa(h, t.tenantId, ['digitalizador'], 'perdeu.mfa');
  return { t, alvo };
}

describe('CA-037b — reset de MFA pelo administrador', () => {
  // @trace CA-037b, RF-001, DEC-082
  it('o reset encerra as sessões, apaga o segredo, envia o link de 24 h e é auditado', async () => {
    const { t, alvo } = await preparar();
    const sessao = await entrar(h, alvo);
    const token = await resetar(t, alvo);

    esperarErro(await sessao.get('/auth/session'), 'ERR-015');
    expect(await h.inspect.sessoesAtivas(alvo.usuarioId)).toEqual([]);
    expect(await h.inspect.usuario(alvo.usuarioId)).toMatchObject({ mfa_ativo: false, impressao_segredo_totp: null });
    expect(token.length).toBeGreaterThanOrEqual(32);

    const eventos = await h.inspect.auditoria(t.tenantId);
    expect(eventos).toContainEqual(
      expect.objectContaining({ acao: 'RESET_MFA', entidade: 'Usuario', registro_id: alvo.usuarioId, usuario_id: t.admin.usuarioId }),
    );
  });

  // @trace CA-037b, RF-002, DEC-082
  it('exemplo 1: link válido e senha correta criam pré-sessão mfa_cadastro e o novo MFA conclui', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    const { c, r } = await aceitar(token, alvo.senha);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toEqual({ etapa: 'mfa_cadastro' });

    const inicio = await c.post('/auth/mfa/setup/start');
    const segredo = segredoDaUri(inicio.corpo.otpauth_uri);
    expect(segredo).not.toBe(alvo.segredoTotp);
    expect((await c.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(segredo, h.clock.now()) } })).status).toBe(200);
    await h.clock.advance(30_000);
    await entrar(h, { ...alvo, segredoTotp: segredo });
  });

  // @trace CA-037b, RF-002, ERR-013, ERR-014
  it('exemplo 2: senha errada → ERR-013, o link não é consumido e as falhas contam para o bloqueio', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    esperarErro((await aceitar(token, SENHA_ERRADA)).r, 'ERR-013');
    expect((await aceitar(token, alvo.senha)).r.status).toBe(200);
  });

  // @trace CA-037b, RF-002, ERR-013, ERR-014
  it('exemplo 2b: 5 senhas erradas no aceite do reset bloqueiam como no login', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    for (let i = 0; i < 5; i++) esperarErro((await aceitar(token, SENHA_ERRADA)).r, 'ERR-013');
    esperarErro((await aceitar(token, alvo.senha)).r, 'ERR-014');
  });

  // @trace CA-037b, RF-002
  it('exemplo 3: pré-sessão expirada sem setupMfa → o mesmo link cria nova pré-sessão', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    const primeira = await aceitar(token, alvo.senha);
    expect(primeira.r.status).toBe(200);
    await h.clock.advance(6 * MINUTO);
    esperarErro(await primeira.c.post('/auth/mfa/setup/start'), 'ERR-015');

    const segunda = await aceitar(token, alvo.senha);
    expect(segunda.r.status, segunda.r.texto).toBe(200);
    expect(segunda.r.corpo).toEqual({ etapa: 'mfa_cadastro' });
  });

  // @trace CA-037b, RF-002, ERR-011
  it('exemplo 4: depois do setupMfa o link → ERR-011', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    const { c } = await aceitar(token, alvo.senha);
    const segredo = segredoDaUri((await c.post('/auth/mfa/setup/start')).corpo.otpauth_uri);
    expect((await c.post('/auth/mfa/setup', { corpo: { codigo: codigoTotp(segredo, h.clock.now()) } })).status).toBe(200);
    esperarErro((await aceitar(token, alvo.senha)).r, 'ERR-011');
  });

  // @trace CA-037b, RF-002, ERR-011
  it('exemplo 5a: link com mais de 24 h → ERR-011', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    await h.clock.advance(24 * HORA + MINUTO);
    esperarErro((await aceitar(token, alvo.senha)).r, 'ERR-011');
  });

  // @trace CA-037b, RF-001, ERR-011
  it('exemplo 5b: link substituído por novo reset → ERR-011; o novo funciona', async () => {
    const { t, alvo } = await preparar();
    const antigo = await resetar(t, alvo);
    const novo = await resetar(t, alvo);
    expect(novo).not.toBe(antigo);
    esperarErro((await aceitar(antigo, alvo.senha)).r, 'ERR-011');
    expect((await aceitar(novo, alvo.senha)).r.status).toBe(200);
  });

  // @trace CA-037b, CA-026b, RF-002, DEC-082 (V-B2 do PLANO §12.3)
  it('reset entre o login e o código: a pré-sessão é encerrada e o código antigo não cria sessão', async () => {
    const { t, alvo } = await preparar();
    const c = new Cliente(h.baseUrl);
    expect((await c.post('/auth/login', { corpo: { email: alvo.email, senha: alvo.senha } })).status).toBe(200);
    const codigoAntigo = codigoTotp(alvo.segredoTotp, h.clock.now());

    await resetar(t, alvo);

    esperarErro(await c.post('/auth/mfa/verify', { corpo: { codigo: codigoAntigo } }), 'ERR-015');
    expect(c.temCookie('mp_session')).toBe(false);
    expect(await h.inspect.sessoesAtivas(alvo.usuarioId)).toEqual([]);
  });

  // @trace CA-037b, CA-026, RF-002, DEC-082, ERR-014
  it('login antes do link → ERR-013 sem pré-sessão, contando para o bloqueio', async () => {
    const { t, alvo } = await preparar();
    const token = await resetar(t, alvo);
    const c = new Cliente(h.baseUrl);
    for (let i = 0; i < 5; i++) esperarErro(await c.post('/auth/login', { corpo: { email: alvo.email, senha: alvo.senha } }), 'ERR-013');
    expect(c.temCookie('mp_pre_session')).toBe(false);
    esperarErro((await aceitar(token, alvo.senha)).r, 'ERR-014');
  });

  // @trace CA-037b, RF-001, ERR-016
  it('só o administrador do tenant reseta MFA', async () => {
    const { t, alvo } = await preparar();
    const outro = await pessoa(h, t.tenantId, ['analista'], 'analista');
    const c = await entrar(h, outro);
    esperarErro(await c.post(`/admin/users/${alvo.usuarioId}/mfa-reset`), 'ERR-016');
    expect(await h.inspect.usuario(alvo.usuarioId)).toMatchObject({ mfa_ativo: true });
  });
});
