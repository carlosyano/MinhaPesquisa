// Envio de papel antigo e de folhas sem QR (RF-013, CA-052, CA-057, FL-001 tabela de criação,
// RN-052, DEC-169, DEC-179, DEC-180, DEC-182, DEC-184 a DEC-187, DEC-192). A localização e a leitura
// usam os simulados do harness; as folhas de papel antigo são imagens sintéticas sem QR.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { comQr, conteudoForjado, jpeg, semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, caminhoVersao, formularioPublicado, projetoCriado, salvarConteudo, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { consultar, item, prepararCotacao, type ItemRevisao } from '../../support/leitura.js';
import {
  acrescentar,
  conteudoCondicoes,
  conteudoDuasPaginas,
  emSequencia,
  enviarAntigo,
  folhaAntiga,
  folhasAntigas,
  identificar,
  imagens,
  leiturasAntigas,
  localizarELer,
  papelAntigoPublicado,
  rascunhoAntigo,
  PODEM_NAO_CONSTAR,
  type VersaoAntiga,
} from '../../support/papel-antigo.js';

let h: Harness;
let A: TenantPronto;
let admin: Cliente;
let dig: Cliente;
let projeto: string;
let condicoes: VersaoAntiga;
let geral: FormularioPublicado;
let habitos: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await tenantComUsuaria(h, 'Tenant Papel Antigo');
  admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  condicoes = await papelAntigoPublicado(admin, projeto, 'Condições de Saúde', conteudoCondicoes());
  geral = await formularioPublicado(admin, projeto, 'Saúde Geral', conteudoDuasPaginas());
  habitos = await formularioPublicado(admin, await projetoCriado(admin, 'Outro Projeto'), 'Hábitos', conteudoDuasPaginas());
  dig = await entrar(h, A.usuaria);
});
// Uma só usuária faz todas as requisições do arquivo: avançar o relógio a cada teste evita o limite
// de 100 requisições por minuto por usuária (Bloco P P.7), que não é o assunto aqui.
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

async function geralJpeg(n: number): Promise<Arquivo> {
  return arquivo(`geral-${n}.jpg`, 'image/jpeg', await jpeg(geral.paginas[n - 1]));
}

async function geralSemQr(n: number): Promise<Arquivo> {
  return arquivo(`geral-sem-qr-${n}.jpg`, 'image/jpeg', await semQr(geral.paginas[n - 1]));
}

async function aceito(r: Resposta, estado: string, aviso: string | null = null): Promise<string> {
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo).toMatchObject({ estado });
  expect(r.corpo.aviso ?? null).toBe(aviso);
  return r.corpo.aplicacao_id;
}

/** Pendente no envio: nem localizada nem lida, mesmo depois de o worker rodar. */
async function pendenteSemLeitura(r: Resposta, aviso: 'ERR-004' | 'ERR-039'): Promise<string> {
  const id = await aceito(r, 'identificacao_pendente', aviso);
  await localizarELer(h, id);
  expect((await consultar(dig, id)).corpo.estado).toBe('identificacao_pendente');
  expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);
  expect(await h.identificador.chamadas(id)).toHaveLength(0);
  expect(await h.motor.chamadas(id)).toHaveLength(0);
  return id;
}

async function eventosDe(id: string) {
  return (await h.inspect.auditoria(A.tenantId)).filter((e) => e.registro_id === id);
}

/** Evento do upload com `origem_qr` nos detalhes (CA-052). */
async function auditouOrigem(id: string, origem: boolean): Promise<void> {
  const eventos = await eventosDe(id);
  expect(eventos.some((e) => (e.detalhes as { origem_qr?: boolean } | null)?.origem_qr === origem), JSON.stringify(eventos)).toBe(true);
}

async function paginasGravadas(id: string): Promise<(number | null)[]> {
  return (await h.inspect.folhas(id)).filter((f) => f.tipo === 'formulario').map((f) => f.numero_pagina);
}

describe('CA-052 — papel antigo sem QR, com a versão escolhida no envio (DEC-169, DEC-180)', () => {
  // @trace CA-052, DEC-169, RN-052, FL-001
  it('exemplo 1: versão de papel antigo escolhida, 2 folhas sem QR → em_leitura, versão escolhida, origem_qr = false; páginas pela localização', async () => {
    const r = await enviarAntigo(dig, projeto, await folhasAntigas(2), { versaoId: condicoes.versaoId });
    const id = await aceito(r, 'em_leitura');
    await auditouOrigem(id, false);
    await localizarELer(h, id, {}, leiturasAntigas());
    const app = (await consultar(dig, id)).corpo;
    expect(app).toMatchObject({ versao_id: condicoes.versaoId, origem_qr: false, papel_antigo: true, estado: 'em_revisao' });
    expect(await paginasGravadas(id)).toEqual([1, 2]);
    expect(await h.identificador.chamadas(id)).toHaveLength(2);
  });

  // @trace CA-052, CA-040, ERR-004, FL-001
  it('exemplo 2: versão de 2 páginas escolhida e 3 folhas → identificacao_pendente com ERR-004; nada é lido', async () => {
    await pendenteSemLeitura(await enviarAntigo(dig, projeto, await folhasAntigas(3), { versaoId: condicoes.versaoId }), 'ERR-004');
  });

  // @trace CA-052, ERR-004, FL-001
  it('exemplo 3: nenhuma versão escolhida e nenhuma folha com QR → identificacao_pendente com ERR-004; nada é lido', async () => {
    await pendenteSemLeitura(await enviarAntigo(dig, projeto, await folhasAntigas(2)), 'ERR-004');
  });

  // @trace CA-052, DEC-180
  it('exemplo 4: sem versão escolhida, QR íntegro de "Saúde Geral" → em_leitura com a versão do QR, origem_qr = true', async () => {
    const id = await aceito(await enviarAntigo(dig, projeto, [await geralJpeg(1), await geralJpeg(2)]), 'em_leitura');
    await auditouOrigem(id, true);
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: geral.versaoId, origem_qr: true, papel_antigo: false });
  });

  // @trace CA-052, DEC-169, DEC-180
  it('exemplo 5: papel antigo escolhido, mas QR íntegro de "Saúde Geral" → o QR prevalece, origem_qr = true', async () => {
    const id = await aceito(await enviarAntigo(dig, projeto, [await geralJpeg(1), await geralJpeg(2)], { versaoId: condicoes.versaoId }), 'em_leitura');
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: geral.versaoId, origem_qr: true });
  });

  // @trace CA-052, ERR-039, DEC-100
  it('exemplo 6: versão de outro projeto escolhida → identificacao_pendente com ERR-039; a tentativa é auditada', async () => {
    const id = await pendenteSemLeitura(await enviarAntigo(dig, projeto, await folhasAntigas(2), { versaoId: habitos.versaoId }), 'ERR-039');
    expect((await eventosDe(id)).length).toBeGreaterThan(0);
  });

  // @trace CA-052, DEC-180, RN-052
  it('exemplo 7: papel antigo escolhido; a primeira folha com QR da página 1 de "Saúde Geral" e a segunda sem QR → versão do QR nas duas; a segunda tem a página da localização', async () => {
    // A folha sem QR vem antes, para que a página dela só possa sair da localização.
    const r = await enviarAntigo(dig, projeto, [await geralSemQr(2), await geralJpeg(1)], { versaoId: condicoes.versaoId });
    const id = await aceito(r, 'em_leitura');
    const [semQrId] = imagens(r);
    await localizarELer(h, id, { [semQrId]: { pagina: 2 } });
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: geral.versaoId, origem_qr: true });
    expect(await paginasGravadas(id)).toEqual([2, 1]);
  });

  // @trace CA-052, DEC-180, ERR-039
  it('exemplo 8: QR de "Saúde Geral" com página repetida; o identifyApplication com a versão de papel antigo é recusado com ERR-039, auditado', async () => {
    const r = await enviarAntigo(dig, projeto, [await geralJpeg(1), await geralJpeg(1)]);
    const id = await pendenteSemLeitura(r, 'ERR-004');
    const antes = (await eventosDe(id)).length;
    esperarErro(await identificar(dig, id, condicoes.versaoId, emSequencia(imagens(r))), 'ERR-039');
    expect((await eventosDe(id)).length).toBeGreaterThan(antes);
    expect((await consultar(dig, id)).corpo).toMatchObject({ estado: 'identificacao_pendente', versao_id: geral.versaoId });
  });

  // @trace CA-052, DEC-180
  it('exemplo 9: sem versão escolhida; a primeira folha com QR de "Saúde Geral" e a segunda sem QR → em_leitura com a versão do QR nas duas folhas', async () => {
    const id = await aceito(await enviarAntigo(dig, projeto, [await geralJpeg(1), await geralSemQr(2)]), 'em_leitura');
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: geral.versaoId, origem_qr: true });
  });

  // @trace CA-052, CA-039, DEC-180, DEC-184, ERR-039
  it('exemplo 10: QR legível de versão inexistente → ERR-039; papel antigo recusado no identifyApplication (DEC-184); "Saúde Geral" aceita, com origem_qr = false', async () => {
    const forjado = conteudoForjado(geral.paginas[0].qr!.conteudo);
    const folhas = [
      arquivo('f1.jpg', 'image/jpeg', await comQr(geral.paginas[0], forjado)),
      arquivo('f2.jpg', 'image/jpeg', await comQr(geral.paginas[1], forjado)),
    ];
    const r = await enviarAntigo(dig, projeto, folhas);
    const id = await pendenteSemLeitura(r, 'ERR-039');

    const antes = (await eventosDe(id)).length;
    esperarErro(await identificar(dig, id, condicoes.versaoId, emSequencia(imagens(r))), 'ERR-039');
    expect((await eventosDe(id)).length).toBeGreaterThan(antes);
    expect((await consultar(dig, id)).corpo.estado).toBe('identificacao_pendente');
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);

    const ok = await identificar(dig, id, geral.versaoId, emSequencia(imagens(r)));
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo).toMatchObject({ estado: 'em_leitura', versao_id: geral.versaoId, origem_qr: false });
  });

  // @trace CA-052, DEC-187
  it('exemplo 11: QR de outro formato (endereço de site) numa folha → conta como sem QR: em_leitura com a versão de papel antigo; a presença é auditada sem o conteúdo', async () => {
    const site = 'https://pesquisa-ficticia.exemplo.test/questionario?origem=folheto';
    const folhas = [arquivo('site-1.jpg', 'image/jpeg', await folhaAntiga('com QR de site', site)), ...(await folhasAntigas(1, 'sem-qr'))];
    const r = await enviarAntigo(dig, projeto, folhas, { versaoId: condicoes.versaoId });
    const id = await aceito(r, 'em_leitura');
    expect((await consultar(dig, id)).corpo).toMatchObject({ versao_id: condicoes.versaoId, origem_qr: false, papel_antigo: true });

    // Mesmo envio sem o QR de site, para comparar: o QR de outro formato acrescenta o registro da presença.
    const gemeo = await aceito(await enviarAntigo(dig, projeto, await folhasAntigas(2, 'gemeo'), { versaoId: condicoes.versaoId }), 'em_leitura');
    const eventos = await eventosDe(id);
    expect(eventos.length).toBeGreaterThan((await eventosDe(gemeo)).length);
    const texto = JSON.stringify(eventos);
    expect(texto).not.toContain('pesquisa-ficticia');
    expect(texto).not.toContain('questionario?origem');
  });

  // @trace CA-052, DEC-187, DEC-184
  it('QR de outro formato não impede a versão de papel antigo no identifyApplication (DEC-187)', async () => {
    const folhas = [arquivo('site.jpg', 'image/jpeg', await folhaAntiga('site', 'https://outro-sistema.exemplo.test/x')), ...(await folhasAntigas(1))];
    const r = await enviarAntigo(dig, projeto, folhas);
    const id = await aceito(r, 'identificacao_pendente', 'ERR-004');
    const ok = await identificar(dig, id, condicoes.versaoId, emSequencia(imagens(r)));
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo).toMatchObject({ estado: 'em_leitura', versao_id: condicoes.versaoId, origem_qr: false });
  });

  // @trace CA-052, DEC-175, ERR-018
  it('o PDF imprimível da versão de papel antigo é recusado com ERR-018', async () => {
    esperarErro(await admin.get(`${caminhoVersao(condicoes.formId, condicoes.versaoId)}/pdf`), 'ERR-018');
  });
});

describe('FL-001 — tabela de criação com a versão escolhida no envio (DEC-169, DEC-184)', () => {
  // @trace FL-001, DEC-184
  it('papel antigo escolhido com uma folha de QR legível de versão inexistente → identificacao_pendente com ERR-039 (linha 1)', async () => {
    const forjada = arquivo('forjada.jpg', 'image/jpeg', await comQr(geral.paginas[0], conteudoForjado(geral.paginas[0].qr!.conteudo)));
    await pendenteSemLeitura(await enviarAntigo(dig, projeto, [forjada, ...(await folhasAntigas(1))], { versaoId: condicoes.versaoId }), 'ERR-039');
  });

  // @trace FL-001, DEC-100
  it('versão escolhida inexistente ou em rascunho → identificacao_pendente com ERR-039 (linha 3)', async () => {
    await pendenteSemLeitura(await enviarAntigo(dig, projeto, await folhasAntigas(2), { versaoId: '00000000-0000-4000-8000-000000000000' }), 'ERR-039');
    const rascunho = await rascunhoAntigo(admin, projeto, 'Rascunho antigo', conteudoCondicoes());
    expect(rascunho.gravado.status, rascunho.gravado.texto).toBe(200);
    await pendenteSemLeitura(await enviarAntigo(dig, projeto, await folhasAntigas(2), { versaoId: rascunho.versaoId }), 'ERR-039');
  });

  // @trace FL-001, CA-030, ERR-003
  it('papel antigo escolhido e teto de custo atingido → aguardando_cota com ERR-003 (linha 5)', async () => {
    const B = await tenantComUsuaria(h, 'Tenant Cota Antiga');
    const adminB = await entrar(h, B.usuaria);
    const projB = await projetoCriado(adminB, 'Saúde Idoso');
    const v = await papelAntigoPublicado(adminB, projB, 'Condições de Saúde', conteudoCondicoes());
    await h.seed.consumoIa({ tenantId: B.tenantId, valorReais: '500.00' });
    const id = await aceito(await enviarAntigo(adminB, projB, await folhasAntigas(2), { versaoId: v.versaoId }), 'aguardando_cota', 'ERR-003');
    await h.worker.processar();
    expect(await h.identificador.chamadas(id)).toHaveLength(0);
  });
});

describe('CA-057 — perguntas que não constam no papel antigo e padrão de data e local (DEC-179, DEC-182, DEC-185, DEC-186, DEC-192)', () => {
  let proj: string;
  let cond: VersaoAntiga;
  let saudeGeral: FormularioPublicado;
  let lembrancas: VersaoAntiga;

  beforeAll(async () => {
    proj = await projetoCriado(admin, 'Saúde Idoso CA-057');
    cond = await papelAntigoPublicado(admin, proj, 'Condições de Saúde', conteudoCondicoes(PODEM_NAO_CONSTAR));
    saudeGeral = await formularioPublicado(admin, proj, 'Saúde Geral', conteudoDuasPaginas());
    lembrancas = await papelAntigoPublicado(admin, proj, 'Lembranças', conteudoCondicoes(['DATA_APLICACAO']));
  });

  async function padrao(): Promise<{ data: string | null; local: string | null }> {
    const p = await admin.get(`/projects/${proj}`);
    expect(p.status, p.texto).toBe(200);
    return { data: p.corpo.padrao_data_aplicacao ?? null, local: p.corpo.padrao_local_aplicacao ?? null };
  }

  async function itens(id: string): Promise<ItemRevisao[]> {
    return (await consultar(dig, id)).corpo.itens;
  }

  /** Nenhuma das perguntas dadas foi à localização nem à leitura. */
  async function semLocalizarNemLer(id: string, codigos: string[]): Promise<void> {
    for (const c of await h.identificador.chamadas(id)) {
      const enviadas = Object.values(c.perguntas).flat();
      for (const codigo of codigos) expect(enviadas, `localização com ${codigo}`).not.toContain(codigo);
    }
    for (const c of await h.motor.chamadas(id)) {
      for (const codigo of codigos) expect(c.campos, `leitura com ${codigo}`).not.toContain(codigo);
    }
  }

  async function lidas(id: string, codigos: string[]): Promise<void> {
    const enviadas = (await h.identificador.chamadas(id)).flatMap((c) => Object.values(c.perguntas).flat());
    const campos = (await h.motor.chamadas(id)).flatMap((c) => c.campos);
    for (const codigo of codigos) {
      expect(enviadas, `localização de ${codigo}`).toContain(codigo);
      expect(campos, `leitura de ${codigo}`).toContain(codigo);
    }
  }

  async function envioLido(o: { versaoId?: string; data?: string; local?: string }, arquivos?: Arquivo[]): Promise<string> {
    const id = await aceito(await enviarAntigo(dig, proj, arquivos ?? (await folhasAntigas(2)), o), 'em_leitura');
    await localizarELer(h, id, {}, leiturasAntigas());
    return id;
  }

  function esperarItem(lista: ItemRevisao[], codigo: string, estado: string, valorFinal?: string | null): void {
    const i = item({ itens: lista }, codigo);
    expect(i.estado, codigo).toBe(estado);
    if (valorFinal !== undefined) expect(i.valor_final, codigo).toBe(valorFinal);
  }

  // @trace CA-057, DEC-179, DEC-192
  it('exemplo 1: primeiro maço, padrão vazio, com 2024-05-10 e "Centro Dia" → CPF e nascimento em_branco; data e local corrigido; nada disso localizado nem lido; padrão gravado', async () => {
    expect(await padrao()).toEqual({ data: null, local: null });
    const id = await envioLido({ versaoId: cond.versaoId, data: '2024-05-10', local: 'Centro Dia' });
    const lista = await itens(id);
    esperarItem(lista, 'CPF', 'em_branco');
    esperarItem(lista, 'DATA_NASCIMENTO', 'em_branco');
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-05-10');
    esperarItem(lista, 'LOCAL_APLICACAO', 'corrigido', 'Centro Dia');
    await semLocalizarNemLer(id, [...PODEM_NAO_CONSTAR]);
    expect(await padrao()).toEqual({ data: '2024-05-10', local: 'Centro Dia' });
  });

  // @trace CA-057, DEC-179
  it('exemplo 2: segundo maço com os valores propostos → como no exemplo 1', async () => {
    const proposto = await padrao();
    expect(proposto).toEqual({ data: '2024-05-10', local: 'Centro Dia' });
    const id = await envioLido({ versaoId: cond.versaoId, data: proposto.data!, local: proposto.local! });
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-05-10');
    esperarItem(lista, 'LOCAL_APLICACAO', 'corrigido', 'Centro Dia');
    esperarItem(lista, 'CPF', 'em_branco');
  });

  // @trace CA-057, DEC-179, DEC-192
  it('exemplo 3: terceiro maço com 2024-05-17 → itens com 2024-05-17; o padrão passa a 2024-05-17', async () => {
    const id = await envioLido({ versaoId: cond.versaoId, data: '2024-05-17', local: 'Centro Dia' });
    esperarItem(await itens(id), 'DATA_APLICACAO', 'corrigido', '2024-05-17');
    expect(await padrao()).toEqual({ data: '2024-05-17', local: 'Centro Dia' });
  });

  // @trace CA-057, DEC-179
  it('exemplo 4: quarto maço sem data nem local → os dois em a_revisar, sem leitura; o padrão não muda', async () => {
    const id = await envioLido({ versaoId: cond.versaoId });
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'a_revisar', null);
    esperarItem(lista, 'LOCAL_APLICACAO', 'a_revisar', null);
    expect(item({ itens: lista }, 'DATA_APLICACAO').valor_ia).toBeNull();
    await semLocalizarNemLer(id, ['DATA_APLICACAO', 'LOCAL_APLICACAO']);
    expect(await padrao()).toEqual({ data: '2024-05-17', local: 'Centro Dia' });
  });

  // @trace CA-057, DEC-179, ERR-001
  it('exemplo 5: rascunho de papel antigo com o NOME marcado nao_consta → ERR-001 (campos: NOME)', async () => {
    const c = conteudoCondicoes();
    c.perguntas.find((p) => p.codigo === 'NOME')!.nao_consta = true;
    const { gravado } = await rascunhoAntigo(admin, proj, 'Nome que não consta', c);
    esperarErro(gravado, 'ERR-001');
    expect(gravado.corpo.campos).toEqual(['NOME']);
  });

  // @trace CA-057, DEC-179, ERR-001
  it('nao_consta fora do papel antigo ou numa pergunta comum → ERR-001; desmarcar papel_antigo com nao_consta → ERR-001', async () => {
    const oficial = await admin.post('/forms', { corpo: { nome: 'Oficial com nao_consta', projeto_id: proj }, headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(oficial.status, oficial.texto).toBe(201);
    const c = conteudoCondicoes(['CPF']);
    const r1 = await salvarConteudo(admin, oficial.corpo.id, oficial.corpo.versoes[0].id, c);
    esperarErro(r1, 'ERR-001');
    expect(r1.corpo.campos).toEqual(['CPF']);

    const comum = conteudoCondicoes();
    comum.perguntas.find((p) => p.codigo === 'PRESSAO')!.nao_consta = true;
    const r2 = (await rascunhoAntigo(admin, proj, 'Pergunta comum que não consta', comum)).gravado;
    esperarErro(r2, 'ERR-001');
    expect(r2.corpo.campos).toEqual(['PRESSAO']);

    const ok = await rascunhoAntigo(admin, proj, 'Desmarcar', conteudoCondicoes(['CPF']));
    expect(ok.gravado.status, ok.gravado.texto).toBe(200);
    esperarErro(await salvarConteudo(admin, ok.formId, ok.versaoId, { ...conteudoCondicoes(['CPF']), papel_antigo: false } as never), 'ERR-001');
  });

  // @trace CA-057, DEC-182, ERR-001
  it('exemplo 6: envio com a data 2099-01-01 → ERR-001 (campos: data_aplicacao); nada é gravado e o padrão não muda', async () => {
    const antes = await h.inspect.contagemUpload(A.tenantId);
    const r = await enviarAntigo(dig, proj, await folhasAntigas(2), { versaoId: cond.versaoId, data: '2099-01-01', local: 'Centro Dia' });
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['data_aplicacao']);
    expect(await h.inspect.contagemUpload(A.tenantId)).toEqual(antes);
    expect(await padrao()).toEqual({ data: '2024-05-17', local: 'Centro Dia' });
  });

  // @trace CA-057, DEC-182, DEC-186, DEC-192
  it('exemplo 7: sem versão, com 2024-05-24; o padrão muda no envio; depois do identifyApplication, ao fim da localização, os itens recebem 2024-05-24', async () => {
    const r = await enviarAntigo(dig, proj, await folhasAntigas(2), { data: '2024-05-24', local: 'Centro Dia' });
    const id = await aceito(r, 'identificacao_pendente', 'ERR-004');
    expect(await padrao()).toEqual({ data: '2024-05-24', local: 'Centro Dia' });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: '2024-05-24', local_aplicacao: 'Centro Dia' });

    const ok = await identificar(dig, id, cond.versaoId, emSequencia(imagens(r)));
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    await localizarELer(h, id, {}, leiturasAntigas());
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-05-24');
    esperarItem(lista, 'LOCAL_APLICACAO', 'corrigido', 'Centro Dia');
  });

  // @trace CA-057, DEC-182, DEC-186, DEC-192
  it('exemplo 8: versão oficial escolhida, folhas sem QR, com 2024-05-31 → o padrão muda no envio; ao fim da localização, data e local são apagados e as perguntas são localizadas e lidas', async () => {
    const r = await enviarAntigo(dig, proj, [await semQrDe(saudeGeral, 1), await semQrDe(saudeGeral, 2)], { versaoId: saudeGeral.versaoId, data: '2024-05-31', local: 'Centro Dia' });
    const id = await aceito(r, 'em_leitura');
    expect(await padrao()).toEqual({ data: '2024-05-31', local: 'Centro Dia' });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: '2024-05-31', local_aplicacao: 'Centro Dia' });

    await localizarELer(h, id, {}, { DATA_APLICACAO: { valor: '2024-05-30', confianca: 0.97 }, LOCAL_APLICACAO: { valor: 'UBS Centro', confianca: 0.97 } });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: null, local_aplicacao: null });
    await lidas(id, ['DATA_APLICACAO', 'LOCAL_APLICACAO']);
    const lista = await itens(id);
    expect(item({ itens: lista }, 'DATA_APLICACAO').valor_ia).toBe('2024-05-30');
    expect(item({ itens: lista }, 'LOCAL_APLICACAO').valor_ia).toBe('UBS Centro');
  });

  // @trace CA-057, DEC-182, DEC-192
  it('exemplo 9: envio só com a data 2024-06-03 → data corrigido; local a_revisar sem leitura; muda só o padrão de data', async () => {
    const id = await envioLido({ versaoId: cond.versaoId, data: '2024-06-03' });
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-06-03');
    esperarItem(lista, 'LOCAL_APLICACAO', 'a_revisar', null);
    await semLocalizarNemLer(id, ['LOCAL_APLICACAO']);
    expect(await padrao()).toEqual({ data: '2024-06-03', local: 'Centro Dia' });
  });

  // @trace CA-057, DEC-185, DEC-186, DEC-192, V-11
  it('exemplo 10: versão oficial por engano, folhas que a localização não reconhece; data e local continuam gravados; depois do identifyApplication com o papel antigo, os itens os recebem', async () => {
    const r = await enviarAntigo(dig, proj, await folhasAntigas(2), { versaoId: saudeGeral.versaoId, data: '2024-06-07', local: 'Centro Dia' });
    const id = await aceito(r, 'em_leitura');
    expect(await padrao()).toEqual({ data: '2024-06-07', local: 'Centro Dia' });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: '2024-06-07', local_aplicacao: 'Centro Dia' });

    const [f1, f2] = imagens(r);
    await localizarELer(h, id, { [f1]: { pagina: null }, [f2]: { pagina: null } });
    expect((await consultar(dig, id)).corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: '2024-06-07', local_aplicacao: 'Centro Dia' });

    const ok = await identificar(dig, id, cond.versaoId, emSequencia([f1, f2]));
    expect(ok.status, ok.texto).toBe(200);
    await localizarELer(h, id, {}, leiturasAntigas());
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-06-07');
    esperarItem(lista, 'LOCAL_APLICACAO', 'corrigido', 'Centro Dia');
  });

  // @trace CA-057, CA-013, DEC-185, DEC-192
  it('exemplo 11: 1 folha sem versão, com 2024-06-14; addApplicationPages com a segunda folha, a versão e 2024-06-21 → a data nova substitui a do envio e o local é mantido', async () => {
    const r = await enviarAntigo(dig, proj, await folhasAntigas(1, 'primeira'), { data: '2024-06-14', local: 'Centro Dia' });
    const id = await aceito(r, 'identificacao_pendente', 'ERR-004');
    expect(await padrao()).toEqual({ data: '2024-06-14', local: 'Centro Dia' });

    const add = await acrescentar(dig, id, await folhasAntigas(1, 'segunda'), { versaoId: cond.versaoId, data: '2024-06-21' });
    expect(add.status, add.texto).toBe(200);
    expect(add.corpo.estado).toBe('em_leitura');
    expect(await padrao()).toEqual({ data: '2024-06-21', local: 'Centro Dia' });
    await localizarELer(h, id, {}, leiturasAntigas());
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-06-21');
    esperarItem(lista, 'LOCAL_APLICACAO', 'corrigido', 'Centro Dia');
  });

  // @trace CA-057, DEC-185, DEC-192
  it('exemplo 12: "Lembranças" (só a data nao_consta) com 2024-06-28 e "Casa de Repouso" → padrão muda nos dois; data corrigido; o local é apagado e LOCAL_APLICACAO é localizado e lido', async () => {
    const r = await enviarAntigo(dig, proj, await folhasAntigas(2), { versaoId: lembrancas.versaoId, data: '2024-06-28', local: 'Casa de Repouso' });
    const id = await aceito(r, 'em_leitura');
    expect(await padrao()).toEqual({ data: '2024-06-28', local: 'Casa de Repouso' });
    await localizarELer(h, id, {}, leiturasAntigas({ LOCAL_APLICACAO: { valor: 'Lar Esperança', confianca: 0.97 } }));
    expect((await h.inspect.aplicacao(id)).local_aplicacao).toBeNull();
    const lista = await itens(id);
    esperarItem(lista, 'DATA_APLICACAO', 'corrigido', '2024-06-28');
    expect(item({ itens: lista }, 'LOCAL_APLICACAO').valor_ia).toBe('Lar Esperança');
    await lidas(id, ['LOCAL_APLICACAO']);
  });

  // @trace CA-057, DEC-186, DEC-192
  it('exemplo 13: papel antigo com 2024-07-05; uma folha não reconhecida; nada aplicado na pendência; identifyApplication com a versão oficial → data e local apagados, padrão mantido', async () => {
    const r = await enviarAntigo(dig, proj, await folhasAntigas(2), { versaoId: cond.versaoId, data: '2024-07-05', local: 'Centro Dia' });
    const id = await aceito(r, 'em_leitura');
    expect(await padrao()).toEqual({ data: '2024-07-05', local: 'Centro Dia' });
    const [f1, f2] = imagens(r);
    await localizarELer(h, id, { [f2]: { pagina: null } });
    expect((await consultar(dig, id)).corpo.estado).toBe('identificacao_pendente');
    const gravada = await h.inspect.aplicacao(id);
    for (const codigo of ['DATA_APLICACAO', 'LOCAL_APLICACAO']) {
      expect(gravada.itens.find((i) => i.pergunta_codigo === codigo)?.valor_final ?? null, codigo).toBeNull();
    }

    const ok = await identificar(dig, id, saudeGeral.versaoId, emSequencia([f1, f2]));
    expect(ok.status, ok.texto).toBe(200);
    await localizarELer(h, id, {}, {});
    expect(await h.inspect.aplicacao(id)).toMatchObject({ data_aplicacao: null, local_aplicacao: null });
    expect(await padrao()).toEqual({ data: '2024-07-05', local: 'Centro Dia' });
  });
});

async function semQrDe(f: FormularioPublicado, n: number): Promise<Arquivo> {
  return arquivo(`sem-qr-${n}.jpg`, 'image/jpeg', await semQr(f.paginas[n - 1]));
}
