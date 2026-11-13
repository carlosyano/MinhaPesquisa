// Motor de leitura isolado (DEC-007, DEC-043, RN-045, PLANO §2.1) e o adaptador Claude
// (DEC-122, DEC-123). O adaptador usa o SDK oficial da Anthropic com o `fetch` injetado: os testes
// conferem a requisição HTTP que sairia para a API e devolvem respostas sintéticas, sem rede.

import { createCanvas } from '@napi-rs/canvas';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AdaptadorClaude, ErroLeitura, type CampoSchema } from '../../packages/motor-leitura/src/index.js';

const RAIZ_MOTOR = fileURLToPath(new URL('../../packages/motor-leitura/src/', import.meta.url));

function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fontes(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('fronteira do motor (PLANO §2.1, RN-045)', () => {
  // @trace DEC-007, RN-045, RN-046
  it('não importa código do produto, banco ou sistema de arquivos e não lê process.env', () => {
    const arquivos = fontes(RAIZ_MOTOR);
    expect(arquivos.length).toBeGreaterThan(0);
    for (const a of arquivos) {
      const src = readFileSync(a, 'utf8');
      const imports = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const i of imports) {
        expect(i, `${a} importa ${i}`).not.toMatch(/^@minhapesquisa\/|apps\/|packages\/db|^pg$|^drizzle-orm|^node:(fs|net|http|https|child_process)$|^(fs|net|http|https|child_process)$/);
      }
      expect(src, a).not.toMatch(/process\.env/);
    }
  });
});

// ── adaptador Claude ──

const SCHEMA: CampoSchema = {
  campos: [
    { chave: 'c1', tipo: 'sim_nao', opcoes: ['sim', 'nao'] },
    { chave: 'c2', tipo: 'escala', valor_min: 1, valor_max: 5 },
  ],
};

// Tipos locais da leitura da página inteira (DEC-220 (4)), para o typecheck não depender do código ainda por escrever.
type GabaritoPagina = CampoSchema & { pagina: number; procurar_assinatura: boolean };
interface RespostaPagina {
  leituras: { chave: string; valor: string | null; confianca: number; regiao: unknown; complementos?: unknown }[];
  regiao_assinatura: unknown;
  custoUsd: number;
}
interface IdentificacaoPagina {
  pagina: number | null;
  confianca: number;
  custoUsd: number;
}
const pg = (s: CampoSchema, procurar = false, pagina = 1): GabaritoPagina => ({ ...s, pagina, procurar_assinatura: procurar });
const lerPagina = (a: AdaptadorClaude, img: Buffer, g: GabaritoPagina): Promise<RespostaPagina> =>
  (a as unknown as { lerPagina(i: Buffer, g: GabaritoPagina): Promise<RespostaPagina> }).lerPagina(img, g);
const identificarPagina = (a: AdaptadorClaude, img: Buffer, perguntasPorPagina: Record<number, string[]>): Promise<IdentificacaoPagina> =>
  (a as unknown as { identificarPagina(i: Buffer, p: Record<number, string[]>): Promise<IdentificacaoPagina> }).identificarPagina(img, perguntasPorPagina);

/** Página inteira sintética (A4 a 150 dpi, como as digitalizações dos testes), com algo escrito. */
function recorte(): Buffer {
  const c = createCanvas(120, 40);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 120, 40);
  ctx.fillStyle = '#000';
  ctx.fillRect(10, 10, 20, 20);
  return c.toBuffer('image/png');
}

interface Pedido {
  url: string;
  metodo: string;
  headers: Headers;
  corpo: any;
}

/** `fetch` sintético: registra cada pedido e responde com a função dada. */
function transporte(responder: (p: Pedido) => Response | Promise<Response>) {
  const pedidos: Pedido[] = [];
  const fetchFalso = async (entrada: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const req = new Request(entrada, init);
    const p = { url: req.url, metodo: req.method, headers: req.headers, corpo: JSON.parse(await req.text()) };
    pedidos.push(p);
    return responder(p);
  };
  return { pedidos, fetch: fetchFalso as typeof fetch };
}

function mensagem(texto: string, extra: Record<string, unknown> = {}): Response {
  return Response.json({
    id: 'msg_teste',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    content: [{ type: 'text', text: texto }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200 },
    ...extra,
  });
}

const REGIAO = { x: 0.1, y: 0.2, largura: 0.3, altura: 0.1 };
const OK = JSON.stringify({
  campos: [
    { chave: 'c1', valor: 'sim', confianca: 0.93, regiao: REGIAO },
    { chave: 'c2', valor: null, confianca: 0.8, regiao: null },
  ],
});

function adaptador(fetch: typeof globalThis.fetch, timeoutMs?: number) {
  return new AdaptadorClaude({ apiKey: 'chave-sintetica-de-teste', modelo: 'claude-opus-5-5', precoUsdPorMTok: { entrada: 4, saida: 20 }, fetch, timeoutMs });
}

describe('AdaptadorClaude — requisição (DEC-122, RN-038, RN-045)', () => {
  // @trace DEC-122, DEC-043, RN-045, RN-038
  it('uma chamada à Messages API com o modelo configurado, o recorte em base64 e a saída estruturada por JSON schema', async () => {
    const t = transporte(() => mensagem(OK));
    const img = recorte();
    await lerPagina(adaptador(t.fetch), img, pg(SCHEMA));
    expect(t.pedidos).toHaveLength(1);
    const [p] = t.pedidos;
    expect(p.metodo).toBe('POST');
    expect(new URL(p.url).pathname).toBe('/v1/messages');
    expect(p.headers.get('x-api-key')).toBe('chave-sintetica-de-teste');
    expect(p.corpo.model).toBe('claude-opus-5-5');
    const blocos = p.corpo.messages.flatMap((m: { content: unknown }) => (Array.isArray(m.content) ? m.content : []));
    const imagens = blocos.filter((b: { type: string }) => b.type === 'image');
    expect(imagens).toHaveLength(1);
    expect(imagens[0].source).toEqual({ type: 'base64', media_type: 'image/png', data: img.toString('base64') });
    expect(p.corpo.output_config?.format?.type).toBe('json_schema');
    const corpo = JSON.stringify(p.corpo);
    for (const c of SCHEMA.campos) expect(corpo).toContain(c.chave);
  });

  // @trace DEC-216, DEC-220, RN-045
  it('as instruções trazem a página e o gabarito dos campos, sem recorte nem faixa preta; a assinatura só se pedida', async () => {
    const t = transporte(() => mensagem(OK));
    await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA, true, 3));
    const blocos = t.pedidos[0].corpo.messages.flatMap((m: { content: unknown }) => (Array.isArray(m.content) ? m.content : []));
    const texto = blocos.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('\n');
    expect(texto).toContain('"pagina":3');
    expect(texto).toContain('"procurar_assinatura":true');
    expect(texto).not.toContain('"recorte"');
    expect(JSON.stringify(t.pedidos[0].corpo.system)).not.toMatch(/faixa preta/);
    expect(JSON.stringify(t.pedidos[0].corpo.output_config)).toContain('regiao_assinatura');

    const sem = transporte(() => mensagem(OK));
    await lerPagina(adaptador(sem.fetch), recorte(), pg(SCHEMA, false));
    expect(JSON.stringify(sem.pedidos[0].corpo.output_config)).not.toContain('regiao_assinatura');
  });

  // @trace DEC-220, RN-037
  it('o schema da leitura é fechado: `additionalProperties: false` na raiz e em cada campo', async () => {
    const t = transporte(() => mensagem(OK));
    await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA));
    const schema = t.pedidos[0].corpo.output_config.format.schema;
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toMatch(/"additionalProperties":true/);
  });

  // @trace RN-037, RN-045
  it('o modelo não recebe ferramentas: a IA nunca executa ações', async () => {
    const t = transporte(() => mensagem(OK));
    await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA));
    expect(t.pedidos[0].corpo.tools ?? []).toEqual([]);
  });
});

describe('AdaptadorClaude — resposta (RN-045, DEC-047, DEC-051)', () => {
  // @trace RN-045, DEC-047
  it('devolve, por campo, o valor, a confiança bruta e a região; e o custo real pelos tokens usados', async () => {
    const t = transporte(() => mensagem(OK));
    const r = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA));
    expect(r.leituras).toEqual([
      { chave: 'c1', valor: 'sim', confianca: 0.93, regiao: REGIAO },
      { chave: 'c2', valor: null, confianca: 0.8, regiao: null },
    ]);
    expect(r.custoUsd).toBeCloseTo((1000 * 4 + 200 * 20) / 1e6, 10);
  });

  // @trace DEC-051
  it('estima o custo antes da chamada, sem chamar a API', () => {
    const t = transporte(() => mensagem(OK));
    const a = adaptador(t.fetch);
    const e = a.estimarCustoUsd(recorte(), pg(SCHEMA));
    expect(e).toBeGreaterThan(0);
    expect(a.estimarCustoUsd(recorte(), pg(SCHEMA))).toBe(e);
    expect(t.pedidos).toHaveLength(0);
  });

  // @trace RN-037, DEC-123, T-02
  it.each([
    ['texto que não é JSON', 'não sei ler'],
    ['campo do schema ausente', JSON.stringify({ campos: [{ chave: 'c1', valor: 'sim', confianca: 0.9, regiao: null }] })],
    ['campo fora do schema', JSON.stringify({ campos: [...JSON.parse(OK).campos, { chave: 'c9', valor: 'sim', confianca: 0.9, regiao: null }] })],
    ['campo repetido', JSON.stringify({ campos: [...JSON.parse(OK).campos, JSON.parse(OK).campos[0]] })],
    ['confiança acima de 1', JSON.stringify({ campos: [{ ...JSON.parse(OK).campos[0], confianca: 1.2 }, JSON.parse(OK).campos[1]] })],
    ['confiança negativa', JSON.stringify({ campos: [{ ...JSON.parse(OK).campos[0], confianca: -0.1 }, JSON.parse(OK).campos[1]] })],
    ['região fora de 0 a 1', JSON.stringify({ campos: [{ ...JSON.parse(OK).campos[0], regiao: { ...REGIAO, x: 1.5 } }, JSON.parse(OK).campos[1]] })],
  ])('saída malformada (%s) → ErroLeitura "malformada"', async (_n, texto) => {
    const t = transporte(() => mensagem(texto));
    const erro = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('malformada');
  });

  // @trace CA-041, REQ §6.6
  it.each([
    ['HTTP 500', () => Response.json({ type: 'error', error: { type: 'api_error', message: 'falha' } }, { status: 500 })],
    ['HTTP 429', () => Response.json({ type: 'error', error: { type: 'rate_limit_error', message: 'limite' } }, { status: 429 })],
    ['recusa do modelo', () => mensagem('', { stop_reason: 'refusal', content: [] })],
    ['resposta cortada por max_tokens', () => mensagem('{"campos": [', { stop_reason: 'max_tokens' })],
  ])('%s → ErroLeitura, numa só tentativa (as retentativas de 1 e 2 s são do worker)', async (_n, responder) => {
    const t = transporte(responder);
    const erro = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect(['erro', 'malformada']).toContain((erro as ErroLeitura).tipo);
    expect(t.pedidos).toHaveLength(1);
  });

  // @trace CA-041, RF-007, REQ §6.6
  it('sem resposta dentro do tempo limite → ErroLeitura "tempo_esgotado"', async () => {
    const fetchLento = ((_e: unknown, init?: RequestInit) =>
      new Promise<Response>((_ok, falhar) => {
        init?.signal?.addEventListener('abort', () => falhar(new DOMException('abortado', 'AbortError')));
      })) as typeof fetch;
    const erro = await lerPagina(adaptador(fetchLento, 50), recorte(), pg(SCHEMA)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('tempo_esgotado');
  });
});

// ── complemento da opção "Outro" (IA-TEST do IMP-009, CHG-018) ──

// O IA-DEV acrescenta à interface do motor (DEC-203 (3)): `CampoLeitura.complementos` (códigos das
// opções com complemento do campo), `LeituraCampo.complementos` (por código de opção, texto e
// confiança, só as devolvidas) e `OpcoesClaude.maxTokensModelo` (máximo de saída do modelo). Os
// tipos locais abaixo descrevem essa interface sem depender dela para o typecheck dos testes.
type CampoComComplemento = CampoSchema['campos'][number] & { complementos?: string[] };
type LeituraComComplemento = { complementos?: Record<string, { valor: string | null; confianca: number }> };
type OpcoesComTeto = ConstructorParameters<typeof AdaptadorClaude>[0] & { maxTokensModelo: number };

/** Escolha única cuja opção `outros` tem complemento, e uma múltipla escolha com `outra` (DEC-197). */
const SCHEMA_COMPLEMENTO: { campos: CampoComComplemento[] } = {
  campos: [
    { chave: 'c1', tipo: 'escolha_unica', opcoes: ['rotina', 'dor', 'outros'], complementos: ['outros'] },
    { chave: 'c2', tipo: 'multipla_escolha', opcoes: ['diabetes', 'outra', 'nenhuma_das_anteriores'], complementos: ['outra'] },
  ],
};

function complemento(campos: Record<string, unknown>[]): string {
  return JSON.stringify({ campos });
}

const OK_COMPLEMENTO = complemento([
  { chave: 'c1', valor: 'outros', confianca: 0.95, regiao: null, complementos: [{ opcao: 'outros', valor: 'Maternidade', confianca: 0.9 }] },
  { chave: 'c2', valor: 'diabetes;outra', confianca: 0.95, regiao: null, complementos: [{ opcao: 'outra', valor: 'Asma', confianca: 0.85 }] },
]);

function adaptadorTeto(fetch: typeof globalThis.fetch, maxTokens: number, maxTokensModelo: number) {
  const opcoes: OpcoesComTeto = { apiKey: 'chave-sintetica-de-teste', modelo: 'claude-opus-5-5', precoUsdPorMTok: { entrada: 4, saida: 20 }, fetch, maxTokens, maxTokensModelo };
  return new AdaptadorClaude(opcoes);
}

describe('AdaptadorClaude — complemento da opção (DEC-197, DEC-203 (3))', () => {
  // @trace DEC-203, DEC-197, RN-037, RN-045
  it('o schema de saída pede o complemento só das opções com complemento, com no máximo 2000 caracteres', async () => {
    const t = transporte(() => mensagem(OK_COMPLEMENTO));
    await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA_COMPLEMENTO));
    const schema = JSON.stringify(t.pedidos[0].corpo.output_config.format.schema);
    expect(schema).toContain('complementos');
    expect(schema).toContain('"maxLength":2000');
    expect(schema).toContain('"outros"');
    expect(schema).toContain('"outra"');
  });

  // @trace DEC-203, DEC-197, RN-045
  it('devolve o complemento por opção, com o texto e a confiança bruta, ao lado do valor do campo', async () => {
    const t = transporte(() => mensagem(OK_COMPLEMENTO));
    const r = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA_COMPLEMENTO));
    expect(r.leituras).toEqual([
      { chave: 'c1', valor: 'outros', confianca: 0.95, regiao: null, complementos: { outros: { valor: 'Maternidade', confianca: 0.9 } } },
      { chave: 'c2', valor: 'diabetes;outra', confianca: 0.95, regiao: null, complementos: { outra: { valor: 'Asma', confianca: 0.85 } } },
    ]);
  });

  // @trace DEC-203, FL-002
  it('complemento ausente na resposta não é falha: fica fora de `complementos` (sem leitura, pré-regra 1b, c)', async () => {
    const t = transporte(() =>
      mensagem(
        complemento([
          { chave: 'c1', valor: 'outros', confianca: 0.95, regiao: null },
          { chave: 'c2', valor: 'diabetes', confianca: 0.95, regiao: null, complementos: [] },
        ]),
      ),
    );
    const r = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA_COMPLEMENTO));
    for (const l of r.leituras as LeituraComComplemento[]) expect(l.complementos?.outros ?? l.complementos?.outra).toBeUndefined();
  });

  // @trace DEC-203, FL-002, DEC-199
  it('complemento lido em branco volta com valor null', async () => {
    const t = transporte(() =>
      mensagem(
        complemento([
          { chave: 'c1', valor: 'outros', confianca: 0.95, regiao: null, complementos: [{ opcao: 'outros', valor: null, confianca: 0.99 }] },
          { chave: 'c2', valor: 'diabetes', confianca: 0.95, regiao: null },
        ]),
      ),
    );
    const r = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA_COMPLEMENTO));
    expect((r.leituras[0] as LeituraComComplemento).complementos).toEqual({ outros: { valor: null, confianca: 0.99 } });
  });

  // @trace DEC-203, RN-037, DEC-129
  it.each([
    ['complemento com 2001 caracteres', [{ opcao: 'outros', valor: 'a'.repeat(2001), confianca: 0.9 }]],
    ['complemento de opção sem complemento', [{ opcao: 'dor', valor: 'joelho', confianca: 0.9 }]],
    ['complemento de opção de outro campo', [{ opcao: 'outra', valor: 'Asma', confianca: 0.9 }]],
    ['complemento repetido', [{ opcao: 'outros', valor: 'A', confianca: 0.9 }, { opcao: 'outros', valor: 'B', confianca: 0.9 }]],
    ['confiança do complemento acima de 1', [{ opcao: 'outros', valor: 'Maternidade', confianca: 1.2 }]],
  ])('saída malformada (%s) → ErroLeitura "malformada"', async (_n, complementos) => {
    const t = transporte(() =>
      mensagem(
        complemento([
          { chave: 'c1', valor: 'outros', confianca: 0.95, regiao: null, complementos },
          { chave: 'c2', valor: 'diabetes', confianca: 0.95, regiao: null },
        ]),
      ),
    );
    const erro = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA_COMPLEMENTO)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('malformada');
  });

  // @trace DEC-203, RN-037
  it('complemento em campo sem opção com complemento → ErroLeitura "malformada"', async () => {
    const t = transporte(() =>
      mensagem(complemento([{ ...JSON.parse(OK).campos[0], complementos: [{ opcao: 'sim', valor: 'x', confianca: 0.9 }] }, JSON.parse(OK).campos[1]])),
    );
    const erro = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('malformada');
  });

  // @trace DEC-203, DEC-051
  it('max_tokens cresce 1.000 por opção com complemento, limitado ao máximo de saída do modelo', async () => {
    const sem = transporte(() => mensagem(OK));
    await lerPagina(adaptadorTeto(sem.fetch, 4096, 64000), recorte(), pg(SCHEMA));
    expect(sem.pedidos[0].corpo.max_tokens).toBe(4096);

    const com = transporte(() => mensagem(OK_COMPLEMENTO));
    await lerPagina(adaptadorTeto(com.fetch, 4096, 64000), recorte(), pg(SCHEMA_COMPLEMENTO));
    expect(com.pedidos[0].corpo.max_tokens).toBe(4096 + 2 * 1000);

    const limitado = transporte(() => mensagem(OK_COMPLEMENTO));
    await lerPagina(adaptadorTeto(limitado.fetch, 4096, 5000), recorte(), pg(SCHEMA_COMPLEMENTO));
    expect(limitado.pedidos[0].corpo.max_tokens).toBe(5000);
  });

  // @trace DEC-203, DEC-051
  it('a estimativa para a reserva cresce com o teto: ao menos 1.000 tokens de saída por opção com complemento, sem passar do modelo', () => {
    const t = transporte(() => mensagem(OK));
    const a = adaptadorTeto(t.fetch, 4096, 64000);
    const semComplemento: CampoSchema = { campos: SCHEMA_COMPLEMENTO.campos.map(({ complementos: _c, ...c }) => c) };
    const base = a.estimarCustoUsd(recorte(), pg(semComplemento));
    const com = a.estimarCustoUsd(recorte(), pg(SCHEMA_COMPLEMENTO));
    expect(com - base).toBeGreaterThanOrEqual((2 * 1000 * 20) / 1e6);
    const limitado = adaptadorTeto(t.fetch, 4096, 5000).estimarCustoUsd(recorte(), SCHEMA_COMPLEMENTO);
    expect(limitado).toBeLessThan(com);
    expect(t.pedidos).toHaveLength(0);
  });
});

describe('AdaptadorClaude — leitura da página inteira (DEC-216, DEC-220 (4))', () => {
  const COM_ASSINATURA = JSON.stringify({
    campos: [
      { chave: 'c1', valor: 'sim', confianca: 0.93, regiao: REGIAO },
      { chave: 'c2', valor: '3', confianca: 0.8, regiao: REGIAO },
    ],
    regiao_assinatura: { x: 0.1, y: 0.8, largura: 0.5, altura: 0.08 },
  });

  // @trace DEC-220, RF-015
  it('devolve a região da assinatura quando pedida (página 1) e nula quando não achada', async () => {
    const achada = await lerPagina(adaptador(transporte(() => mensagem(COM_ASSINATURA)).fetch), recorte(), pg(SCHEMA, true));
    expect(achada.regiao_assinatura).toEqual({ x: 0.1, y: 0.8, largura: 0.5, altura: 0.08 });
    const nula = JSON.stringify({ campos: JSON.parse(COM_ASSINATURA).campos, regiao_assinatura: null });
    expect((await lerPagina(adaptador(transporte(() => mensagem(nula)).fetch), recorte(), pg(SCHEMA, true))).regiao_assinatura).toBeNull();
  });

  // @trace DEC-220, RN-037, DEC-129
  it.each([
    ['chave fora do gabarito', { campos: [{ chave: 'c9', valor: 'x', confianca: 0.9, regiao: REGIAO }], regiao_assinatura: null }],
    ['campo a mais na raiz', { campos: JSON.parse(OK).campos, PESO: '70' }],
    ['região fora de 0..1', { campos: [{ chave: 'c1', valor: 'sim', confianca: 0.9, regiao: { x: 0.9, y: 0.2, largura: 0.3, altura: 0.1 } }, { chave: 'c2', valor: null, confianca: 0.8, regiao: null }] }],
  ])('resposta com %s → ErroLeitura "malformada"', async (_nome, corpo) => {
    const t = transporte(() => mensagem(JSON.stringify(corpo)));
    const erro = await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA)).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('malformada');
  });

  // @trace DEC-220 (4)
  it('max_tokens = 300 por campo do gabarito (mais 1.000 por opção com complemento, DEC-203)', async () => {
    const t = transporte(() => mensagem(OK));
    await lerPagina(adaptador(t.fetch), recorte(), pg(SCHEMA));
    expect(t.pedidos[0].corpo.max_tokens).toBe(300 * SCHEMA.campos.length);
  });
});

describe('AdaptadorClaude — identificação da página (DEC-216, RN-037, RN-045)', () => {
  const PERGUNTAS = { 1: ['NOME', 'PRESSAO'], 2: ['CPF'] };
  const IDENT = JSON.stringify({ pagina: 2, confianca: 0.91 });

  // @trace DEC-216, RN-045
  it('uma chamada com a imagem e as perguntas por página, sem região nem valor lido na resposta', async () => {
    const t = transporte(() => mensagem(IDENT));
    const r = await identificarPagina(adaptador(t.fetch), recorte(), PERGUNTAS);
    expect(r).toMatchObject({ pagina: 2, confianca: 0.91 });
    expect(t.pedidos).toHaveLength(1);
    const corpo = JSON.stringify(t.pedidos[0].corpo);
    expect(corpo).toContain('NOME');
    expect(JSON.stringify(t.pedidos[0].corpo.output_config)).not.toContain('regiao');
    expect(t.pedidos[0].corpo.tools ?? []).toHaveLength(0);
  });

  // @trace DEC-178, DEC-216
  it('página nula é válida (não indicada)', async () => {
    const t = transporte(() => mensagem(JSON.stringify({ pagina: null, confianca: 0.2 })));
    expect((await identificarPagina(adaptador(t.fetch), recorte(), PERGUNTAS)).pagina).toBeNull();
  });

  // @trace RN-037, DEC-216
  it.each([
    ['texto lido junto da página', { pagina: 1, confianca: 0.9, texto: 'Maria' }],
    ['regiões na resposta', { pagina: 1, confianca: 0.9, regioes: {} }],
    ['página inexistente', { pagina: 9, confianca: 0.9 }],
  ])('resposta com %s → ErroLeitura "malformada"', async (_n, corpo) => {
    const t = transporte(() => mensagem(JSON.stringify(corpo)));
    const erro = await identificarPagina(adaptador(t.fetch), recorte(), PERGUNTAS).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroLeitura);
    expect((erro as ErroLeitura).tipo).toBe('malformada');
  });
});
