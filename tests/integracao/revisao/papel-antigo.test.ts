// Conclusão de papel antigo (RF-013, RF-005, RF-008, CA-054, DEC-172, DEC-176, FL-001 precedência
// 1a, 2, 3, 3a e 4) e assinatura anexada sem QR (CA-044, DEC-183). Cada exemplo do CA-054 parte do
// mesmo "Dado", num tenant próprio: a respondente R1 ("MARIA  SOUZA", sem CPF e sem nascimento) e a
// aplicação A3 em `em_revisao`, com todos os itens resolvidos.
// Ajustado no IA-TEST do IMP-009 (DEC-201): a coluna do CPF vem de `COL`, porque `Arquivo` entrou antes dela.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jpeg, semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { COL, exportada, linhas } from '../../support/exportacao.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness, type RespondenteGravado, type RoteiroLeitura } from '../../support/harness.js';
import { abrir, concluir, confirmarPendentes, consultar, prepararCotacao } from '../../support/leitura.js';
import { antigaEmRevisao, conteudoCondicoes, leiturasAntigas, localizarELer, papelAntigoPublicado, type VersaoAntiga } from '../../support/papel-antigo.js';

const CPF_VALIDO = '52998224725';
const CPF_OUTRO = '39053344705';
const CPF_INVALIDO = '52998224700';

let h: Harness;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
});
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

interface Cenario {
  T: TenantPronto;
  dig: Cliente;
  projeto: string;
  antiga: VersaoAntiga;
  r1: RespondenteGravado;
  /** A3, em `em_revisao`, lida com `leitura`. */
  a3: string;
}

/** O "Dado" do CA-054, com A3 lida com `extra` por cima da leitura padrão. */
async function cenario(extra: RoteiroLeitura = {}): Promise<Cenario> {
  const T = await tenantComUsuaria(h, 'Tenant CA-054');
  const dig = await entrar(h, T.usuaria);
  const projeto = await projetoCriado(dig, 'Saúde Idoso');
  const antiga = await papelAntigoPublicado(dig, projeto, 'Condições de Saúde', conteudoCondicoes());

  // R1 nasce de uma aplicação de papel antigo sem CPF e sem nascimento, sem candidatos: respondente novo.
  const r0 = await antigaEmRevisao(h, dig, projeto, antiga.versaoId, leiturasAntigas({ NOME: { valor: 'MARIA  SOUZA', confianca: 0.97 }, DATA_NASCIMENTO: { valor: null, confianca: 0.97 } }));
  const c0 = await concluir(dig, r0, { assinatura: 'ausente' });
  expect(c0.status, c0.texto).toBe(200);
  expect(c0.corpo.estado).toBe('concluida');
  const todos = await h.inspect.respondentes(T.tenantId);
  expect(todos).toHaveLength(1);
  expect(todos[0]).toMatchObject({ cpf: null, data_nascimento: null });

  const a3 = await antigaEmRevisao(h, dig, projeto, antiga.versaoId, leiturasAntigas(extra));
  return { T, dig, projeto, antiga, r1: todos[0], a3 };
}

async function respondentes(c: Cenario): Promise<RespondenteGravado[]> {
  return h.inspect.respondentes(c.T.tenantId);
}

/** Recusa sem gravar nada: a aplicação continua em `em_revisao` e os respondentes não mudam. */
async function recusadaSemGravar(c: Cenario, r: Resposta, erro: string): Promise<void> {
  const antes = await respondentes(c);
  esperarErro(r, erro);
  expect((await h.inspect.aplicacao(c.a3)).estado).toBe('em_revisao');
  expect((await h.inspect.aplicacao(c.a3)).respondente_id).toBeNull();
  expect(await respondentes(c)).toEqual(antes);
}

/** Aplicação de versão oficial com os mesmos dados, em `em_revisao` (exemplos 7, 8 e 12). */
async function oficialEmRevisao(c: Cenario, extra: RoteiroLeitura = {}): Promise<string> {
  const f = await formularioPublicado(c.dig, c.projeto, 'Saúde Geral', conteudoCondicoes());
  const r = await enviar(c.dig, c.projeto, await Promise.all(f.paginas.map(async (p) => arquivo(`p${p.numero}.jpg`, 'image/jpeg', await jpeg(p)))));
  expect(r.status, r.texto).toBe(202);
  const id: string = r.corpo.aplicacao_id;
  await localizarELer(h, id, {}, leiturasAntigas(extra));
  await confirmarPendentes(c.dig, id);
  return id;
}

describe('CA-054 — papel antigo conclui sem CPF e sem assinatura (DEC-172, DEC-176)', () => {
  // @trace CA-054, DEC-176, FL-001, ERR-001
  it('exemplo 1: sem escolha do respondente → ERR-001; escolhendo R1 → concluida, vinculada a R1, que ganha a data de nascimento; entra na exportação com CPF vazio', async () => {
    const c = await cenario();
    const aberta = await abrir(c.dig, c.a3);
    expect(aberta.corpo.candidatos_nome).toEqual([{ respondente_id: c.r1.id, nome: c.r1.nome, data_nascimento: null }]);
    expect(JSON.stringify(aberta.corpo.candidatos_nome)).not.toMatch(/\d{11}/);

    await recusadaSemGravar(c, await concluir(c.dig, c.a3, { assinatura: 'ausente' }), 'ERR-001');

    const ok = await concluir(c.dig, c.a3, { assinatura: 'ausente', respondente_id: c.r1.id });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo).toMatchObject({ estado: 'concluida', assinatura: 'ausente', papel_antigo: true });
    expect((await h.inspect.aplicacao(c.a3)).respondente_id).toBe(c.r1.id);
    const r1 = (await respondentes(c)).find((r) => r.id === c.r1.id)!;
    expect(r1).toMatchObject({ data_nascimento: '1950-03-12', cpf: null, nome: c.r1.nome });
    expect(await respondentes(c)).toHaveLength(1);

    const a = await exportada(h, c.dig, { formato: 'csv', escopo: 'linha_por_item', projeto_ids: [c.projeto] });
    const doA3 = linhas(a, 'csv').slice(1).filter((l) => l[0] === c.a3);
    expect(doA3.length).toBeGreaterThan(0);
    expect(doA3.every((l) => l[COL.CPF] === '')).toBe(true);
  });

  // @trace CA-054, RN-015, DEC-172
  it('exemplo 2: CPF válido e assinatura ausente → concluida; cria a respondente com esse CPF; entra na exportação', async () => {
    const c = await cenario({ CPF: { valor: CPF_VALIDO, confianca: 0.97 } });
    const ok = await concluir(c.dig, c.a3, { assinatura: 'ausente' });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('concluida');
    const comCpf = (await respondentes(c)).filter((r) => r.cpf === CPF_VALIDO);
    expect(comCpf).toHaveLength(1);
    expect((await h.inspect.aplicacao(c.a3)).respondente_id).toBe(comCpf[0].id);
    const a = await exportada(h, c.dig, { formato: 'csv', escopo: 'linha_por_item', projeto_ids: [c.projeto] });
    expect(linhas(a, 'csv').slice(1).some((l) => l[0] === c.a3 && l[COL.CPF] === CPF_VALIDO)).toBe(true);
  });

  // @trace CA-054, DEC-176
  it('exemplo 3: CPF inválido e assinatura presente; escolhendo respondente novo → concluida, com respondente novo "Maria Souza", sem CPF', async () => {
    const c = await cenario({ CPF: { valor: CPF_INVALIDO, confianca: 0.97 } });
    const ok = await concluir(c.dig, c.a3, { assinatura: 'presente', respondente_id: null });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('concluida');
    const todos = await respondentes(c);
    expect(todos).toHaveLength(2);
    const novo = todos.find((r) => r.id !== c.r1.id)!;
    expect(novo).toMatchObject({ nome: 'Maria Souza', cpf: null, data_nascimento: '1950-03-12' });
    expect((await h.inspect.aplicacao(c.a3)).respondente_id).toBe(novo.id);
  });

  // @trace CA-054, DEC-176
  it('exemplo 4: data de nascimento em branco; escolhendo R1 → concluida, e R1 continua sem data de nascimento', async () => {
    const c = await cenario({ DATA_NASCIMENTO: { valor: null, confianca: 0.97 } });
    const ok = await concluir(c.dig, c.a3, { assinatura: 'ausente', respondente_id: c.r1.id });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('concluida');
    expect((await respondentes(c)).find((r) => r.id === c.r1.id)!.data_nascimento).toBeNull();
  });

  // @trace CA-054, DEC-176, ERR-001
  it('exemplo 5: respondente_id fora dos candidatos → ERR-001; nada é gravado', async () => {
    const c = await cenario();
    await recusadaSemGravar(c, await concluir(c.dig, c.a3, { assinatura: 'ausente', respondente_id: '00000000-0000-4000-8000-000000000000' }), 'ERR-001');
  });

  // @trace CA-054, DEC-020, ERR-006
  it('exemplo 6: nome em branco → ERR-006; permanece em em_revisao', async () => {
    const c = await cenario({ NOME: { valor: null, confianca: 0.97 } });
    await recusadaSemGravar(c, await concluir(c.dig, c.a3, { assinatura: 'ausente' }), 'ERR-006');
  });

  // @trace CA-054, DEC-175, ERR-006
  it('exemplo 7: versão oficial, CPF em branco e assinatura presente → aguardando_cpf com aviso ERR-006', async () => {
    const c = await cenario();
    const id = await oficialEmRevisao(c);
    const r = await concluir(c.dig, id, { assinatura: 'presente' });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'aguardando_cpf', aviso: 'ERR-006', papel_antigo: false });
  });

  // @trace CA-054, CA-021, DEC-064
  it('exemplo 8: versão oficial, CPF válido e assinatura ausente → sem_assinatura, sem vínculo e fora da exportação', async () => {
    const c = await cenario();
    const id = await oficialEmRevisao(c, { CPF: { valor: CPF_VALIDO, confianca: 0.97 } });
    const r = await concluir(c.dig, id, { assinatura: 'ausente' });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('sem_assinatura');
    expect((await h.inspect.aplicacao(id)).respondente_id).toBeNull();
    const a = await exportada(h, c.dig, { formato: 'csv', escopo: 'linha_por_item', projeto_ids: [c.projeto] });
    expect(linhas(a, 'csv').slice(1).some((l) => l[0] === id)).toBe(false);
  });

  // @trace CA-054, DEC-176
  it('exemplo 9: nome "Joana Lima", sem respondente com esse nome; sem respondente_id → concluida, com respondente novo sem CPF', async () => {
    const c = await cenario({ NOME: { valor: 'Joana Lima', confianca: 0.97 } });
    expect((await abrir(c.dig, c.a3)).corpo.candidatos_nome ?? []).toEqual([]);
    const ok = await concluir(c.dig, c.a3, { assinatura: 'ausente' });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('concluida');
    const novo = (await respondentes(c)).find((r) => r.id !== c.r1.id)!;
    expect(novo).toMatchObject({ nome: 'Joana Lima', cpf: null });
  });

  // @trace CA-054, DEC-176, FL-001, ERR-001
  it('exemplo 10: CPF válido com respondente_id de R1 → ERR-001 (com CPF válido o vínculo é pelo CPF); nada é gravado', async () => {
    const c = await cenario({ CPF: { valor: CPF_VALIDO, confianca: 0.97 } });
    await recusadaSemGravar(c, await concluir(c.dig, c.a3, { assinatura: 'ausente', respondente_id: c.r1.id }), 'ERR-001');
  });

  // @trace CA-054, DEC-176
  it('exemplo 11: data de nascimento em branco e CPF válido → concluida; cria a respondente com esse CPF e sem data de nascimento', async () => {
    const c = await cenario({ DATA_NASCIMENTO: { valor: null, confianca: 0.97 }, CPF: { valor: CPF_OUTRO, confianca: 0.97 } });
    const ok = await concluir(c.dig, c.a3, { assinatura: 'ausente' });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('concluida');
    expect((await respondentes(c)).filter((r) => r.cpf === CPF_OUTRO)).toEqual([expect.objectContaining({ data_nascimento: null })]);
  });

  // @trace CA-054, FL-001, ERR-001
  it('exemplo 12: versão oficial com respondente_id de R1 → ERR-001; continua em em_revisao, sem ir a aguardando_cpf (precedência 1a)', async () => {
    const c = await cenario();
    const id = await oficialEmRevisao(c);
    esperarErro(await concluir(c.dig, id, { assinatura: 'presente', respondente_id: c.r1.id }), 'ERR-001');
    expect((await h.inspect.aplicacao(id)).estado).toBe('em_revisao');
  });

  // @trace CA-054, DEC-176, ERR-001
  it('exemplo 13: "Joana Lima" sem candidatos, com respondente_id de R1 → ERR-001 (lista vazia); nada é gravado', async () => {
    const c = await cenario({ NOME: { valor: 'Joana Lima', confianca: 0.97 } });
    await recusadaSemGravar(c, await concluir(c.dig, c.a3, { assinatura: 'ausente', respondente_id: c.r1.id }), 'ERR-001');
  });

  // @trace CA-054, DEC-176, FL-001
  it('a lista de candidatos é calculada pelo valor_final atual do NOME: corrigido o nome, os candidatos mudam', async () => {
    const c = await cenario({ NOME: { valor: 'Joana Lima', confianca: 0.97 } });
    const aberta = await abrir(c.dig, c.a3);
    expect(aberta.corpo.candidatos_nome ?? []).toEqual([]);
    const nome = (aberta.corpo.itens as { id: string; pergunta_codigo: string }[]).find((i) => i.pergunta_codigo === 'NOME')!;
    const etag = aberta.headers.get('etag')!;
    const r = await c.dig.patch(`/applications/${c.a3}/review`, { corpo: { itens: [{ item_id: nome.id, acao: 'corrigir', valor_final: ' maria souza ' }] }, headers: { 'if-match': etag } });
    expect(r.status, r.texto).toBe(200);
    expect((await consultar(c.dig, c.a3)).corpo.candidatos_nome).toEqual([expect.objectContaining({ respondente_id: c.r1.id })]);
  });
});

describe('CA-044 — assinatura anexada sem QR legível (DEC-183)', () => {
  let T: TenantPronto;
  let dig: Cliente;
  let projeto: string;
  let f: FormularioPublicado;

  beforeAll(async () => {
    T = await tenantComUsuaria(h, 'Tenant CA-044');
    dig = await entrar(h, T.usuaria);
    projeto = await projetoCriado(dig, 'Saúde Idoso');
    f = await formularioPublicado(dig, projeto, 'Saúde Geral', conteudoCondicoes());
  });

  async function semAssinatura(): Promise<string> {
    const r = await enviar(dig, projeto, await Promise.all(f.paginas.map(async (p) => arquivo(`p${p.numero}.jpg`, 'image/jpeg', await jpeg(p)))));
    const id: string = r.corpo.aplicacao_id;
    await localizarELer(h, id, {}, leiturasAntigas({ CPF: { valor: CPF_VALIDO, confianca: 0.97 } }));
    await confirmarPendentes(dig, id);
    const c = await concluir(dig, id, { assinatura: 'ausente' });
    expect(c.corpo.estado).toBe('sem_assinatura');
    return id;
  }

  function anexar(id: string, bytes: Buffer): Promise<Resposta> {
    return dig.enviarFormulario(`/applications/${id}/signature`, [['arquivo', arquivo('assinada.jpg', 'image/jpeg', bytes)], ['assinatura', 'presente']], { 'idempotency-key': chaveIdempotencia() });
  }

  // @trace CA-044, DEC-183
  it('exemplo 2: página 1 sem QR legível → concluida; nenhuma chamada de localização nem de leitura', async () => {
    const id = await semAssinatura();
    const loc = (await h.localizador.chamadas(id)).length;
    const lei = (await h.motor.chamadas(id)).length;
    const r = await anexar(id, await semQr(f.paginas[0]));
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'concluida', assinatura: 'presente' });
    await h.worker.processar();
    expect(await h.localizador.chamadas(id)).toHaveLength(loc);
    expect(await h.motor.chamadas(id)).toHaveLength(lei);
  });

  // @trace CA-044, ERR-004
  it('exemplo 3: página 2 com QR íntegro → ERR-004; permanece em sem_assinatura', async () => {
    const id = await semAssinatura();
    esperarErro(await anexar(id, await jpeg(f.paginas[1])), 'ERR-004');
    expect((await h.inspect.aplicacao(id)).estado).toBe('sem_assinatura');
  });
});
