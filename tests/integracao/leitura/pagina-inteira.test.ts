// CPF em caixas e data da aplicação vizinhos são lidos (CA-062, RF-015, DEC-216, DEC-220 (4) e (5), RN-052
// item 5 revogado). IA-TEST do IMP-010 (CHG-019). Motor simulado do harness.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import type { Cliente } from '../../support/cliente.js';
import { jpeg } from '../../support/arquivos.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { abrir, calibrarConfianca, consultar, CPF, item, prepararCotacao } from '../../support/leitura.js';
import { conteudoDuasPaginas } from '../../support/papel-antigo.js';

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await tenantComUsuaria(h, 'Tenant CA-062');
  await calibrarConfianca(h, A.tenantId);
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', conteudoDuasPaginas());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

const alta = (valor: string) => ({ valor, confianca: 0.97 });

async function lida(extra = {}) {
  const r = await enviar(dig, projeto, await Promise.all(f.paginas.map(async (p) => arquivo(`p${p.numero}.jpg`, 'image/jpeg', await jpeg(p)))));
  expect(r.status, r.texto).toBe(202);
  const id: string = r.corpo.aplicacao_id;
  h.motor.programar(id, {
    NOME: alta('Maria Silva'),
    DATA_NASCIMENTO: alta('1950-01-01'),
    CPF: alta(CPF.joana),
    DATA_APLICACAO: alta('2026-10-30'),
    LOCAL_APLICACAO: alta('UBS Centro'),
    PRESSAO_ALTA: alta('sim'),
    USA_MEDICAMENTO: alta('nao'),
    ...extra,
  });
  await h.worker.processar();
  return id;
}

describe('CA-062 — CPF em caixas e data da aplicação vizinhos são lidos', () => {
  // @trace CA-062, DEC-106, DEC-216
  it('Dado: a página 1 tem o CPF em 11 caixas logo acima da data da aplicação no mapa_layout', async () => {
    const mapa = (await h.inspect.mapaLayout(f.versaoId))!;
    const cpf = mapa.perguntas.find((p) => p.codigo === 'CPF')!;
    const data = mapa.perguntas.find((p) => p.codigo === 'DATA_APLICACAO')!;
    expect(cpf.caixas).toHaveLength(11);
    expect(cpf.pagina).toBe(1);
    expect(data.pagina).toBe(1);
    expect(cpf.regiao.y).toBeLessThan(data.regiao.y);
  });

  // @trace CA-062, DEC-216, DEC-220, RN-038
  it('a leitura recebe a página inteira com o gabarito das perguntas da página 1 (e a assinatura só nela)', async () => {
    const id = await lida();
    const chamadas = (await h.motor.chamadas(id)).filter((c) => c.resultado === 'ok');
    const p1 = chamadas.filter((c) => c.pagina === 1);
    expect(p1).toHaveLength(1);
    expect([...p1[0].campos].sort()).toEqual(['CPF', 'DATA_APLICACAO', 'DATA_NASCIMENTO', 'LOCAL_APLICACAO', 'NOME']);
    expect(p1[0].procurar_assinatura).toBe(true);
    expect(p1[0].maxTokens).toBe(300 * 5);
    const p2 = chamadas.filter((c) => c.pagina === 2);
    expect(p2).toHaveLength(1);
    expect(p2[0].procurar_assinatura).toBe(false);
    for (const c of chamadas) expect(Math.max(c.largura, c.altura)).toBeLessThanOrEqual(2000);
  });

  // @trace CA-062, RN-052, DEC-216
  it('CPF e data voltam com valor, confiança e região, e nenhum vai a a_revisar por estar perto do outro', async () => {
    const mapa = (await h.inspect.mapaLayout(f.versaoId))!;
    const cpfReg = mapa.perguntas.find((p) => p.codigo === 'CPF')!.regiao;
    const dataReg = mapa.perguntas.find((p) => p.codigo === 'DATA_APLICACAO')!.regiao;
    const id = await lida({
      CPF: { valor: CPF.joana, confianca: 0.97, regiao: cpfReg },
      DATA_APLICACAO: { valor: '2026-10-30', confianca: 0.97, regiao: dataReg },
    });
    // O CPF completo só aparece depois do openReview (DEC-126) e o CPF sempre vai à conferência (FL-002, regras 5 e 6).
    const app = (await abrir(dig, id)).corpo;
    expect(item(app, 'CPF')).toMatchObject({ valor_ia: CPF.joana, estado: 'a_revisar' });
    expect(item(app, 'DATA_APLICACAO')).toMatchObject({ valor_ia: '2026-10-30', estado: 'confirmado_automaticamente' });
    const folha1 = (await h.inspect.folhas(id)).find((x) => x.numero_pagina === 1)!;
    expect(folha1.regioes).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: 'CPF', ...cpfReg }), expect.objectContaining({ codigo: 'DATA_APLICACAO', ...dataReg })]),
    );
  });

  // @trace CA-062, FL-002, CA-005, CA-006
  it('o estado de cada item segue a confiança e a validação: CPF inválido ou confiança baixa vai a a_revisar, o vizinho não', async () => {
    const id = await lida({ CPF: { valor: CPF.invalido, confianca: 0.97 }, DATA_APLICACAO: { valor: '2026-10-30', confianca: 0.97 } });
    const app = (await consultar(dig, id)).corpo;
    expect(item(app, 'CPF').estado).toBe('a_revisar');
    expect(item(app, 'DATA_APLICACAO').estado).not.toBe('a_revisar');

    const id2 = await lida({ DATA_APLICACAO: { valor: '2026-10-30', confianca: 0.4 } });
    const app2 = (await consultar(dig, id2)).corpo;
    expect(item(app2, 'DATA_APLICACAO').estado).toBe('a_revisar');
    expect(item(app2, 'DATA_NASCIMENTO').estado).not.toBe('a_revisar');
  });
});
