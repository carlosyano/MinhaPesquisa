// Isolamento entre tenants nas operações do IMP-002 (CA-012 com /projects, TS-001, RN-002,
// RN-023): recurso de outro tenant responde 404 ERR-002, com corpo idêntico ao de ID
// inexistente, a tentativa é auditada no tenant de quem tentou e nada muda no outro tenant.

import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jpeg, pdfDeImagens, semQr } from '../../support/arquivos.js';
import { esperarErro, semCorrelacao } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, pessoa, tenantComAdmin, type Pessoa, type TenantPronto } from '../../support/cenarios.js';
import {
  arquivo,
  caminhoVersao,
  conteudoValido,
  criarFormulario,
  enviar,
  formularioPublicado,
  projetoCriado,
  type FormularioPublicado,
} from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let A: TenantPronto;
let B: TenantPronto;
let usuarioA: Pessoa;
let a: Cliente;
let projetoA: string;
let projetoB: string;
let formB: FormularioPublicado;
let rascunhoB: { formId: string; versaoId: string };
let aplicacaoB: { id: string; imagemId: string };

beforeAll(async () => {
  h = await criarHarness();
  A = await tenantComAdmin(h, 'Tenant A');
  B = await tenantComAdmin(h, 'Tenant B');
  const adminB = await entrar(h, B.admin);
  projetoB = await projetoCriado(adminB, 'Saúde Idoso B');
  formB = await formularioPublicado(adminB, projetoB, 'Demografia B');
  rascunhoB = await criarFormulario(adminB, projetoB, 'Rascunho B');
  const digB = await entrar(h, await pessoa(h, B.tenantId, ['digitalizador'], 'b.dig', { projetos: [projetoB] }));
  const imgs = [await jpeg(formB.paginas[0]), await semQr(formB.paginas[1]), await jpeg(formB.paginas[2]), await jpeg(formB.paginas[3])];
  const envio = await enviar(digB, projetoB, [arquivo('b.pdf', 'application/pdf', await pdfDeImagens(imgs))]);
  expect(envio.status, envio.texto).toBe(202);
  aplicacaoB = { id: envio.corpo.aplicacao_id, imagemId: envio.corpo.paginas[1].imagem_id };

  // Usuário de A com todos os perfis, para que a recusa venha do escopo e não do perfil.
  usuarioA = await pessoa(h, A.tenantId, ['admin_tenant', 'digitalizador', 'analista'], 'a.todos');
  a = await entrar(h, usuarioA);
  projetoA = await projetoCriado(a, 'Saúde Idoso A');
});
afterAll(async () => {
  await h?.close();
});

async function esperarNaoEncontradoAuditado(tentativa: () => Promise<Resposta>): Promise<Resposta> {
  const doUsuario = async (tenant: string) => (await h.inspect.auditoria(tenant)).filter((e) => e.usuario_id === usuarioA.usuarioId).length;
  const antes = await doUsuario(A.tenantId);
  const r = await tentativa();
  esperarErro(r, 'ERR-002');
  expect(await doUsuario(A.tenantId)).toBeGreaterThan(antes);
  expect(await doUsuario(B.tenantId)).toBe(0);
  return r;
}

describe('CA-012 — isolamento entre tenants em /projects', () => {
  // @trace CA-012, TS-001, RN-002
  it('exemplos 1 e 2: GET /projects/{id-B} → 404 auditado, corpo idêntico ao de ID inexistente', async () => {
    const outro = await esperarNaoEncontradoAuditado(() => a.get(`/projects/${projetoB}`));
    const inexistente = await esperarNaoEncontradoAuditado(() => a.get(`/projects/${randomUUID()}`));
    expect(semCorrelacao(outro)).toEqual(semCorrelacao(inexistente));
  });

  // @trace CA-012, TS-001, CA-027
  it('exemplo 3: POST /projects/{id-B}/archive → 404; projeto do tenant-B inalterado', async () => {
    await esperarNaoEncontradoAuditado(() => a.post(`/projects/${projetoB}/archive`));
    const hist = await h.inspect.historicoStatusProjeto(projetoB);
    expect(hist.map((m) => m.status)).toEqual(['ativo']);
  });

  // @trace CA-012
  it('exemplo 4: GET /projects/{id-A} → 200', async () => {
    const r = await a.get(`/projects/${projetoA}`);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.id).toBe(projetoA);
  });

  // @trace CA-012, RN-004
  it('listProjects não mostra projetos de outro tenant', async () => {
    const r = await a.get('/projects');
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.itens.map((p: { id: string }) => p.id)).not.toContain(projetoB);
  });
});

describe('TS-001 — demais operações do IMP-002 com recursos de outro tenant', () => {
  const idem = () => ({ 'idempotency-key': chaveIdempotencia() });
  const casos: [string, () => Promise<Resposta>][] = [
    ['updateProject', () => a.patch(`/projects/${projetoB}`, { corpo: { nome: 'Invadido' }, headers: { 'if-match': '"qualquer"' } })],
    ['unarchiveProject', () => a.post(`/projects/${projetoB}/unarchive`)],
    ['listForms', () => a.get(`/projects/${projetoB}/forms`)],
    ['createForm', () => a.post('/forms', { corpo: { nome: 'Invasor', projeto_id: projetoB }, headers: idem() })],
    ['createVersion', () => a.post(`/forms/${formB.formId}/versions`, { corpo: { copiar_de_versao_id: formB.versaoId }, headers: idem() })],
    ['getVersion', () => a.get(caminhoVersao(formB.formId, formB.versaoId))],
    [
      'updateVersion',
      () => a.requisitar('PUT', caminhoVersao(rascunhoB.formId, rascunhoB.versaoId), { corpo: conteudoValido(), headers: { 'if-match': '"qualquer"' } }),
    ],
    ['publishVersion', () => a.post(`${caminhoVersao(rascunhoB.formId, rascunhoB.versaoId)}/publish`)],
    ['generatePdf', () => a.get(`${caminhoVersao(formB.formId, formB.versaoId)}/pdf`)],
    ['uploadImages', async () => enviar(a, projetoB, [arquivo('x.pdf', 'application/pdf', formB.pdf)])],
    [
      'identifyApplication',
      () =>
        a.post(`/applications/${aplicacaoB.id}/identify`, {
          corpo: { versao_id: formB.versaoId, paginas: [{ imagem_id: aplicacaoB.imagemId, numero_pagina: 2 }] },
          headers: idem(),
        }),
    ],
    [
      'addApplicationPages',
      async () => a.enviarArquivos(`/applications/${aplicacaoB.id}/pages`, [arquivo('p.jpg', 'image/jpeg', await jpeg(formB.paginas[1]))], idem()),
    ],
    ['getPageImage', () => a.get(`/applications/${aplicacaoB.id}/pages/${aplicacaoB.imagemId}/image`)],
  ];

  // @trace TS-001, RN-023, CA-012
  it.each(casos)('%s com recurso do tenant-B → 404 ERR-002 auditado, sem efeito no tenant-B', async (_op, tentativa) => {
    const contagemB = await h.inspect.contagemUpload(B.tenantId);
    await esperarNaoEncontradoAuditado(tentativa);
    expect(await h.inspect.contagemUpload(B.tenantId)).toEqual(contagemB);
    expect(await h.inspect.leiturasSolicitadas(aplicacaoB.id)).toBe(0);
  });

  // @trace TS-001, RN-042
  it('versões e projeto do tenant-B seguem como estavam', async () => {
    const adminB = await entrar(h, B.admin);
    expect((await adminB.get(`/projects/${projetoB}`)).corpo).toMatchObject({ nome: 'Saúde Idoso B', status: 'ativo' });
    expect((await adminB.get(caminhoVersao(rascunhoB.formId, rascunhoB.versaoId))).corpo.resumo.status).toBe('rascunho');
    const forms = await adminB.get(`/projects/${projetoB}/forms`);
    expect(forms.corpo.itens.map((f: { nome: string }) => f.nome).sort()).toEqual(['Demografia B', 'Rascunho B']);
  });
});
