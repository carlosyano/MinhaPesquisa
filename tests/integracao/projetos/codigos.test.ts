// Códigos sequenciais de projeto e de formulário e seus limites (CA-063, DEC-217, DEC-218, DEC-220 (1)).
// IA-TEST do IMP-010 (CHG-019). Cada teste monta o seu tenant, para que o Dado do CA-063 valha: os
// projetos 00001 e 00002, nessa ordem, e os formulários 001 e 002 no projeto 00001.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria } from '../../support/cenarios.js';
import { criarFormulario, criarProjeto, projetoCriado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
beforeAll(async () => {
  h = await criarHarness();
});
afterAll(async () => {
  await h?.close();
});

interface Cenario {
  tenantId: string;
  c: Cliente;
  p1: string;
  p2: string;
}

async function cenario(): Promise<Cenario> {
  const t = await tenantComUsuaria(h, 'Codigos');
  const c = await entrar(h, t.usuaria);
  const p1 = await projetoCriado(c, 'Saúde Idoso');
  const p2 = await projetoCriado(c, 'Nutrição');
  await criarFormulario(c, p1, 'Triagem');
  await criarFormulario(c, p1, 'Demografia');
  return { tenantId: t.tenantId, c, p1, p2 };
}

async function codigoDoProjeto(c: Cliente, id: string): Promise<string> {
  const r = await c.get(`/projects/${id}`);
  expect(r.status, r.texto).toBe(200);
  return r.corpo.codigo;
}

function novoFormulario(c: Cliente, projetoId: string, nome: string) {
  return c.post('/forms', { corpo: { nome, projeto_id: projetoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
}

describe('CA-063 — códigos sequenciais de projeto e de formulário', () => {
  // @trace CA-063, DEC-217, RF-015
  it('exemplo 1: o projeto novo recebe o código "00003"; os anteriores são "00001" e "00002"', async () => {
    const { c, p1, p2 } = await cenario();
    expect(await codigoDoProjeto(c, p1)).toBe('00001');
    expect(await codigoDoProjeto(c, p2)).toBe('00002');
    const r = await criarProjeto(c, 'Terceiro');
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo.codigo).toBe('00003');
  });

  // @trace CA-063, DEC-217
  it('exemplo 2: o formulário novo do projeto 00002 recebe "001" (a contagem é por projeto)', async () => {
    const { c, p1, p2 } = await cenario();
    const r = await novoFormulario(c, p2, 'Hábitos');
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo.codigo).toBe('001');
    const noP1 = await novoFormulario(c, p1, 'Hábitos');
    expect(noP1.corpo.codigo).toBe('003');
  });

  // @trace CA-063, DEC-217
  it('exemplo 3: alterar o nome e arquivar o projeto 00001 não muda o código', async () => {
    const { c, p1 } = await cenario();
    const etag = (await c.get(`/projects/${p1}`)).headers.get('etag')!;
    const ok = await c.patch(`/projects/${p1}`, { corpo: { nome: 'Saúde Idoso II' }, headers: { 'if-match': etag } });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.codigo).toBe('00001');
    const arquivado = await c.post(`/projects/${p1}/archive`);
    expect(arquivado.status, arquivado.texto).toBe(200);
    expect(arquivado.corpo.codigo).toBe('00001');
    expect(await codigoDoProjeto(c, p1)).toBe('00001');
  });

  // @trace CA-063, DEC-217
  it('o código é só de leitura: o pedido que o informa é recusado com ERR-001', async () => {
    const { c, p1 } = await cenario();
    esperarErro(await criarProjeto(c, 'Com código', { codigo: '00009' }), 'ERR-001');
    const etag = (await c.get(`/projects/${p1}`)).headers.get('etag')!;
    esperarErro(await c.patch(`/projects/${p1}`, { corpo: { codigo: '00009' }, headers: { 'if-match': etag } }), 'ERR-001');
    esperarErro(await c.post('/forms', { corpo: { nome: 'Com código', projeto_id: p1, codigo: '009' }, headers: { 'idempotency-key': chaveIdempotencia() } }), 'ERR-001');
    expect(await codigoDoProjeto(c, p1)).toBe('00001');
  });

  // @trace CA-063, DEC-217, DEC-220
  it('exemplo 4: a migração de 3 projetos sem código, criados em dias diferentes, dá "00001", "00002" e "00003" pela ordem de criado_em', async () => {
    const t = await tenantComUsuaria(h, 'Migracao projetos');
    const c = await entrar(h, t.usuaria);
    // Fora de ordem de propósito: o código segue o criado_em, não a ordem de gravação.
    const base = await h.seed.baseSemCodigos({
      tenantId: t.tenantId,
      projetos: [
        { nome: 'Terceiro', criadoEm: '2026-10-03T12:00:00Z' },
        { nome: 'Primeiro', criadoEm: '2026-10-01T12:00:00Z' },
        { nome: 'Segundo', criadoEm: '2026-10-02T12:00:00Z' },
      ],
    });
    expect(await codigoDoProjeto(c, base[0].projetoId)).toBe('00003');
    expect(await codigoDoProjeto(c, base[1].projetoId)).toBe('00001');
    expect(await codigoDoProjeto(c, base[2].projetoId)).toBe('00002');
    // E o próximo continua a sequência.
    expect((await criarProjeto(c, 'Quarto')).corpo.codigo).toBe('00004');
  });

  // @trace CA-063, DEC-217, DEC-220
  it('exemplo 8: a migração de um projeto com 3 formulários sem código dá "001", "002" e "003" pela ordem de criado_em, dentro do projeto', async () => {
    const t = await tenantComUsuaria(h, 'Migracao formularios');
    const c = await entrar(h, t.usuaria);
    const [{ projetoId, formularioIds }] = await h.seed.baseSemCodigos({
      tenantId: t.tenantId,
      projetos: [
        {
          nome: 'Saúde Idoso',
          criadoEm: '2026-09-01T12:00:00Z',
          formularios: [
            { nome: 'Terceiro', criadoEm: '2026-10-03T12:00:00Z' },
            { nome: 'Primeiro', criadoEm: '2026-10-01T12:00:00Z' },
            { nome: 'Segundo', criadoEm: '2026-10-02T12:00:00Z' },
          ],
        },
      ],
    });
    const lista = await c.get(`/projects/${projetoId}/forms`);
    expect(lista.status, lista.texto).toBe(200);
    const codigoDe = (id: string): string => (lista.corpo.itens as { id: string; codigo: string }[]).find((f) => f.id === id)!.codigo;
    expect(codigoDe(formularioIds[0])).toBe('003');
    expect(codigoDe(formularioIds[1])).toBe('001');
    expect(codigoDe(formularioIds[2])).toBe('002');
    expect((await novoFormulario(c, projetoId, 'Quarto')).corpo.codigo).toBe('004');
  });
});

describe('CA-063 — limites (DEC-218)', () => {
  // @trace CA-063, DEC-218, ERR-001
  it('exemplo 5: com o código de projeto 99999 já usado, criar outro projeto → ERR-001 sem `campos`; nada é criado', async () => {
    const { tenantId, c } = await cenario();
    await h.seed.limiteDeCodigo({ tipo: 'projeto', tenantId });
    const antes = ((await c.get('/projects')).corpo.itens as unknown[]).length;
    const r = await criarProjeto(c, 'Além do limite');
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toBeUndefined();
    expect(((await c.get('/projects')).corpo.itens as unknown[]).length).toBe(antes);
  });

  // @trace CA-063, DEC-218, ERR-001
  it('exemplo 6: com o código de formulário 999 já usado no projeto, criar outro formulário → ERR-001 sem `campos`; nada é criado', async () => {
    const { c, p1, p2 } = await cenario();
    await h.seed.limiteDeCodigo({ tipo: 'formulario', projetoId: p1 });
    const antes = ((await c.get(`/projects/${p1}/forms`)).corpo.itens as unknown[]).length;
    const r = await novoFormulario(c, p1, 'Além do limite');
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toBeUndefined();
    expect(((await c.get(`/projects/${p1}/forms`)).corpo.itens as unknown[]).length).toBe(antes);
    // O limite é do projeto: outro projeto segue normalmente.
    expect((await novoFormulario(c, p2, 'Livre')).status).toBe(201);
  });

  // @trace CA-063, DEC-218, ERR-001
  it('exemplo 7: com a versão 99 no formulário, criar outra versão → ERR-001 sem `campos`; nada é criado', async () => {
    const { c, p1 } = await cenario();
    const { formId, versaoId } = await criarFormulario(c, p1, 'Hábitos');
    await h.seed.limiteDeCodigo({ tipo: 'versao', formId });
    const r = await c.post(`/forms/${formId}/versions`, { corpo: { copiar_de_versao_id: versaoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toBeUndefined();
  });
});

describe('CA-063 — concorrência (DEC-220 (1))', () => {
  // @trace CA-063, DEC-220
  it('exemplo 9: duas criações de projeto ao mesmo tempo recebem códigos diferentes e consecutivos', async () => {
    const { c } = await cenario();
    const [a, b] = await Promise.all([criarProjeto(c, 'Concorrente A'), criarProjeto(c, 'Concorrente B')]);
    expect(a.status, a.texto).toBe(201);
    expect(b.status, b.texto).toBe(201);
    expect([a.corpo.codigo, b.corpo.codigo].sort()).toEqual(['00003', '00004']);
  });

  // @trace CA-063, DEC-220
  it('duas criações de formulário ao mesmo tempo no projeto recebem códigos diferentes e consecutivos', async () => {
    const { c, p1 } = await cenario();
    const [a, b] = await Promise.all([novoFormulario(c, p1, 'Concorrente A'), novoFormulario(c, p1, 'Concorrente B')]);
    expect(a.status, a.texto).toBe(201);
    expect(b.status, b.texto).toBe(201);
    expect([a.corpo.codigo, b.corpo.codigo].sort()).toEqual(['003', '004']);
  });
});
