// Montagem da aplicação e QR (CA-013, CA-039, CA-040, FL-001 tabela de criação e saída de
// identificacao_pendente, T-14). A ordem da tabela de criação vale quando há mais de uma condição.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comQr, conteudoForjado, jpeg, paginasDoPdf, semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, pessoa, tenantComAdmin, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let A: TenantPronto;
let adminA: Cliente;
let dig: Cliente;
let digId: string;
let projeto: string;
let outroProjeto: string;
let f: FormularioPublicado;
let outroForm: FormularioPublicado;
let formOutroProjeto: FormularioPublicado;
let formOutroTenant: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  A = await tenantComAdmin(h, 'Tenant A');
  adminA = await entrar(h, A.admin);
  projeto = await projetoCriado(adminA, 'Saúde Idoso');
  outroProjeto = await projetoCriado(adminA, 'Outro projeto');
  f = await formularioPublicado(adminA, projeto, 'Demografia');
  outroForm = await formularioPublicado(adminA, projeto, 'Hábitos');
  formOutroProjeto = await formularioPublicado(adminA, outroProjeto, 'Demografia do outro projeto');
  const B = await tenantComAdmin(h, 'Tenant B');
  const adminB = await entrar(h, B.admin);
  formOutroTenant = await formularioPublicado(adminB, await projetoCriado(adminB, 'Projeto B'), 'Demografia B');
  const p = await pessoa(h, A.tenantId, ['digitalizador'], 'dig.montagem', { projetos: [projeto, outroProjeto] });
  digId = p.usuarioId;
  dig = await entrar(h, p);
});
afterAll(async () => {
  await h?.close();
});

async function paginas(form: FormularioPublicado, numeros: number[]): Promise<Arquivo[]> {
  return Promise.all(numeros.map(async (n, i) => arquivo(`p${i + 1}.jpg`, 'image/jpeg', await jpeg(form.paginas[n - 1]))));
}

async function esperarPendente(r: Resposta, aviso: 'ERR-004' | 'ERR-039'): Promise<string> {
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso });
  expect(await h.inspect.leiturasSolicitadas(r.corpo.aplicacao_id)).toBe(0);
  return r.corpo.aplicacao_id;
}

function identificar(id: string, corpo: unknown): Promise<Resposta> {
  return dig.post(`/applications/${id}/identify`, { corpo, headers: { 'idempotency-key': chaveIdempotencia() } });
}

describe('CA-013 / CA-040 — páginas agrupadas por quem digitaliza', () => {
  // @trace CA-013, ERR-004, FL-001
  it('página faltante (1, 2 e 4) → identificacao_pendente com ERR-004; nada é lido', async () => {
    await esperarPendente(await enviar(dig, projeto, await paginas(f, [1, 2, 4])), 'ERR-004');
  });

  // @trace CA-013, ERR-004
  it('página repetida (1, 2, 2, 3, 4) → identificacao_pendente com ERR-004', async () => {
    await esperarPendente(await enviar(dig, projeto, await paginas(f, [1, 2, 2, 3, 4])), 'ERR-004');
  });

  // @trace CA-013, ERR-004, FL-001
  it('página de outro formulário do mesmo projeto → identificacao_pendente com ERR-004', async () => {
    const mistura = [...(await paginas(f, [1, 2, 3])), ...(await paginas(outroForm, [4]))];
    await esperarPendente(await enviar(dig, projeto, mistura), 'ERR-004');
  });

  // @trace CA-040, CA-013, ERR-004
  it('PDF com mais páginas que a versão (4 + 1) → uma aplicação com 5 páginas, no alerta do CA-013', async () => {
    const pdf = await paginasDoPdf(f.pdf, [1, 2, 3, 4, 4]);
    const r = await enviar(dig, projeto, [arquivo('lote.pdf', 'application/pdf', pdf)]);
    await esperarPendente(r, 'ERR-004');
    expect(r.corpo.paginas).toHaveLength(5);
  });

  // @trace CA-040, DEC-008
  it('todos os arquivos de um envio formam uma única aplicação', async () => {
    const antes = await h.inspect.contagemUpload(A.tenantId);
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 3, 4]));
    expect(r.status, r.texto).toBe(202);
    const depois = await h.inspect.contagemUpload(A.tenantId);
    expect(depois.aplicacoes - antes.aplicacoes).toBe(1);
    expect(depois.imagens - antes.imagens).toBe(4);
  });
});

describe('CA-039 — QR validado contra tenant, projeto e versão (T-14)', () => {
  async function auditada(aplicacaoId: string): Promise<void> {
    expect(await h.inspect.auditoria(A.tenantId)).toContainEqual(expect.objectContaining({ usuario_id: digId, registro_id: aplicacaoId }));
  }

  // @trace CA-039, ERR-039, T-14
  it('QR legível que não aponta para nenhuma versão → ERR-039; nada é lido; tentativa auditada', async () => {
    const imgs = await paginas(f, [1, 2, 3, 4]);
    imgs[2] = arquivo('p3.jpg', 'image/jpeg', await comQr(f.paginas[2], conteudoForjado(f.paginas[2].qr!.conteudo)));
    await auditada(await esperarPendente(await enviar(dig, projeto, imgs), 'ERR-039'));
  });

  // @trace CA-039, ERR-039, RN-002
  it('QR de versão de outro tenant → ERR-039; nada é lido; auditada', async () => {
    const imgs = await paginas(f, [1, 2, 3, 4]);
    imgs[0] = arquivo('p1.jpg', 'image/jpeg', await jpeg(formOutroTenant.paginas[0]));
    await auditada(await esperarPendente(await enviar(dig, projeto, imgs), 'ERR-039'));
  });

  // @trace CA-039, ERR-039
  it('QR de versão de outro projeto do mesmo tenant → ERR-039', async () => {
    await auditada(await esperarPendente(await enviar(dig, projeto, await paginas(formOutroProjeto, [1, 2, 3, 4])), 'ERR-039'));
  });

  // @trace FL-001
  it('ordem da tabela de criação: página sem QR (linha 1) prevalece sobre QR de outro tenant (linha 2) → ERR-004', async () => {
    const imgs = await paginas(f, [1, 2, 3, 4]);
    imgs[0] = arquivo('p1.jpg', 'image/jpeg', await jpeg(formOutroTenant.paginas[0]));
    imgs[1] = arquivo('p2.jpg', 'image/jpeg', await semQr(f.paginas[1]));
    await esperarPendente(await enviar(dig, projeto, imgs), 'ERR-004');
  });

  // @trace FL-001
  it('ordem da tabela de criação: QR de outro tenant (linha 2) prevalece sobre página faltante (linha 3) → ERR-039', async () => {
    const imgs = await paginas(f, [1, 2, 3]);
    imgs[0] = arquivo('p1.jpg', 'image/jpeg', await jpeg(formOutroTenant.paginas[0]));
    await esperarPendente(await enviar(dig, projeto, imgs), 'ERR-039');
  });
});

describe('FL-001 — saída de identificacao_pendente pelo digitalizador', () => {
  // @trace CA-004, FL-001, RF-006
  it('identifyApplication com versão e números de página → em_leitura e leitura solicitada', async () => {
    const imgs = await paginas(f, [1, 2, 3, 4]);
    imgs[1] = arquivo('p2.jpg', 'image/jpeg', await semQr(f.paginas[1]));
    const r = await enviar(dig, projeto, imgs);
    const id = await esperarPendente(r, 'ERR-004');
    const ok = await identificar(id, {
      versao_id: f.versaoId,
      paginas: (r.corpo.paginas as { imagem_id: string }[]).map((p, i) => ({ imagem_id: p.imagem_id, numero_pagina: i + 1 })),
    });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo).toMatchObject({ id, projeto_id: projeto, versao_id: f.versaoId, estado: 'em_leitura' });
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(1);
  });

  // @trace CA-013, IdentifyRequest, ERR-004
  it('identificação que continua incoerente → 400 ERR-004 e o estado não muda', async () => {
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 2, 3, 4]));
    const id = await esperarPendente(r, 'ERR-004');
    const imagens = (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);
    // Número repetido.
    esperarErro(await identificar(id, { versao_id: f.versaoId, paginas: imagens.map((imagem_id, i) => ({ imagem_id, numero_pagina: Math.min(i + 1, 4) })) }), 'ERR-004');
    // Imagem da aplicação ausente da lista.
    esperarErro(await identificar(id, { versao_id: f.versaoId, paginas: imagens.slice(0, 4).map((imagem_id, i) => ({ imagem_id, numero_pagina: i + 1 })) }), 'ERR-004');
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);

    // Descartando a repetida, fica coerente.
    const ok = await identificar(id, {
      versao_id: f.versaoId,
      paginas: [
        { imagem_id: imagens[0], numero_pagina: 1 },
        { imagem_id: imagens[1], numero_pagina: 2 },
        { imagem_id: imagens[2], descartar: true },
        { imagem_id: imagens[3], numero_pagina: 3 },
        { imagem_id: imagens[4], numero_pagina: 4 },
      ],
    });
    expect(ok.status, ok.texto).toBe(200);
    expect(ok.corpo.estado).toBe('em_leitura');
    expect(ok.corpo.paginas).toHaveLength(4);
  });

  // @trace CA-039, ERR-039
  it('identificar com versão de outro projeto do mesmo tenant → 400 ERR-039', async () => {
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 4]));
    const id = await esperarPendente(r, 'ERR-004');
    const imagens = (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);
    esperarErro(await identificar(id, { versao_id: formOutroProjeto.versaoId, paginas: imagens.map((imagem_id, i) => ({ imagem_id, numero_pagina: i + 1 })) }), 'ERR-039');
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);
  });

  // @trace DEC-100, CA-039, ERR-039, RN-002
  it('identificar com versão de outro tenant → 400 ERR-039 (não 404), auditado', async () => {
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 4]));
    const id = await esperarPendente(r, 'ERR-004');
    const imagens = (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);
    const antes = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.usuario_id === digId).length;
    esperarErro(await identificar(id, { versao_id: formOutroTenant.versaoId, paginas: imagens.map((imagem_id, i) => ({ imagem_id, numero_pagina: i + 1 })) }), 'ERR-039');
    expect((await h.inspect.auditoria(A.tenantId)).filter((e) => e.usuario_id === digId).length).toBeGreaterThan(antes);
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);
  });

  // @trace CA-013, FL-001, RN-040
  it('addApplicationPages com a página faltante → aplicação completa vai para em_leitura', async () => {
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 4]));
    const id = await esperarPendente(r, 'ERR-004');
    const add = await dig.enviarArquivos(`/applications/${id}/pages`, await paginas(f, [3]), { 'idempotency-key': chaveIdempotencia() });
    expect(add.status, add.texto).toBe(200);
    expect(add.corpo.estado).toBe('em_leitura');
    expect(add.corpo.paginas).toHaveLength(4);
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(1);
  });

  // @trace FL-001, ERR-018
  it('aplicação em_leitura não aceita identificação nem novas páginas (ERR-018)', async () => {
    const r = await enviar(dig, projeto, await paginas(f, [1, 2, 3, 4]));
    expect(r.corpo.estado).toBe('em_leitura');
    const id = r.corpo.aplicacao_id as string;
    const imagens = (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);
    esperarErro(await identificar(id, { versao_id: f.versaoId, paginas: imagens.map((imagem_id, i) => ({ imagem_id, numero_pagina: i + 1 })) }), 'ERR-018');
    esperarErro(await dig.enviarArquivos(`/applications/${id}/pages`, await paginas(f, [3]), { 'idempotency-key': chaveIdempotencia() }), 'ERR-018');
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(1);
  });
});
