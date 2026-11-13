// Papel antigo de apoio (IA-TEST do IMP-008, CHG-017), sempre pela API, com o localizador e o motor
// simulados do harness (DEC-174, DEC-123). As folhas de papel antigo são imagens sintéticas sem QR e
// sem marcadores (DEC-169, DEC-170): com o localizador simulado, a página e as regiões vêm do roteiro
// ou do padrão descrito em harness.ts. Conteúdo 100% sintético (Q-001).
//
// Os CAs falam da "versão 2 de Condições de Saúde"; aqui a versão de papel antigo é a 1 do seu
// formulário, porque o número da versão não muda nenhuma regra da CHG-017.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import QRCode from 'qrcode';
import { expect } from 'vitest';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from './cliente.js';
import { arquivo, caminhoVersao, conteudoValido, formularioDoEnvio, publicar, registrarFormulario, salvarConteudo, type Conteudo, type Pergunta } from './formularios.js';
import type { Harness, OpcoesMotor, RegiaoNormalizada, RoteiroIdentificacao, RoteiroLeitura } from './harness.js';
import { confirmarPendentes } from './leitura.js';

/** Perguntas da RN-050 que PODEM ser marcadas `nao_consta` no papel antigo (DEC-179). */
export const PODEM_NAO_CONSTAR = ['CPF', 'DATA_NASCIMENTO', 'DATA_APLICACAO', 'LOCAL_APLICACAO'] as const;

/**
 * "Condições de Saúde", de papel antigo, com 2 páginas: na página 1, só NOME (identificação) e
 * PRESSAO (saúde), como no CA-055; na página 2, os outros 4 campos da RN-050 e ESTADO_CIVIL. As
 * perguntas de `naoConsta` saem marcadas `nao_consta` (DEC-179).
 */
export function conteudoCondicoes(naoConsta: readonly string[] = []): Conteudo {
  let ordem = 0;
  const q = (p: Omit<Pergunta, 'ordem'>): Pergunta => ({ ...p, ordem: ++ordem, ...(naoConsta.includes(p.codigo as string) ? { nao_consta: true } : {}) }) as Pergunta;
  const perguntas = [
    q({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', pagina: 1, campo_respondente: 'nome' }),
    q({ codigo: 'PRESSAO', tipo: 'sim_nao', enunciado: 'Tem pressão alta?', pagina: 1, sensibilidade: 'saude' }),
  ];
  perguntas.push(
    q({ codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 2, campo_respondente: 'data_nascimento' }),
    q({ codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 2, campo_respondente: 'cpf' }),
    q({ codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 2, campo_aplicacao: 'data_aplicacao' }),
    q({ codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', pagina: 2, campo_aplicacao: 'local_aplicacao' }),
    q({
      codigo: 'ESTADO_CIVIL',
      tipo: 'escolha_unica',
      enunciado: 'Estado civil',
      pagina: 2,
      opcoes: [
        { codigo: 'solteiro', rotulo: 'Solteiro(a)', ordem: 1 },
        { codigo: 'casado', rotulo: 'Casado(a)', ordem: 2 },
      ],
    }),
  );
  return { perguntas, regras_salto: [] };
}

/**
 * "Memórias Antigas" de papel antigo com a estrutura do CA-058 (sem MEDICAMENTOS_EM_USO): 3 páginas,
 * a página 3 sem perguntas (`total_paginas` = 3, DEC-181). CPF, data de nascimento e data da
 * aplicação, que o original não tem, no início da página 1 com `nao_consta` (DEC-190).
 */
export function conteudoMemorias(): Conteudo {
  let ordem = 0;
  const q = (p: Omit<Pergunta, 'ordem'>): Pergunta => ({ ...p, ordem: ++ordem }) as Pergunta;
  return {
    perguntas: [
      q({ codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 1, campo_respondente: 'data_nascimento', nao_consta: true }),
      q({ codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 1, campo_respondente: 'cpf', nao_consta: true }),
      q({ codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 1, campo_aplicacao: 'data_aplicacao', nao_consta: true }),
      q({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome', pagina: 1, campo_respondente: 'nome' }),
      q({
        codigo: 'ESTADO_CIVIL',
        tipo: 'escolha_unica',
        enunciado: 'Estado civil',
        pagina: 1,
        opcoes: [
          { codigo: 'solteiro', rotulo: 'Solteiro', ordem: 1 },
          { codigo: 'casado', rotulo: 'Casado', ordem: 2 },
        ],
      }),
      q({ codigo: 'PRESSAO_ALTA', tipo: 'sim_nao', enunciado: 'Pressão alta?', pagina: 2 }),
      q({ codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local', pagina: 2, campo_aplicacao: 'local_aplicacao' }),
    ],
    regras_salto: [],
  };
}

/** Versão oficial de 2 páginas (com QR): as páginas 1 e 2 da versão de referência do IMP-002. */
export function conteudoDuasPaginas(): Conteudo {
  const c = conteudoValido();
  return { perguntas: c.perguntas.filter((p) => p.pagina <= 2), regras_salto: [] };
}

export interface VersaoAntiga {
  formId: string;
  versaoId: string;
}

/** Rascunho de papel antigo pelo `createForm` com `papel_antigo` (DEC-175), com o conteúdo gravado. */
export async function rascunhoAntigo(admin: Cliente, projetoId: string, nome: string, conteudo: Conteudo, totalPaginas?: number): Promise<VersaoAntiga & { gravado: Resposta }> {
  const r = await admin.post('/forms', { corpo: { nome, projeto_id: projetoId, papel_antigo: true }, headers: { 'idempotency-key': chaveIdempotencia() } });
  expect(r.status, r.texto).toBe(201);
  const versaoId: string = r.corpo.versoes[0].id;
  expect(r.corpo.versoes[0].papel_antigo).toBe(true);
  registrarFormulario(projetoId, r.corpo.id, versaoId);
  const gravado = await salvarConteudo(admin, r.corpo.id, versaoId, {
    ...conteudo,
    papel_antigo: true,
    ...(totalPaginas === undefined ? {} : { total_paginas: totalPaginas }),
  } as Conteudo);
  return { formId: r.corpo.id, versaoId, gravado };
}

/** Versão de papel antigo publicada. */
export async function papelAntigoPublicado(admin: Cliente, projetoId: string, nome: string, conteudo: Conteudo, totalPaginas?: number): Promise<VersaoAntiga> {
  const { formId, versaoId, gravado } = await rascunhoAntigo(admin, projetoId, nome, conteudo, totalPaginas);
  expect(gravado.status, gravado.texto).toBe(200);
  const p = await publicar(admin, formId, versaoId);
  expect(p.status, p.texto).toBe(200);
  const v = await admin.get(caminhoVersao(formId, versaoId));
  expect(v.corpo.resumo).toMatchObject({ status: 'publicada', papel_antigo: true });
  return { formId, versaoId };
}

/**
 * Folha de papel antigo em JPEG (A4 a 150 dpi), sem QR e sem marcadores, com um rótulo que a torna
 * única. `qr` desenha um QR comum com esse conteúdo no canto, como o de um site (DEC-187).
 */
export async function folhaAntiga(rotulo: string, qr?: string): Promise<Buffer> {
  const canvas = createCanvas(1240, 1754);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#202020';
  ctx.font = '36px sans-serif';
  ctx.fillText(`Pesquisa de saúde (fictícia) — ${rotulo}`, 90, 140);
  for (let i = 0; i < 8; i++) {
    ctx.fillText(`Pergunta ${i + 1}: ______________________`, 90, 300 + i * 160);
  }
  if (qr) {
    const img = await loadImage(await QRCode.toBuffer(qr, { margin: 2, width: 220, errorCorrectionLevel: 'M' }));
    ctx.drawImage(img, canvas.width - 300, 60, 220, 220);
  }
  return canvas.encode('jpeg', 85);
}

/** `n` folhas de papel antigo, uma por arquivo. */
export async function folhasAntigas(n: number, prefixo = 'antiga'): Promise<Arquivo[]> {
  return Promise.all(Array.from({ length: n }, async (_, i) => arquivo(`${prefixo}-${i + 1}.jpg`, 'image/jpeg', await folhaAntiga(`${prefixo} ${i + 1}`))));
}

export interface OpcoesEnvio {
  versaoId?: string;
  /** Formulário escolhido no envio (DEC-215); padrão: o da versão ou o último criado no projeto. `null` omite o campo. */
  formularioId?: string | null;
  data?: string;
  local?: string;
  chave?: string;
}

function camposEnvio(arquivos: Arquivo[], o: OpcoesEnvio, projetoId?: string): [string, string | Arquivo][] {
  const campos: [string, string | Arquivo][] = arquivos.map((a) => ['arquivos', a]);
  // Só o uploadImages leva o formulário; o addApplicationPages usa o da aplicação (DEC-221).
  if (projetoId !== undefined && o.formularioId !== null) campos.push(['formulario_id', o.formularioId ?? formularioDoEnvio(projetoId, o.versaoId)]);
  if (o.versaoId) campos.push(['versao_id', o.versaoId]);
  if (o.data !== undefined) campos.push(['data_aplicacao', o.data]);
  if (o.local !== undefined) campos.push(['local_aplicacao', o.local]);
  return campos;
}

/** `uploadImages` com a versão escolhida e a data e o local do envio (DEC-169, DEC-179). */
export async function enviarAntigo(dig: Cliente, projetoId: string, arquivos: Arquivo[], o: OpcoesEnvio = {}): Promise<Resposta> {
  return dig.enviarFormulario(`/projects/${projetoId}/applications/upload`, camposEnvio(arquivos, o, projetoId), { 'idempotency-key': o.chave ?? chaveIdempotencia() });
}

/** `addApplicationPages` com a versão e a data e o local, que substituem os do envio (DEC-185). */
export async function acrescentar(dig: Cliente, aplicacaoId: string, arquivos: Arquivo[], o: OpcoesEnvio = {}): Promise<Resposta> {
  return dig.enviarFormulario(`/applications/${aplicacaoId}/pages`, camposEnvio(arquivos, o), { 'idempotency-key': o.chave ?? chaveIdempotencia() });
}

export type PaginaInformada = { imagem_id: string; numero_pagina: number } | { imagem_id: string; descartar: true };

export async function identificar(dig: Cliente, aplicacaoId: string, versaoId: string, paginas: PaginaInformada[]): Promise<Resposta> {
  return dig.post(`/applications/${aplicacaoId}/identify`, { corpo: { versao_id: versaoId, paginas }, headers: { 'idempotency-key': chaveIdempotencia() } });
}

/** `imagem_id` das folhas, na ordem da resposta do upload. */
export function imagens(r: Resposta): string[] {
  return (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);
}

/** As folhas na ordem dada, como páginas 1, 2, ... */
export function emSequencia(ids: string[]): PaginaInformada[] {
  return ids.map((imagem_id, i) => ({ imagem_id, numero_pagina: i + 1 }));
}

/** Programa o identificador e o motor e roda o worker com as retentativas de 1 e 2 s (DEC-129). */
export async function localizarELer(h: Harness, aplicacaoId: string, identificacao: RoteiroIdentificacao = {}, leitura: RoteiroLeitura = {}, opcoes?: OpcoesMotor): Promise<void> {
  h.identificador.programar(aplicacaoId, identificacao);
  h.motor.programar(aplicacaoId, leitura, opcoes);
  await h.worker.processar();
  for (const ms of [1_000, 2_000]) {
    await h.clock.advance(ms);
    await h.worker.processar();
  }
}

/** Faixa horizontal da página, de `y` com a altura dada. */
export function faixa(y: number, altura = 0.1): RegiaoNormalizada {
  return { x: 0.05, y, largura: 0.9, altura };
}

/** Leitura legível do papel antigo de "Condições de Saúde" (CA-054), com o CPF em branco. */
export function leiturasAntigas(extra: RoteiroLeitura = {}): RoteiroLeitura {
  const alta = (valor: string | null) => ({ valor, confianca: 0.97 });
  return {
    NOME: alta('Maria Souza'),
    PRESSAO: alta('sim'),
    DATA_NASCIMENTO: alta('1950-03-12'),
    CPF: alta(null),
    DATA_APLICACAO: alta('2024-05-10'),
    LOCAL_APLICACAO: alta('Centro Dia'),
    ESTADO_CIVIL: alta('casado'),
    ...extra,
  };
}

/** Envia 2 folhas de papel antigo com a versão escolhida, lê e resolve todos os itens: `em_revisao`. */
export async function antigaEmRevisao(h: Harness, dig: Cliente, projetoId: string, versaoId: string, leitura: RoteiroLeitura = leiturasAntigas()): Promise<string> {
  const r = await enviarAntigo(dig, projetoId, await folhasAntigas(2), { versaoId });
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.estado).toBe('em_leitura');
  const id: string = r.corpo.aplicacao_id;
  await localizarELer(h, id, {}, leitura);
  const aberta = await confirmarPendentes(dig, id);
  expect(aberta.corpo.estado).toBe('em_revisao');
  return id;
}
