// Conclusão da aplicação e vínculo do respondente pelo CPF (RF-005, RF-008, CA-002, CA-014,
// CA-014b, CA-021, CA-032, CA-044; FL-001 precedência na conclusão; DEC-020, DEC-064, DEC-079).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jpeg } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness, type RespondenteGravado, type RoteiroLeitura } from '../../support/harness.js';
import {
  abrir,
  comMotivo,
  concluida,
  concluir,
  confirmarPendentes,
  consultar,
  conteudoLeitura,
  CPF,
  enviarELer,
  item,
  leiturasCompletas,
  prepararCotacao,
  prontaParaConcluir,
  revisar,
  type AcaoRevisao,
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
  A = await tenantComUsuaria(h, 'Tenant A');
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

async function comCpf(cpf: string): Promise<RespondenteGravado[]> {
  return (await h.inspect.respondentes(A.tenantId)).filter((r) => r.cpf === cpf);
}

/**
 * Lê a aplicação com os campos de `baixos` em confiança 0,5 (a_revisar), confirma os demais itens
 * a revisar e aplica a cada campo de `acoes` a ação indicada.
 */
async function revisada(acoes: Record<string, AcaoRevisao['acao']>, extra: RoteiroLeitura = {}): Promise<string> {
  const baixos: RoteiroLeitura = {};
  const roteiro = leiturasCompletas(extra);
  for (const c of Object.keys(acoes)) {
    const lido = roteiro[c];
    baixos[c] = { valor: 'valor' in lido ? lido.valor : null, confianca: 0.5 };
  }
  const id = await enviarELer(h, dig, projeto, f, { ...roteiro, ...baixos });
  const aberta = await abrir(dig, id);
  expect(aberta.status, aberta.texto).toBe(200);
  const pend = (aberta.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar');
  const r = await revisar(
    dig,
    id,
    pend.map((i) => ({ item_id: i.id, acao: acoes[i.pergunta_codigo] ?? 'confirmar' })),
    aberta.headers.get('etag')!,
  );
  expect(r.status, r.texto).toBe(200);
  return id;
}

async function anexarAssinatura(id: string, bytes?: Buffer): Promise<Resposta> {
  const img = bytes ?? (await jpeg(f.paginas[0]));
  return dig.enviarFormulario(
    `/applications/${id}/signature`,
    [
      ['arquivo', arquivo('p1-assinada.jpg', 'image/jpeg', img)],
      ['assinatura', 'presente'],
    ],
    { 'idempotency-key': chaveIdempotencia() },
  );
}

describe('CA-032 — campos obrigatórios bloqueiam a conclusão (DEC-020, DEC-079)', () => {
  // @trace CA-032, ERR-006, DEC-020, DEC-079, FL-001
  it.each([
    ['exemplo 1: local vazio', { LOCAL_APLICACAO: 'em_branco' }],
    ['exemplo 2: data vazia', { DATA_APLICACAO: 'em_branco' }],
    ['exemplo 4: nome vazio', { NOME: 'em_branco' }],
    ['nome ilegível', { NOME: 'ilegivel' }],
    ['data de nascimento rasurada', { DATA_NASCIMENTO: 'rasurado' }],
    ['local marcado como não se aplica', { LOCAL_APLICACAO: 'nao_se_aplica' }],
  ] as const)('%s → 400 ERR-006; nada é gravado e a aplicação fica em em_revisao', async (_n, acoes) => {
    const id = await revisada(acoes);
    const antes = (await consultar(dig, id)).corpo;
    esperarErro(await concluir(dig, id), 'ERR-006');
    const depois = (await consultar(dig, id)).corpo;
    expect(depois.estado).toBe('em_revisao');
    expect(depois.itens).toEqual(antes.itens);
    expect(await comCpf(CPF.joana)).toHaveLength(0);
  });

  // @trace CA-032, CA-002, ERR-006, FL-001
  it.each([
    ['exemplo 3: CPF vazio', { CPF: 'em_branco' }, {}],
    ['CPF ilegível', { CPF: 'ilegivel' }, {}],
    ['CPF rasurado', { CPF: 'rasurado' }, {}],
    ['CPF confirmado com dígitos inválidos', {}, { CPF: { valor: CPF.invalido, confianca: 0.97 } }],
  ] as const)('%s → 200 com aviso ERR-006 e estado aguardando_cpf, sem vínculo', async (_n, acoes, extra) => {
    const id = await revisada(acoes as Record<string, AcaoRevisao['acao']>, extra as RoteiroLeitura);
    const r = await concluir(dig, id);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'aguardando_cpf', aviso: 'ERR-006' });
    expect((await h.inspect.aplicacao(id)).respondente_id).toBeNull();
  });

  // @trace FL-001, ERR-006, ERR-022
  it('precedência: item a_revisar (ERR-022) vem antes do CPF ausente, que vem antes do local vazio', async () => {
    const naoResolvido = await enviarELer(h, dig, projeto, f, leiturasCompletas({ ESTADO_CIVIL: { valor: 'casado', confianca: 0.5 } }));
    const aberta = await abrir(dig, naoResolvido);
    const resto = (aberta.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar' && i.pergunta_codigo !== 'ESTADO_CIVIL');
    await revisar(
      dig,
      naoResolvido,
      resto.map((i) => ({ item_id: i.id, acao: i.pergunta_codigo === 'LOCAL_APLICACAO' ? 'em_branco' : 'confirmar' })),
      aberta.headers.get('etag')!,
    );
    esperarErro(await concluir(dig, naoResolvido), 'ERR-022');

    const cpfELocal = await revisada({ CPF: 'em_branco', LOCAL_APLICACAO: 'em_branco' });
    const r = await concluir(dig, cpfELocal);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'aguardando_cpf', aviso: 'ERR-006' });
  });

  // @trace CA-032, RN-016, DEC-020
  it('exemplo 5: tudo informado e assinatura presente → concluida, com data e local gravados na aplicação', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: CPF.novo, confianca: 0.97 } });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'concluida', data_aplicacao: '2026-10-30', local_aplicacao: 'UBS Centro' });
  });
});

describe('CA-002 / CA-014 / CA-014b — vínculo pelo CPF (RN-015)', () => {
  let maria: RespondenteGravado;

  // @trace CA-014b, RF-005, RN-015, RN-011
  it('CPF novo e válido → cria o respondente com os dados lidos do formulário e audita a criação', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: CPF.maria, confianca: 0.97 } });
    const criados = await comCpf(CPF.maria);
    expect(criados).toHaveLength(1);
    maria = criados[0];
    expect(maria).toMatchObject({ nome: 'Maria Silva', data_nascimento: '1950-01-01', anonimizado: false });
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(maria.id);
    expect(await h.inspect.auditoria(A.tenantId)).toContainEqual(expect.objectContaining({ registro_id: maria.id, usuario_id: A.usuaria.usuarioId }));
  });

  // @trace CA-002, CA-014, RN-015, RN-013, ERR-001
  it('exemplo 1: CPF lido "123.456.789-09" com nome divergente → vincula ao existente, sem respondente novo; a usuária escolhe o nome', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: '123.456.789-09', confianca: 0.97 }, NOME: { valor: 'Maria da Silva', confianca: 0.97 } });
    const app = (await abrir(dig, id)).corpo;
    expect(app.divergencias_cadastro).toEqual(['nome']);
    expect(app.cadastro_existente).toMatchObject({ nome: 'Maria Silva' });
    expect(JSON.stringify(app.cadastro_existente)).not.toContain(CPF.maria);

    esperarErro(await concluir(dig, id), 'ERR-001'); // manter_cadastro obrigatório para cada divergência
    const r = await concluir(dig, id, { assinatura: 'presente', manter_cadastro: { nome: 'existente' } });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('concluida');
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(maria.id);
    const mesmos = await comCpf(CPF.maria);
    expect(mesmos).toHaveLength(1);
    expect(mesmos[0].nome).toBe('Maria Silva');
    const div = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.campo === 'nome' && (e.registro_id === id || e.registro_id === maria.id));
    expect(div.length).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(div)).not.toContain('Maria');
  });

  // @trace CA-002, CA-014, RN-015
  it('exemplo 2: CPF sem máscara, mesmo resultado; escolhendo o valor da aplicação, o cadastro passa a ter o nome lido', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: CPF.maria, confianca: 0.97 }, NOME: { valor: 'Maria da Silva', confianca: 0.97 } });
    const r = await concluir(dig, id, { assinatura: 'presente', manter_cadastro: { nome: 'aplicacao' } });
    expect(r.status, r.texto).toBe(200);
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(maria.id);
    const mesmos = await comCpf(CPF.maria);
    expect(mesmos).toHaveLength(1);
    expect(mesmos[0].nome).toBe('Maria da Silva');
  });

  // @trace CA-002, ERR-006, RN-012
  it('exemplo 3: CPF "123.456.789-00" (inválido) → sucesso com aviso ERR-006, aguardando_cpf e nenhum vínculo', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: '123.456.789-00', confianca: 0.97 } });
    const r = await concluir(dig, id);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'aguardando_cpf', aviso: 'ERR-006' });
    expect((await h.inspect.aplicacao(id)).respondente_id).toBeNull();
    expect(await comCpf(CPF.invalido)).toHaveLength(0);
  });
});

describe('CA-021 / CA-044 — assinatura ausente e anexada depois (DEC-006, DEC-064, RN-044)', () => {
  // @trace CA-021, DEC-064, FL-001, RN-044
  it('assinatura ausente → sem_assinatura; o respondente não é criado nem vinculado', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: CPF.outro, confianca: 0.97 } });
    const r = await concluir(dig, id, { assinatura: 'ausente' });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'sem_assinatura', assinatura: 'ausente' });
    expect((await h.inspect.aplicacao(id)).respondente_id).toBeNull();
    expect(await comCpf(CPF.outro)).toHaveLength(0);
  });

  // @trace CA-044, RN-044, DEC-064, FL-001
  it('página 1 assinada anexada → concluida, sem reler os outros campos; a página original é mantida e o respondente vinculado', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: CPF.terceiro, confianca: 0.97 } });
    expect((await concluir(dig, id, { assinatura: 'ausente' })).corpo.estado).toBe('sem_assinatura');
    const chamadas = (await h.motor.chamadas(id)).length;

    const r = await anexarAssinatura(id);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'concluida', assinatura: 'presente' });
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(chamadas);
    const paginas = r.corpo.paginas as { tipo: string; numero_pagina: number | null }[];
    expect(paginas.filter((p) => p.tipo === 'assinatura')).toHaveLength(1);
    expect(paginas.filter((p) => p.tipo === 'formulario' && p.numero_pagina === 1)).toHaveLength(1);
    const [resp] = await comCpf(CPF.terceiro);
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(resp.id);
  });

  // @trace CA-044, ERR-018
  it('attachSignaturePage fora de sem_assinatura → 409 ERR-018', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f);
    esperarErro(await anexarAssinatura(id), 'ERR-018');
  });

  // @trace FL-001, CA-044
  it('sem_assinatura por engano: reabrir corrige a conferência e volta a em_revisao preservando os itens', async () => {
    const id = await prontaParaConcluir(h, dig, projeto, f);
    expect((await concluir(dig, id, { assinatura: 'ausente' })).corpo.estado).toBe('sem_assinatura');
    const antes = (await consultar(dig, id)).corpo.itens;
    const r = await dig.post(`/applications/${id}/reopen`, comMotivo('Assinatura estava no verso'));
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('em_revisao');
    expect((await consultar(dig, id)).corpo.itens).toEqual(antes);
  });

  // @trace CA-044, CA-014, DEC-064, FL-001
  it('o manter_cadastro gravado na conclusão sem assinatura é aplicado só quando a assinatura chega', async () => {
    const cpf = CPF.ana;
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Ana Souza', confianca: 0.97 } });
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Ana de Souza', confianca: 0.97 } });
    await abrir(dig, id);
    const r = await concluir(dig, id, { assinatura: 'ausente', manter_cadastro: { nome: 'aplicacao' } });
    expect(r.corpo.estado).toBe('sem_assinatura');
    expect((await comCpf(cpf))[0].nome).toBe('Ana Souza');

    expect((await anexarAssinatura(id)).corpo.estado).toBe('concluida');
    expect((await comCpf(cpf))[0].nome).toBe('Ana de Souza');
  });

  // @trace CA-044, FL-001, ERR-018
  it('se o cadastro mudou desde a conclusão, a assinatura anexada devolve a aplicação a em_revisao com aviso ERR-018', async () => {
    const cpf = CPF.rosa;
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Rosa Lima', confianca: 0.97 } });
    const x = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Rosa Maria Lima', confianca: 0.97 } });
    await abrir(dig, x);
    expect((await concluir(dig, x, { assinatura: 'ausente', manter_cadastro: { nome: 'existente' } })).corpo.estado).toBe('sem_assinatura');

    // Outra aplicação do mesmo CPF muda o nome do cadastro.
    const y = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Rosa Maria Lima', confianca: 0.97 } });
    await abrir(dig, y);
    expect((await concluir(dig, y, { assinatura: 'presente', manter_cadastro: { nome: 'aplicacao' } })).corpo.estado).toBe('concluida');

    const r = await anexarAssinatura(x);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'em_revisao', aviso: 'ERR-018' });
    expect(r.corpo.paginas.filter((p: { tipo: string }) => p.tipo === 'assinatura')).toHaveLength(1);
  });
});

describe('Itens pendentes e conclusão', () => {
  // @trace FL-002, ERR-022, TS-003
  it('item em aguardando_condicao impede a conclusão (ERR-022)', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ CPF: { valor: CPF.pendente, confianca: 0.97 }, USA_MEDICAMENTO: { valor: 'sim', confianca: 0.5 } }));
    const aberta = await abrir(dig, id);
    expect(item(aberta.corpo, 'QUAIS_MEDICAMENTOS').estado).toBe('aguardando_condicao');
    const outros = (aberta.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar' && i.pergunta_codigo !== 'USA_MEDICAMENTO');
    await revisar(dig, id, outros.map((i) => ({ item_id: i.id, acao: 'confirmar' })), aberta.headers.get('etag')!);
    esperarErro(await concluir(dig, id), 'ERR-022');
    await confirmarPendentes(dig, id);
    expect((await concluir(dig, id)).corpo.estado).toBe('concluida');
  });
});
