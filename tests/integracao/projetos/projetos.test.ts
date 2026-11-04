// Cadastro e ciclo de vida de projetos (RF-003, CA-027, DEC-027, RN-004).
// A parte do CA-027 sobre revisões e relatórios de projeto arquivado é observável só no
// IMP-003 e no IMP-004; aqui: recusa de upload, reativação e histórico com data, hora e usuário.
// Desde o IMP-005 o projeto não tem grupo mínimo (DEC-110) e a única usuária faz tudo (DEC-109).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jpeg, pdfDeImagens, semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, criarProjeto, enviar, formularioPublicado, projetoCriado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComUsuaria(h, 'Tenant Projetos');
  c = await entrar(h, T.usuaria);
});
afterAll(async () => {
  await h?.close();
});

describe('RF-003 — cadastro de projetos', () => {
  // @trace RF-003, CA-027, DEC-027
  it('a usuária cria projeto ativo; criação no histórico e na auditoria', async () => {
    const r = await criarProjeto(c, 'Saúde Idoso', { descricao: 'Pesquisa fictícia de hábitos' });
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo).toMatchObject({ nome: 'Saúde Idoso', descricao: 'Pesquisa fictícia de hábitos', status: 'ativo' });
    expect(r.corpo).not.toHaveProperty('grupo_minimo');
    expect(r.headers.get('etag')).toBeTruthy();
    const hist = await h.inspect.historicoStatusProjeto(r.corpo.id);
    expect(hist).toEqual([{ status: 'ativo', usuario_id: T.usuaria.usuarioId, registrado_em: h.clock.now() }]);
    expect(await h.inspect.auditoria(T.tenantId)).toContainEqual(
      expect.objectContaining({ usuario_id: T.usuaria.usuarioId, registro_id: r.corpo.id }),
    );
  });

  // @trace RF-003, DEC-110, ERR-001
  it('grupo_minimo não existe mais na criação nem na alteração (ERR-001)', async () => {
    esperarErro(await criarProjeto(c, 'Projeto com grupo', { grupo_minimo: 5 }), 'ERR-001');
    const id = await projetoCriado(c, 'Projeto sem grupo');
    const etag = (await c.get(`/projects/${id}`)).headers.get('etag')!;
    esperarErro(await c.patch(`/projects/${id}`, { corpo: { grupo_minimo: 8 }, headers: { 'if-match': etag } }), 'ERR-001');
  });

  // @trace RF-003, RN-027
  it('alteração de nome e descrição com If-Match é auditada; If-Match antigo → ERR-017', async () => {
    const id = await projetoCriado(c, 'Projeto alterável');
    const atual = await c.get(`/projects/${id}`);
    const etag = atual.headers.get('etag')!;
    const ok = await c.patch(`/projects/${id}`, { corpo: { nome: 'Projeto alterado', descricao: 'Nova descrição fictícia' }, headers: { 'if-match': etag } });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo).toMatchObject({ nome: 'Projeto alterado', descricao: 'Nova descrição fictícia' });
    expect(ok.headers.get('etag')).not.toBe(etag);
    const eventos = (await h.inspect.auditoria(T.tenantId)).filter((e) => e.registro_id === id);
    expect(eventos.length).toBeGreaterThanOrEqual(2); // criação e alteração
    esperarErro(await c.patch(`/projects/${id}`, { corpo: { nome: 'Outro nome' }, headers: { 'if-match': etag } }), 'ERR-017');
    expect((await c.get(`/projects/${id}`)).corpo.nome).toBe('Projeto alterado');
  });

  // @trace RF-003, RN-004, DEC-109
  it('listProjects devolve todos os projetos do tenant, sem vínculo, e nenhum de outro tenant', async () => {
    const outro = await tenantComUsuaria(h, 'Outro tenant');
    const deOutro = await projetoCriado(await entrar(h, outro.usuaria), 'Projeto de outro tenant');
    const x = await projetoCriado(c, 'Projeto X');
    const y = await projetoCriado(c, 'Projeto Y');
    const r = await c.get('/projects?limite=100');
    expect(r.status, r.texto).toBe(200);
    const ids = r.corpo.itens.map((i: { id: string }) => i.id);
    expect(ids).toEqual(expect.arrayContaining([x, y]));
    expect(ids).not.toContain(deOutro);
    expect(r.corpo.meta.total).toBe(ids.length);
  });
});

describe('CA-027 — ciclo de vida do projeto', () => {
  // @trace CA-027, DEC-027, ERR-001, ERR-018
  it('arquivar recusa novos uploads (ERR-001, nada gravado); reativar libera; histórico com data, hora e usuário', async () => {
    const id = await projetoCriado(c, 'Saúde Idoso arquivável');
    const form = await formularioPublicado(c, id, 'Demografia');
    const pdf = arquivo('formulario.pdf', 'application/pdf', form.pdf);

    await h.clock.advance(60_000);
    const arquivado = await c.post(`/projects/${id}/archive`);
    expect(arquivado.status, arquivado.texto).toBe(200);
    expect(arquivado.corpo.status).toBe('arquivado');
    const quandoArquivou = h.clock.now();

    const antes = await h.inspect.contagemUpload(T.tenantId);
    esperarErro(await enviar(c, id, [pdf]), 'ERR-001');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
    esperarErro(await c.post(`/projects/${id}/archive`), 'ERR-018');

    await h.clock.advance(60_000);
    const reativado = await c.post(`/projects/${id}/unarchive`);
    expect(reativado.status, reativado.texto).toBe(200);
    expect(reativado.corpo.status).toBe('ativo');
    esperarErro(await c.post(`/projects/${id}/unarchive`), 'ERR-018');

    const envio = await enviar(c, id, [pdf]);
    expect(envio.status, envio.texto).toBe(202);

    const hist = await h.inspect.historicoStatusProjeto(id);
    expect(hist.map((m) => m.status)).toEqual(['ativo', 'arquivado', 'ativo']);
    expect(hist.every((m) => m.usuario_id === T.usuaria.usuarioId)).toBe(true);
    expect(hist[1].registrado_em).toEqual(quandoArquivou);
    expect(hist[2].registrado_em).toEqual(h.clock.now());
  });

  // @trace CA-027, FL-001
  it('aplicação aberta antes do arquivamento continua o fluxo (identificação manual)', async () => {
    const id = await projetoCriado(c, 'Projeto com aplicação em andamento');
    const form = await formularioPublicado(c, id, 'Demografia');
    const imagens = [await jpeg(form.paginas[0]), await semQr(form.paginas[1]), await jpeg(form.paginas[2]), await jpeg(form.paginas[3])];
    const envio = await enviar(c, id, [arquivo('lote.pdf', 'application/pdf', await pdfDeImagens(imagens))]);
    expect(envio.status, envio.texto).toBe(202);
    expect(envio.corpo.estado).toBe('identificacao_pendente');

    expect((await c.post(`/projects/${id}/archive`)).status).toBe(200);
    const r = await c.post(`/applications/${envio.corpo.aplicacao_id}/identify`, {
      corpo: {
        versao_id: form.versaoId,
        paginas: envio.corpo.paginas.map((p: { imagem_id: string }, i: number) => ({ imagem_id: p.imagem_id, numero_pagina: i + 1 })),
      },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('em_leitura');
  });

  // @trace CA-027, DEC-098
  it('em projeto arquivado, a aplicação já aberta aceita a página faltante (addApplicationPages)', async () => {
    const id = await projetoCriado(c, 'Projeto com página faltante');
    const form = await formularioPublicado(c, id, 'Demografia');
    const tres = await Promise.all([0, 1, 3].map(async (i) => arquivo(`p${i + 1}.jpg`, 'image/jpeg', await jpeg(form.paginas[i]))));
    const envio = await enviar(c, id, tres);
    expect(envio.status, envio.texto).toBe(202);
    expect(envio.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });

    expect((await c.post(`/projects/${id}/archive`)).status).toBe(200);
    const add = await c.enviarArquivos(
      `/applications/${envio.corpo.aplicacao_id}/pages`,
      [arquivo('p3.jpg', 'image/jpeg', await jpeg(form.paginas[2]))],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(add.status, add.texto).toBe(200);
    expect(add.corpo.estado).toBe('em_leitura');
  });
});
