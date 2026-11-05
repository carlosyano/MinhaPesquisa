// Teto de custo de IA (CA-030, TS-007, DEC-035, DEC-051, DEC-058). Custo em dólar convertido pela
// cotação fixa do mês (US$ 1,00 = R$ 5,00 nestes testes); reserva do custo estimado antes de cada
// chamada e ajuste pelo custo real. Cada exemplo tem o seu tenant, porque o teto é por tenant.
// Os testes que viram o mês ficam no fim: o relógio só anda para a frente.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { semQr } from '../../support/arquivos.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { consultar, conteudoLeitura, enviarELer, leiturasCompletas, paginasJpeg, calibrarConfianca, prepararCotacao, type ItemRevisao } from '../../support/leitura.js';

let h: Harness;

interface Cenario {
  t: TenantPronto;
  dig: Cliente;
  projeto: string;
  f: FormularioPublicado;
}

async function cenario(consumidoReais: string | null): Promise<Cenario> {
  const t = await tenantComUsuaria(h, 'Tenant cota');
  const admin = await entrar(h, t.usuaria);
  const projeto = await projetoCriado(admin, 'Saúde Idoso');
  const f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  await h.seed.parametro({ tenantId: t.tenantId, chave: 'custo_ia_teto', valor: '500.00' });
  if (consumidoReais) await h.seed.consumoIa({ tenantId: t.tenantId, valorReais: consumidoReais });
  return { t, dig: await entrar(h, t.usuaria), projeto, f };
}

async function cota(c: Cliente) {
  const r = await c.get('/tenant/quota');
  expect(r.status, r.texto).toBe(200);
  return r.corpo as { teto: string; consumido: string; periodo_inicio: string; periodo_fim: string; atingido: boolean; aplicacoes_aguardando: number };
}

async function enviarSemLer(c: Cenario): Promise<{ id: string; corpo: any }> {
  const r = await enviar(c.dig, c.projeto, await paginasJpeg(c.f));
  expect(r.status, r.texto).toBe(202);
  h.motor.programar(r.corpo.aplicacao_id, leiturasCompletas());
  return { id: r.corpo.aplicacao_id, corpo: r.corpo };
}

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  await calibrarConfianca(h);
});
afterAll(async () => {
  await h?.close();
});

describe('getQuotaStatus — aviso na tela (DEC-112)', () => {
  // @trace CA-030, RF-007, DEC-058
  it('teto padrão de R$ 500,00, mês civil corrente e nada consumido', async () => {
    const c = await cenario(null);
    expect(await cota(c.dig)).toEqual({
      teto: '500.00',
      consumido: '0.00',
      periodo_inicio: '2026-11-01',
      periodo_fim: '2026-11-30',
      atingido: false,
      aplicacoes_aguardando: 0,
    });
  });

  // @trace DEC-051, RNF-014
  it('o consumido soma o custo real de cada chamada, não o estimado', async () => {
    const c = await cenario(null);
    h.motor.custo({ estimadoUsd: 0.1, realUsd: 0.06 });
    const id = await enviarELer(h, c.dig, c.projeto, c.f, leiturasCompletas());
    const feitas = (await h.motor.chamadas(id)).filter((x) => x.resultado === 'ok').length;
    expect(feitas).toBeGreaterThan(0);
    expect((await cota(c.dig)).consumido).toBe((0.3 * feitas).toFixed(2));
    h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
  });
});

describe('CA-030 — teto mensal atingido', () => {
  // @trace CA-030, DEC-051, FL-001, RN-036
  it('exemplo 1: acumulado R$ 499,00 e R$ 0,50 por chamada → as chamadas que cabem são feitas, o resto aguarda sem descartar nada', async () => {
    const c = await cenario('499.00');
    h.motor.custo({ estimadoUsd: 0.1, realUsd: 0.1 });
    const { id, corpo } = await enviarSemLer(c);
    expect(corpo.estado).toBe('em_leitura');
    await h.worker.processar();

    const feitas = (await h.motor.chamadas(id)).filter((x) => x.resultado === 'ok');
    expect(feitas.length).toBeGreaterThanOrEqual(1);
    expect(feitas.length).toBeLessThanOrEqual(2); // 499,50 e, no máximo, 500,00; nunca acima do teto
    const q = await cota(c.dig);
    expect(q.consumido).toBe((499 + 0.5 * feitas.length).toFixed(2));
    expect(Number(q.consumido)).toBeLessThanOrEqual(500);
    expect(q.aplicacoes_aguardando).toBe(1);

    // em_leitura → aguardando_cota: os itens já lidos ficam; as páginas restantes aguardam.
    const app = (await consultar(c.dig, id)).corpo as { estado: string; itens: ItemRevisao[] };
    expect(app.estado).toBe('aguardando_cota');
    const lidos = new Set(feitas.flatMap((x) => x.campos));
    for (const i of app.itens) {
      const chave = i.linha_codigo ? `${i.pergunta_codigo}.${i.linha_codigo}` : i.pergunta_codigo;
      if (lidos.has(chave)) expect(i.estado, chave).not.toBe('pendente_leitura');
      else expect(i.estado, chave).toBe('pendente_leitura');
    }

    // Teto aumentado por script: o job retoma a fila e lê só o que faltava.
    await h.seed.parametro({ tenantId: c.t.tenantId, chave: 'custo_ia_teto', valor: '600.00' });
    await h.clock.advance(60_000);
    await h.worker.processar();
    expect((await consultar(c.dig, id)).corpo.estado).toBe('em_revisao');
    const todas = (await h.motor.chamadas(id)).filter((x) => x.resultado === 'ok').flatMap((x) => x.campos);
    expect(new Set(todas).size).toBe(todas.length);
    h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
  });

  // @trace CA-030, DEC-051, ERR-003
  it('exemplo 2: acumulado R$ 499,80 e R$ 0,50 estimado → nenhuma chamada; aplicação em aguardando_cota', async () => {
    const c = await cenario('499.80');
    h.motor.custo({ estimadoUsd: 0.1, realUsd: 0.1 });
    const { id } = await enviarSemLer(c);
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(0);
    expect((await consultar(c.dig, id)).corpo.estado).toBe('aguardando_cota');
    const q = await cota(c.dig);
    expect(q).toMatchObject({ consumido: '499.80', aplicacoes_aguardando: 1 });
    h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
  });

  // @trace CA-030, TS-007, ERR-003, FL-001
  it('exemplo 3 / TS-007: acumulado igual ao teto → o upload já nasce em aguardando_cota com aviso ERR-003 e nada é lido', async () => {
    const c = await cenario('500.00');
    h.motor.custo({ estimadoUsd: 0.002, realUsd: 0.002 });
    const { id, corpo } = await enviarSemLer(c);
    expect(corpo).toMatchObject({ estado: 'aguardando_cota', aviso: 'ERR-003' });
    await h.worker.processar();
    await h.clock.advance(60 * 60_000);
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(0);
    const dig = await entrar(h, c.t.usuaria); // a sessão expirou por inatividade (30 min)
    expect(await cota(dig)).toMatchObject({ teto: '500.00', consumido: '500.00', atingido: true, aplicacoes_aguardando: 1 });
    h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
  });

  // @trace FL-001, CA-030, CA-004
  it('identificação manual com o teto atingido → aguardando_cota (nada é lido)', async () => {
    const c = await cenario('500.00');
    const imgs = await paginasJpeg(c.f);
    imgs[1] = arquivo('p2.jpg', 'image/jpeg', await semQr(c.f.paginas[1]));
    const r = await enviar(c.dig, c.projeto, imgs);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
    const id = r.corpo.aplicacao_id;
    const ok = await c.dig.post(`/applications/${id}/identify`, {
      corpo: {
        versao_id: c.f.versaoId,
        paginas: (r.corpo.paginas as { imagem_id: string }[]).map((p, i) => ({ imagem_id: p.imagem_id, numero_pagina: i + 1 })),
      },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('aguardando_cota');
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(0);
  });

  // @trace FL-001, CA-030, CA-041
  it('mandar ler de novo uma aplicação em erro_leitura com o teto atingido → aguardando_cota', async () => {
    const c = await cenario(null);
    const r = await enviar(c.dig, c.projeto, await paginasJpeg(c.f));
    const id = r.corpo.aplicacao_id;
    h.motor.programar(id, leiturasCompletas({ PRESSAO_ALTA: { falha: { tipo: 'erro', vezes: 10 } } }));
    await h.worker.processar();
    for (const ms of [1_000, 2_000, 4_000, 8_000]) {
      await h.clock.advance(ms);
      await h.worker.processar();
    }
    expect((await consultar(c.dig, id)).corpo.estado).toBe('erro_leitura');
    await h.seed.consumoIa({ tenantId: c.t.tenantId, valorReais: '500.00' });
    const retry = await c.dig.post(`/applications/${id}/retry`, { headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(retry.status, retry.texto).toBe(202);
    expect(retry.corpo.estado).toBe('aguardando_cota');
  });
});

describe('Virada do mês civil (DEC-058) — fica no fim do arquivo', () => {
  let c: Cenario;
  let id: string;

  beforeAll(async () => {
    c = await cenario('500.00');
    ({ id } = await enviarSemLer(c));
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(0);
  });

  // @trace CA-030, DEC-058, FL-001
  it('exemplo 4: na virada do mês (fuso America/Sao_Paulo) o consumido zera e a fila é retomada', async () => {
    // 01/12/2026 00:00 em São Paulo = 03:00 UTC.
    await h.clock.advance(new Date('2026-12-01T03:00:01.000Z').getTime() - h.clock.now().getTime());
    await h.worker.processar();
    const dig = await entrar(h, c.t.usuaria); // as sessões expiraram com o relógio
    expect(['em_leitura', 'em_revisao']).toContain((await consultar(dig, id)).corpo.estado);
    expect((await h.motor.chamadas(id)).length).toBeGreaterThan(0);
    expect(await cota(dig)).toMatchObject({ consumido: '0.00', periodo_inicio: '2026-12-01', periodo_fim: '2026-12-31', atingido: false });
  });

  // @trace DEC-058, ERR-003, FL-001
  it('sem cotação do dólar do mês corrente nenhuma leitura é feita: a aplicação fica em aguardando_cota', async () => {
    await h.clock.advance(new Date('2027-01-01T03:00:01.000Z').getTime() - h.clock.now().getTime());
    const novo = { ...c, dig: await entrar(h, c.t.usuaria) };
    const r = await enviar(novo.dig, novo.projeto, await paginasJpeg(novo.f));
    expect(r.status, r.texto).toBe(202);
    const novoId = r.corpo.aplicacao_id;
    h.motor.programar(novoId, leiturasCompletas());
    await h.worker.processar();
    expect(await h.motor.chamadas(novoId)).toHaveLength(0);
    expect((await consultar(novo.dig, novoId)).corpo.estado).toBe('aguardando_cota');
  });
});
