// Importação de formulário de apoio (IA-TEST do IMP-006), sempre pela API, com o extrator de
// estrutura simulado do harness (DEC-141). Os arquivos enviados são modelos em branco (DEC-133):
// com o extrator simulado, o que ele "lê" vem do roteiro, não da imagem.

import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import { expect } from 'vitest';
import { MB, pdfEmBranco } from './arquivos.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from './cliente.js';
import { arquivo, caminhoVersao, type Pergunta } from './formularios.js';
import type { Harness, PerguntaExtraida, RoteiroImportacao } from './harness.js';

/** Os 5 campos da RN-050, na ordem da tabela, com o tipo, a marcação e a sensibilidade. */
export const CAMPOS_RN050 = [
  { codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', campo_respondente: 'nome', sensibilidade: 'identificacao' },
  { codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', campo_respondente: 'data_nascimento', sensibilidade: 'identificacao' },
  { codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', campo_respondente: 'cpf', sensibilidade: 'identificacao' },
  { codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', campo_aplicacao: 'data_aplicacao', sensibilidade: 'outro' },
  { codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', campo_aplicacao: 'local_aplicacao', sensibilidade: 'outro' },
] as const;

export const CODIGOS_RN050 = CAMPOS_RN050.map((c) => c.codigo);

/** Pergunta lida pelo extrator. */
export function lida(enunciado: string, tipo: string, extra: Omit<PerguntaExtraida, 'enunciado' | 'tipo'> = {}): PerguntaExtraida {
  return { enunciado, tipo, ...extra };
}

/** Modelo em PDF com `paginas` páginas em branco. */
export async function modeloPdf(paginas: number, nome = 'questionario.pdf'): Promise<Arquivo> {
  return arquivo(nome, 'application/pdf', await pdfEmBranco(paginas));
}

/** Foto de página em JPEG, A4 a 300 dpi (2480 × 3508 px): maior que os 2000 px enviados ao extrator. */
export async function fotoGrande(nome = 'pagina.jpg'): Promise<Arquivo> {
  const canvas = createCanvas(2480, 3508);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.font = '60px sans-serif';
  ctx.fillText('Questionário fictício', 200, 300);
  return arquivo(nome, 'image/jpeg', await canvas.encode('jpeg', 85));
}

/** TIFF válido com `tamanho` bytes (tipo fora da DEC-029). */
export async function tiff(tamanho = 3 * MB): Promise<Buffer> {
  const img = await sharp({ create: { width: 200, height: 280, channels: 3, background: '#ffffff' } }).tiff().toBuffer();
  return Buffer.concat([img, Buffer.alloc(Math.max(0, tamanho - img.length))]);
}

export interface OpcoesImportacao {
  nome?: string;
  /** `null` omite o campo do multipart. */
  semDadosReais?: string | null;
  chave?: string;
  /** Marca a versão 1 como de papel antigo (DEC-175, DEC-181); acrescentado no IA-TEST do IMP-008. */
  papelAntigo?: boolean;
}

/** `importForm`: multipart com os arquivos, o nome do formulário e a declaração (DEC-133). */
export async function importar(c: Cliente, projetoId: string, arquivos: Arquivo[], o: OpcoesImportacao = {}): Promise<Resposta> {
  const campos: [string, string | Arquivo][] = arquivos.map((a) => ['arquivos', a]);
  campos.push(['nome_formulario', o.nome ?? 'Hábitos']);
  const declaracao = o.semDadosReais === undefined ? 'true' : o.semDadosReais;
  if (declaracao !== null) campos.push(['sem_dados_reais', declaracao]);
  if (o.papelAntigo !== undefined) campos.push(['papel_antigo', String(o.papelAntigo)]);
  return c.enviarFormulario(`/projects/${projetoId}/form-imports`, campos, { 'idempotency-key': o.chave ?? chaveIdempotencia() });
}

export async function consultarImportacao(c: Cliente, importacaoId: string): Promise<Resposta> {
  return c.get(`/form-imports/${importacaoId}`);
}

/** Roda o worker com as retentativas de 1 e 2 s (DEC-129), até não sobrar tarefa vencida. */
export async function processarComRetentativas(h: Harness): Promise<void> {
  await h.worker.processar();
  for (const ms of [1_000, 2_000]) {
    await h.clock.advance(ms);
    await h.worker.processar();
  }
}

/** Envia o modelo, programa o extrator e processa; devolve a importação já terminada. */
export async function importarEProcessar(
  h: Harness,
  c: Cliente,
  projetoId: string,
  roteiro: RoteiroImportacao,
  arquivos?: Arquivo[],
  nome = 'Hábitos',
): Promise<any> {
  const paginas = Math.max(1, ...Object.keys(roteiro).map(Number));
  const r = await importar(c, projetoId, arquivos ?? [await modeloPdf(paginas)], { nome });
  expect(r.status, r.texto).toBe(202);
  h.extrator.programar(r.corpo.id, roteiro);
  await processarComRetentativas(h);
  const fim = await consultarImportacao(c, r.corpo.id);
  expect(fim.status, fim.texto).toBe(200);
  return fim.corpo;
}

/** Conteúdo da versão criada pela importação concluída. */
export async function versaoImportada(c: Cliente, imp: { formulario_id: string; versao_id: string }): Promise<{ perguntas: Pergunta[]; regras_salto: unknown[] }> {
  const v = await c.get(caminhoVersao(imp.formulario_id, imp.versao_id));
  expect(v.status, v.texto).toBe(200);
  expect(v.corpo.resumo).toMatchObject({ numero: 1, status: 'rascunho' });
  return v.corpo.conteudo;
}

/** Perguntas na ordem do formulário: por página e, dentro dela, por ordem. */
export function emOrdem(perguntas: Pergunta[]): Pergunta[] {
  return [...perguntas].sort((a, b) => a.pagina - b.pagina || a.ordem - b.ordem);
}

export function porCodigo(perguntas: Pergunta[], codigo: string): Pergunta & Record<string, any> {
  const achada = perguntas.filter((p) => p.codigo === codigo);
  expect(achada, `pergunta ${codigo}`).toHaveLength(1);
  return achada[0];
}

export function codigosDe(itens: unknown): string[] {
  return ((itens ?? []) as { codigo: string }[]).map((o) => o.codigo);
}
