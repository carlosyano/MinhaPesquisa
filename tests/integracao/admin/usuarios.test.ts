// Gestão de usuários, perfis e vínculos (RF-001, CA-016, CA-038, RN-003, RN-004, DEC-054, DEC-065).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { emailSintetico, entrar, pessoa, tenantComAdmin, ultimoToken } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

async function criar(c: Cliente, corpo: Record<string, unknown>, chave = chaveIdempotencia()) {
  return c.post('/admin/users', { corpo, headers: { 'idempotency-key': chave } });
}

async function atualizar(c: Cliente, usuarioId: string, corpo: Record<string, unknown>) {
  const etag = (await c.get(`/admin/users/${usuarioId}`)).headers.get('etag');
  expect(etag).toBeTruthy();
  return c.patch(`/admin/users/${usuarioId}`, { corpo, headers: { 'if-match': etag! } });
}

describe('RF-001 — criação de usuário', () => {
  // @trace RF-001, RN-003, RN-004, CA-035, DEC-032
  it('cria em pendente_convite, com vários perfis, vínculo padrão a todos os projetos e convite enviado', async () => {
    const t = await tenantComAdmin(h);
    const p1 = (await h.seed.projeto(t.tenantId, 'Projeto 1')).projetoId;
    const c = await entrar(h, t.admin);
    const email = emailSintetico('novo');
    const r = await criar(c, { email, nome: 'Nova Pessoa Fictícia', perfis: ['digitalizador', 'analista'] });
    expect(r.status, r.texto).toBe(201);
    expect(r.headers.get('etag')).toBeTruthy();
    expect(r.corpo).toMatchObject({
      email,
      nome: 'Nova Pessoa Fictícia',
      todos_projetos: true,
      mfa_ativo: false,
      situacao: 'pendente_convite',
    });
    expect([...r.corpo.perfis].sort()).toEqual(['analista', 'digitalizador']);
    expect(r.corpo.projetos).toContain(p1);
    expect(ultimoToken(h, email, 'convite').length).toBeGreaterThanOrEqual(32);
  });

  // @trace RF-001, DEC-054, DEC-065, ERR-023
  it('e-mail já usado → ERR-023, com a mesma resposta no próprio tenant e em outro', async () => {
    const t = await tenantComAdmin(h);
    const outro = await tenantComAdmin(h, 'Outro');
    const c = await entrar(h, t.admin);
    const doProprio = await criar(c, { email: t.admin.email, nome: 'Duplicado', perfis: ['analista'] });
    const doOutro = await criar(c, { email: outro.admin.email, nome: 'Duplicado', perfis: ['analista'] });
    esperarErro(doProprio, 'ERR-023');
    esperarErro(doOutro, 'ERR-023');
    expect(semCorrelacao(doProprio)).toEqual(semCorrelacao(doOutro));
  });

  // @trace RF-001, ERR-001
  it('dados inválidos → ERR-001 (sem perfil, perfil desconhecido, e-mail inválido, campo extra)', async () => {
    const t = await tenantComAdmin(h);
    const c = await entrar(h, t.admin);
    const base = { email: emailSintetico('invalido'), nome: 'Inválido', perfis: ['analista'] };
    for (const corpo of [
      { ...base, perfis: [] },
      { ...base, perfis: ['superusuario'] },
      { ...base, email: 'nao-e-email' },
      { ...base, tenant_id: t.tenantId },
    ]) {
      esperarErro(await criar(c, corpo), 'ERR-001');
    }
  });

  // @trace RF-001, Bloco P P.8, ERR-019
  it('mesma chave de idempotência: mesmo corpo não duplica; corpo diferente → ERR-019', async () => {
    const t = await tenantComAdmin(h);
    const c = await entrar(h, t.admin);
    const chave = chaveIdempotencia();
    const corpo = { email: emailSintetico('idem'), nome: 'Idempotente', perfis: ['analista'] };
    const r1 = await criar(c, corpo, chave);
    const r2 = await criar(c, corpo, chave);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    expect(r2.corpo.id).toBe(r1.corpo.id);
    expect(h.mail.enviados().filter((m) => m.para === corpo.email)).toHaveLength(1);
    esperarErro(await criar(c, { ...corpo, nome: 'Outro nome' }, chave), 'ERR-019');
  });
});

describe('RF-001 — permissões', () => {
  // @trace RF-001, ERR-016
  it.each(['digitalizador', 'analista', 'analista_individual'] as const)('perfil %s não administra usuários → ERR-016', async (perfil) => {
    const t = await tenantComAdmin(h);
    const u = await pessoa(h, t.tenantId, [perfil], perfil);
    const c = await entrar(h, u);
    esperarErro(await c.get('/admin/users'), 'ERR-016');
    esperarErro(await c.get(`/admin/users/${t.admin.usuarioId}`), 'ERR-016');
    esperarErro(await criar(c, { email: emailSintetico('x'), nome: 'X', perfis: ['admin_tenant'] }), 'ERR-016');
    esperarErro(await c.get('/admin/individual-access-grants'), 'ERR-016');
  });
});

describe('RF-001 — atualização, desativação e último administrador', () => {
  // @trace RF-001, Bloco P P.8, ERR-017
  it('If-Match desatualizado → ERR-017 e nada muda', async () => {
    const t = await tenantComAdmin(h);
    const u = await pessoa(h, t.tenantId, ['analista'], 'etag');
    const c = await entrar(h, t.admin);
    const etag = (await c.get(`/admin/users/${u.usuarioId}`)).headers.get('etag')!;
    expect((await c.patch(`/admin/users/${u.usuarioId}`, { corpo: { nome: 'Primeira' }, headers: { 'if-match': etag } })).status).toBe(200);
    esperarErro(await c.patch(`/admin/users/${u.usuarioId}`, { corpo: { nome: 'Segunda' }, headers: { 'if-match': etag } }), 'ERR-017');
    expect((await c.get(`/admin/users/${u.usuarioId}`)).corpo.nome).toBe('Primeira');
  });

  // @trace RF-001, CA-038, ERR-015
  it('desativar encerra as sessões do usuário imediatamente e bloqueia o login', async () => {
    const t = await tenantComAdmin(h);
    const u = await pessoa(h, t.tenantId, ['analista'], 'desativar');
    const sessaoU = await entrar(h, u);
    const c = await entrar(h, t.admin);
    const r = await atualizar(c, u.usuarioId, { ativo: false });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.situacao).toBe('inativo');
    esperarErro(await sessaoU.get('/auth/session'), 'ERR-015');
    expect(await h.inspect.sessoesAtivas(u.usuarioId)).toEqual([]);

    expect((await atualizar(c, u.usuarioId, { ativo: true })).corpo.situacao).toBe('ativo');
    await entrar(h, u);
  });

  // @trace RF-001, ERR-018
  it('usuário em pendente_convite não pode ser ativado pela edição → ERR-018', async () => {
    const t = await tenantComAdmin(h);
    const c = await entrar(h, t.admin);
    const r = await criar(c, { email: emailSintetico('pendente'), nome: 'Pendente', perfis: ['analista'] });
    esperarErro(await atualizar(c, r.corpo.id, { ativo: true }), 'ERR-018');
  });

  // @trace RF-001, ERR-018
  it('não desativa nem retira admin_tenant do último administrador ativo', async () => {
    const t = await tenantComAdmin(h);
    const c = await entrar(h, t.admin);
    esperarErro(await atualizar(c, t.admin.usuarioId, { ativo: false }), 'ERR-018');
    esperarErro(await atualizar(c, t.admin.usuarioId, { perfis: ['analista'] }), 'ERR-018');
    expect((await c.get('/auth/session')).corpo.perfis).toContain('admin_tenant');

    // Com um segundo administrador ativo, a mudança passa.
    await pessoa(h, t.tenantId, ['admin_tenant'], 'admin2');
    expect((await atualizar(c, t.admin.usuarioId, { perfis: ['admin_tenant', 'analista'] })).status).toBe(200);
    expect((await atualizar(c, t.admin.usuarioId, { perfis: ['analista'] })).status).toBe(200);
  });
});

describe('CA-016 — analista restrito a projetos (parte do IMP-001)', () => {
  // @trace CA-016, RN-004, DEC-015
  it('o analista vinculado só ao projeto A vê só o projeto A na sessão', async () => {
    const t = await tenantComAdmin(h);
    const pA = (await h.seed.projeto(t.tenantId, 'Projeto A')).projetoId;
    const pB = (await h.seed.projeto(t.tenantId, 'Projeto B')).projetoId;
    const analista = await pessoa(h, t.tenantId, ['analista'], 'restrito', { todosProjetos: false, projetos: [pA] });
    const c = await entrar(h, analista);
    expect((await c.get('/auth/session')).corpo.projetos).toEqual([pA]);

    // Mudança de vínculo pelo admin vale na sessão seguinte e é auditada (RN-027).
    const adminC = await entrar(h, t.admin);
    const doAdmin = async () => (await h.inspect.auditoria(t.tenantId)).filter((e) => e.usuario_id === t.admin.usuarioId).length;
    const antes = await doAdmin();
    expect((await atualizar(adminC, analista.usuarioId, { todos_projetos: false, projetos: [pB] })).status).toBe(200);
    expect(await doAdmin()).toBeGreaterThan(antes);
    const c2 = await entrar(h, analista);
    expect((await c2.get('/auth/session')).corpo.projetos).toEqual([pB]);
  });

  // @trace CA-016, RN-004, Q-016, DEC-068
  it('o vínculo "todos os projetos" inclui projetos criados depois', async () => {
    const t = await tenantComAdmin(h);
    const analista = await pessoa(h, t.tenantId, ['analista'], 'todos', { todosProjetos: true });
    const depois = (await h.seed.projeto(t.tenantId, 'Projeto Posterior')).projetoId;
    const c = await entrar(h, analista);
    expect((await c.get('/auth/session')).corpo.projetos).toContain(depois);
  });
});
