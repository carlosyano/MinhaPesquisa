// Concessão e revogação de acesso individual (CA-025, CA-038, RF-001, DEC-031, DEC-060, DEC-080, Q-030).
// A auditoria de cada abertura de ficha (CA-025) é verificada no IMP-004, com a ficha (PLANO §11.1).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { DIA, HORA, MINUTO, entrar, pessoa, tenantComAdmin, type Pessoa, type TenantPronto } from '../../support/cenarios.js';
import { criarHarness, type Harness, type Perfil } from '../../support/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

const JUSTIFICATIVA = 'Acompanhamento de casos do projeto (texto fictício)';

interface Cenario {
  t: TenantPronto;
  projeto: string;
  analista: Pessoa;
  adminC: Cliente;
}

async function cenario(perfis: Perfil[] = ['analista', 'analista_individual']): Promise<Cenario> {
  const t = await tenantComAdmin(h);
  const projeto = (await h.seed.projeto(t.tenantId, 'Projeto Saúde')).projetoId;
  const analista = await pessoa(h, t.tenantId, perfis, 'analista', { todosProjetos: false, projetos: [projeto] });
  return { t, projeto, analista, adminC: await entrar(h, t.admin) };
}

function conceder(c: Cliente, usuario_id: string, projeto_id: string, justificativa = JUSTIFICATIVA) {
  return c.post('/admin/individual-access-grants', {
    corpo: { usuario_id, projeto_id, justificativa },
    headers: { 'idempotency-key': chaveIdempotencia() },
  });
}

async function concessoes(c: Cliente, somenteVigentes: boolean) {
  const r = await c.get(`/admin/individual-access-grants?somente_vigentes=${somenteVigentes}&limite=100`);
  expect(r.status, r.texto).toBe(200);
  return r.corpo.itens as Array<{ id: string; vigente: boolean; revogado_em?: string | null }>;
}

describe('CA-025 — concessão de acesso individual', () => {
  // @trace CA-025, RF-001, DEC-031
  it('vale por 90 dias a partir da concessão', async () => {
    const { projeto, analista, adminC } = await cenario();
    const r = await conceder(adminC, analista.usuarioId, projeto);
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo).toMatchObject({ usuario_id: analista.usuarioId, projeto_id: projeto, vigente: true });
    const concedido = new Date(r.corpo.concedido_em).getTime();
    expect(new Date(r.corpo.valido_ate).getTime() - concedido).toBe(90 * DIA);
    expect(Math.abs(concedido - h.clock.now().getTime())).toBeLessThan(MINUTO);
  });

  // @trace CA-025, RF-001, DEC-031
  it('expira sozinha: vigente até 90 dias, não vigente depois, sem ação de ninguém', async () => {
    const { t, projeto, analista, adminC } = await cenario();
    const id = (await conceder(adminC, analista.usuarioId, projeto)).corpo.id;

    await h.clock.advance(90 * DIA - HORA);
    let c = await entrar(h, t.admin);
    expect((await concessoes(c, true)).map((g) => g.id)).toContain(id);

    await h.clock.advance(HORA + MINUTO);
    c = await entrar(h, t.admin);
    expect((await concessoes(c, true)).map((g) => g.id)).not.toContain(id);
    expect(await concessoes(c, false)).toContainEqual(expect.objectContaining({ id, vigente: false }));
  });

  // @trace CA-025, RF-001, DEC-060, DEC-080, Q-030, ERR-018
  it.each([
    [['analista']],
    [['digitalizador']],
    [['admin_tenant']],
  ] as Perfil[][][])('usuário sem o perfil analista_individual (%j) → ERR-018 e nada é criado', async (perfis) => {
    const { projeto, analista, adminC } = await cenario(perfis);
    esperarErro(await conceder(adminC, analista.usuarioId, projeto), 'ERR-018');
    expect((await concessoes(adminC, false)).length).toBe(0);
  });

  // @trace CA-025, RF-001, ERR-018
  it('segunda concessão vigente para o mesmo usuário e projeto → ERR-018; após revogar, nova concessão passa', async () => {
    const { projeto, analista, adminC } = await cenario();
    const primeira = await conceder(adminC, analista.usuarioId, projeto);
    expect(primeira.status).toBe(201);
    esperarErro(await conceder(adminC, analista.usuarioId, projeto), 'ERR-018');
    expect((await adminC.delete(`/admin/individual-access-grants/${primeira.corpo.id}`)).status).toBe(204);
    expect((await conceder(adminC, analista.usuarioId, projeto)).status).toBe(201);
  });

  // @trace CA-025, RF-001, ERR-001
  it('justificativa ausente ou com menos de 10 caracteres → ERR-001', async () => {
    const { projeto, analista, adminC } = await cenario();
    esperarErro(await conceder(adminC, analista.usuarioId, projeto, 'curta'), 'ERR-001');
    esperarErro(
      await adminC.post('/admin/individual-access-grants', {
        corpo: { usuario_id: analista.usuarioId, projeto_id: projeto },
        headers: { 'idempotency-key': chaveIdempotencia() },
      }),
      'ERR-001',
    );
  });

  // @trace CA-025, RF-001, ERR-016
  it('só o administrador do tenant concede', async () => {
    const { projeto, analista } = await cenario();
    const c = await entrar(h, analista);
    esperarErro(await conceder(c, analista.usuarioId, projeto), 'ERR-016');
  });
});

describe('CA-038 — revogação', () => {
  // @trace CA-038, RF-001
  it('revogar tem efeito imediato, encerra as sessões do analista e é auditado', async () => {
    const { t, projeto, analista, adminC } = await cenario();
    const id = (await conceder(adminC, analista.usuarioId, projeto)).corpo.id;
    const sessaoAnalista = await entrar(h, analista);

    expect((await adminC.delete(`/admin/individual-access-grants/${id}`)).status).toBe(204);

    esperarErro(await sessaoAnalista.get('/auth/session'), 'ERR-015');
    expect(await h.inspect.sessoesAtivas(analista.usuarioId)).toEqual([]);
    expect((await concessoes(adminC, true)).map((g) => g.id)).not.toContain(id);
    const revogada = (await concessoes(adminC, false)).find((g) => g.id === id);
    expect(revogada).toMatchObject({ vigente: false });
    expect(revogada?.revogado_em).toBeTruthy();
    expect(await h.inspect.auditoria(t.tenantId)).toContainEqual(
      expect.objectContaining({ usuario_id: t.admin.usuarioId, registro_id: id }),
    );
  });

  // @trace CA-038, RF-001, ERR-002
  it('concessão inexistente → ERR-002', async () => {
    const { adminC } = await cenario();
    esperarErro(await adminC.delete('/admin/individual-access-grants/00000000-0000-4000-8000-000000000000'), 'ERR-002');
  });
});
