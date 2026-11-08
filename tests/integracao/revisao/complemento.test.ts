// Opção "Outro" com complemento (RF-014, US-013, CA-059; RN-009, RN-047, RN-049, RN-051, FL-002 pré-regra
// 1b; DEC-197, DEC-199 a DEC-205, DEC-209, DEC-212). O texto escrito ao lado da opção é um item de
// resposta próprio, ligado à opção (`opcao_codigo`), lido no mesmo recorte da pergunta pelo motor
// simulado (DEC-203 (3)), revisado como os demais e exportado na coluna `Complemento` (DEC-201).
// O exemplo 12 (ficha individual) é do IMP-004.
//
// Cada exemplo tem a sua aplicação, com nome e CPF sintéticos próprios, no projeto "Saúde 60+". O
// limite de confiança do tenant é 0,90, como no "Dado" do CA-059.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jpeg, luminancias, lerPdf, pdfDeImagens } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { MINUTO, entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { COL, exportada, linhas } from '../../support/exportacao.js';
import {
  arquivo,
  caminhoVersao,
  criarFormulario,
  enviar,
  formularioPublicado,
  projetoCriado,
  publicar,
  salvarConteudo,
  type Conteudo,
  type FormularioPublicado,
  type Pergunta,
} from '../../support/formularios.js';
import { criarHarness, type Harness, type LeituraOk, type RoteiroLeitura } from '../../support/harness.js';
import { importarEProcessar, lida as extraida, porCodigo, versaoImportada } from '../../support/importacao.js';
import { abrir, calibrarConfianca, comMotivo, concluir, consultar, prepararCotacao, revisar, semIdentificadores, type AcaoRevisao, type ItemRevisao } from '../../support/leitura.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;
let saude: string;
/** Versão do "Dado": MOTIVO_CONSULTA e DOENCAS, com complemento em `outros` e em `outra`. */
let f: FormularioPublicado;
/** Versão dos exemplos 4e e 6e: CONSULTOU antes de MOTIVO_CONSULTA, com a regra de salto. */
let fSalto: FormularioPublicado;

type Item = ItemRevisao & { opcao_codigo?: string | null };

// ── conteúdo ──

function q(p: Omit<Pergunta, 'ordem'>, ordem: number): Pergunta {
  return { ...p, ordem } as Pergunta;
}

const RN050: Omit<Pergunta, 'ordem'>[] = [
  { codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', pagina: 1, campo_respondente: 'nome' },
  { codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 1, campo_respondente: 'data_nascimento' },
  { codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 1, campo_respondente: 'cpf' },
  { codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 1, campo_aplicacao: 'data_aplicacao' },
  { codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', pagina: 1, campo_aplicacao: 'local_aplicacao' },
];

const MOTIVO: Omit<Pergunta, 'ordem'> = {
  codigo: 'MOTIVO_CONSULTA',
  tipo: 'escolha_unica',
  enunciado: 'Motivo da última consulta',
  pagina: 2,
  opcoes: [
    { codigo: 'rotina', rotulo: 'Rotina', ordem: 1 },
    { codigo: 'dor', rotulo: 'Dor', ordem: 2 },
    { codigo: 'outros', rotulo: 'Outros', ordem: 3, com_complemento: true },
  ],
};

const DOENCAS: Omit<Pergunta, 'ordem'> = {
  codigo: 'DOENCAS',
  tipo: 'multipla_escolha',
  enunciado: 'Tem alguma destas doenças?',
  pagina: 2,
  opcoes: [
    { codigo: 'diabetes', rotulo: 'Diabetes', ordem: 1 },
    { codigo: 'outra', rotulo: 'Outra', ordem: 2, com_complemento: true },
    { codigo: 'nenhuma_das_anteriores', rotulo: 'Nenhuma das anteriores', ordem: 3 },
  ],
};

const CONSULTOU: Omit<Pergunta, 'ordem'> = { codigo: 'CONSULTOU', tipo: 'sim_nao', enunciado: 'Consultou um médico este ano?', pagina: 2 };
const FUMA: Omit<Pergunta, 'ordem'> = { codigo: 'FUMA', tipo: 'sim_nao', enunciado: 'Você fuma?', pagina: 2 };
const SATISFACAO_COM: Omit<Pergunta, 'ordem'> = {
  codigo: 'SATISFACAO_COM',
  tipo: 'matriz',
  enunciado: 'Como avalia a sua satisfação com',
  pagina: 2,
  linhas: [
    { codigo: 'moradia', rotulo: 'Moradia', ordem: 1 },
    { codigo: 'saude', rotulo: 'Saúde', ordem: 2 },
  ],
  opcoes: [
    { codigo: 'boa', rotulo: 'Boa', ordem: 1 },
    { codigo: 'ruim', rotulo: 'Ruim', ordem: 2 },
  ],
};

function conteudo(perguntas: Omit<Pergunta, 'ordem'>[], regras_salto: Conteudo['regras_salto'] = []): Conteudo {
  return { perguntas: structuredClone([...RN050, ...perguntas]).map((p, i) => q(p, i + 1)), regras_salto };
}

const conteudoDado = () => conteudo([MOTIVO, DOENCAS]);
// "CONSULTOU = nao → pula MOTIVO_CONSULTA": MOTIVO_CONSULTA só aparece com CONSULTOU = sim.
const conteudoSalto = () => conteudo([CONSULTOU, MOTIVO, DOENCAS], [{ pergunta_origem_codigo: 'CONSULTOU', pergunta_destino_codigo: 'MOTIVO_CONSULTA', opcao_codigo: 'sim' }]);
const conteudoRascunho = () => conteudo([MOTIVO, DOENCAS, FUMA, SATISFACAO_COM]);

/** Opção da pergunta, pelo código. */
function opcao(p: Pergunta, codigo: string): Record<string, unknown> {
  const o = (p.opcoes as Record<string, unknown>[]).find((x) => x.codigo === codigo);
  expect(o, `opção ${codigo}`).toBeTruthy();
  return o!;
}

// ── respondentes sintéticos ──

/** CPF com dígitos verificadores válidos a partir de 9 dígitos. */
function cpfValido(base: string): string {
  const d = base.split('').map(Number);
  for (const n of [9, 10]) {
    const soma = d.slice(0, n).reduce((s, x, i) => s + x * (n + 1 - i), 0);
    const r = soma % 11;
    d.push(r < 2 ? 0 : 11 - r);
  }
  return d.join('');
}

let sequencia = 0;

/** Leitura confiante dos campos da RN-050 (nome e CPF próprios) e de DOENCAS = diabetes; `extra` por cima. */
function roteiro(extra: RoteiroLeitura = {}): RoteiroLeitura {
  sequencia++;
  const alta = (valor: string) => ({ valor, confianca: 0.97 });
  return {
    NOME: alta(`Pessoa Fictícia ${sequencia}`),
    DATA_NASCIMENTO: alta('1950-03-10'),
    CPF: alta(cpfValido(String(310_000_000 + sequencia * 7))),
    DATA_APLICACAO: alta('2026-11-01'),
    LOCAL_APLICACAO: alta('UBS Centro'),
    DOENCAS: alta('diabetes'),
    ...extra,
  };
}

/** MOTIVO_CONSULTA lida com `valor` e o complemento de `outros` (`undefined` = não programado: em branco, 0,99). */
function motivo(valor: string | null, confianca: number, comp?: { valor: string | null; confianca: number } | null): RoteiroLeitura {
  const l: LeituraOk = { valor, confianca };
  if (comp !== undefined) l.complementos = { outros: comp };
  return { MOTIVO_CONSULTA: l };
}

// ── fluxo ──

/** Envia as 2 páginas num PDF, programa o motor e roda o worker; devolve o id da aplicação. */
async function lerAplicacao(extra: RoteiroLeitura, form = f): Promise<string> {
  const pdf = await pdfDeImagens(await Promise.all([0, 1].map((i) => jpeg(form.paginas[i]))));
  const r = await enviar(c, saude, [arquivo(`pessoa-${sequencia + 1}.pdf`, 'application/pdf', pdf)]);
  expect(r.status, r.texto).toBe(202);
  const id: string = r.corpo.aplicacao_id;
  h.motor.programar(id, roteiro(extra));
  await h.worker.processar();
  return id;
}

async function itens(id: string): Promise<Item[]> {
  return (await consultar(c, id)).corpo.itens as Item[];
}

function daPergunta(lista: Item[], codigo: string): Item {
  const achado = lista.filter((i) => i.pergunta_codigo === codigo && !i.opcao_codigo && !i.linha_codigo);
  expect(achado, `item da pergunta ${codigo}`).toHaveLength(1);
  return achado[0];
}

function doComplemento(lista: Item[], codigo: string, opcaoCodigo: string): Item {
  const achado = lista.filter((i) => i.pergunta_codigo === codigo && i.opcao_codigo === opcaoCodigo);
  expect(achado, `complemento ${codigo}.${opcaoCodigo}`).toHaveLength(1);
  return achado[0];
}

const perg = async (id: string) => daPergunta(await itens(id), 'MOTIVO_CONSULTA');
const comp = async (id: string) => doComplemento(await itens(id), 'MOTIVO_CONSULTA', 'outros');

/** Item gravado no banco (inspect), com `revisor_id` e `revisao_reaberta`. */
async function gravado(id: string, codigo: string, opcaoCodigo: string | null) {
  const achado = (await h.inspect.aplicacao(id)).itens.filter((i) => i.pergunta_codigo === codigo && i.opcao_codigo === opcaoCodigo && i.linha_codigo === null);
  expect(achado, `${codigo}.${opcaoCodigo}`).toHaveLength(1);
  return achado[0];
}

/** Uma ação de revisão sobre um item. */
async function acao(id: string, alvo: Item, a: AcaoRevisao['acao'], valor_final?: string): Promise<Resposta> {
  return revisar(c, id, [{ item_id: alvo.id, acao: a, ...(valor_final === undefined ? {} : { valor_final }) }]);
}

async function acaoOk(id: string, alvo: Item, a: AcaoRevisao['acao'], valor_final?: string): Promise<void> {
  const r = await acao(id, alvo, a, valor_final);
  expect(r.status, r.texto).toBe(200);
}

/**
 * Abre a revisão e resolve todo item `a_revisar` que não é de MOTIVO_CONSULTA (nem o seu complemento):
 * confirma o lido, ou marca em branco o lido em branco (DEC-128).
 */
async function resolverDemais(id: string): Promise<void> {
  let atual = await abrir(c, id);
  expect(atual.status, atual.texto).toBe(200);
  for (let rodada = 0; rodada < 4; rodada++) {
    const pendentes = (atual.corpo.itens as Item[]).filter((i) => i.estado === 'a_revisar' && i.pergunta_codigo !== 'MOTIVO_CONSULTA');
    if (pendentes.length === 0) return;
    atual = await revisar(c, id, pendentes.map((i) => ({ item_id: i.id, acao: i.valor_ia === null ? 'em_branco' : 'confirmar' })), atual.headers.get('etag') ?? undefined);
    expect(atual.status, atual.texto).toBe(200);
  }
  throw new Error('itens a revisar não se resolveram');
}

async function concluida(id: string): Promise<void> {
  await resolverDemais(id);
  const r = await concluir(c, id);
  expect(r.status, r.texto).toBe(200);
  expect(r.corpo.estado).toBe('concluida');
}

async function reaberta(id: string): Promise<void> {
  const r = await c.post(`/applications/${id}/reopen`, comMotivo('Conferir de novo o papel'));
  expect(r.status, r.texto).toBe(200);
  expect((await abrir(c, id)).status).toBe(200);
}

/** Linhas exportadas (`linha_por_item`) da aplicação, a partir de `Codigo_Pergunta`. */
async function exportadas(id: string): Promise<string[][]> {
  const l = linhas(await exportada(h, c, { formato: 'xlsx', escopo: 'linha_por_item', projeto_ids: [saude] }), 'xlsx');
  return l.slice(1).filter((x) => x[COL.ID_Aplicacao] === id).map((x) => x.slice(COL.Codigo_Pergunta));
}

function linhasDe(l: string[][], codigo: string): string[][] {
  return l.filter((x) => x[0] === codigo);
}

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  T = await tenantComUsuaria(h, 'Tenant Complemento');
  await calibrarConfianca(h, T.tenantId);
  c = await entrar(h, T.usuaria);
  saude = await projetoCriado(c, 'Saúde 60+');
  f = await formularioPublicado(c, saude, 'Saúde 60+', conteudoDado());
  fSalto = await formularioPublicado(c, saude, 'Saúde 60+ com salto', conteudoSalto());
});
// Uma só usuária faz todas as requisições: avançar o relógio evita o limite de 100 por minuto (Bloco P P.7).
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

describe('CA-059 — leitura do complemento (pré-regra 1b)', () => {
  // @trace CA-059, RF-014, RN-009, DEC-197, DEC-200, DEC-201, DEC-203
  it('exemplo 1: `outros` (0,95) e "Maternidade" (0,95) → complemento confirmado_automaticamente; Complemento "Maternidade" na linha de `outros`', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Maternidade', confianca: 0.95 }));
    const lista = await itens(id);
    expect(daPergunta(lista, 'MOTIVO_CONSULTA')).toMatchObject({ estado: 'confirmado_automaticamente', valor_ia: 'outros' });
    expect(doComplemento(lista, 'MOTIVO_CONSULTA', 'outros')).toMatchObject({ estado: 'confirmado_automaticamente', valor_ia: 'Maternidade', confianca: 0.95 });
    // Um item de complemento por opção com complemento, e só para elas (DEC-203 (2)).
    expect(lista.filter((i) => i.opcao_codigo).map((i) => `${i.pergunta_codigo}.${i.opcao_codigo}`).sort()).toEqual(['DOENCAS.outra', 'MOTIVO_CONSULTA.outros']);
    expect(await gravado(id, 'MOTIVO_CONSULTA', 'outros')).toMatchObject({ revisor_id: null, revisao_reaberta: false });

    await concluida(id);
    const l = await exportadas(id);
    expect(linhasDe(l, 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', 'Maternidade', 'respondida']]);
    expect(linhasDe(l, 'DOENCAS')).toEqual([['DOENCAS', '', 'diabetes', 'Diabetes', '', 'respondida']]);
  });

  // @trace CA-059, DEC-197, DEC-203, RN-045, RN-038
  it('o complemento é lido na mesma chamada da pergunta, sem chamada nem recorte próprios', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Maternidade', confianca: 0.95 }));
    const chamadas = await h.motor.chamadas(id);
    const comMotivo = chamadas.filter((x) => x.campos.includes('MOTIVO_CONSULTA'));
    expect(comMotivo).toHaveLength(1);
    expect(comMotivo[0].schema).toContain('outros');
    expect(chamadas.flatMap((x) => x.campos).filter((k) => k.startsWith('MOTIVO_CONSULTA'))).toEqual(['MOTIVO_CONSULTA']);
  });

  // @trace CA-059, RN-045, DEC-203
  it('getItemImage do complemento devolve o recorte da região da sua pergunta', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Maternidade', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    const imgPergunta = await c.get(`/applications/${id}/items/${(await perg(id)).id}/image`);
    const imgComp = await c.get(`/applications/${id}/items/${(await comp(id)).id}/image`);
    expect(imgComp.status, imgComp.texto).toBe(200);
    expect(imgComp.corpo.regiao).not.toBeNull();
    expect(imgComp.corpo.regiao).toEqual(imgPergunta.corpo.regiao);
  });

  // @trace CA-059, FL-002, DEC-203
  it('exemplo 1a: a resposta da leitura não traz o complemento → a_revisar (1b, c), sem valor lido', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, null));
    expect(await perg(id)).toMatchObject({ estado: 'confirmado_automaticamente' });
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: null });
  });

  // @trace CA-059, FL-002, DEC-200, CA-008
  it('exemplo 2: "Matrnidade" (0,60) → a_revisar; corrigido para "Maternidade" → corrigido, exportado; a correção é auditada sem o texto', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Matrnidade', confianca: 0.6 }));
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: 'Matrnidade' });
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'corrigir', 'Maternidade');
    expect(await comp(id)).toMatchObject({ estado: 'corrigido', valor_final: 'Maternidade' });
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisor_id).toBe(T.usuaria.usuarioId);

    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', 'Maternidade', 'respondida']]);
    const texto = semIdentificadores(JSON.stringify(await h.inspect.auditoria(T.tenantId)) + (await h.inspect.logs()));
    for (const lido of ['Matrnidade', 'Maternidade']) expect(texto).not.toContain(lido);
  });

  // @trace CA-059, FL-002, DEC-074, DEC-199
  it('exemplo 3: nada escrito ao lado → a_revisar (6a); marcado em branco → em_branco; a aplicação conclui com Complemento vazio', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: null, confianca: 0.99 }));
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: null });
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'em_branco');
    expect((await comp(id)).estado).toBe('em_branco');
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', '', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-205, ERR-001
  it('exemplo 4: `dor` com "joelho" ao lado de "Outros" → a_revisar como inconsistência; `corrigir` recusado com ERR-001; nao_se_aplica aceito', async () => {
    const id = await lerAplicacao(motivo('dor', 0.95, { valor: 'joelho', confianca: 0.95 }));
    expect(await perg(id)).toMatchObject({ estado: 'confirmado_automaticamente', valor_ia: 'dor' });
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: 'joelho' });
    expect((await abrir(c, id)).status).toBe(200);
    for (const a of ['corrigir', 'confirmar', 'em_branco', 'ilegivel', 'rasurado'] as const) {
      esperarErro(await acao(id, await comp(id), a, a === 'corrigir' ? 'joelho' : undefined), 'ERR-001');
      expect((await comp(id)).estado, a).toBe('a_revisar');
    }
    await acaoOk(id, await comp(id), 'nao_se_aplica');
    expect((await comp(id)).estado).toBe('nao_se_aplica');
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'dor', 'Dor', '', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-205
  it('exemplo 4a: `dor` e nada escrito ao lado de "Outros" → complemento nao_se_aplica (1b, b) já na leitura', async () => {
    const id = await lerAplicacao(motivo('dor', 0.95));
    expect(await comp(id)).toMatchObject({ estado: 'nao_se_aplica' });
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisor_id).toBeNull();
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'dor', 'Dor', '', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-209
  it.each(['em_branco', 'ilegivel', 'rasurado', 'nao_se_aplica'] as const)(
    'exemplo 4b: `dor` (0,70) com "joelho" → aguardando_condicao; a usuária marca a pergunta %s → nao_se_aplica, "joelho" só em valor_ia',
    async (marca) => {
      const id = await lerAplicacao(motivo('dor', 0.7, { valor: 'joelho', confianca: 0.95 }));
      expect((await perg(id)).estado).toBe('a_revisar');
      expect((await comp(id)).estado).toBe('aguardando_condicao');
      expect((await abrir(c, id)).status).toBe(200);
      await acaoOk(id, await perg(id), marca);
      expect((await comp(id)).estado).toBe('nao_se_aplica');
      expect(await gravado(id, 'MOTIVO_CONSULTA', 'outros')).toMatchObject({ valor_ia: 'joelho', valor_final: null, estado: 'nao_se_aplica' });
      await concluida(id);
      expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', '', '', '', marca]]);
    },
  );

  // @trace CA-059, FL-001, ERR-022
  it('exemplo 4c: complemento a_revisar (caso 7) com as outras perguntas resolvidas → confirmApplication recusada com ERR-022; ele continua a_revisar', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'a'.repeat(201), confianca: 0.95 }));
    await resolverDemais(id);
    expect((await itens(id)).filter((i) => ['a_revisar', 'aguardando_condicao', 'pendente_leitura'].includes(i.estado)).map((i) => i.opcao_codigo)).toEqual(['outros']);
    esperarErro(await concluir(c, id), 'ERR-022');
    expect((await comp(id)).estado).toBe('a_revisar');
    expect((await consultar(c, id)).corpo.estado).toBe('em_revisao');
  });

  // @trace CA-059, FL-002, DEC-212
  it('exemplo 4d: caso 4 (nao_se_aplica pela usuária); `confirmar` de novo em MOTIVO_CONSULTA, ainda `dor` → permanece nao_se_aplica', async () => {
    const id = await lerAplicacao(motivo('dor', 0.95, { valor: 'joelho', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'nao_se_aplica');
    await acaoOk(id, await perg(id), 'confirmar');
    expect(await perg(id)).toMatchObject({ estado: 'confirmado', valor_final: 'dor' });
    expect((await comp(id)).estado).toBe('nao_se_aplica');
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'dor', 'Dor', '', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-209, DEC-203
  it('exemplo 4e: CONSULTOU `nao` e "joelho" ao lado de "Outros" sem marcação → MOTIVO_CONSULTA nao_se_aplica pelo salto (revisor nulo); complemento a_revisar', async () => {
    const id = await lerAplicacao({ CONSULTOU: { valor: 'nao', confianca: 0.95 }, ...motivo(null, 0.99, { valor: 'joelho', confianca: 0.95 }) }, fSalto);
    expect((await perg(id)).estado).toBe('nao_se_aplica');
    expect((await gravado(id, 'MOTIVO_CONSULTA', null)).revisor_id).toBeNull();
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: 'joelho' });
  });

  // @trace CA-059, FL-002, DEC-200
  it('exemplo 5: `outros` (0,70) → complemento aguardando_condicao; a usuária confirma `outros` → confirmado_automaticamente', async () => {
    const id = await lerAplicacao(motivo('outros', 0.7, { valor: 'Maternidade', confianca: 0.95 }));
    expect((await comp(id)).estado).toBe('aguardando_condicao');
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await perg(id), 'confirmar');
    expect((await comp(id)).estado).toBe('confirmado_automaticamente');
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisor_id).toBeNull();
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', 'Maternidade', 'respondida']]);
  });

  // @trace CA-059, FL-002, ERR-018
  it('exemplo 13: caso 5, saveReview só do complemento com MOTIVO_CONSULTA a_revisar → ERR-018; ele continua aguardando_condicao', async () => {
    const id = await lerAplicacao(motivo('outros', 0.7, { valor: 'Maternidade', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    for (const a of ['confirmar', 'corrigir', 'nao_se_aplica'] as const) {
      esperarErro(await acao(id, await comp(id), a, a === 'corrigir' ? 'Maternidade' : undefined), 'ERR-018');
      expect((await comp(id)).estado, a).toBe('aguardando_condicao');
    }
  });

  // @trace CA-059, FL-002, DEC-209
  it('exemplo 6: `outros` confirmado e depois corrigido para `rotina` → complemento confirmado_automaticamente, depois nao_se_aplica, "Maternidade" só em valor_ia', async () => {
    const id = await lerAplicacao(motivo('outros', 0.8, { valor: 'Maternidade', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await perg(id), 'confirmar');
    expect((await comp(id)).estado).toBe('confirmado_automaticamente');
    await acaoOk(id, await perg(id), 'corrigir', 'rotina');
    expect((await comp(id)).estado).toBe('nao_se_aplica');
    expect(await gravado(id, 'MOTIVO_CONSULTA', 'outros')).toMatchObject({ valor_ia: 'Maternidade', valor_final: null });
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'rotina', 'Rotina', '', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-204
  it('exemplo 6a: caso 2 (corrigido); `confirmar` de novo em MOTIVO_CONSULTA, ainda `outros` → permanece corrigido, "Maternidade"', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Matrnidade', confianca: 0.6 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'corrigir', 'Maternidade');
    await acaoOk(id, await perg(id), 'confirmar');
    expect(await comp(id)).toMatchObject({ estado: 'corrigido', valor_final: 'Maternidade' });
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', 'Maternidade', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-203, DEC-204
  it('exemplo 6b: caso 1 concluído e reaberto → complemento a_revisar com "Maternidade" preservado; continua a_revisar depois da confirmação da pergunta', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Maternidade', confianca: 0.95 }));
    await concluida(id);
    await reaberta(id);
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_final: 'Maternidade' });
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisao_reaberta).toBe(true);

    await acaoOk(id, await perg(id), 'confirmar');
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_final: 'Maternidade' });
    esperarErro(await concluir(c, id), 'ERR-022');

    await acaoOk(id, await comp(id), 'confirmar');
    expect((await comp(id)).estado).toBe('confirmado');
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisao_reaberta).toBe(false);
  });

  // @trace CA-059, FL-002, DEC-205, DEC-209
  it('exemplo 6c: caso 4 (nao_se_aplica pela DEC-205) concluído e reaberto → complemento a_revisar de novo', async () => {
    const id = await lerAplicacao(motivo('dor', 0.95, { valor: 'joelho', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'nao_se_aplica');
    await concluida(id);
    await reaberta(id);
    expect((await comp(id)).estado).toBe('a_revisar');
  });

  // @trace CA-059, FL-002, DEC-203
  it('exemplo 6d: num só saveReview, a pergunta corrigida para `outros` e o complemento para "Maternidade" → a pergunta vem primeiro; complemento corrigido', async () => {
    const id = await lerAplicacao(motivo('dor', 0.7, { valor: 'Maternidade', confianca: 0.95 }));
    expect((await comp(id)).estado).toBe('aguardando_condicao');
    expect((await abrir(c, id)).status).toBe(200);
    // O complemento vai primeiro na lista: a ordem de aplicação é a da regra, não a do pedido.
    const r = await revisar(c, id, [
      { item_id: (await comp(id)).id, acao: 'corrigir', valor_final: 'Maternidade' },
      { item_id: (await perg(id)).id, acao: 'corrigir', valor_final: 'outros' },
    ]);
    expect(r.status, r.texto).toBe(200);
    expect(await perg(id)).toMatchObject({ estado: 'corrigido', valor_final: 'outros' });
    expect(await comp(id)).toMatchObject({ estado: 'corrigido', valor_final: 'Maternidade' });
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'MOTIVO_CONSULTA')).toEqual([['MOTIVO_CONSULTA', '', 'outros', 'Outros', 'Maternidade', 'respondida']]);
  });

  // @trace CA-059, FL-002, DEC-209
  it('exemplo 6e: caso 4b (pergunta em_branco pela usuária) concluído e reaberto → o complemento permanece nao_se_aplica', async () => {
    const id = await lerAplicacao(motivo('dor', 0.7, { valor: 'joelho', confianca: 0.95 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await perg(id), 'em_branco');
    await concluida(id);
    await reaberta(id);
    expect((await comp(id)).estado).toBe('nao_se_aplica');
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisao_reaberta).toBe(false);
  });

  // @trace CA-059, FL-002, REQ §5.4, ERR-001
  it('exemplo 7: texto com 201 caracteres → a_revisar (regra 7); `corrigir` com 201 recusado com ERR-001, com 200 aceito', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'a'.repeat(201), confianca: 0.95 }));
    expect(await comp(id)).toMatchObject({ estado: 'a_revisar', valor_ia: 'a'.repeat(201) });
    expect((await abrir(c, id)).status).toBe(200);
    esperarErro(await acao(id, await comp(id), 'corrigir', 'b'.repeat(201)), 'ERR-001');
    expect((await comp(id)).estado).toBe('a_revisar');
    await acaoOk(id, await comp(id), 'corrigir', 'b'.repeat(200));
    expect(await comp(id)).toMatchObject({ estado: 'corrigido', valor_final: 'b'.repeat(200) });
  });

  // @trace CA-059, DEC-203, DEC-129, RN-037
  it('complemento acima de 2000 caracteres está fora do schema da chamada: falha da leitura com as retentativas, não a regra 7', async () => {
    const r = await enviar(c, saude, [arquivo('longo.pdf', 'application/pdf', await pdfDeImagens(await Promise.all([0, 1].map((i) => jpeg(f.paginas[i])))))]);
    expect(r.status, r.texto).toBe(202);
    const id: string = r.corpo.aplicacao_id;
    h.motor.programar(id, roteiro(motivo('outros', 0.95, { valor: 'a'.repeat(2001), confianca: 0.95 })));
    await h.worker.processar();
    for (const ms of [1_000, 2_000]) {
      await h.clock.advance(ms);
      await h.worker.processar();
    }
    const comMotivo = (await h.motor.chamadas(id)).filter((x) => x.campos.includes('MOTIVO_CONSULTA'));
    expect(comMotivo.map((x) => x.resultado)).toEqual(['malformada', 'malformada', 'malformada']);
    expect((await consultar(c, id)).corpo.estado).toBe('erro_leitura');
  });

  // @trace CA-059, RN-051, DEC-201
  it('exemplo 8: DOENCAS `diabetes;outra` e "Asma" → complemento de `outra` confirmado_automaticamente; duas linhas de DOENCAS, Complemento só na de `outra`', async () => {
    const id = await lerAplicacao({ DOENCAS: { valor: 'diabetes;outra', confianca: 0.95, complementos: { outra: { valor: 'Asma', confianca: 0.95 } } } });
    expect(doComplemento(await itens(id), 'DOENCAS', 'outra')).toMatchObject({ estado: 'confirmado_automaticamente', valor_ia: 'Asma' });
    await concluida(id);
    expect(linhasDe(await exportadas(id), 'DOENCAS')).toEqual([
      ['DOENCAS', '', 'diabetes', 'Diabetes', '', 'respondida'],
      ['DOENCAS', '', 'outra', 'Outra', 'Asma', 'respondida'],
    ]);
  });

  // @trace CA-059, FL-001, DEC-203
  it('a volta de sem_assinatura para em_revisao preserva os itens de complemento', async () => {
    const id = await lerAplicacao(motivo('outros', 0.95, { valor: 'Matrnidade', confianca: 0.6 }));
    expect((await abrir(c, id)).status).toBe(200);
    await acaoOk(id, await comp(id), 'corrigir', 'Maternidade');
    await resolverDemais(id);
    const r = await concluir(c, id, { assinatura: 'ausente' });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('sem_assinatura');
    const volta = await c.post(`/applications/${id}/reopen`, comMotivo('Assinatura estava no verso'));
    expect(volta.status, volta.texto).toBe(200);
    expect(await comp(id)).toMatchObject({ estado: 'corrigido', valor_final: 'Maternidade' });
    expect((await gravado(id, 'MOTIVO_CONSULTA', 'outros')).revisao_reaberta).toBe(false);
  });
});

describe('CA-059 — formulário com complemento (RN-047, RN-049, DEC-202)', () => {
  /** Rascunho novo com o conteúdo dado; devolve os ids. */
  async function rascunho(nome: string, cont: Conteudo): Promise<{ formId: string; versaoId: string }> {
    const ids = await criarFormulario(c, saude, nome);
    const s = await salvarConteudo(c, ids.formId, ids.versaoId, cont);
    expect(s.status, s.texto).toBe(200);
    return ids;
  }

  async function conteudoAtual(formId: string, versaoId: string): Promise<{ perguntas: Pergunta[] }> {
    const v = await c.get(caminhoVersao(formId, versaoId));
    expect(v.status, v.texto).toBe(200);
    return v.corpo.conteudo;
  }

  /** Linhas da página com um traço horizontal escuro de ao menos 180 px (cerca de 32 mm a 144 dpi), fora do QR. */
  async function linhasComTraco(pdf: Buffer, pagina: number): Promise<number> {
    const p = (await lerPdf(pdf))[pagina - 1];
    const lum = await luminancias(p.png);
    const qr = p.qr?.caixa;
    let total = 0;
    for (let y = 0; y < lum.altura; y++) {
      let corrida = 0;
      let achou = false;
      for (let x = 0; x < lum.largura && !achou; x++) {
        const noQr = qr && x >= qr.x - 10 && x <= qr.x + qr.largura + 10 && y >= qr.y - 10 && y <= qr.y + qr.altura + 10;
        corrida = !noQr && lum.em(x, y) < 128 ? corrida + 1 : 0;
        achou = corrida >= 180;
      }
      if (achou) total++;
    }
    return total;
  }

  // @trace CA-059, RN-049, DEC-202, DEC-203
  it('exemplo 9: importação de "Motivo: ( ) Rotina ( ) Dor ( ) Outros: ______" → opção `outros`, "Outros", com_complemento = true', async () => {
    const imp = await importarEProcessar(h, c, saude, {
      1: {
        perguntas: [
          extraida('Nome completo', 'texto_curto', { campo_padrao: 'nome' }),
          extraida('Data de nascimento', 'data', { campo_padrao: 'data_nascimento' }),
          extraida('CPF', 'cpf', { campo_padrao: 'cpf' }),
          extraida('Data da aplicação', 'data', { campo_padrao: 'data_aplicacao' }),
          extraida('Local da aplicação', 'texto_curto', { campo_padrao: 'local_aplicacao' }),
          extraida('Motivo', 'escolha_unica', { opcoes: ['Rotina', 'Dor', 'Outros'], opcoes_com_complemento: ['Outros'] }),
        ],
      },
    }, undefined, 'Importado com Outros');
    expect(imp.estado).toBe('concluida');
    const v = await versaoImportada(c, imp);
    const motivoImportado = v.perguntas.find((p) => p.tipo === 'escolha_unica')!;
    expect(motivoImportado).toBeTruthy();
    expect(opcao(motivoImportado, 'outros')).toMatchObject({ rotulo: 'Outros', com_complemento: true });
    expect(opcao(motivoImportado, 'rotina').com_complemento ?? false).toBe(false);
    expect(opcao(motivoImportado, 'dor').com_complemento ?? false).toBe(false);
  });

  // @trace CA-059, DEC-202, DEC-203, RF-004
  it('exemplo 10: updateVersion com com_complemento em `diabetes` → gravado; publicado, o PDF traz uma linha para escrever depois de "Diabetes"', async () => {
    const { formId, versaoId } = await rascunho('Rascunho Diabetes', conteudoRascunho());
    const p1 = await publicar(c, formId, versaoId);
    expect(p1.status, p1.texto).toBe(200);
    const pdfSem = await c.baixar(`${caminhoVersao(formId, versaoId)}/pdf`);
    expect(pdfSem.status).toBe(200);

    // Versão 2, cópia da 1: a cópia leva a marca das opções (DEC-203 (3)).
    const v2 = await c.post(`/forms/${formId}/versions`, { corpo: { copiar_de_versao_id: versaoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(v2.status, v2.texto).toBe(201);
    const copia = v2.corpo.conteudo as Conteudo;
    expect(opcao(porCodigo(copia.perguntas, 'MOTIVO_CONSULTA'), 'outros').com_complemento).toBe(true);
    expect(opcao(porCodigo(copia.perguntas, 'DOENCAS'), 'outra').com_complemento).toBe(true);

    opcao(porCodigo(copia.perguntas, 'DOENCAS'), 'diabetes').com_complemento = true;
    const versao2: string = v2.corpo.resumo.id;
    const s = await salvarConteudo(c, formId, versao2, copia);
    expect(s.status, s.texto).toBe(200);
    expect(opcao(porCodigo((await conteudoAtual(formId, versao2)).perguntas, 'DOENCAS'), 'diabetes').com_complemento).toBe(true);
    const p2 = await publicar(c, formId, versao2);
    expect(p2.status, p2.texto).toBe(200);
    const pdfCom = await c.baixar(`${caminhoVersao(formId, versao2)}/pdf`);
    expect(pdfCom.status).toBe(200);

    expect((await lerPdf(pdfCom.bytes))[1].texto).toContain('Diabetes');
    expect(await linhasComTraco(pdfCom.bytes, 2)).toBeGreaterThan(await linhasComTraco(pdfSem.bytes, 2));
  });

  // @trace CA-059, RN-047, DEC-202, ERR-001
  it.each([
    ['`nenhuma_das_anteriores` de DOENCAS', 'DOENCAS', (cont: Conteudo) => (opcao(porCodigo(cont.perguntas, 'DOENCAS'), 'nenhuma_das_anteriores').com_complemento = true)],
    [
      'opção de FUMA (sim_nao)',
      'FUMA',
      (cont: Conteudo) => {
        porCodigo(cont.perguntas, 'FUMA').opcoes = [
          { codigo: 'sim', rotulo: 'Sim', ordem: 1, com_complemento: true },
          { codigo: 'nao', rotulo: 'Não', ordem: 2 },
        ];
      },
    ],
    ['opção de SATISFACAO_COM (matriz)', 'SATISFACAO_COM', (cont: Conteudo) => (opcao(porCodigo(cont.perguntas, 'SATISFACAO_COM'), 'boa').com_complemento = true)],
  ])('exemplo 11: com_complemento na %s → ERR-001 com o código da pergunta em `campos`; nada é gravado', async (_n, codigo, mudar) => {
    const { formId, versaoId } = await rascunho(`Rascunho ${codigo}`, conteudoRascunho());
    const cont = conteudoRascunho();
    mudar(cont);
    const r = await salvarConteudo(c, formId, versaoId, cont);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual([codigo]);
    const atual = await conteudoAtual(formId, versaoId);
    expect(atual).toEqual(expect.objectContaining({ perguntas: expect.any(Array) }));
    for (const p of atual.perguntas) {
      for (const o of (p.opcoes ?? []) as Record<string, unknown>[]) {
        if (!(p.codigo === 'MOTIVO_CONSULTA' && o.codigo === 'outros') && !(p.codigo === 'DOENCAS' && o.codigo === 'outra')) expect(o.com_complemento ?? false, `${p.codigo}.${o.codigo}`).toBe(false);
      }
    }
  });
});
