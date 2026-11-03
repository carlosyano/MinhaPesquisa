// Upload de imagens (RF-006, CA-003, CA-004, CA-029, TS-002, RN-040, DEC-029, DEC-042, REQ §6.5).
// As páginas enviadas são o PDF gerado pela API, renderizado como scan ou foto (support/arquivos).
// Sem teto de custo atingido (IMP-003), aplicação completa e coerente entra em `em_leitura`.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  EICAR,
  MB,
  comGps,
  executavel,
  inflarPdf,
  jpeg,
  jpegComTamanho,
  metadados,
  paginasDoPdf,
  pdfDeImagens,
  pdfEmBranco,
  png,
  semQr,
} from '../../support/arquivos.js';
import { esperarErro, esperarErroCom } from '../../support/catalogo.js';
import { chaveIdempotencia, type Arquivo, type Cliente } from '../../support/cliente.js';
import { entrar, pessoa, tenantComAdmin, type TenantPronto } from '../../support/cenarios.js';
import { PAGINAS_VERSAO, arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let admin: Cliente;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComAdmin(h, 'Tenant Upload');
  admin = await entrar(h, T.admin);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia');
  dig = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.upload', { projetos: [projeto] }));
});
afterAll(async () => {
  await h?.close();
});

async function jpegs(): Promise<Arquivo[]> {
  return Promise.all(f.paginas.map(async (p) => arquivo(`pagina-${p.numero}.jpg`, 'image/jpeg', await jpeg(p))));
}

describe('CA-003 — upload identifica formulário, versão e página', () => {
  // @trace CA-003, RF-006, FL-001
  it('páginas em JPEG (uma por arquivo) → versão e páginas identificadas pelo QR, aplicação em_leitura e leitura solicitada uma vez', async () => {
    const r = await enviar(dig, projeto, await jpegs());
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('em_leitura');
    expect(r.corpo.aviso ?? null).toBeNull();
    expect(r.corpo.paginas).toHaveLength(PAGINAS_VERSAO);
    expect(r.corpo.paginas.map((p: { numero_pagina: number }) => p.numero_pagina)).toEqual([1, 2, 3, 4]);
    expect(r.corpo.paginas.every((p: { tipo: string; registro_ok: boolean }) => p.tipo === 'formulario' && p.registro_ok)).toBe(true);
    expect(await h.inspect.leiturasSolicitadas(r.corpo.aplicacao_id)).toBe(1);
  });

  // @trace CA-003, DEC-042
  it('a ordem dos arquivos não importa: a página vem do QR', async () => {
    const [p1, p2, p3, p4] = await jpegs();
    const r = await enviar(dig, projeto, [p3, p1, p4, p2]);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('em_leitura');
    expect([...r.corpo.paginas.map((p: { numero_pagina: number }) => p.numero_pagina)].sort()).toEqual([1, 2, 3, 4]);
  });

  // @trace CA-003, CA-029
  it('PNG e PDF escaneado também são aceitos', async () => {
    const pngs = await Promise.all(f.paginas.map(async (p) => arquivo(`p${p.numero}.png`, 'image/png', await png(p))));
    const r1 = await enviar(dig, projeto, pngs);
    expect(r1.status, r1.texto).toBe(202);
    expect(r1.corpo.estado).toBe('em_leitura');
    const scan = await pdfDeImagens(await Promise.all(f.paginas.map((p) => jpeg(p))));
    const r2 = await enviar(dig, projeto, [arquivo('scan.pdf', 'application/pdf', scan)]);
    expect(r2.status, r2.texto).toBe(202);
    expect(r2.corpo.estado).toBe('em_leitura');
  });
});

describe('CA-004 — upload sem QR legível', () => {
  // @trace CA-004, ERR-004, FL-001
  it('QR danificado na página 2 → identificacao_pendente com aviso ERR-004; nada é lido', async () => {
    const imgs = await jpegs();
    imgs[1] = arquivo('pagina-2.jpg', 'image/jpeg', await semQr(f.paginas[1]));
    const r = await enviar(dig, projeto, imgs);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
    expect(await h.inspect.leiturasSolicitadas(r.corpo.aplicacao_id)).toBe(0);
  });
});

describe('CA-029 / TS-002 — validação de segurança, tipo, tamanho e páginas', () => {
  async function esperarRecusa(arquivos: Arquivo[], motivo: string): Promise<void> {
    const antes = await h.inspect.contagemUpload(T.tenantId);
    const r = await enviar(dig, projeto, arquivos);
    esperarErroCom(r, 'ERR-029', motivo);
    expect(r.corpo.motivo).toBe(motivo);
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
  }

  // @trace CA-029
  it('exemplo 1: formulario.pdf de 15 MB e 4 páginas → aceito', async () => {
    const pdf = await inflarPdf(f.pdf, 15 * MB);
    const r = await enviar(dig, projeto, [arquivo('formulario.pdf', 'application/pdf', pdf)]);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('em_leitura');
  });

  // @trace CA-029, ERR-029
  it('exemplo 2: foto.jpg de 25 MB → "excede o limite de 20 MB"', async () => {
    await esperarRecusa([arquivo('foto.jpg', 'image/jpeg', jpegComTamanho(await jpeg(f.paginas[0]), 25 * MB))], 'excede o limite de 20 MB');
  });

  // @trace CA-029, ERR-029
  it('exemplo 3: dados.exe de 2 MB → "tipo de arquivo não permitido"', async () => {
    await esperarRecusa([arquivo('dados.exe', 'application/octet-stream', executavel(2 * MB))], 'tipo de arquivo não permitido');
  });

  // @trace CA-029, ERR-029, DEC-042
  it('exemplo 4: scan.png com conteúdo EICAR (MIME image/png) → "risco de segurança detectado" (antimalware antes do tipo)', async () => {
    await esperarRecusa([arquivo('scan.png', 'image/png', EICAR)], 'risco de segurança detectado');
  });

  // @trace CA-029, ERR-029, DEC-029
  it('exemplo 5: lote.pdf de 18 MB e 51 páginas → "excede o limite de 50 páginas"', async () => {
    await esperarRecusa([arquivo('lote.pdf', 'application/pdf', await inflarPdf(await pdfEmBranco(51), 18 * MB))], 'excede o limite de 50 páginas');
  });

  // @trace TS-002, ERR-029
  it('TS-002: .exe de 5 MB e depois .pdf de 25 MB → ambos recusados, nada processado', async () => {
    await esperarRecusa([arquivo('instalador.exe', 'application/x-msdownload', executavel(5 * MB))], 'tipo de arquivo não permitido');
    await esperarRecusa([arquivo('grande.pdf', 'application/pdf', await inflarPdf(f.pdf, 25 * MB))], 'excede o limite de 20 MB');
  });

  // @trace CA-029, DEC-042
  it('o tipo vem do conteúdo, não da extensão nem do MIME declarado', async () => {
    await esperarRecusa([arquivo('foto.jpg', 'image/jpeg', executavel(1 * MB))], 'tipo de arquivo não permitido');
    const r = await enviar(dig, projeto, [arquivo('documento.bin', 'application/octet-stream', f.pdf)]);
    expect(r.status, r.texto).toBe(202);
  });

  // @trace CA-029, DEC-029
  it('PDF de 50 páginas passa da validação de páginas (sem QR → identificacao_pendente, não ERR-029)', async () => {
    const r = await enviar(dig, projeto, [arquivo('lote.pdf', 'application/pdf', await pdfEmBranco(50))]);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
  });

  // @trace CA-029
  it('um arquivo recusado no envio recusa o envio inteiro; nada é gravado', async () => {
    const imgs = await jpegs();
    await esperarRecusa([...imgs.slice(0, 3), arquivo('scan.png', 'image/png', EICAR)], 'risco de segurança detectado');
  });
});

describe('RN-040 — metadados removidos no upload', () => {
  // @trace RN-040, DEC-042, RN-029, T-05
  it('foto de celular com EXIF e GPS: a imagem guardada não tem metadados; link assinado de 5 min', async () => {
    const imgs = await jpegs();
    // Página 2 com QR danificado para a aplicação ficar em identificacao_pendente, onde a imagem
    // é consultada pelo digitalizador (getPageImage).
    imgs[1] = arquivo('celular.jpg', 'image/jpeg', comGps(await semQr(f.paginas[1])));
    expect((await metadados(imgs[1].bytes)).latitude).toBeDefined();
    const r = await enviar(dig, projeto, imgs);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('identificacao_pendente');

    for (const p of r.corpo.paginas as { imagem_id: string }[]) {
      const img = await dig.get(`/applications/${r.corpo.aplicacao_id}/pages/${p.imagem_id}/image`);
      expect(img.status, img.texto).toBe(200);
      expect(new Date(img.corpo.expira_em).getTime()).toBe(h.clock.now().getTime() + 5 * 60_000);
      const baixada = await fetch(img.corpo.url);
      expect(baixada.status).toBe(200);
      expect(await metadados(Buffer.from(await baixada.arrayBuffer())), p.imagem_id).toEqual({});
    }
  });
});

describe('DEC-099 — quem vê a imagem da página (getPageImage)', () => {
  async function pendente(): Promise<{ id: string; imagem: string }> {
    const imgs = await jpegs();
    imgs[1] = arquivo('pagina-2.jpg', 'image/jpeg', await semQr(f.paginas[1]));
    const r = await enviar(dig, projeto, imgs);
    expect(r.corpo.estado).toBe('identificacao_pendente');
    return { id: r.corpo.aplicacao_id, imagem: r.corpo.paginas[1].imagem_id };
  }

  // @trace DEC-099, RN-029, RN-027
  it('digitalizador vinculado vê a imagem em identificacao_pendente; o acesso é auditado com o id da imagem', async () => {
    const { id, imagem } = await pendente();
    const outro = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.outro', { projetos: [projeto] }));
    const r = await outro.get(`/applications/${id}/pages/${imagem}/image`);
    expect(r.status, r.texto).toBe(200);
    expect(await h.inspect.auditoria(T.tenantId)).toContainEqual(expect.objectContaining({ registro_id: imagem }));
  });

  // @trace DEC-099, ERR-016, ERR-002
  it('analista e administrador sem perfil digitalizador → ERR-016; digitalizador sem vínculo → ERR-002', async () => {
    const { id, imagem } = await pendente();
    const analista = await entrar(h, await pessoa(h, T.tenantId, ['analista'], 'analista.img', { projetos: [projeto] }));
    esperarErro(await analista.get(`/applications/${id}/pages/${imagem}/image`), 'ERR-016');
    esperarErro(await admin.get(`/applications/${id}/pages/${imagem}/image`), 'ERR-016');
    const outroProjeto = await projetoCriado(admin, 'Projeto de outro digitalizador');
    const semVinculo = await entrar(h, await pessoa(h, T.tenantId, ['digitalizador'], 'dig.sem.vinculo', { projetos: [outroProjeto] }));
    esperarErro(await semVinculo.get(`/applications/${id}/pages/${imagem}/image`), 'ERR-002');
  });

  // @trace DEC-099, ERR-018
  it('aplicação em_leitura (sem reserva possível) → ERR-018', async () => {
    const r = await enviar(dig, projeto, await jpegs());
    expect(r.corpo.estado).toBe('em_leitura');
    esperarErro(await dig.get(`/applications/${r.corpo.aplicacao_id}/pages/${r.corpo.paginas[0].imagem_id}/image`), 'ERR-018');
  });
});

describe('RF-006 — permissão, vínculo e idempotência', () => {
  // @trace RF-006, ERR-016
  it('administrador sem o perfil digitalizador não envia (ERR-016)', async () => {
    const antes = await h.inspect.contagemUpload(T.tenantId);
    esperarErro(await enviar(admin, projeto, await jpegs()), 'ERR-016');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
  });

  // @trace RF-006, RN-004, ERR-002
  it('digitalizador não vinculado ao projeto → 404 ERR-002', async () => {
    const outroProjeto = await projetoCriado(admin, 'Projeto sem vínculo');
    const antes = await h.inspect.contagemUpload(T.tenantId);
    esperarErro(await enviar(dig, outroProjeto, await jpegs()), 'ERR-002');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
  });

  // @trace REQ §6.5, ERR-019, P.8
  it('mesma chave e mesmo conteúdo → mesma aplicação, sem duplicar; mesma chave e outro conteúdo → ERR-019', async () => {
    const chave = chaveIdempotencia();
    const imgs = await jpegs();
    const r1 = await enviar(dig, projeto, imgs, chave);
    expect(r1.status, r1.texto).toBe(202);
    const depois1 = await h.inspect.contagemUpload(T.tenantId);
    const r2 = await enviar(dig, projeto, imgs, chave);
    expect(r2.status, r2.texto).toBe(202);
    expect(r2.corpo.aplicacao_id).toBe(r1.corpo.aplicacao_id);
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(depois1);
    expect(await h.inspect.leiturasSolicitadas(r1.corpo.aplicacao_id)).toBe(1);

    esperarErro(await enviar(dig, projeto, [arquivo('outro.pdf', 'application/pdf', await paginasDoPdf(f.pdf, [1, 2, 3, 4]))], chave), 'ERR-019');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(depois1);
  });

  // @trace REQ §6.5, ERR-001
  it('upload sem Idempotency-Key → ERR-001', async () => {
    const r = await dig.enviarArquivos(`/projects/${projeto}/applications/upload`, await jpegs());
    esperarErro(r, 'ERR-001');
  });
});
