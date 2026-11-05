// Dados do ciclo de coleta do projeto (CA-049, DEC-137): objetivo, coordenador e período de
// coleta, opcionais. O nome do coordenador é dado pessoal: não entra em auditoria nem em log
// (RN-027, RN-028). Nomes fictícios (Q-001).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import type { Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { criarProjeto } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComUsuaria(h, 'Tenant Ciclo de coleta');
  c = await entrar(h, T.usuaria);
});
afterAll(async () => {
  await h?.close();
});

async function alterar(id: string, corpo: Record<string, unknown>) {
  const etag = (await c.get(`/projects/${id}`)).headers.get('etag')!;
  return c.patch(`/projects/${id}`, { corpo, headers: { 'if-match': etag } });
}

describe('CA-049 — dados do ciclo de coleta do projeto', () => {
  // @trace CA-049, DEC-137, RF-003
  it('exemplo 1: createProject com coordenador e período → gravado', async () => {
    const r = await criarProjeto(c, 'Saúde 60+', {
      objetivo: 'Conhecer hábitos de sono (fictício)',
      coordenador: 'Ana Souza',
      coleta_inicio: '2026-12-01',
      coleta_fim: '2027-03-31',
    });
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo).toMatchObject({
      objetivo: 'Conhecer hábitos de sono (fictício)',
      coordenador: 'Ana Souza',
      coleta_inicio: '2026-12-01',
      coleta_fim: '2027-03-31',
    });
    expect((await c.get(`/projects/${r.corpo.id}`)).corpo.coordenador).toBe('Ana Souza');
  });

  // @trace CA-049, DEC-137
  it('exemplo 2: createProject só com o início da coleta → gravado, o resto nulo', async () => {
    const r = await criarProjeto(c, 'Saúde 60+ início', { coleta_inicio: '2026-12-01' });
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo).toMatchObject({ coleta_inicio: '2026-12-01', coleta_fim: null, coordenador: null, objetivo: null });
  });

  // @trace CA-049, DEC-137, ERR-001
  it('exemplo 3: updateProject com coleta_fim antes de coleta_inicio → ERR-001 (campos: coleta_fim); nada muda', async () => {
    const r = await criarProjeto(c, 'Saúde 60+ datas');
    const id = r.corpo.id;
    const e = await alterar(id, { coleta_inicio: '2027-03-31', coleta_fim: '2026-12-01' });
    esperarErro(e, 'ERR-001');
    expect(e.corpo.campos).toEqual(['coleta_fim']);
    expect((await c.get(`/projects/${id}`)).corpo).toMatchObject({ coleta_inicio: null, coleta_fim: null });

    // Também vale contra a data já gravada.
    expect((await alterar(id, { coleta_inicio: '2027-03-31' })).status).toBe(200);
    const e2 = await alterar(id, { coleta_fim: '2026-12-01' });
    esperarErro(e2, 'ERR-001');
    expect(e2.corpo.campos).toEqual(['coleta_fim']);
    esperarErro(await criarProjeto(c, 'Saúde 60+ invertido', { coleta_inicio: '2027-03-31', coleta_fim: '2026-12-01' }), 'ERR-001');
  });

  // @trace CA-049, DEC-137, RN-027, RN-028
  it('exemplo 4: coordenador null apaga o nome; a auditoria e os logs não trazem o nome', async () => {
    const r = await criarProjeto(c, 'Saúde 60+ coordenação', { coordenador: 'Ana Souza' });
    const id = r.corpo.id;
    const ok = await alterar(id, { coordenador: null });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.coordenador).toBeNull();
    expect((await c.get(`/projects/${id}`)).corpo.coordenador).toBeNull();

    const eventos = (await h.inspect.auditoria(T.tenantId)).filter((x) => x.registro_id === id);
    expect(eventos.length).toBeGreaterThanOrEqual(2); // criação e alteração
    expect(JSON.stringify(eventos)).not.toContain('Ana Souza');
    expect(await h.inspect.logs()).not.toContain('Ana Souza');
  });
});
