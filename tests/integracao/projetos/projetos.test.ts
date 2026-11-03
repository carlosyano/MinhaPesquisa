// Cadastro e ciclo de vida de projetos (RF-003, CA-027, DEC-027, DEC-055, RN-004).
// A parte do CA-027 sobre revisões e relatórios de projeto arquivado é observável só no
// IMP-003 e no IMP-004; aqui: recusa de upload, reativação e histórico com data, hora e usuário.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jpeg, pdfDeImagens, semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, pessoa, tenantComAdmin, type Pessoa, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, criarProjeto, enviar, formularioPublicado, projetoCriado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let admin: Cliente;
let digitalizador: Pessoa;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComAdmin(h, 'Tenant Projetos');
  admin = await entrar(h, T.admin);
  digitalizador = await pessoa(h, T.tenantId, ['digitalizador'], 'dig.projetos');
});
afterAll(async () => {
  await h?.close();
});

describe('RF-003 — cadastro de projetos', () => {
  // @trace RF-003, CA-027, DEC-027, DEC-055
  it('administrador cria projeto ativo com grupo mínimo padrão 5; criação no histórico e na auditoria', async () => {
    const r = await criarProjeto(admin, 'Saúde Idoso', { descricao: 'Pesquisa fictícia de hábitos' });
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo).toMatchObject({ nome: 'Saúde Idoso', descricao: 'Pesquisa fictícia de hábitos', status: 'ativo', grupo_minimo: 5 });
    expect(r.headers.get('etag')).toBeTruthy();
    const hist = await h.inspect.historicoStatusProjeto(r.corpo.id);
    expect(hist).toEqual([{ status: 'ativo', usuario_id: T.admin.usuarioId, registrado_em: h.clock.now() }]);
    expect(await h.inspect.auditoria(T.tenantId)).toContainEqual(
      expect.objectContaining({ usuario_id: T.admin.usuarioId, registro_id: r.corpo.id }),
    );
  });

  // @trace RF-003, RN-026, DEC-055
  it.each([
    [1, 201],
    [1000, 201],
    [0, 400],
    [1001, 400],
  ])('grupo_minimo = %i → %i', async (grupo, status) => {
    const r = await criarProjeto(admin, `Projeto grupo ${grupo}`, { grupo_minimo: grupo });
    if (status === 201) {
      expect(r.status, r.texto).toBe(201);
      expect(r.corpo.grupo_minimo).toBe(grupo);
    } else esperarErro(r, 'ERR-001');
  });

  // @trace RF-003, ERR-016
  it.each([['digitalizador'], ['analista']] as const)('perfil %s não cria projeto (ERR-016)', async (perfil) => {
    const p = await pessoa(h, T.tenantId, [perfil], `sem.permissao.${perfil}`);
    const c = await entrar(h, p);
    const antes = (await c.get('/projects')).corpo?.meta?.total;
    esperarErro(await criarProjeto(c, 'Não deve existir'), 'ERR-016');
    expect((await c.get('/projects')).corpo?.meta?.total).toBe(antes);
  });

  // @trace RF-003, DEC-055, RN-027
  it('alteração de grupo_minimo com If-Match é auditada; If-Match antigo → ERR-017', async () => {
    const id = await projetoCriado(admin, 'Projeto alterável');
    const atual = await admin.get(`/projects/${id}`);
    const etag = atual.headers.get('etag')!;
    const ok = await admin.patch(`/projects/${id}`, { corpo: { grupo_minimo: 8 }, headers: { 'if-match': etag } });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.grupo_minimo).toBe(8);
    expect(ok.headers.get('etag')).not.toBe(etag);
    const eventos = (await h.inspect.auditoria(T.tenantId)).filter((e) => e.registro_id === id);
    expect(eventos.length).toBeGreaterThanOrEqual(2); // criação e alteração
    esperarErro(await admin.patch(`/projects/${id}`, { corpo: { grupo_minimo: 9 }, headers: { 'if-match': etag } }), 'ERR-017');
    expect((await admin.get(`/projects/${id}`)).corpo.grupo_minimo).toBe(8);
  });

  // @trace RF-003, RN-004
  it('listProjects devolve só os projetos vinculados ao usuário', async () => {
    const x = await projetoCriado(admin, 'Projeto vinculado');
    await projetoCriado(admin, 'Projeto não vinculado');
    const p = await pessoa(h, T.tenantId, ['digitalizador'], 'dig.vinculo', { projetos: [x] });
    const c = await entrar(h, p);
    const r = await c.get('/projects');
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.itens.map((i: { id: string }) => i.id)).toEqual([x]);
    expect(r.corpo.meta).toMatchObject({ pagina: 1, limite: 20, total: 1 });
  });
});

describe('CA-027 — ciclo de vida do projeto', () => {
  // @trace CA-027, DEC-027, ERR-001, ERR-018
  it('arquivar recusa novos uploads (ERR-001, nada gravado); reativar libera; histórico com data, hora e usuário', async () => {
    const id = await projetoCriado(admin, 'Saúde Idoso arquivável');
    const form = await formularioPublicado(admin, id, 'Demografia');
    const dig = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.arquivo', { projetos: [id] }));
    const pdf = arquivo('formulario.pdf', 'application/pdf', form.pdf);

    await h.clock.advance(60_000);
    const arquivado = await admin.post(`/projects/${id}/archive`);
    expect(arquivado.status, arquivado.texto).toBe(200);
    expect(arquivado.corpo.status).toBe('arquivado');
    const quandoArquivou = h.clock.now();

    const antes = await h.inspect.contagemUpload(T.tenantId);
    esperarErro(await enviar(dig, id, [pdf]), 'ERR-001');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
    esperarErro(await admin.post(`/projects/${id}/archive`), 'ERR-018');

    await h.clock.advance(60_000);
    const reativado = await admin.post(`/projects/${id}/unarchive`);
    expect(reativado.status, reativado.texto).toBe(200);
    expect(reativado.corpo.status).toBe('ativo');
    esperarErro(await admin.post(`/projects/${id}/unarchive`), 'ERR-018');

    const envio = await enviar(dig, id, [pdf]);
    expect(envio.status, envio.texto).toBe(202);

    const hist = await h.inspect.historicoStatusProjeto(id);
    expect(hist.map((m) => m.status)).toEqual(['ativo', 'arquivado', 'ativo']);
    expect(hist.every((m) => m.usuario_id === T.admin.usuarioId)).toBe(true);
    expect(hist[1].registrado_em).toEqual(quandoArquivou);
    expect(hist[2].registrado_em).toEqual(h.clock.now());
  });

  // @trace CA-027, FL-001
  it('aplicação aberta antes do arquivamento continua o fluxo (identificação manual)', async () => {
    const id = await projetoCriado(admin, 'Projeto com aplicação em andamento');
    const form = await formularioPublicado(admin, id, 'Demografia');
    const dig = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.andamento', { projetos: [id] }));
    const imagens = [await jpeg(form.paginas[0]), await semQr(form.paginas[1]), await jpeg(form.paginas[2]), await jpeg(form.paginas[3])];
    const envio = await enviar(dig, id, [arquivo('lote.pdf', 'application/pdf', await pdfDeImagens(imagens))]);
    expect(envio.status, envio.texto).toBe(202);
    expect(envio.corpo.estado).toBe('identificacao_pendente');

    expect((await admin.post(`/projects/${id}/archive`)).status).toBe(200);
    const r = await dig.post(`/applications/${envio.corpo.aplicacao_id}/identify`, {
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
    const id = await projetoCriado(admin, 'Projeto com página faltante');
    const form = await formularioPublicado(admin, id, 'Demografia');
    const dig = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.faltante', { projetos: [id] }));
    const tres = await Promise.all([0, 1, 3].map(async (i) => arquivo(`p${i + 1}.jpg`, 'image/jpeg', await jpeg(form.paginas[i]))));
    const envio = await enviar(dig, id, tres);
    expect(envio.status, envio.texto).toBe(202);
    expect(envio.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });

    expect((await admin.post(`/projects/${id}/archive`)).status).toBe(200);
    const add = await dig.enviarArquivos(
      `/applications/${envio.corpo.aplicacao_id}/pages`,
      [arquivo('p3.jpg', 'image/jpeg', await jpeg(form.paginas[2]))],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(add.status, add.texto).toBe(200);
    expect(add.corpo.estado).toBe('em_leitura');
  });

  // @trace CA-027, RF-003, ERR-016
  it('só o administrador arquiva e reativa', async () => {
    const id = await projetoCriado(admin, 'Projeto protegido');
    const dig = await entrar(h, digitalizador);
    esperarErro(await dig.post(`/projects/${id}/archive`), 'ERR-016');
    expect((await admin.get(`/projects/${id}`)).corpo.status).toBe('ativo');
    expect(await h.inspect.historicoStatusProjeto(id)).toHaveLength(1);
  });
});
