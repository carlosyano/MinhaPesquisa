// Leitura, revisão e conclusão de apoio (IA-TEST do IMP-003), sempre pela API, com o motor
// simulado do harness (DEC-123). Conteúdo 100% sintético (Q-001): nomes fictícios e CPFs de teste
// com dígitos verificadores válidos, salvo quando o nome diz o contrário.

import { expect } from 'vitest';
import { jpeg } from './arquivos.js';
import { chaveIdempotencia, type Cliente, type Resposta } from './cliente.js';
import { arquivo, conteudoValido, enviar, type Conteudo, type FormularioPublicado } from './formularios.js';
import type { Harness, RoteiroLeitura } from './harness.js';

/** Cotação fixa do mês usada nos testes: US$ 1,00 = R$ 5,00 (DEC-058). */
export const COTACAO = '5.00';

/** CPFs sintéticos válidos (dígitos verificadores conferidos) e um inválido. */
export const CPF = {
  maria: '12345678909',
  joana: '52998224725',
  novo: '11144477735',
  outro: '39053344705',
  terceiro: '71428793860',
  ana: '86288366757',
  rosa: '52601815906',
  pendente: '08301661305',
  reaberta: '18609139034',
  corrigido: '99603082430',
  invalido: '12345678900',
} as const;

/** Cotação do dólar dos meses em que os testes leem (o relógio do harness começa em 02/11/2026). */
export async function prepararCotacao(h: Harness, competencias = ['2026-11-01', '2026-12-01']): Promise<void> {
  for (const competencia of competencias) {
    await h.seed.parametro({ tenantId: null, chave: 'cotacao_usd_brl', valor: COTACAO, competencia });
  }
}

/**
 * Versão de referência do IMP-002 com o que a leitura precisa a mais: escala de 1 a 5 (CA-006),
 * matriz com duas linhas (RN-009) e uma segunda regra de salto encadeada: USA_MEDICAMENTO só se
 * PRESSAO_ALTA = sim, e QUAIS_MEDICAMENTOS só se USA_MEDICAMENTO = sim (FL-002 regra 4).
 */
export function conteudoLeitura(): Conteudo {
  const c = conteudoValido();
  let ordem = Math.max(...c.perguntas.map((p) => p.ordem));
  c.perguntas.push(
    { codigo: 'SATISFACAO_SONO', tipo: 'escala', enunciado: 'Satisfação com o sono (1 a 5)', pagina: 4, ordem: ++ordem, valor_min: 1, valor_max: 5 },
    {
      codigo: 'SINTOMAS',
      tipo: 'matriz',
      enunciado: 'Com que frequência sente',
      pagina: 4,
      ordem: ++ordem,
      linhas: [
        { codigo: 'dor', rotulo: 'Dor', ordem: 1 },
        { codigo: 'cansaco', rotulo: 'Cansaço', ordem: 2 },
      ],
      opcoes: [
        { codigo: 'nunca', rotulo: 'Nunca', ordem: 1 },
        { codigo: 'as_vezes', rotulo: 'Às vezes', ordem: 2 },
        { codigo: 'sempre', rotulo: 'Sempre', ordem: 3 },
      ],
    },
  );
  c.regras_salto.push({ pergunta_origem_codigo: 'PRESSAO_ALTA', pergunta_destino_codigo: 'USA_MEDICAMENTO', opcao_codigo: 'sim' });
  return c;
}

/** Itens de `conteudoLeitura`, com a linha da matriz quando houver. */
export const ITENS = [
  'NOME', 'DATA_NASCIMENTO', 'CPF', 'DATA_APLICACAO', 'LOCAL_APLICACAO', 'PRESSAO_ALTA', 'USA_MEDICAMENTO',
  'QUAIS_MEDICAMENTOS', 'ESTADO_CIVIL', 'HORAS_SONO', 'ALIMENTOS', 'SATISFACAO_SONO', 'SINTOMAS.dor', 'SINTOMAS.cansaco',
] as const;

/** Leitura completa e legível de todos os campos, com confiança alta (0,97). */
export function leiturasCompletas(extra: RoteiroLeitura = {}): RoteiroLeitura {
  const alta = (valor: string) => ({ valor, confianca: 0.97 });
  return {
    NOME: alta('Maria Silva'),
    DATA_NASCIMENTO: alta('1950-01-01'),
    CPF: alta(CPF.joana),
    DATA_APLICACAO: alta('2026-10-30'),
    LOCAL_APLICACAO: alta('UBS Centro'),
    PRESSAO_ALTA: alta('sim'),
    USA_MEDICAMENTO: alta('sim'),
    QUAIS_MEDICAMENTOS: alta('Losartana'),
    ESTADO_CIVIL: alta('casado'),
    HORAS_SONO: alta('7'),
    ALIMENTOS: alta('frutas;verduras'),
    SATISFACAO_SONO: alta('4'),
    'SINTOMAS.dor': alta('nunca'),
    'SINTOMAS.cansaco': alta('as_vezes'),
    ...extra,
  };
}

export interface ItemRevisao {
  id: string;
  pergunta_codigo: string;
  linha_codigo?: string | null;
  valor_ia: string | null;
  confianca: number | null;
  valor_final: string | null;
  estado: string;
}

/** Item pela chave `CODIGO` ou `CODIGO.linha`. */
export function item(aplicacao: { itens: ItemRevisao[] }, chave: string): ItemRevisao {
  const [codigo, linha] = chave.split('.');
  const achado = aplicacao.itens.filter((i) => i.pergunta_codigo === codigo && (i.linha_codigo ?? undefined) === linha);
  expect(achado, `item ${chave}`).toHaveLength(1);
  return achado[0];
}

export async function paginasJpeg(f: FormularioPublicado, numeros = [1, 2, 3, 4]) {
  return Promise.all(numeros.map(async (n) => arquivo(`p${n}.jpg`, 'image/jpeg', await jpeg(f.paginas[n - 1]))));
}

/** Envia as 4 páginas, programa o motor e roda o worker; devolve o id da aplicação. */
export async function enviarELer(h: Harness, dig: Cliente, projetoId: string, f: FormularioPublicado, roteiro: RoteiroLeitura): Promise<string> {
  const r = await enviar(dig, projetoId, await paginasJpeg(f));
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.estado).toBe('em_leitura');
  const id: string = r.corpo.aplicacao_id;
  h.motor.programar(id, roteiro);
  await h.worker.processar();
  return id;
}

export async function consultar(dig: Cliente, id: string): Promise<Resposta> {
  const r = await dig.get(`/applications/${id}`);
  expect(r.status, r.texto).toBe(200);
  return r;
}

export async function abrir(dig: Cliente, id: string): Promise<Resposta> {
  return dig.post(`/applications/${id}/review/open`);
}

export interface AcaoRevisao {
  item_id: string;
  acao: 'confirmar' | 'corrigir' | 'em_branco' | 'ilegivel' | 'rasurado' | 'nao_se_aplica';
  valor_final?: string | null;
}

/** saveReview com o ETag atual da aplicação (If-Match obrigatório, RN-043). */
export async function revisar(dig: Cliente, id: string, itens: AcaoRevisao[], etag?: string): Promise<Resposta> {
  const tag = etag ?? (await consultar(dig, id)).headers.get('etag');
  expect(tag).toBeTruthy();
  return dig.patch(`/applications/${id}/review`, { corpo: { itens }, headers: { 'if-match': tag! } });
}

/** Abre a revisão e confirma o valor lido de todo item `a_revisar`, até não sobrar nenhum. */
export async function confirmarPendentes(dig: Cliente, id: string): Promise<Resposta> {
  const aberta = await abrir(dig, id);
  expect(aberta.status, aberta.texto).toBe(200);
  let atual = aberta;
  for (let rodada = 0; rodada < 4; rodada++) {
    const pendentes = (atual.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar');
    if (pendentes.length === 0) return atual;
    atual = await revisar(dig, id, pendentes.map((i) => ({ item_id: i.id, acao: 'confirmar' })), atual.headers.get('etag') ?? undefined);
    expect(atual.status, atual.texto).toBe(200);
  }
  throw new Error('itens a revisar não se resolveram');
}

/** confirmApplication com Idempotency-Key e o ETag atual. */
export async function concluir(dig: Cliente, id: string, corpo: Record<string, unknown> = { assinatura: 'presente' }): Promise<Resposta> {
  const etag = (await consultar(dig, id)).headers.get('etag');
  expect(etag).toBeTruthy();
  return dig.post(`/applications/${id}/confirm`, { corpo, headers: { 'idempotency-key': chaveIdempotencia(), 'if-match': etag! } });
}

/** Aplicação lida e com todos os itens resolvidos, pronta para concluir. */
export async function prontaParaConcluir(h: Harness, dig: Cliente, projetoId: string, f: FormularioPublicado, extra: RoteiroLeitura = {}): Promise<string> {
  const id = await enviarELer(h, dig, projetoId, f, leiturasCompletas(extra));
  await confirmarPendentes(dig, id);
  return id;
}

/** Aplicação concluída com assinatura presente; `corpo` permite informar manter_cadastro. */
export async function concluida(
  h: Harness,
  dig: Cliente,
  projetoId: string,
  f: FormularioPublicado,
  extra: RoteiroLeitura = {},
  corpo: Record<string, unknown> = { assinatura: 'presente' },
): Promise<string> {
  const id = await prontaParaConcluir(h, dig, projetoId, f, extra);
  const r = await concluir(dig, id, corpo);
  expect(r.status, r.texto).toBe(200);
  expect(r.corpo.estado).toBe('concluida');
  return id;
}

export function comMotivo(motivo: string) {
  return { corpo: { motivo }, headers: { 'idempotency-key': chaveIdempotencia() } };
}

/**
 * Tira de um texto (log ou auditoria serializada) o que muda a cada execução e pode conter
 * dígitos por acaso: UUIDs, sequências hexadecimais longas, instantes ISO e números de 13 ou
 * mais dígitos. Assim a busca por valores pessoais (CA-008, RN-028) não falha por coincidência.
 */
export function semIdentificadores(texto: string): string {
  return texto
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, '<instante>')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
    .replace(/\d{13,}/g, '<n>');
}
