// Identificação da página e leitura da página inteira (RF-013, RF-015, CA-053, CA-055, RN-052, DEC-171,
// DEC-177, DEC-178, DEC-188, DEC-216, DEC-220, RN-036, RN-037, RN-045). Identificador e motor simulados do
// harness; as fotos de papel antigo são imagens sintéticas sem QR, de 1240 × 1754 px.
// Reescrito no IA-TEST do IMP-010 (CHG-019): a identificação devolve só a página e a confiança; as regiões
// vêm da leitura, que recebe a página inteira com o gabarito (sem recortes nem teste de sobreposição).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jpeg } from '../../support/arquivos.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { abrir, calibrarConfianca, consultar, item, prepararCotacao, type ItemRevisao } from '../../support/leitura.js';
import {
  conteudoCondicoes,
  conteudoDuasPaginas,
  conteudoMemorias,
  emSequencia,
  enviarAntigo,
  faixa,
  folhasAntigas,
  identificar,
  imagens,
  leiturasAntigas,
  localizarELer,
  papelAntigoPublicado,
  type VersaoAntiga,
} from '../../support/papel-antigo.js';

const LARGURA = 1240;
const ALTURA = 1754;

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let condicoes: VersaoAntiga;
let condicoesQr: FormularioPublicado;
let memorias: VersaoAntiga;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await tenantComUsuaria(h, 'Tenant Localização');
  const admin = await entrar(h, A.usuaria);
  await h.seed.parametro({ tenantId: A.tenantId, chave: 'limite_confianca_localizacao', valor: '0.50' });
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  condicoes = await papelAntigoPublicado(admin, projeto, 'Condições de Saúde', conteudoCondicoes());
  condicoesQr = await formularioPublicado(admin, projeto, 'Condições de Saúde QR', conteudoDuasPaginas());
  memorias = await papelAntigoPublicado(admin, projeto, 'Memórias Antigas', conteudoMemorias(), 3);
  dig = await entrar(h, A.usuaria);
});
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

async function estado(id: string): Promise<string> {
  return (await consultar(dig, id)).corpo.estado;
}

async function paginasGravadas(id: string): Promise<(number | null)[]> {
  return (await h.inspect.folhas(id)).filter((f) => f.tipo === 'formulario').map((f) => f.numero_pagina);
}

/** Envio de fotos de papel antigo com a versão escolhida; devolve a aplicação e as folhas. */
async function fotos(n: number, versaoId = condicoes.versaoId): Promise<{ id: string; f: string[] }> {
  const r = await enviarAntigo(dig, projeto, await folhasAntigas(n, 'foto'), { versaoId });
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.estado).toBe('em_leitura');
  return { id: r.corpo.aplicacao_id, f: imagens(r) };
}

async function pendenteSemLeitura(id: string): Promise<void> {
  expect((await consultar(dig, id)).corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
  expect(await h.motor.chamadas(id)).toHaveLength(0);
}

describe('CA-053 — ordem das folhas indicada pela identificação (DEC-171, DEC-178, DEC-188, DEC-216)', () => {
  // @trace CA-053, DEC-171, DEC-216, DEC-220, RN-052
  it('exemplo 1: foto 1 = página 2 e foto 2 = página 1 → lidas nessa ordem, cada uma inteira com o gabarito da sua página', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(
      h,
      id,
      { [f[0]]: { pagina: 2 }, [f[1]]: { pagina: 1 } },
      leiturasAntigas({ NOME: { valor: 'Maria Souza', confianca: 0.97, regiao: faixa(0.2, 0.1) } }),
    );
    expect(await paginasGravadas(id)).toEqual([2, 1]);
    expect(await estado(id)).toBe('em_revisao');
    // As regiões vêm da leitura e ficam gravadas na folha da página 1 (a segunda do envio).
    const gravada = (await h.inspect.folhas(id))[1];
    expect(gravada.regioes).toEqual(expect.arrayContaining([expect.objectContaining({ codigo: 'NOME', linha: null, ...faixa(0.2, 0.1) })]));

    // Uma leitura por página, com a imagem inteira (sem recorte, sem folga) e o gabarito da página.
    const leituras = (await h.motor.chamadas(id)).filter((c) => c.resultado === 'ok');
    expect(leituras.map((c) => [c.pagina, [...c.campos].sort()])).toEqual(
      expect.arrayContaining([
        [1, ['NOME', 'PRESSAO']],
        [2, ['CPF', 'DATA_APLICACAO', 'DATA_NASCIMENTO', 'ESTADO_CIVIL', 'LOCAL_APLICACAO']],
      ]),
    );
    for (const c of leituras) {
      expect(c.largura).toBe(LARGURA);
      expect(c.altura).toBe(ALTURA);
    }
  });

  // @trace CA-053, DEC-178, ERR-004
  it('exemplos 2 e 5: confiança 0,40 → pendente sem leitura; com as páginas informadas não há nova identificação e as duas fotos são lidas; pergunta que a leitura não encontra vai a a_revisar', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(h, id, { [f[0]]: { pagina: 1, confianca: 0.9 }, [f[1]]: { pagina: 2, confianca: 0.4 } });
    await pendenteSemLeitura(id);
    const antes = (await h.identificador.chamadas(id)).length;

    const ok = await identificar(dig, id, condicoes.versaoId, emSequencia(f));
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    await localizarELer(h, id, {}, leiturasAntigas({ ESTADO_CIVIL: { valor: null, confianca: 0.2, regiao: null } }));

    // A página informada prevalece: nenhuma identificação nova (DEC-220 (5)).
    expect(await h.identificador.chamadas(id)).toHaveLength(antes);
    expect(await paginasGravadas(id)).toEqual([1, 2]);
    expect(await estado(id)).toBe('em_revisao');
    const estadoCivil = item((await consultar(dig, id)).corpo, 'ESTADO_CIVIL');
    expect(estadoCivil).toMatchObject({ estado: 'a_revisar', valor_ia: null });
    expect((await h.motor.chamadas(id)).filter((c) => c.pagina === 2 && c.resultado === 'ok')).toHaveLength(1);
  });

  // @trace CA-053, CA-013, ERR-004
  it('exemplo 3: as duas fotos como página 1 → pendente (página repetida); informadas as páginas, segue para a leitura', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(h, id, { [f[0]]: { pagina: 1 }, [f[1]]: { pagina: 1 } });
    await pendenteSemLeitura(id);
    const ok = await identificar(dig, id, condicoes.versaoId, emSequencia(f));
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    await localizarELer(h, id, {}, leiturasAntigas());
    expect(await estado(id)).toBe('em_revisao');
    expect(await paginasGravadas(id)).toEqual([1, 2]);
  });

  // @trace CA-053, DEC-171, RN-052
  it('exemplo 4: identificação diverge do QR legível → pendente; a página informada prevalece sem conferir o QR (RN-052, item 3a)', async () => {
    const r = await enviarAntigo(dig, projeto, [
      arquivo('qr-1.jpg', 'image/jpeg', await jpeg(condicoesQr.paginas[0])),
      arquivo('qr-2.jpg', 'image/jpeg', await jpeg(condicoesQr.paginas[1])),
    ], { versaoId: condicoes.versaoId, formularioId: condicoesQr.formId });
    expect(r.status, r.texto).toBe(202);
    const id: string = r.corpo.aplicacao_id;
    const f = imagens(r);
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: condicoesQr.versaoId, origem_qr: true });
    await localizarELer(h, id, { [f[0]]: { pagina: 2 }, [f[1]]: { pagina: 1 } });
    await pendenteSemLeitura(id);

    const ok = await identificar(dig, id, condicoesQr.versaoId, [
      { imagem_id: f[0], numero_pagina: 2 },
      { imagem_id: f[1], numero_pagina: 1 },
    ]);
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    await localizarELer(h, id);
    expect(await estado(id)).toBe('em_revisao');
    expect(await paginasGravadas(id)).toEqual([2, 1]);
  });

  // @trace CA-053, DEC-178
  it('exemplo 6: confiança exatamente 0,50 → reconhecida; segue para a leitura', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(h, id, { [f[0]]: { pagina: 1, confianca: 0.9 }, [f[1]]: { pagina: 2, confianca: 0.5 } }, leiturasAntigas());
    expect(await estado(id)).toBe('em_revisao');
    expect(await paginasGravadas(id)).toEqual([1, 2]);
  });

  // @trace CA-053, DEC-178
  it('sem o parâmetro do tenant, vale o padrão 0,50 (DEC-178)', async () => {
    const B = await tenantComUsuaria(h, 'Tenant Limite Padrão');
    const adminB = await entrar(h, B.usuaria);
    const projB = await projetoCriado(adminB, 'Saúde Idoso');
    const v = await papelAntigoPublicado(adminB, projB, 'Condições de Saúde', conteudoCondicoes());
    for (const [confianca, esperado] of [[0.5, 'em_revisao'], [0.49, 'identificacao_pendente']] as const) {
      const r = await enviarAntigo(adminB, projB, await folhasAntigas(2), { versaoId: v.versaoId });
      const f = imagens(r);
      await localizarELer(h, r.corpo.aplicacao_id, { [f[1]]: { pagina: 2, confianca } });
      expect((await consultar(adminB, r.corpo.aplicacao_id)).corpo.estado, String(confianca)).toBe(esperado);
    }
  });

  // @trace CA-053, DEC-188, RN-052
  it('exemplo 7: 3 páginas, a 3 sem perguntas; a foto de página nula passa a ser a página 3, por eliminação, sem regiões e sem leitura', async () => {
    const { id, f } = await fotos(3, memorias.versaoId);
    await localizarELer(h, id, { [f[0]]: { pagina: 1, confianca: 0.9 }, [f[1]]: { pagina: null }, [f[2]]: { pagina: 2, confianca: 0.9 } }, leiturasAntigas());
    expect(await paginasGravadas(id)).toEqual([1, 3, 2]);
    expect((await h.inspect.folhas(id))[1].regioes).toBeNull();
    expect(await estado(id)).toBe('em_revisao');
    const paginasLidas = new Set((await h.motor.chamadas(id)).map((c) => c.pagina));
    expect([...paginasLidas].sort()).toEqual([1, 2]);
  });

  // @trace CA-053, DEC-188, ERR-004
  it('exemplo 8: duas fotos de página nula → pendente sem leitura (a eliminação só vale para uma folha)', async () => {
    const { id, f } = await fotos(3, memorias.versaoId);
    await localizarELer(h, id, { [f[0]]: { pagina: 1, confianca: 0.9 }, [f[1]]: { pagina: null }, [f[2]]: { pagina: null } });
    await pendenteSemLeitura(id);
  });

  // @trace CA-053, DEC-188
  it('a eliminação não vale quando a página que falta tem perguntas → pendente', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(h, id, { [f[0]]: { pagina: 1 }, [f[1]]: { pagina: null } });
    await pendenteSemLeitura(id);
  });

  // @trace CA-053, RN-052, FL-001, DEC-196
  it('exemplo 9: terceira foto repetida → pendente já no envio, sem identificação; descartada a terceira, as duas são lidas com a página informada, sem nova identificação', async () => {
    const r = await enviarAntigo(dig, projeto, await folhasAntigas(3, 'foto'), { versaoId: condicoes.versaoId });
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
    const id: string = r.corpo.aplicacao_id;
    const f = imagens(r);
    await h.worker.processar();
    expect(await h.identificador.chamadas(id)).toHaveLength(0);

    const ok = await identificar(dig, id, condicoes.versaoId, [
      { imagem_id: f[0], numero_pagina: 1 },
      { imagem_id: f[1], numero_pagina: 2 },
      { imagem_id: f[2], descartar: true },
    ]);
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    await localizarELer(h, id, {}, leiturasAntigas());
    expect(await h.identificador.chamadas(id)).toHaveLength(0);
    expect(await paginasGravadas(id)).toEqual([1, 2]);
    expect(await estado(id)).toBe('em_revisao');
    expect((await h.motor.chamadas(id)).map((c) => c.pagina).sort()).toEqual([1, 2]);
  });

  // @trace CA-053, RN-052, DEC-129
  it('páginas já identificadas são preservadas na falha; a retomada identifica só as que faltam (RN-052, item 3b)', async () => {
    const { id, f } = await fotos(2);
    await localizarELer(h, id, { [f[1]]: { falha: { tipo: 'erro', vezes: 10 } } });
    expect(await estado(id)).toBe('erro_leitura');
    const daFoto1 = (await h.identificador.chamadas(id)).filter((c) => c.imagem_id === f[0]).length;
    expect(daFoto1).toBe(1);

    h.identificador.programar(id, {});
    const retry = await dig.post(`/applications/${id}/retry`, { headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(retry.status, retry.texto).toBe(202); // retryReading responde 202 (contrato; testes falha e cota do IMP-003)
    await localizarELer(h, id, {}, leiturasAntigas());
    expect((await h.identificador.chamadas(id)).filter((c) => c.imagem_id === f[0])).toHaveLength(daFoto1);
    expect(await estado(id)).toBe('em_revisao');
  });
});

describe('CA-055 — identificação sem leitura de valores e leitura da página inteira (RN-045, RN-037, RN-036, DEC-216, DEC-220)', () => {
  let B: TenantPronto;
  let digB: Cliente;
  let projB: string;
  let v: VersaoAntiga;

  beforeAll(async () => {
    B = await tenantComUsuaria(h, 'Tenant CA-055');
    const adminB = await entrar(h, B.usuaria);
    projB = await projetoCriado(adminB, 'Saúde Idoso');
    v = await papelAntigoPublicado(adminB, projB, 'Condições de Saúde', conteudoCondicoes());
    digB = await entrar(h, B.usuaria);
    await calibrarConfianca(h, B.tenantId);
  });

  async function enviar(): Promise<{ id: string; f: string[] }> {
    const r = await enviarAntigo(digB, projB, await folhasAntigas(2, 'ca055'), { versaoId: v.versaoId });
    expect(r.status, r.texto).toBe(202);
    return { id: r.corpo.aplicacao_id, f: imagens(r) };
  }

  async function itensDe(id: string): Promise<ItemRevisao[]> {
    return (await consultar(digB, id)).corpo.itens;
  }

  // @trace CA-055, RN-045, RN-036, DEC-216, DEC-220
  it('exemplo 1: uma identificação por folha (página inteira e perguntas por página, sem projeto nem tenant) e uma leitura por página com o gabarito; o custo entra no teto', async () => {
    h.identificador.custo({ estimadoUsd: 0.02, realUsd: 0.02 });
    h.motor.custo({ estimadoUsd: 0.02, realUsd: 0.02 });
    try {
      const { id, f } = await enviar();
      await localizarELer(h, id, { [f[0]]: { pagina: 1 } }, leiturasAntigas());
      expect((await consultar(digB, id)).corpo.estado).toBe('em_revisao');

      const ident = (await h.identificador.chamadas(id)).filter((c) => c.imagem_id === f[0]);
      expect(ident).toHaveLength(1);
      expect(ident[0].perguntas[1]).toContain('NOME');
      expect(ident[0].perguntas[1]).toContain('PRESSAO');
      expect(ident[0].largura / ident[0].altura).toBeCloseTo(LARGURA / ALTURA, 2);
      const proibidos = [B.tenantId, projB, v.formId, v.versaoId, id, 'Saúde Idoso', 'Condições de Saúde', B.usuaria.email, 'ca055'];
      for (const proibido of proibidos) expect(ident[0].entrada).not.toContain(proibido);

      // Leitura da página 1: a página inteira, só com NOME e PRESSAO no gabarito, também sem contexto.
      const leitura = (await h.motor.chamadas(id)).filter((c) => c.pagina === 1 && c.resultado === 'ok');
      expect(leitura).toHaveLength(1);
      expect([...leitura[0].campos].sort()).toEqual(['NOME', 'PRESSAO']);
      expect(leitura[0].largura).toBe(ident[0].largura);
      expect(leitura[0].altura).toBe(ident[0].altura);
      for (const proibido of proibidos) expect(leitura[0].gabarito).not.toContain(proibido);

      const feitas = (await h.identificador.chamadas(id)).length + (await h.motor.chamadas(id)).length;
      const cota = await digB.get('/tenant/quota');
      expect(cota.corpo.consumido).toBe((0.1 * feitas).toFixed(2)); // US$ 0,02 × R$ 5,00 por chamada
    } finally {
      h.identificador.custo({ estimadoUsd: 0, realUsd: 0 });
      h.motor.custo({ estimadoUsd: 0, realUsd: 0 });
    }
  });

  // @trace CA-055, RN-037, DEC-216, ERR-041
  it('exemplo 2: a identificação traz o texto "Maria" junto da página → recusada como falha da chamada; depois de 3, erro_leitura (ERR-041), sem leitura', async () => {
    const { id, f } = await enviar();
    await localizarELer(h, id, { [f[0]]: { pagina: 1, extra: { texto: 'Maria' } } });
    expect((await consultar(digB, id)).corpo).toMatchObject({ estado: 'erro_leitura', aviso: 'ERR-041' });
    expect((await h.identificador.chamadas(id)).filter((c) => c.imagem_id === f[0])).toHaveLength(3);
    expect(await h.motor.chamadas(id)).toHaveLength(0);
    expect(await h.inspect.logs()).not.toContain('Maria');
  });

  // @trace CA-055, DEC-216, RN-052
  it('exemplo 3: regiões de NOME e PRESSAO que se sobrepõem → os dois itens seguem a confiança; não há teste de sobreposição (RN-052, item 5, revogado)', async () => {
    const { id, f } = await enviar();
    await localizarELer(
      h,
      id,
      { [f[0]]: { pagina: 1 } },
      leiturasAntigas({
        NOME: { valor: 'Maria Souza', confianca: 0.97, regiao: faixa(0.2, 0.15) },
        PRESSAO: { valor: 'sim', confianca: 0.97, regiao: faixa(0.3, 0.15) },
      }),
    );
    const lista = await itensDe(id);
    expect(item({ itens: lista }, 'NOME')).toMatchObject({ valor_ia: 'Maria Souza' });
    expect(item({ itens: lista }, 'PRESSAO')).toMatchObject({ valor_ia: 'sim' });
    expect((await h.motor.chamadas(id)).flatMap((c) => c.campos)).toEqual(expect.arrayContaining(['NOME', 'PRESSAO']));
  });

  // @trace CA-055, DEC-216, DEC-177
  it('regiões sobrepostas com um dos campos de confiança baixa → só a confiança manda o item a a_revisar', async () => {
    const { id, f } = await enviar();
    await localizarELer(
      h,
      id,
      { [f[0]]: { pagina: 1 } },
      leiturasAntigas({
        NOME: { valor: 'Maria Souza', confianca: 0.97, regiao: faixa(0.2, 0.15) },
        PRESSAO: { valor: 'sim', confianca: 0.3, regiao: faixa(0.3, 0.15) },
      }),
    );
    const lista = await itensDe(id);
    // NOME é texto curto e sempre vai à conferência (FL-002, regra 6); o vizinho de confiança alta não.
    expect(item({ itens: lista }, 'ESTADO_CIVIL').estado).not.toBe('a_revisar');
    expect(item({ itens: lista }, 'PRESSAO')).toMatchObject({ estado: 'a_revisar', valor_ia: 'sim' });
  });

  // @trace CA-055, DEC-177, DEC-216
  it('exemplo 4: leitura sem valor e sem região de PRESSAO → PRESSAO em a_revisar; a imagem do item é a página inteira, com regiao nula', async () => {
    const { id, f } = await enviar();
    await localizarELer(h, id, { [f[0]]: { pagina: 1 } }, leiturasAntigas({ PRESSAO: { valor: null, confianca: 0.2, regiao: null } }));
    const pressao = item({ itens: await itensDe(id) }, 'PRESSAO');
    expect(pressao).toMatchObject({ estado: 'a_revisar', valor_ia: null });
    expect(item({ itens: await itensDe(id) }, 'NOME').valor_ia).toBe('Maria Souza');

    expect((await abrir(digB, id)).status).toBe(200);
    const img = await digB.get(`/applications/${id}/items/${pressao.id}/image`);
    expect(img.status, img.texto).toBe(200);
    expect(img.corpo.regiao).toBeNull();
    const nome = item({ itens: await itensDe(id) }, 'NOME');
    const imgNome = await digB.get(`/applications/${id}/items/${nome.id}/image`);
    expect(imgNome.corpo.regiao).not.toBeNull();
  });

  // @trace CA-055, RN-037, DEC-220
  it('exemplo 5: a leitura traz um campo PESO, fora do gabarito da página → recusada como falha da chamada; depois de 3, erro_leitura (ERR-041)', async () => {
    const { id, f } = await enviar();
    await localizarELer(h, id, { [f[0]]: { pagina: 1 } }, leiturasAntigas(), { camposExtras: { PESO: { valor: '70', confianca: 0.97 } } });
    expect((await consultar(digB, id)).corpo).toMatchObject({ estado: 'erro_leitura', aviso: 'ERR-041' });
    const paginaUm = (await h.motor.chamadas(id)).filter((c) => c.pagina === 1);
    expect(paginaUm).toHaveLength(3);
    expect(paginaUm.every((c) => c.resultado === 'malformada')).toBe(true);
    expect(await h.inspect.logs()).not.toContain('"PESO"');
  });

  // @trace CA-055, RN-037, DEC-220
  it('região fora de 0..1 também é recusada como falha da chamada', async () => {
    for (const regiao of [{ x: -0.1, y: 0.2, largura: 0.5, altura: 0.1 }, { x: 0.5, y: 0.2, largura: 0.8, altura: 0.1 }]) {
      const { id, f } = await enviar();
      await localizarELer(h, id, { [f[0]]: { pagina: 1 } }, leiturasAntigas({ NOME: { valor: 'Maria Souza', confianca: 0.97, regiao } }));
      expect((await consultar(digB, id)).corpo.estado, JSON.stringify(regiao)).toBe('erro_leitura');
    }
  });
});
