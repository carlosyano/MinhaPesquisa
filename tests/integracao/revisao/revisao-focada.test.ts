// Achados da revisão focada do IMP-003 (CHG-013): exibição do CPF só na revisão aberta (DEC-126),
// nenhuma confirmação automática antes da calibração (DEC-127), confirmar só valor no schema
// (DEC-128) e as correções técnicas da DEC-130: página ilegível conta como falha da tarefa sem
// travar as demais, reserva recusada não faz a cota oscilar e o descarte da aplicação reaberta
// anonimiza o respondente da conclusão anterior.
//
// O tenant A fica com o padrão de `limite_confianca` (1,00, DEC-127); os demais recebem o limite
// calibrado (0,90) no próprio tenant. Os testes que mexem no custo da IA ficam no fim do arquivo.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import type { Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness, type RoteiroLeitura } from '../../support/harness.js';
import {
  abrir,
  calibrarConfianca,
  comMotivo,
  concluida,
  consultar,
  conteudoLeitura,
  CPF,
  enviarELer,
  item,
  leiturasCompletas,
  paginasJpeg,
  prepararCotacao,
  revisar,
  type ItemRevisao,
} from '../../support/leitura.js';

let h: Harness;

interface Cenario {
  t: TenantPronto;
  dig: Cliente;
  projeto: string;
  f: FormularioPublicado;
}

async function cenario(nome: string, calibrado: boolean): Promise<Cenario> {
  const t = await tenantComUsuaria(h, nome);
  if (calibrado) await calibrarConfianca(h, t.tenantId);
  const admin = await entrar(h, t.usuaria);
  const projeto = await projetoCriado(admin, 'Saúde Idoso');
  const f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  return { t, dig: await entrar(h, t.usuaria), projeto, f };
}

let A: Cenario;
let B: Cenario;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await cenario('Tenant A', false);
  B = await cenario('Tenant B', true);
});
afterAll(async () => {
  await h?.close();
});

async function exibicoesCpf(c: Cenario): Promise<number> {
  return (await h.inspect.auditoria(c.t.tenantId)).filter((e) => e.acao === 'EXIBICAO_CPF').length;
}

function cpfDe(corpo: { itens: ItemRevisao[] }): ItemRevisao {
  return item(corpo, 'CPF');
}

describe('DEC-127 — nenhuma confirmação automática antes da calibração', () => {
  // @trace DEC-127, DEC-028, DEC-047, FL-002, CA-005
  it('sem limite calibrado, leitura com confiança 0,99 em tudo → nenhum item confirmado automaticamente', async () => {
    const alta = (valor: string) => ({ valor, confianca: 0.99 });
    const roteiro: RoteiroLeitura = leiturasCompletas({
      ESTADO_CIVIL: alta('casado'),
      HORAS_SONO: alta('7'),
      SATISFACAO_SONO: alta('4'),
      PRESSAO_ALTA: alta('sim'),
      'SINTOMAS.dor': alta('nunca'),
    });
    const id = await enviarELer(h, A.dig, A.projeto, A.f, roteiro);
    const app = (await consultar(A.dig, id)).corpo as { estado: string; itens: ItemRevisao[] };
    expect(app.estado).toBe('em_revisao');
    expect(app.itens.filter((i) => i.estado === 'confirmado_automaticamente')).toEqual([]);
    for (const chave of ['ESTADO_CIVIL', 'HORAS_SONO', 'SATISFACAO_SONO', 'PRESSAO_ALTA', 'SINTOMAS.dor']) {
      expect(item(app, chave).estado, chave).toBe('a_revisar');
    }
  });

  // @trace DEC-127, DEC-059, FL-002
  it('com o limite calibrado gravado (0,90), a mesma leitura confirma automaticamente o que passa da regra 8', async () => {
    const id = await enviarELer(h, B.dig, B.projeto, B.f, leiturasCompletas({ ESTADO_CIVIL: { valor: 'casado', confianca: 0.99 } }));
    expect(item((await consultar(B.dig, id)).corpo, 'ESTADO_CIVIL').estado).toBe('confirmado_automaticamente');
  });
});

describe('DEC-126 — CPF completo só enquanto a revisão está aberta', () => {
  // @trace DEC-126, RN-013, CA-008
  it('depois da conclusão, getApplication volta a mostrar o CPF mascarado', async () => {
    const id = await concluida(h, B.dig, B.projeto, B.f, { CPF: { valor: CPF.rosa, confianca: 0.97 } });
    const cpf = cpfDe((await consultar(B.dig, id)).corpo);
    expect(cpf.valor_ia).toBeTruthy();
    expect(cpf.valor_ia).not.toBe(CPF.rosa);
    expect(cpf.valor_final).not.toBe(CPF.rosa);
  });

  // @trace DEC-126, RN-013, CA-042
  it('reabertura apaga a marca: CPF mascarado até um novo openReview, que audita de novo', async () => {
    const id = await concluida(h, B.dig, B.projeto, B.f, { CPF: { valor: CPF.pendente, confianca: 0.97 } });
    const r = await B.dig.post(`/applications/${id}/reopen`, comMotivo('Conferir o nome'));
    expect(r.status, r.texto).toBe(200);
    await h.worker.processar();
    expect(cpfDe((await consultar(B.dig, id)).corpo).valor_final).not.toBe(CPF.pendente);

    const antes = await exibicoesCpf(B);
    const aberta = await abrir(B.dig, id);
    expect(aberta.status, aberta.texto).toBe(200);
    expect(cpfDe(aberta.corpo).valor_final).toBe(CPF.pendente);
    expect(await exibicoesCpf(B)).toBe(antes + 1);
  });

  // @trace DEC-126, RN-013, CA-007
  it('cada openReview audita uma exibição; getApplication na mesma revisão aberta mostra sem nova auditoria', async () => {
    const id = await enviarELer(h, B.dig, B.projeto, B.f, leiturasCompletas({ CPF: { valor: CPF.terceiro, confianca: 0.97 } }));
    const antes = await exibicoesCpf(B);
    await abrir(B.dig, id);
    await abrir(B.dig, id);
    expect(await exibicoesCpf(B)).toBe(antes + 2);
    expect(cpfDe((await consultar(B.dig, id)).corpo).valor_ia).toBe(CPF.terceiro);
    expect(await exibicoesCpf(B)).toBe(antes + 2);
  });

  // @trace DEC-126, RN-013, CA-007
  it('recorte do campo de CPF consultado sem a revisão aberta audita EXIBICAO_CPF', async () => {
    const id = await enviarELer(h, B.dig, B.projeto, B.f, leiturasCompletas({ CPF: { valor: CPF.outro, confianca: 0.97 } }));
    const cpf = cpfDe((await consultar(B.dig, id)).corpo);
    const antes = await exibicoesCpf(B);
    const r = await B.dig.get(`/applications/${id}/items/${cpf.id}/image`);
    expect(r.status, r.texto).toBe(200);
    expect(await exibicoesCpf(B)).toBe(antes + 1);
  });
});

describe('DEC-128 — confirmar só valor preenchido e no schema', () => {
  async function aRevisar(roteiro: RoteiroLeitura, chave: string) {
    const id = await enviarELer(h, B.dig, B.projeto, B.f, leiturasCompletas(roteiro));
    const aberta = await abrir(B.dig, id);
    expect(aberta.status, aberta.texto).toBe(200);
    const alvo = item(aberta.corpo, chave);
    expect(alvo.estado).toBe('a_revisar');
    return { id, alvo, etag: aberta.headers.get('etag')! };
  }

  // @trace DEC-128, FL-002, CA-006
  it('escala lida como 7 (faixa 1 a 5) → confirmar é recusado com ERR-001 em acao; corrigir para 4 resolve', async () => {
    const { id, alvo, etag } = await aRevisar({ SATISFACAO_SONO: { valor: '7', confianca: 0.97 } }, 'SATISFACAO_SONO');
    const r = await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'confirmar' }], etag);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['acao']);
    expect(item((await consultar(B.dig, id)).corpo, 'SATISFACAO_SONO').estado).toBe('a_revisar');

    const ok = await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'corrigir', valor_final: '4' }]);
    expect(ok.status, ok.texto).toBe(200);
    expect(item(ok.corpo, 'SATISFACAO_SONO')).toMatchObject({ estado: 'corrigido', valor_final: '4' });
  });

  // @trace DEC-128, DEC-074, RN-020
  it('campo lido em branco → confirmar é recusado; marcar em branco resolve', async () => {
    const { id, alvo, etag } = await aRevisar({ HORAS_SONO: { valor: null, confianca: 0.99 } }, 'HORAS_SONO');
    const r = await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'confirmar' }], etag);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['acao']);
    const ok = await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'em_branco' }]);
    expect(ok.status, ok.texto).toBe(200);
    expect(item(ok.corpo, 'HORAS_SONO').estado).toBe('em_branco');
  });

  // @trace DEC-128, RN-028, CA-014b
  it('data de nascimento inexistente (1950-02-30) → confirmar é recusado com ERR-001, sem erro interno nem o valor no log', async () => {
    const { id, alvo, etag } = await aRevisar({ DATA_NASCIMENTO: { valor: '1950-02-30', confianca: 0.97 } }, 'DATA_NASCIMENTO');
    const r = await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'confirmar' }], etag);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['acao']);
    expect(await h.inspect.logs()).not.toContain('1950-02-30');
  });

  // @trace DEC-128, RN-012
  it('CPF lido com dígito verificador errado → confirmar é recusado', async () => {
    const { id, alvo, etag } = await aRevisar({ CPF: { valor: CPF.invalido, confianca: 0.97 } }, 'CPF');
    esperarErro(await revisar(B.dig, id, [{ item_id: alvo.id, acao: 'confirmar' }], etag), 'ERR-001');
  });
});

describe('DEC-130 (3) — descarte de aplicação reaberta', () => {
  // @trace DEC-130, DEC-078, CA-033, CA-042
  it('o respondente da conclusão anterior, sem outra aplicação concluída, é anonimizado e entra na ListaEliminacoes', async () => {
    const id = await concluida(h, B.dig, B.projeto, B.f, { CPF: { valor: CPF.ana, confianca: 0.97 } });
    const respondente = (await h.inspect.aplicacao(id)).respondente_id!;
    expect(respondente).toBeTruthy();
    expect((await B.dig.post(`/applications/${id}/reopen`, comMotivo('Formulário de outra pessoa'))).status).toBe(200);
    await h.worker.processar();
    const d = await B.dig.post(`/applications/${id}/discard`, comMotivo('Formulário de outra pessoa'));
    expect(d.status, d.texto).toBe(200);

    const r = (await h.inspect.respondentes(B.t.tenantId)).find((x) => x.id === respondente)!;
    expect(r).toMatchObject({ nome: 'ANONIMIZADO', cpf: null, data_nascimento: null, endereco: null, anonimizado: true });
    const lista = (await h.inspect.listaEliminacoes(B.t.tenantId)).filter((e) => e.respondente_id_original === respondente);
    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('anonimizacao_reabertura');
  });

  // @trace DEC-130, DEC-078
  it('respondente que ainda tem outra aplicação concluída não é anonimizado', async () => {
    await concluida(h, B.dig, B.projeto, B.f, { CPF: { valor: CPF.novo, confianca: 0.97 } });
    const id = await concluida(h, B.dig, B.projeto, B.f, { CPF: { valor: CPF.novo, confianca: 0.97 } });
    const respondente = (await h.inspect.aplicacao(id)).respondente_id!;
    expect((await B.dig.post(`/applications/${id}/reopen`, comMotivo('Conferência'))).status).toBe(200);
    await h.worker.processar();
    expect((await B.dig.post(`/applications/${id}/discard`, comMotivo('Duplicada'))).status).toBe(200);
    expect((await h.inspect.respondentes(B.t.tenantId)).find((x) => x.id === respondente)).toMatchObject({ anonimizado: false });
  });
});

describe('DEC-130 (1) — página que não se lê do disco', () => {
  // @trace DEC-130, CA-041, REQ §6.6, PLANO §4.2.1
  it('arquivo corrompido conta como falha da tarefa até erro_leitura; a leitura das outras aplicações continua', async () => {
    const C = await cenario('Tenant página', true);
    const r1 = await enviar(C.dig, C.projeto, await paginasJpeg(C.f));
    expect(r1.status, r1.texto).toBe(202);
    const quebrada: string = r1.corpo.aplicacao_id;
    h.motor.programar(quebrada, leiturasCompletas());
    await h.seed.corromperPagina(quebrada, 3);

    const r2 = await enviar(C.dig, C.projeto, await paginasJpeg(C.f));
    const boa: string = r2.corpo.aplicacao_id;
    h.motor.programar(boa, leiturasCompletas());

    await h.worker.processar();
    expect((await consultar(C.dig, boa)).corpo.estado).toBe('em_revisao');
    expect((await consultar(C.dig, quebrada)).corpo.estado).toBe('em_leitura');
    for (const ms of [1_000, 2_000, 4_000]) {
      await h.clock.advance(ms);
      await h.worker.processar();
    }
    expect((await consultar(C.dig, quebrada)).corpo).toMatchObject({ estado: 'erro_leitura', aviso: 'ERR-041' });
    expect((await h.motor.chamadas(quebrada)).filter((c) => c.pagina === 3)).toEqual([]);
  });
});

describe('DEC-130 (2) — reserva recusada perto do teto (CA-030, exemplo 2)', () => {
  // @trace DEC-130, CA-030, DEC-051, ERR-003
  it('acumulado R$ 499,80 e R$ 0,50 estimado: a aplicação fica em aguardando_cota, sem oscilar, e a cota aparece atingida', async () => {
    const C = await cenario('Tenant teto', true);
    await h.seed.consumoIa({ tenantId: C.t.tenantId, valorReais: '499.80' });
    h.motor.custo({ estimadoUsd: 0.1, realUsd: 0.1 });
    try {
      const r = await enviar(C.dig, C.projeto, await paginasJpeg(C.f));
      const id: string = r.corpo.aplicacao_id;
      h.motor.programar(id, leiturasCompletas());
      await h.worker.processar();
      const primeira = await consultar(C.dig, id);
      expect(primeira.corpo.estado).toBe('aguardando_cota');
      const etag = primeira.headers.get('etag');

      for (let i = 0; i < 5; i++) {
        await h.clock.advance(1_000);
        await h.worker.processar();
      }
      const depois = await consultar(C.dig, id);
      expect(depois.corpo.estado).toBe('aguardando_cota');
      expect(depois.headers.get('etag')).toBe(etag);
      expect(await h.motor.chamadas(id)).toHaveLength(0);
      const q = await C.dig.get('/tenant/quota');
      expect(q.corpo).toMatchObject({ consumido: '499.80', atingido: true, aplicacoes_aguardando: 1 });

      // Teto aumentado por script: a fila volta e a leitura termina.
      await h.seed.parametro({ tenantId: C.t.tenantId, chave: 'custo_ia_teto', valor: '600.00' });
      await h.clock.advance(1_000);
      await h.worker.processar();
      expect((await consultar(C.dig, id)).corpo.estado).toBe('em_revisao');
    } finally {
      h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
    }
  });

  // @trace DEC-130, CA-030, FL-001
  it('com a cota marcada como atingida, um envio novo já nasce em aguardando_cota com ERR-003', async () => {
    const C = await cenario('Tenant teto 2', true);
    await h.seed.consumoIa({ tenantId: C.t.tenantId, valorReais: '499.80' });
    h.motor.custo({ estimadoUsd: 0.1, realUsd: 0.1 });
    try {
      const r1 = await enviar(C.dig, C.projeto, await paginasJpeg(C.f));
      h.motor.programar(r1.corpo.aplicacao_id, leiturasCompletas());
      await h.worker.processar();
      const r2 = await enviar(C.dig, C.projeto, await paginasJpeg(C.f));
      expect(r2.corpo).toMatchObject({ estado: 'aguardando_cota', aviso: 'ERR-003' });
      expect(await h.motor.chamadas(r2.corpo.aplicacao_id)).toHaveLength(0);
    } finally {
      h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
    }
  });
});
