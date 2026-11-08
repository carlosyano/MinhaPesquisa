// Revisão humana (RF-008, CA-007, CA-008, CA-020, CA-018 exemplos 3, 4, 5 e 8; FL-002 transições
// do revisor), CPF mascarado fora da revisão (RN-013), gravação concorrente (RN-043) e isolamento
// das operações novas (TS-001, RN-002).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import {
  abrir,
  concluida,
  concluir,
  consultar,
  conteudoLeitura,
  CPF,
  enviarELer,
  item,
  leiturasCompletas,
  paginasJpeg,
  calibrarConfianca, prepararCotacao,
  revisar,
  semIdentificadores,
  type ItemRevisao,
} from '../../support/leitura.js';

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  await calibrarConfianca(h);
  A = await tenantComUsuaria(h, 'Tenant A');
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

describe('RN-013 — CPF mascarado fora da revisão', () => {
  // @trace RN-013, RNF-003, DEC-072
  it('getApplication antes de openReview mostra o CPF mascarado; openReview mostra o completo e audita EXIBICAO_CPF', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const antes = item((await consultar(dig, id)).corpo, 'CPF');
    expect(antes.valor_ia).toBeTruthy();
    expect(antes.valor_ia).not.toContain(CPF.joana);
    const exibicoesAntes = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.acao === 'EXIBICAO_CPF').length;

    const aberta = await abrir(dig, id);
    expect(aberta.status, aberta.texto).toBe(200);
    expect(item(aberta.corpo, 'CPF').valor_ia).toBe(CPF.joana);
    expect(item((await consultar(dig, id)).corpo, 'CPF').valor_ia).toBe(CPF.joana);
    const exibicoes = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.acao === 'EXIBICAO_CPF');
    expect(exibicoes.length).toBeGreaterThan(exibicoesAntes);
    expect(exibicoes.every((e) => e.usuario_id === A.usuaria.usuarioId && !JSON.stringify(e).includes(CPF.joana))).toBe(true);
  });

  // @trace RN-013, CA-002, REQ §5.4
  it('CPF lido com máscara fica no formato canônico de 11 dígitos', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ CPF: { valor: '123.456.789-09', confianca: 0.97 } }));
    expect(item((await abrir(dig, id)).corpo, 'CPF').valor_ia).toBe(CPF.maria);
  });
});

describe('CA-007 — revisão lado a lado', () => {
  // @trace CA-007, RN-029, RNF-007, DEC-112
  it('getItemImage devolve o link do recorte, válido por 5 minutos e só no notebook, com a região na página', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const aberta = await abrir(dig, id);
    const alvo = item(aberta.corpo, 'ESTADO_CIVIL');
    const r = await dig.get(`/applications/${id}/items/${alvo.id}/image`);
    expect(r.status, r.texto).toBe(200);
    expect(new URL(r.corpo.url).hostname).toBe('127.0.0.1');
    expect(new Date(r.corpo.expira_em).getTime() - h.clock.now().getTime()).toBe(5 * MINUTO);
    for (const k of ['x', 'y', 'largura', 'altura'] as const) {
      expect(r.corpo.regiao[k]).toBeGreaterThanOrEqual(0);
      expect(r.corpo.regiao[k]).toBeLessThanOrEqual(1);
    }
    const img = await fetch(r.corpo.url);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type') ?? '').toMatch(/^image\//);
    expect((await img.arrayBuffer()).byteLength).toBeGreaterThan(0);

    await h.clock.advance(5 * MINUTO + 1_000);
    expect((await fetch(r.corpo.url)).status).not.toBe(200);
  });

  // @trace CA-007, FL-002, RN-010, RN-020
  it('as seis ações: confirmar, corrigir, em branco, ilegível, rasurado e não se aplica; valor_ia nunca muda', async () => {
    const baixa = (valor: string) => ({ valor, confianca: 0.5 });
    const id = await enviarELer(
      h,
      dig,
      projeto,
      f,
      leiturasCompletas({
        ESTADO_CIVIL: baixa('casado'),
        HORAS_SONO: baixa('7'),
        SATISFACAO_SONO: baixa('4'),
        'SINTOMAS.dor': baixa('nunca'),
        'SINTOMAS.cansaco': baixa('sempre'),
        ALIMENTOS: baixa('frutas'),
      }),
    );
    const aberta = await abrir(dig, id);
    const i = (c: string) => item(aberta.corpo, c).id;
    const r = await revisar(
      dig,
      id,
      [
        { item_id: i('ESTADO_CIVIL'), acao: 'confirmar' },
        { item_id: i('HORAS_SONO'), acao: 'corrigir', valor_final: '8' },
        { item_id: i('SATISFACAO_SONO'), acao: 'em_branco' },
        { item_id: i('SINTOMAS.dor'), acao: 'ilegivel' },
        { item_id: i('SINTOMAS.cansaco'), acao: 'rasurado' },
        { item_id: i('ALIMENTOS'), acao: 'nao_se_aplica' },
      ],
      aberta.headers.get('etag')!,
    );
    expect(r.status, r.texto).toBe(200);
    expect(item(r.corpo, 'ESTADO_CIVIL')).toMatchObject({ estado: 'confirmado', valor_ia: 'casado', valor_final: 'casado' });
    expect(item(r.corpo, 'HORAS_SONO')).toMatchObject({ estado: 'corrigido', valor_ia: '7', valor_final: '8' });
    expect(item(r.corpo, 'SATISFACAO_SONO')).toMatchObject({ estado: 'em_branco', valor_ia: '4' });
    expect(item(r.corpo, 'SINTOMAS.dor')).toMatchObject({ estado: 'ilegivel', valor_ia: 'nunca' });
    expect(item(r.corpo, 'SINTOMAS.cansaco')).toMatchObject({ estado: 'rasurado', valor_ia: 'sempre' });
    expect(item(r.corpo, 'ALIMENTOS')).toMatchObject({ estado: 'nao_se_aplica', valor_ia: 'frutas' });

    // Item já resolvido aceita outra ação de revisão (FL-002).
    const de_novo = await revisar(dig, id, [{ item_id: i('SATISFACAO_SONO'), acao: 'corrigir', valor_final: '5' }], r.headers.get('etag')!);
    expect(de_novo.status, de_novo.texto).toBe(200);
    expect(item(de_novo.corpo, 'SATISFACAO_SONO')).toMatchObject({ estado: 'corrigido', valor_final: '5' });
  });

  // @trace CA-007, ERR-001
  it('corrigir sem valor_final → 400 ERR-001; nada é gravado', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ ESTADO_CIVIL: { valor: 'casado', confianca: 0.5 } }));
    const aberta = await abrir(dig, id);
    esperarErro(await revisar(dig, id, [{ item_id: item(aberta.corpo, 'ESTADO_CIVIL').id, acao: 'corrigir' }], aberta.headers.get('etag')!), 'ERR-001');
    expect(item((await consultar(dig, id)).corpo, 'ESTADO_CIVIL').estado).toBe('a_revisar');
  });

  // @trace FL-001, RN-012, ERR-001
  it('no item de CPF: não se aplica → ERR-001; corrigir com dígitos verificadores inválidos → ERR-001', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const aberta = await abrir(dig, id);
    const cpf = item(aberta.corpo, 'CPF').id;
    esperarErro(await revisar(dig, id, [{ item_id: cpf, acao: 'nao_se_aplica' }], aberta.headers.get('etag')!), 'ERR-001');
    esperarErro(await revisar(dig, id, [{ item_id: cpf, acao: 'corrigir', valor_final: CPF.invalido }], aberta.headers.get('etag')!), 'ERR-001');
    expect(item((await consultar(dig, id)).corpo, 'CPF')).toMatchObject({ estado: 'a_revisar', valor_final: null });
  });
});

describe('CA-008 — correção auditada sem expor o valor', () => {
  // @trace CA-008, RN-027, RN-028, RNF-005, RNF-006
  it.each([
    ['DATA_NASCIMENTO', 'data_nascimento', '1950-01-01', '1951-01-01', ['1950', '1951']],
    ['CPF', 'cpf', CPF.invalido, CPF.maria, ['123456789', CPF.maria]],
  ])('%s: valor_ia %j corrigido para %j', async (codigo, campo, lido, novo, proibidos) => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ [codigo]: { valor: lido, confianca: 0.5 } }));
    const aberta = await abrir(dig, id);
    const alvo = item(aberta.corpo, codigo);
    const r = await revisar(dig, id, [{ item_id: alvo.id, acao: 'corrigir', valor_final: novo }], aberta.headers.get('etag')!);
    expect(r.status, r.texto).toBe(200);
    expect(item(r.corpo, codigo)).toMatchObject({ estado: 'corrigido', valor_ia: lido, valor_final: novo });

    const eventos = await h.inspect.auditoria(A.tenantId);
    const correcao = eventos.filter((e) => e.acao === 'CORRECAO_CAMPO' && e.registro_id === alvo.id);
    expect(correcao).toHaveLength(1);
    expect(correcao[0]).toMatchObject({ usuario_id: A.usuaria.usuarioId, entidade: 'ItemResposta' });
    expect(correcao[0].campo?.toLowerCase()).toBe(campo);
    const auditoria = semIdentificadores(JSON.stringify(eventos));
    const logs = semIdentificadores(await h.inspect.logs());
    for (const p of proibidos) {
      expect(auditoria, `auditoria contém ${p}`).not.toContain(p);
      expect(logs, `log contém ${p}`).not.toContain(p);
    }
  });
});

describe('Reavaliação das regras de salto na revisão (CA-020, CA-018)', () => {
  // QUAIS_MEDICAMENTOS só se USA_MEDICAMENTO = sim.
  async function lerEAbrir(usa: { valor: string | null; confianca: number }, quais: string | null) {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ USA_MEDICAMENTO: usa, QUAIS_MEDICAMENTOS: { valor: quais, confianca: 0.99 } }));
    const aberta = await abrir(dig, id);
    expect(aberta.status, aberta.texto).toBe(200);
    return { id, aberta, origem: item(aberta.corpo, 'USA_MEDICAMENTO').id };
  }

  // @trace CA-020, FL-002, RN-021
  it('destino nao_se_aplica pela regra; o revisor corrige a origem para "sim" → destino volta a a_revisar', async () => {
    const { id, aberta, origem } = await lerEAbrir({ valor: 'nao', confianca: 0.97 }, null);
    expect(item(aberta.corpo, 'QUAIS_MEDICAMENTOS').estado).toBe('nao_se_aplica');
    const r = await revisar(dig, id, [{ item_id: origem, acao: 'corrigir', valor_final: 'sim' }], aberta.headers.get('etag')!);
    expect(r.status, r.texto).toBe(200);
    expect(item(r.corpo, 'QUAIS_MEDICAMENTOS').estado).toBe('a_revisar');
  });

  // @trace CA-018, FL-002
  it.each([
    ['exemplo 3', { valor: 'nao', confianca: 0.85 }, null, 'confirmar', 'nao_se_aplica'],
    ['confirmada "sim"', { valor: 'sim', confianca: 0.85 }, 'Losartana', 'confirmar', 'a_revisar'],
    ['exemplo 4', { valor: null, confianca: 0.99 }, null, 'em_branco', 'a_revisar'],
    ['exemplo 5', { valor: 'sim', confianca: 0.85 }, 'Losartana', 'ilegivel', 'a_revisar'],
    ['exemplo 8', { valor: 'sim', confianca: 0.85 }, null, 'rasurado', 'a_revisar'],
  ] as const)('%s: destino em aguardando_condicao; origem resolvida com %s → destino %s', async (_n, usa, quais, acao, esperado) => {
    const { id, aberta, origem } = await lerEAbrir(usa, quais);
    expect(item(aberta.corpo, 'QUAIS_MEDICAMENTOS').estado).toBe('aguardando_condicao');
    const r = await revisar(dig, id, [{ item_id: origem, acao: acao as 'confirmar' }], aberta.headers.get('etag')!);
    expect(r.status, r.texto).toBe(200);
    expect(item(r.corpo, 'QUAIS_MEDICAMENTOS').estado).toBe(esperado);
  });
});

describe('RN-043 — gravação concorrente e estados (sem reserva, DEC-112)', () => {
  // @trace RN-043, ERR-017, REQ §6.5
  it('duas abas com o mesmo ETag: a segunda gravação → 412 ERR-017 e nada dela é gravado', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ ESTADO_CIVIL: { valor: 'casado', confianca: 0.5 } }));
    const aba1 = await abrir(dig, id);
    const aba2 = await entrar(h, A.usuaria);
    const etag = aba1.headers.get('etag')!;
    const alvo = item(aba1.corpo, 'ESTADO_CIVIL').id;
    expect((await revisar(dig, id, [{ item_id: alvo, acao: 'confirmar' }], etag)).status).toBe(200);
    esperarErro(await revisar(aba2, id, [{ item_id: alvo, acao: 'corrigir', valor_final: 'viuvo' }], etag), 'ERR-017');
    expect(item((await consultar(dig, id)).corpo, 'ESTADO_CIVIL')).toMatchObject({ estado: 'confirmado', valor_final: 'casado' });
  });

  // @trace RN-043, ERR-001
  it('saveReview sem If-Match → 400 ERR-001', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const alvo = item((await abrir(dig, id)).corpo, 'NOME').id;
    esperarErro(await dig.patch(`/applications/${id}/review`, { corpo: { itens: [{ item_id: alvo, acao: 'confirmar' }] } }), 'ERR-001');
  });

  // @trace FL-001, ERR-018
  it('openReview com a leitura em andamento → 409 ERR-018', async () => {
    const r = await enviar(dig, projeto, await paginasJpeg(f));
    esperarErro(await abrir(dig, r.corpo.aplicacao_id), 'ERR-018');
  });

  // @trace FL-001, ERR-018
  it('aplicação concluída: saveReview e getItemImage → 409 ERR-018; openReview também', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: CPF.outro, confianca: 0.97 } });
    const alvo = item((await consultar(dig, id)).corpo, 'NOME').id;
    esperarErro(await revisar(dig, id, [{ item_id: alvo, acao: 'em_branco' }]), 'ERR-018');
    esperarErro(await dig.get(`/applications/${id}/items/${alvo}/image`), 'ERR-018');
    esperarErro(await abrir(dig, id), 'ERR-018');
  });

  // @trace FL-001, RN-012, ERR-006
  it('em aguardando_cpf, saveReview com um CPF válido devolve a aplicação a em_revisao', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ CPF: { valor: CPF.invalido, confianca: 0.97 } }));
    const aberta = await abrir(dig, id);
    const pend = (aberta.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar');
    expect((await revisar(dig, id, pend.map((i) => ({ item_id: i.id, acao: 'confirmar' })), aberta.headers.get('etag')!)).status).toBe(200);
    const c = await concluir(dig, id);
    expect(c.status, c.texto).toBe(200);
    expect(c.corpo).toMatchObject({ estado: 'aguardando_cpf', aviso: 'ERR-006' });
    const cpf = item(c.corpo, 'CPF').id;
    const r = await revisar(dig, id, [{ item_id: cpf, acao: 'corrigir', valor_final: CPF.maria }]);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('em_revisao');
  });

  // @trace RN-002, ERR-002
  it('item de outra aplicação no corpo do saveReview → 404 ERR-002', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const outra = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const alheio = item((await abrir(dig, outra)).corpo, 'NOME').id;
    await abrir(dig, id);
    esperarErro(await revisar(dig, id, [{ item_id: alheio, acao: 'confirmar' }]), 'ERR-002');
    expect(item((await consultar(dig, outra)).corpo, 'NOME').estado).toBe('a_revisar');
  });
});

describe('listReviewQueue — fila por estado', () => {
  // @trace RF-008, TL-006
  it('filtra as aplicações do projeto pelo estado', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const r = await dig.get(`/projects/${projeto}/review-queue?estado=em_revisao&limite=100`);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.itens.map((a: { id: string }) => a.id)).toContain(id);
    expect(r.corpo.itens.every((a: { estado: string }) => a.estado === 'em_revisao')).toBe(true);
  });
});

describe('TS-001 — operações de revisão sobre aplicação de outro tenant', () => {
  let B: TenantPronto;
  let userB: Cliente;
  let id: string;
  let itemId: string;

  beforeAll(async () => {
    id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    itemId = item((await consultar(dig, id)).corpo, 'NOME').id;
    B = await tenantComUsuaria(h, 'Tenant B');
    userB = await entrar(h, B.usuaria);
  });

  const comChave = () => ({ headers: { 'idempotency-key': chaveIdempotencia(), 'if-match': '"qualquer"' } });

  // @trace TS-001, CA-012, RN-002, ERR-002
  it.each([
    ['getApplication', (c: Cliente) => c.get(`/applications/${id}`)],
    ['openReview', (c: Cliente) => c.post(`/applications/${id}/review/open`)],
    ['getItemImage', (c: Cliente) => c.get(`/applications/${id}/items/${itemId}/image`)],
    ['saveReview', (c: Cliente) => c.patch(`/applications/${id}/review`, { corpo: { itens: [{ item_id: itemId, acao: 'em_branco' }] }, headers: { 'if-match': '"qualquer"' } })],
    ['confirmApplication', (c: Cliente) => c.post(`/applications/${id}/confirm`, { corpo: { assinatura: 'presente' }, ...comChave() })],
    ['retryReading', (c: Cliente) => c.post(`/applications/${id}/retry`, comChave())],
    ['discardApplication', (c: Cliente) => c.post(`/applications/${id}/discard`, { corpo: { motivo: 'teste de isolamento' }, ...comChave() })],
    ['reopenApplication', (c: Cliente) => c.post(`/applications/${id}/reopen`, { corpo: { motivo: 'teste de isolamento' }, ...comChave() })],
    ['listReviewQueue', (c: Cliente) => c.get(`/projects/${projeto}/review-queue`)],
  ])('%s → 404 ERR-002, auditado no tenant de quem tentou; a aplicação de A não muda', async (_op, chamar) => {
    const deB = async (tenant: string) => (await h.inspect.auditoria(tenant)).filter((e) => e.usuario_id === B.usuaria.usuarioId).length;
    const antes = await deB(B.tenantId);
    esperarErro(await chamar(userB), 'ERR-002');
    expect(await deB(B.tenantId)).toBeGreaterThan(antes);
    expect(await deB(A.tenantId)).toBe(0);
    const app = (await consultar(dig, id)).corpo;
    expect(app.estado).toBe('em_revisao');
    expect(item(app, 'NOME').estado).toBe('a_revisar');
  });
});
