// Exportação em formato longo de apoio (IA-TEST do IMP-007), sempre pela API, com o motor de
// leitura simulado do harness (DEC-123) para chegar às aplicações concluídas. Conteúdo 100%
// sintético (Q-001): nomes fictícios e CPFs de teste com dígitos verificadores válidos.
// Ajustado no IA-TEST do IMP-009 (CHG-018, DEC-201): colunas `Arquivo` e `Complemento`; as páginas
// vão num só PDF, "maria.pdf", para a coluna `Arquivo` ser a mesma em todas as linhas.

import { expect } from 'vitest';
import { jpeg, pdfDeImagens } from './arquivos.js';
import { chaveIdempotencia, type Cliente, type Resposta } from './cliente.js';
import { arquivo, enviar, type Conteudo, type FormularioPublicado, type Pergunta } from './formularios.js';
import type { Harness, RoteiroLeitura } from './harness.js';
import { abrir, concluir, type AcaoRevisao, type ItemRevisao } from './leitura.js';
import { lerCsv, lerXlsx, valores, type Celula } from './planilha.js';

/** Cabeçalho da RN-051, nesta ordem (com `Arquivo` e `Complemento` desde a REQ v2.8, DEC-201). */
export const COLUNAS = [
  'ID_Aplicacao',
  'Arquivo',
  'CPF',
  'Nome',
  'Data_Aplicacao',
  'Codigo_Pergunta',
  'Codigo_Linha',
  'Codigo_Opcao_Valor',
  'Rotulo_Opcao_Valor',
  'Complemento',
  'Situacao',
] as const;

/**
 * A versão do CA-050, nesta ordem: os 5 campos da RN-050 na página 1 e, na página 2, BENS_POSSUIDOS
 * (`multipla_escolha`), SATISFACAO_COM (`matriz`, linhas `moradia` e `saude`), PESO (`numero`),
 * FUMA (`sim_nao`) e DOENCAS (`multipla_escolha`). O PESO aceita de -10 a 300 para o exemplo 7 do
 * CA-051 (`-3`).
 */
export function conteudoSaude(): Conteudo {
  let ordem = 0;
  const q = (p: Omit<Pergunta, 'ordem'>): Pergunta => ({ ...p, ordem: ++ordem }) as Pergunta;
  return {
    perguntas: [
      q({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', pagina: 1, campo_respondente: 'nome' }),
      q({ codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 1, campo_respondente: 'data_nascimento' }),
      q({ codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 1, campo_respondente: 'cpf' }),
      q({ codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 1, campo_aplicacao: 'data_aplicacao' }),
      q({ codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', pagina: 1, campo_aplicacao: 'local_aplicacao' }),
      q({
        codigo: 'BENS_POSSUIDOS',
        tipo: 'multipla_escolha',
        enunciado: 'Quais bens possui?',
        pagina: 2,
        opcoes: [
          { codigo: 'carro', rotulo: 'Carro', ordem: 1 },
          { codigo: 'geladeira', rotulo: 'Geladeira', ordem: 2 },
          { codigo: 'televisao', rotulo: 'Televisão', ordem: 3 },
          { codigo: 'nenhuma_das_anteriores', rotulo: 'Nenhuma das anteriores', ordem: 4 },
        ],
      }),
      q({
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
          { codigo: 'regular', rotulo: 'Regular', ordem: 2 },
          { codigo: 'ruim', rotulo: 'Ruim', ordem: 3 },
        ],
      }),
      q({ codigo: 'PESO', tipo: 'numero', enunciado: 'Peso', pagina: 2, valor_min: -10, valor_max: 300, unidade: 'kg' }),
      q({ codigo: 'FUMA', tipo: 'sim_nao', enunciado: 'Você fuma?', pagina: 2 }),
      q({
        codigo: 'DOENCAS',
        tipo: 'multipla_escolha',
        enunciado: 'Tem alguma destas doenças?',
        pagina: 2,
        opcoes: [
          { codigo: 'diabetes', rotulo: 'Diabetes', ordem: 1 },
          { codigo: 'hipertensao', rotulo: 'Hipertensão', ordem: 2 },
          { codigo: 'nenhuma_das_anteriores', rotulo: 'Nenhuma das anteriores', ordem: 3 },
        ],
      }),
    ],
    regras_salto: [],
  };
}

/**
 * Leitura da A1 do CA-050 ("Maria da Silva", CPF lido com máscara, 05/11/2026), com confiança alta.
 * A linha `saude` da matriz é lida com confiança baixa, para a revisão marcá-la ilegível, e FUMA
 * vem em branco. `extra` troca campos.
 */
export function leituraA1(extra: RoteiroLeitura = {}): RoteiroLeitura {
  const alta = (valor: string | null) => ({ valor, confianca: 0.97 });
  return {
    NOME: alta('Maria da Silva'),
    DATA_NASCIMENTO: alta('1950-03-10'),
    CPF: alta('529.982.247-25'),
    DATA_APLICACAO: alta('2026-11-05'),
    LOCAL_APLICACAO: alta('Clínica Centro'),
    BENS_POSSUIDOS: alta('carro;geladeira'),
    'SATISFACAO_COM.moradia': alta('boa'),
    'SATISFACAO_COM.saude': { valor: 'regular', confianca: 0.4 },
    PESO: alta('72.5'),
    FUMA: { valor: null, confianca: 0.99 },
    DOENCAS: alta('nenhuma_das_anteriores'),
    ...extra,
  };
}

/** Ações da revisão da A1: a linha `saude` ilegível e FUMA em branco. */
export const ACOES_A1: Record<string, AcaoRevisao['acao']> = { 'SATISFACAO_COM.saude': 'ilegivel', FUMA: 'em_branco' };

/** Nome do PDF enviado por `lida`, com as 2 páginas: a coluna `Arquivo` de todas as linhas (DEC-201). */
export const ARQUIVO = 'maria.pdf';

/** As 8 linhas da A1 na tabela do CA-050, a partir de `Codigo_Pergunta` (Complemento vazio, antes da situação). */
export const LINHAS_A1: readonly (readonly string[])[] = [
  ['LOCAL_APLICACAO', '', 'Clínica Centro', '', '', 'respondida'],
  ['BENS_POSSUIDOS', '', 'carro', 'Carro', '', 'respondida'],
  ['BENS_POSSUIDOS', '', 'geladeira', 'Geladeira', '', 'respondida'],
  ['SATISFACAO_COM', 'moradia', 'boa', 'Boa', '', 'respondida'],
  ['SATISFACAO_COM', 'saude', '', '', '', 'ilegivel'],
  ['PESO', '', '72.5', '', '', 'respondida'],
  ['FUMA', '', '', '', '', 'em_branco'],
  ['DOENCAS', '', 'nenhuma_das_anteriores', 'Nenhuma das anteriores', '', 'respondida'],
];

/** Envia as 2 páginas num PDF, programa o motor e roda o worker; devolve o id da aplicação em revisão. */
export async function lida(h: Harness, dig: Cliente, projetoId: string, f: FormularioPublicado, roteiro: RoteiroLeitura, nomeArquivo = ARQUIVO): Promise<string> {
  const pdf = await pdfDeImagens(await Promise.all([0, 1].map((i) => jpeg(f.paginas[i]))));
  const r = await enviar(dig, projetoId, [arquivo(nomeArquivo, 'application/pdf', pdf)]);
  expect(r.status, r.texto).toBe(202);
  const id: string = r.corpo.aplicacao_id;
  h.motor.programar(id, roteiro);
  await h.worker.processar();
  return id;
}

/**
 * Abre a revisão e resolve todo item `a_revisar`: a ação de `acoes` (chave `CODIGO` ou
 * `CODIGO.linha`) ou, sem ela, confirma o valor lido (o lido em branco é marcado em branco, DEC-128).
 */
export async function revisada(dig: Cliente, id: string, acoes: Record<string, AcaoRevisao['acao']> = {}): Promise<void> {
  let atual = await abrir(dig, id);
  expect(atual.status, atual.texto).toBe(200);
  for (let rodada = 0; rodada < 4; rodada++) {
    const pendentes = (atual.corpo.itens as ItemRevisao[]).filter((i) => i.estado === 'a_revisar');
    if (pendentes.length === 0) return;
    const itens = pendentes.map((i) => {
      const chave = i.linha_codigo ? `${i.pergunta_codigo}.${i.linha_codigo}` : i.pergunta_codigo;
      return { item_id: i.id, acao: acoes[chave] ?? (i.valor_ia === null ? 'em_branco' : 'confirmar') } as AcaoRevisao;
    });
    const etag = atual.headers.get('etag');
    expect(etag).toBeTruthy();
    atual = await dig.patch(`/applications/${id}/review`, { corpo: { itens }, headers: { 'if-match': etag! } });
    expect(atual.status, atual.texto).toBe(200);
  }
  throw new Error('itens a revisar não se resolveram');
}

/**
 * Aplicação lida, revisada e conferida com a assinatura indicada: `presente` → `concluida`;
 * `ausente` → `sem_assinatura` (CA-021).
 */
export async function conferida(
  h: Harness,
  dig: Cliente,
  projetoId: string,
  f: FormularioPublicado,
  roteiro: RoteiroLeitura,
  acoes: Record<string, AcaoRevisao['acao']> = {},
  assinatura: 'presente' | 'ausente' = 'presente',
  nomeArquivo = ARQUIVO,
): Promise<string> {
  const id = await lida(h, dig, projetoId, f, roteiro, nomeArquivo);
  await revisada(dig, id, acoes);
  const r = await concluir(dig, id, { assinatura });
  expect(r.status, r.texto).toBe(200);
  expect(r.corpo.estado).toBe(assinatura === 'presente' ? 'concluida' : 'sem_assinatura');
  return id;
}

export async function pedirExportacao(c: Cliente, corpo: Record<string, unknown>, chave = chaveIdempotencia()): Promise<Resposta> {
  return c.post('/exports', { corpo, headers: { 'idempotency-key': chave } });
}

export async function consultarExportacao(c: Cliente, id: string): Promise<Resposta> {
  return c.get(`/exports/${id}`);
}

export interface ArquivoExportado {
  id: string;
  /** Resposta do getExport depois do worker. */
  consulta: Resposta;
  bytes: Buffer;
  contentType: string;
}

/** Pede a exportação, roda o worker e baixa o arquivo pelo link assinado (DEC-165 (3)). */
export async function exportada(h: Harness, c: Cliente, corpo: Record<string, unknown>): Promise<ArquivoExportado> {
  const r = await pedirExportacao(c, corpo);
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.status).toBe('enfileirada');
  await h.worker.processar();
  const consulta = await consultarExportacao(c, r.corpo.id);
  expect(consulta.status, consulta.texto).toBe(200);
  expect(consulta.corpo.status, consulta.texto).toBe('concluida');
  expect(consulta.corpo.url_download).toBeTruthy();
  const baixado = await fetch(consulta.corpo.url_download);
  expect(baixado.status).toBe(200);
  return {
    id: r.corpo.id,
    consulta,
    bytes: Buffer.from(await baixado.arrayBuffer()),
    contentType: baixado.headers.get('content-type') ?? '',
  };
}

/** Células da planilha `Dados` do XLSX exportado. */
export function celulasXlsx(a: ArquivoExportado): Celula[][] {
  return lerXlsx(a.bytes).linhas;
}

/** Linhas do arquivo como texto, do XLSX ou do CSV. */
export function linhas(a: ArquivoExportado, formato: 'xlsx' | 'csv'): string[][] {
  return formato === 'xlsx' ? valores(celulasXlsx(a)) : lerCsv(a.bytes);
}

/** Índices das colunas da RN-051. */
export const COL = Object.fromEntries(COLUNAS.map((c, i) => [c, i])) as Record<(typeof COLUNAS)[number], number>;

/** As linhas sem o cabeçalho, a partir de `Codigo_Pergunta` (as 6 últimas colunas). */
export function itens(l: string[][]): string[][] {
  return l.slice(1).map((x) => x.slice(COL.Codigo_Pergunta));
}
