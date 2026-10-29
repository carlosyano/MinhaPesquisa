// Isolamento entre tenants nas operações privadas do IMP-001 (CA-012, TS-001, RN-002, RNF-001).
// Os exemplos do CA-012 com /projects ficam para o IMP-002 (PLANO §11.1); aqui os mesmos
// quatro exemplos valem para usuários e concessões.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { emailSintetico, entrar, pessoa, tenantComAdmin, type Pessoa, type TenantPronto } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let A: TenantPronto;
let B: TenantPronto;
let adminA: Cliente;
let projetoA: string;
let projetoB: string;
let usuarioB: Pessoa;
let individualA: Pessoa;
let concessaoB: string;

beforeAll(async () => {
  h = await criarHarness();
  A = await tenantComAdmin(h, 'Tenant A');
  B = await tenantComAdmin(h, 'Tenant B');
  projetoA = (await h.seed.projeto(A.tenantId, 'Projeto A')).projetoId;
  projetoB = (await h.seed.projeto(B.tenantId, 'Projeto B')).projetoId;
  usuarioB = await pessoa(h, B.tenantId, ['analista', 'analista_individual'], 'b.individual');
  individualA = await pessoa(h, A.tenantId, ['analista', 'analista_individual'], 'a.individual');

  const adminB = await entrar(h, B.admin);
  const g = await adminB.post('/admin/individual-access-grants', {
    corpo: { usuario_id: usuarioB.usuarioId, projeto_id: projetoB, justificativa: 'Auditoria interna do projeto B (fictícia)' },
    headers: { 'idempotency-key': chaveIdempotencia() },
  });
  expect(g.status, g.texto).toBe(201);
  concessaoB = g.corpo.id;
  adminA = await entrar(h, A.admin);
});
afterAll(async () => {
  await h?.close();
});

/** Cada tentativa fora do escopo gera evento na auditoria do tenant de quem tentou (ERR-002). */
async function esperarNaoEncontradoAuditado(tentativa: () => Promise<Resposta>): Promise<Resposta> {
  const antesA = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.usuario_id === A.admin.usuarioId).length;
  const r = await tentativa();
  esperarErro(r, 'ERR-002');
  const depoisA = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.usuario_id === A.admin.usuarioId).length;
  expect(depoisA).toBeGreaterThan(antesA);
  // Nada é escrito no tenant B em nome do usuário de A.
  expect((await h.inspect.auditoria(B.tenantId)).filter((e) => e.usuario_id === A.admin.usuarioId)).toEqual([]);
  return r;
}

describe('CA-012 / TS-001 — isolamento entre tenants (operações do IMP-001)', () => {
  // @trace CA-012, TS-001, RN-002
  it('exemplos 1 e 2: getUser de outro tenant → 404 auditado, corpo idêntico ao de ID inexistente', async () => {
    const outro = await esperarNaoEncontradoAuditado(() => adminA.get(`/admin/users/${usuarioB.usuarioId}`));
    const inexistente = await esperarNaoEncontradoAuditado(() => adminA.get(`/admin/users/${randomUUID()}`));
    expect(semCorrelacao(outro)).toEqual(semCorrelacao(inexistente));
    expect(outro.texto).not.toContain(usuarioB.email);
  });

  // @trace CA-012, TS-001, RN-002
  it('exemplo 3: escritas sobre recursos do tenant B → 404 e o tenant B fica inalterado', async () => {
    const antes = await h.inspect.usuario(usuarioB.usuarioId);

    await esperarNaoEncontradoAuditado(() =>
      adminA.patch(`/admin/users/${usuarioB.usuarioId}`, { corpo: { ativo: false, nome: 'Invadido' }, headers: { 'if-match': '"x"' } }),
    );
    await esperarNaoEncontradoAuditado(() =>
      adminA.post(`/admin/users/${usuarioB.usuarioId}/invite`, { headers: { 'idempotency-key': chaveIdempotencia() } }),
    );
    await esperarNaoEncontradoAuditado(() => adminA.post(`/admin/users/${usuarioB.usuarioId}/mfa-reset`));
    await esperarNaoEncontradoAuditado(() => adminA.delete(`/admin/individual-access-grants/${concessaoB}`));

    expect(await h.inspect.usuario(usuarioB.usuarioId)).toEqual(antes);
    expect(h.mail.enviados().filter((m) => m.para === usuarioB.email && m.tipo !== 'recuperacao_senha')).toEqual([]);
    const adminB = await entrar(h, B.admin);
    const u = await adminB.get(`/admin/users/${usuarioB.usuarioId}`);
    expect(u.corpo).toMatchObject({ nome: 'Pessoa Fictícia b.individual', situacao: 'ativo' });
    const lista = await adminB.get('/admin/individual-access-grants');
    expect(lista.corpo.itens).toContainEqual(expect.objectContaining({ id: concessaoB, vigente: true }));
  });

  // @trace CA-012, TS-001, RN-002
  it('IDs do tenant B no corpo da requisição → 404 e nada é criado', async () => {
    const email = emailSintetico('cruzado');
    await esperarNaoEncontradoAuditado(() =>
      adminA.post('/admin/users', {
        corpo: { email, nome: 'Cruzado Fictício', perfis: ['analista'], todos_projetos: false, projetos: [projetoB] },
        headers: { 'idempotency-key': chaveIdempotencia() },
      }),
    );
    expect(h.mail.enviados().filter((m) => m.para === email)).toEqual([]);

    await esperarNaoEncontradoAuditado(() =>
      adminA.post('/admin/individual-access-grants', {
        corpo: { usuario_id: usuarioB.usuarioId, projeto_id: projetoA, justificativa: 'Tentativa cruzada fictícia' },
        headers: { 'idempotency-key': chaveIdempotencia() },
      }),
    );
    await esperarNaoEncontradoAuditado(() =>
      adminA.post('/admin/individual-access-grants', {
        corpo: { usuario_id: individualA.usuarioId, projeto_id: projetoB, justificativa: 'Tentativa cruzada fictícia' },
        headers: { 'idempotency-key': chaveIdempotencia() },
      }),
    );

    const etag = (await adminA.get(`/admin/users/${individualA.usuarioId}`)).headers.get('etag')!;
    await esperarNaoEncontradoAuditado(() =>
      adminA.patch(`/admin/users/${individualA.usuarioId}`, {
        corpo: { todos_projetos: false, projetos: [projetoB] },
        headers: { 'if-match': etag },
      }),
    );
    const depois = await adminA.get(`/admin/users/${individualA.usuarioId}`);
    expect(depois.corpo.projetos).not.toContain(projetoB);
  });

  // @trace CA-012, TS-001, RN-002
  it('exemplo 4: recursos do próprio tenant → 200; listagens não mostram o tenant B', async () => {
    const u = await adminA.get(`/admin/users/${individualA.usuarioId}`);
    expect(u.status).toBe(200);

    const usuarios = await adminA.get('/admin/users?limite=100');
    expect(usuarios.status).toBe(200);
    const ids = usuarios.corpo.itens.map((x: { id: string }) => x.id);
    expect(ids).toContain(A.admin.usuarioId);
    expect(ids).not.toContain(usuarioB.usuarioId);
    expect(ids).not.toContain(B.admin.usuarioId);

    const concessoes = await adminA.get('/admin/individual-access-grants?somente_vigentes=false&limite=100');
    expect(concessoes.status).toBe(200);
    expect(concessoes.corpo.itens.map((x: { id: string }) => x.id)).not.toContain(concessaoB);

    const sessao = await adminA.get('/auth/session');
    expect(sessao.corpo.projetos).toContain(projetoA);
    expect(sessao.corpo.projetos).not.toContain(projetoB);
  });
});
