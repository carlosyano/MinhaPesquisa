// Projetos, formulários e uploads de apoio (IA-TEST do IMP-002), sempre pela API.
// Conteúdo 100% sintético (Q-001).

import { expect } from 'vitest';
import { lerPdf, type PaginaRenderizada } from './arquivos.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from './cliente.js';

export type Pergunta = Record<string, unknown> & { codigo: string; tipo: string; pagina: number; ordem: number };
export interface Conteudo {
  perguntas: Pergunta[];
  regras_salto: { pergunta_origem_codigo: string; pergunta_destino_codigo: string; opcao_codigo: string }[];
}

/** Total de páginas da versão de referência. */
export const PAGINAS_VERSAO = 4;

/**
 * Versão de referência: 4 páginas; os 5 campos da RN-017 na página 1; sim/não, texto livre,
 * escolha única, número e múltipla escolha; uma regra de salto (RN-021).
 */
export function conteudoValido(): Conteudo {
  let ordem = 0;
  const q = (p: Omit<Pergunta, 'ordem'>): Pergunta => ({ ...p, ordem: ++ordem }) as Pergunta;
  return {
    perguntas: [
      q({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', pagina: 1, campo_respondente: 'nome' }),
      q({ codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 1, campo_respondente: 'data_nascimento' }),
      q({ codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 1, campo_respondente: 'cpf' }),
      q({ codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 1, campo_aplicacao: 'data_aplicacao' }),
      q({ codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', pagina: 1, campo_aplicacao: 'local_aplicacao' }),
      q({ codigo: 'PRESSAO_ALTA', tipo: 'sim_nao', enunciado: 'Tem pressão alta?', pagina: 2 }),
      q({ codigo: 'USA_MEDICAMENTO', tipo: 'sim_nao', enunciado: 'Usa medicamento de uso contínuo?', pagina: 2 }),
      q({ codigo: 'QUAIS_MEDICAMENTOS', tipo: 'texto_livre', enunciado: 'Quais medicamentos?', pagina: 3 }),
      q({
        codigo: 'ESTADO_CIVIL',
        tipo: 'escolha_unica',
        enunciado: 'Estado civil',
        pagina: 3,
        opcoes: [
          { codigo: 'solteiro', rotulo: 'Solteiro(a)', ordem: 1 },
          { codigo: 'casado', rotulo: 'Casado(a)', ordem: 2 },
          { codigo: 'viuvo', rotulo: 'Viúvo(a)', ordem: 3 },
        ],
      }),
      q({ codigo: 'HORAS_SONO', tipo: 'numero', enunciado: 'Horas de sono por noite', pagina: 4, valor_min: 0, valor_max: 24, unidade: 'h' }),
      q({
        codigo: 'ALIMENTOS',
        tipo: 'multipla_escolha',
        enunciado: 'O que comeu ontem?',
        pagina: 4,
        opcoes: [
          { codigo: 'frutas', rotulo: 'Frutas', ordem: 1 },
          { codigo: 'verduras', rotulo: 'Verduras', ordem: 2 },
          { codigo: 'nenhuma_das_anteriores', rotulo: 'Nenhuma das anteriores', ordem: 3 },
        ],
      }),
    ],
    regras_salto: [{ pergunta_origem_codigo: 'USA_MEDICAMENTO', pergunta_destino_codigo: 'QUAIS_MEDICAMENTOS', opcao_codigo: 'sim' }],
  };
}

export async function criarProjeto(admin: Cliente, nome: string, extra: Record<string, unknown> = {}): Promise<Resposta> {
  return admin.post('/projects', { corpo: { nome, ...extra }, headers: { 'idempotency-key': chaveIdempotencia() } });
}

export async function projetoCriado(admin: Cliente, nome: string): Promise<string> {
  const r = await criarProjeto(admin, nome);
  expect(r.status, r.texto).toBe(201);
  return r.corpo.id;
}

// Formulário de cada versão e último formulário criado em cada projeto (IA-TEST do IMP-010, CHG-019).
// Desde a DEC-215 todo envio informa o `formulario_id`; os testes que não são sobre a escolha usam o
// formulário da versão que já enviam ou, sem versão, o último criado no projeto. Quem precisa de outro
// passa `formularioId` (ver `enviar`).
const formularioDaVersao = new Map<string, string>();
const ultimoFormulario = new Map<string, string>();

/** Guarda o formulário recém-criado para o `enviar` (também usado por `papel-antigo.ts`). */
export function registrarFormulario(projetoId: string, formId: string, versaoId: string): void {
  formularioDaVersao.set(versaoId, formId);
  ultimoFormulario.set(projetoId, formId);
}

/** Formulário do envio: o da versão dada, senão o último criado no projeto; falha o teste se não houver. */
export function formularioDoEnvio(projetoId: string, versaoId?: string): string {
  const id = (versaoId && formularioDaVersao.get(versaoId)) || ultimoFormulario.get(projetoId);
  if (!id) throw new Error(`IA-TEST: projeto ${projetoId} sem formulário criado pelos auxiliares; informe formularioId`);
  return id;
}

export async function criarFormulario(admin: Cliente, projetoId: string, nome: string): Promise<{ formId: string; versaoId: string }> {
  const r = await admin.post('/forms', { corpo: { nome, projeto_id: projetoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
  expect(r.status, r.texto).toBe(201);
  expect(r.corpo.versoes).toHaveLength(1);
  registrarFormulario(projetoId, r.corpo.id, r.corpo.versoes[0].id);
  return { formId: r.corpo.id, versaoId: r.corpo.versoes[0].id };
}

export function caminhoVersao(formId: string, versaoId: string): string {
  return `/forms/${formId}/versions/${versaoId}`;
}

/** Lê a versão para obter o ETag e grava o conteúdo com If-Match (REQ §6.5). */
export async function salvarConteudo(admin: Cliente, formId: string, versaoId: string, conteudo: Conteudo): Promise<Resposta> {
  const atual = await admin.get(caminhoVersao(formId, versaoId));
  expect(atual.status, atual.texto).toBe(200);
  const etag = atual.headers.get('etag');
  expect(etag).toBeTruthy();
  return admin.requisitar('PUT', caminhoVersao(formId, versaoId), { corpo: conteudo, headers: { 'if-match': etag! } });
}

export async function publicar(admin: Cliente, formId: string, versaoId: string): Promise<Resposta> {
  return admin.post(`${caminhoVersao(formId, versaoId)}/publish`);
}

export interface FormularioPublicado {
  formId: string;
  versaoId: string;
  pdf: Buffer;
  paginas: PaginaRenderizada[];
}

/** Formulário com a versão de referência publicada e o PDF gerado e renderizado. */
export async function formularioPublicado(admin: Cliente, projetoId: string, nome: string, conteudo = conteudoValido()): Promise<FormularioPublicado> {
  const { formId, versaoId } = await criarFormulario(admin, projetoId, nome);
  const s = await salvarConteudo(admin, formId, versaoId, conteudo);
  expect(s.status, s.texto).toBe(200);
  const p = await publicar(admin, formId, versaoId);
  expect(p.status, p.texto).toBe(200);
  const pdf = await admin.baixar(`${caminhoVersao(formId, versaoId)}/pdf`);
  expect(pdf.status, pdf.texto.slice(0, 500)).toBe(200);
  expect(pdf.headers.get('content-type') ?? '').toMatch(/^application\/pdf/);
  return { formId, versaoId, pdf: pdf.bytes, paginas: await lerPdf(pdf.bytes) };
}

export function arquivo(nome: string, tipo: string, bytes: Buffer): Arquivo {
  return { nome, tipo, bytes };
}

/**
 * `uploadImages` com o `formulario_id` obrigatório (DEC-215): `formularioId` explícito ou, sem ele, o
 * último formulário criado no projeto pelos auxiliares. `formularioId: null` omite o campo (CA-061, exemplo 2).
 */
export async function enviar(dig: Cliente, projetoId: string, arquivos: Arquivo[], chave = chaveIdempotencia(), formularioId?: string | null): Promise<Resposta> {
  const campos: [string, string | Arquivo][] = arquivos.map((a) => ['arquivos', a]);
  if (formularioId !== null) campos.push(['formulario_id', formularioId ?? formularioDoEnvio(projetoId)]);
  return dig.enviarFormulario(`/projects/${projetoId}/applications/upload`, campos, { 'idempotency-key': chave });
}
