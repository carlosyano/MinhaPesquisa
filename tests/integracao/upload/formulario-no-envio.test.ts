// Projeto e formulário escolhidos antes do envio (CA-061, RF-015, DEC-215, DEC-221 a DEC-235, ERR-045).
// IA-TEST do IMP-010 (CHG-019). A tabela do CA-061 tem 19 exemplos; os de números 1 a 8 e 18 exercitam
// o `uploadImages`, os de 9, 10, 13 a 17 e 19 o `addApplicationPages`, os de 11 e 12 o
// `attachSignaturePage`. Os códigos do QR vêm da API (`codigo` do projeto e do formulário), não de
// valores fixos, e o QR segue o formato `PPPPP.FFF.VV.X/Y` (DEC-218).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { comQr, executavel, jpeg, semQr } from '../../support/arquivos.js';
import { esperarErro, esperarErroCom } from '../../support/catalogo.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, criarFormulario, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { concluir, confirmarPendentes, CPF, prepararCotacao } from '../../support/leitura.js';
import { acrescentar, conteudoDuasPaginas } from '../../support/papel-antigo.js';

let h: Harness;
let A: TenantPronto;
let admin: Cliente;
let dig: Cliente;
let projeto: string;
let codProjeto: string;
let demografia: FormularioPublicado;
let habitos: FormularioPublicado;
let codDemografia: string;
let codHabitos: string;
let versao02: string;
let outroProjeto: string;
let formOutroProjeto: FormularioPublicado;
let formOutroTenant: FormularioPublicado;

const OUTRO_PROJETO_QR = '00007';

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await tenantComUsuaria(h, 'Tenant A');
  admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  codProjeto = (await admin.get(`/projects/${projeto}`)).corpo.codigo;
  expect(codProjeto).toBe('00001');
  // O formulário 001 existe só para que "Demografia" e "Hábitos" tenham os códigos 002 e 003 do CA-061.
  await criarFormulario(admin, projeto, 'Triagem');
  demografia = await formularioPublicado(admin, projeto, 'Demografia', conteudoDuasPaginas());
  habitos = await formularioPublicado(admin, projeto, 'Hábitos', conteudoDuasPaginas());
  codDemografia = await codigoDoFormulario(demografia.formId);
  codHabitos = await codigoDoFormulario(habitos.formId);
  expect([codDemografia, codHabitos]).toEqual(['002', '003']);
  const v2 = await admin.post(`/forms/${demografia.formId}/versions`, { corpo: { copiar_de_versao_id: demografia.versaoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
  expect(v2.status, v2.texto).toBe(201);
  versao02 = v2.corpo.resumo.id;
  outroProjeto = await projetoCriado(admin, 'Outro projeto');
  formOutroProjeto = await formularioPublicado(admin, outroProjeto, 'Demografia do outro projeto', conteudoDuasPaginas());
  const B = await tenantComUsuaria(h, 'Tenant B');
  const adminB = await entrar(h, B.usuaria);
  formOutroTenant = await formularioPublicado(adminB, await projetoCriado(adminB, 'Projeto B'), 'Demografia B', conteudoDuasPaginas());
  dig = await entrar(h, A.usuaria);
});
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

async function codigoDoFormulario(formId: string): Promise<string> {
  const lista = await admin.get(`/projects/${projeto}/forms`);
  expect(lista.status, lista.texto).toBe(200);
  return (lista.corpo.itens as { id: string; codigo: string }[]).find((f) => f.id === formId)!.codigo;
}

/** Conteúdo do QR no formato da DEC-218. */
function qr(projetoCod: string, formCod: string, x: number, y = 2, versao = '01'): string {
  return `${projetoCod}.${formCod}.${versao}.${x}/${y}`;
}

async function folha(f: FormularioPublicado, n: number, conteudoQr?: string | 'sem'): Promise<Arquivo> {
  const bytes = conteudoQr === 'sem' ? await semQr(f.paginas[n - 1]) : conteudoQr ? await comQr(f.paginas[n - 1], conteudoQr) : await jpeg(f.paginas[n - 1]);
  return arquivo(`folha-${n}.jpg`, 'image/jpeg', bytes);
}

const imagensDe = (r: Resposta): string[] => (r.corpo.paginas as { imagem_id: string }[]).map((p) => p.imagem_id);

/** Aplicação de "Demografia" em `identificacao_pendente` com a folha 1 (falta a 2): exemplos 9, 10, 13, 16, 17 e 19. */
async function pendenteComUmaFolha(): Promise<string> {
  const r = await enviar(dig, projeto, [await folha(demografia, 1)], chaveIdempotencia(), demografia.formId);
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
  return r.corpo.aplicacao_id;
}

/** Aplicação de "Demografia" em `sem_assinatura`, com as 2 folhas lidas e revisadas: exemplos 11 e 12. */
async function semAssinatura(): Promise<string> {
  const r = await enviar(dig, projeto, [await folha(demografia, 1), await folha(demografia, 2)], chaveIdempotencia(), demografia.formId);
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.estado).toBe('em_leitura');
  const id: string = r.corpo.aplicacao_id;
  const alta = (valor: string) => ({ valor, confianca: 0.97 });
  h.motor.programar(id, {
    NOME: alta('Maria Silva'),
    DATA_NASCIMENTO: alta('1950-01-01'),
    CPF: alta(CPF.joana),
    DATA_APLICACAO: alta('2026-10-30'),
    LOCAL_APLICACAO: alta('UBS Centro'),
    PRESSAO_ALTA: alta('sim'),
    USA_MEDICAMENTO: alta('nao'),
  });
  await h.worker.processar();
  await confirmarPendentes(dig, id);
  const c = await concluir(dig, id, { assinatura: 'ausente' });
  expect(c.status, c.texto).toBe(200);
  expect(c.corpo.estado).toBe('sem_assinatura');
  return id;
}

function anexar(id: string, pagina1: Arquivo): Promise<Resposta> {
  return dig.enviarFormulario(`/applications/${id}/signature`, [['arquivo', pagina1], ['assinatura', 'presente']], { 'idempotency-key': chaveIdempotencia() });
}

function acrescentarFolha(id: string, a: Arquivo, versaoId?: string): Promise<Resposta> {
  return acrescentar(dig, id, [a], { versaoId });
}

/** O que mudou na base e no armazenamento: usado para provar "nada é gravado". */
async function fotografia(id?: string) {
  return {
    contagem: await h.inspect.contagemUpload(A.tenantId),
    ...(id ? { aplicacao: await h.inspect.aplicacao(id), folhas: await h.inspect.folhas(id) } : {}),
  };
}

async function auditadaSemImagem(acao: string, detalhes: Record<string, string>): Promise<void> {
  const eventos = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.acao === acao);
  expect(eventos.length, `evento ${acao}`).toBeGreaterThan(0);
  const e = eventos[eventos.length - 1];
  expect(e.detalhes).toMatchObject(detalhes);
  // Só os códigos lidos: nada de imagem, nome de arquivo nem conteúdo da folha (REQ §2.9, detalhes).
  expect(JSON.stringify(e.detalhes)).not.toMatch(/folha-\d|\.jpg|base64/i);
}

describe('CA-061 — uploadImages com o formulário escolhido (exemplos 1 a 8 e 18)', () => {
  // @trace CA-061, DEC-215, RF-015, FL-001
  it('exemplo 1: projeto e formulário certos, QR `PPPPP.FFF.01.X/2` → em_leitura, versão 01 de "Demografia"', async () => {
    const r = await enviar(dig, projeto, [await folha(demografia, 1), await folha(demografia, 2)], chaveIdempotencia(), demografia.formId);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('em_leitura');
    expect(demografia.paginas.map((p) => p.qr?.conteudo)).toEqual([qr(codProjeto, codDemografia, 1), qr(codProjeto, codDemografia, 2)]);
    const g = await h.inspect.aplicacao(r.corpo.aplicacao_id);
    expect(g).toMatchObject({ estado: 'em_leitura', versao_id: demografia.versaoId, formulario_id: demografia.formId, origem_qr: true });
  });

  // @trace CA-061, DEC-215, ERR-001
  it('exemplo 2: sem formulário → ERR-001 com `campos` = formulario_id; nada é gravado', async () => {
    const antes = await fotografia();
    const r = await enviar(dig, projeto, [await folha(demografia, 1), await folha(demografia, 2)], chaveIdempotencia(), null);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['formulario_id']);
    expect(await fotografia()).toEqual(antes);
  });

  // @trace CA-061, DEC-215, ERR-045
  it('exemplo 3: QR de "Hábitos" na folha 1 → ERR-045 com projeto_qr e formulario_qr; nenhuma aplicação é criada; auditada sem imagem', async () => {
    const antes = await fotografia();
    const r = await enviar(dig, projeto, [await folha(demografia, 1, qr(codProjeto, codHabitos, 1)), await folha(demografia, 2)], chaveIdempotencia(), demografia.formId);
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: codProjeto, formulario_qr: codHabitos });
    expect(await fotografia()).toEqual(antes);
    await auditadaSemImagem('form_selection_mismatch', { projeto_qr: codProjeto, formulario_qr: codHabitos });
  });

  // @trace CA-061, DEC-215, ERR-045
  it('exemplo 4: QR de outro projeto (00007) na folha 2 → ERR-045; nada é gravado', async () => {
    const antes = await fotografia();
    const r = await enviar(dig, projeto, [await folha(demografia, 1), await folha(demografia, 2, qr(OUTRO_PROJETO_QR, codDemografia, 1))], chaveIdempotencia(), demografia.formId);
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: OUTRO_PROJETO_QR, formulario_qr: codDemografia });
    expect(await fotografia()).toEqual(antes);
  });

  // @trace CA-061, DEC-215, ERR-001
  it('exemplo 5: formulário de outro projeto → ERR-001 com `campos` = formulario_id', async () => {
    const antes = await fotografia();
    const r = await enviar(dig, projeto, [await folha(demografia, 1), await folha(demografia, 2)], chaveIdempotencia(), formOutroProjeto.formId);
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['formulario_id']);
    expect(await fotografia()).toEqual(antes);
  });

  // @trace CA-061, DEC-215, DEC-169, ERR-004, FL-001
  it('exemplo 6: nenhum QR legível e nenhuma versão escolhida → identificacao_pendente com ERR-004; o formulário escolhido é gravado', async () => {
    const r = await enviar(dig, projeto, [await folha(demografia, 1, 'sem'), await folha(demografia, 2, 'sem')], chaveIdempotencia(), demografia.formId);
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-004' });
    expect(await h.inspect.aplicacao(r.corpo.aplicacao_id)).toMatchObject({ versao_id: null, formulario_id: demografia.formId });
    expect(await h.inspect.leiturasSolicitadas(r.corpo.aplicacao_id)).toBe(0);
  });

  // @trace CA-061, DEC-224, ERR-045
  it('exemplo 7: folha 1 de "Hábitos" e folha 2 de outro projeto → ERR-045 com os códigos da primeira folha divergente; nada é gravado', async () => {
    const antes = await fotografia();
    const r = await enviar(
      dig,
      projeto,
      [await folha(demografia, 1, qr(codProjeto, codHabitos, 1)), await folha(demografia, 2, qr(OUTRO_PROJETO_QR, codDemografia, 2))],
      chaveIdempotencia(),
      demografia.formId,
    );
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: codProjeto, formulario_qr: codHabitos });
    expect(await fotografia()).toEqual(antes);
  });

  // @trace CA-061, DEC-224, ERR-029
  it('exemplo 8: arquivo inválido na posição 1 e folha 2 de "Hábitos" → ERR-029 (posição 1), não ERR-045; nada é gravado', async () => {
    const antes = await fotografia();
    const r = await enviar(
      dig,
      projeto,
      [arquivo('programa.jpg', 'image/jpeg', executavel(2048)), await folha(demografia, 2, qr(codProjeto, codHabitos, 2))],
      chaveIdempotencia(),
      demografia.formId,
    );
    esperarErroCom(r, 'ERR-029', 'tipo de arquivo não permitido');
    expect(r.corpo.posicao).toBe(1);
    expect(await fotografia()).toEqual(antes);
  });

  // @trace CA-061, DEC-232, ERR-039
  it('exemplo 18: versao_id inexistente sem QR legível → identificacao_pendente com ERR-039; folhas gravadas e versão não gravada', async () => {
    // O auxiliar `enviar` não leva versão; este exemplo manda a versão inexistente pelo multipart.
    const sem = await dig.enviarFormulario(
      `/projects/${projeto}/applications/upload`,
      [
        ['arquivos', await folha(demografia, 1, 'sem')],
        ['arquivos', await folha(demografia, 2, 'sem')],
        ['formulario_id', demografia.formId],
        ['versao_id', '00000000-0000-4000-8000-000000000000'],
      ],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(sem.status, sem.texto).toBe(202);
    expect(sem.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-039' });
    expect(await h.inspect.aplicacao(sem.corpo.aplicacao_id)).toMatchObject({ versao_id: null, formulario_id: demografia.formId });
    expect(await h.inspect.folhas(sem.corpo.aplicacao_id)).toHaveLength(2);
  });

  // @trace CA-061, DEC-169, DEC-180
  it('versão do formulário escolhido, sem QR legível: vale a versão escolhida e a aplicação vai para em_leitura', async () => {
    const r = await dig.enviarFormulario(
      `/projects/${projeto}/applications/upload`,
      [
        ['arquivos', await folha(demografia, 1, 'sem')],
        ['arquivos', await folha(demografia, 2, 'sem')],
        ['formulario_id', demografia.formId],
        ['versao_id', demografia.versaoId],
      ],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo.estado).toBe('em_leitura');
    expect(await h.inspect.aplicacao(r.corpo.aplicacao_id)).toMatchObject({ versao_id: demografia.versaoId, formulario_id: demografia.formId, origem_qr: false });
  });

  // @trace CA-061, DEC-221, ERR-039
  it('versao_id de outro formulário do projeto no envio → ERR-039; nada é gravado', async () => {
    const antes = await fotografia();
    const r = await dig.enviarFormulario(
      `/projects/${projeto}/applications/upload`,
      [
        ['arquivos', await folha(demografia, 1, 'sem')],
        ['arquivos', await folha(demografia, 2, 'sem')],
        ['formulario_id', demografia.formId],
        ['versao_id', habitos.versaoId],
      ],
      { 'idempotency-key': chaveIdempotencia() },
    );
    esperarErro(r, 'ERR-039');
    expect(await fotografia()).toEqual(antes);
  });
});

describe('CA-061 — addApplicationPages (exemplos 9, 10 e 13 a 17 e 19)', () => {
  // @trace CA-061, DEC-222, ERR-045
  it('exemplo 9: folha de "Hábitos" → ERR-045; a aplicação continua identificacao_pendente, com as mesmas páginas', async () => {
    const id = await pendenteComUmaFolha();
    const antes = await fotografia(id);
    const r = await acrescentarFolha(id, await folha(demografia, 2, qr(codProjeto, codHabitos, 2)));
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: codProjeto, formulario_qr: codHabitos });
    expect(await fotografia(id)).toEqual(antes);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'identificacao_pendente' });
  });

  // @trace CA-061, DEC-222, ERR-045
  it('exemplo 10: folha de outro projeto → ERR-045; nada é gravado e a aplicação não muda', async () => {
    const id = await pendenteComUmaFolha();
    const antes = await fotografia(id);
    const r = await acrescentarFolha(id, await folha(demografia, 2, qr(OUTRO_PROJETO_QR, codDemografia, 2)));
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: OUTRO_PROJETO_QR, formulario_qr: codDemografia });
    expect(await fotografia(id)).toEqual(antes);
  });

  // @trace CA-061, DEC-225, ERR-039
  it('exemplo 13: versao_id de "Hábitos", sem QR legível → ERR-039 (400); nada é gravado e a aplicação não muda', async () => {
    const id = await pendenteComUmaFolha();
    const antes = await fotografia(id);
    const r = await acrescentarFolha(id, await folha(demografia, 2, 'sem'), habitos.versaoId);
    esperarErro(r, 'ERR-039');
    expect(await fotografia(id)).toEqual(antes);
  });

  // @trace CA-061, DEC-230, DEC-232, ERR-039
  it('exemplo 16: versão 02 (rascunho) de "Demografia" → 200; a folha é gravada, a versão não, e fica o aviso ERR-039', async () => {
    const id = await pendenteComUmaFolha();
    const r = await acrescentarFolha(id, await folha(demografia, 2, 'sem'), versao02);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-039', versao_id: null });
    expect(await h.inspect.folhas(id)).toHaveLength(2);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ versao_id: null, estado: 'identificacao_pendente' });
    expect(await h.inspect.leiturasSolicitadas(id)).toBe(0);
  });

  // @trace CA-061, DEC-233, ERR-039
  it('exemplo 17: versão de outro tenant → mesmo resultado do exemplo 16, como se não existisse; a tentativa é auditada (version_out_of_scope)', async () => {
    const id = await pendenteComUmaFolha();
    const r = await acrescentarFolha(id, await folha(demografia, 2, 'sem'), formOutroTenant.versaoId);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-039', versao_id: null });
    expect(await h.inspect.folhas(id)).toHaveLength(2);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ versao_id: null });
    const eventos = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.acao === 'version_out_of_scope' && e.registro_id === id);
    expect(eventos.length).toBeGreaterThan(0);
    expect(JSON.stringify(eventos)).not.toContain(formOutroTenant.versaoId);
  });

  // @trace CA-061, DEC-230, DEC-232, ERR-039
  it('exemplo 19: versão 01 de "Demografia" de outro projeto → 200; a folha é gravada, a versão não, e fica o aviso ERR-039', async () => {
    const id = await pendenteComUmaFolha();
    const r = await acrescentarFolha(id, await folha(demografia, 2, 'sem'), formOutroProjeto.versaoId);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo).toMatchObject({ estado: 'identificacao_pendente', aviso: 'ERR-039', versao_id: null });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ versao_id: null });
    expect(await h.inspect.folhas(id)).toHaveLength(2);
  });

  // @trace CA-061, DEC-221, DEC-222, DEC-230
  it('QR legível e válido na folha acrescentada prevalece sobre a versão inválida do pedido (DEC-180, DEC-230)', async () => {
    const id = await pendenteComUmaFolha();
    const r = await acrescentarFolha(id, await folha(demografia, 2), versao02);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('em_leitura');
    expect(r.corpo.aviso ?? null).toBeNull();
    expect(await h.inspect.aplicacao(id)).toMatchObject({ versao_id: demografia.versaoId, origem_qr: true });
  });

  // @trace CA-061, DEC-221
  it('o addApplicationPages não aceita `formulario_id` (o formulário é o da aplicação): ERR-001', async () => {
    const id = await pendenteComUmaFolha();
    const r = await dig.enviarFormulario(`/applications/${id}/pages`, [['arquivos', await folha(demografia, 2)], ['formulario_id', habitos.formId]], { 'idempotency-key': chaveIdempotencia() });
    esperarErro(r, 'ERR-001');
  });
});

describe('CA-061 — attachSignaturePage (exemplos 11 e 12)', () => {
  // @trace CA-061, DEC-222, ERR-045
  it('exemplo 11: página 1 assinada de "Hábitos" → ERR-045; permanece em sem_assinatura, sem folha nova', async () => {
    const id = await semAssinatura();
    const antes = await fotografia(id);
    const r = await anexar(id, await folha(demografia, 1, qr(codProjeto, codHabitos, 1)));
    esperarErro(r, 'ERR-045');
    expect(r.corpo).toMatchObject({ projeto_qr: codProjeto, formulario_qr: codHabitos });
    expect(await fotografia(id)).toEqual(antes);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'sem_assinatura' });
  });

  // @trace CA-061, DEC-222, ERR-045
  it('exemplo 12: página 1 assinada de outro projeto → ERR-045; permanece em sem_assinatura, sem folha nova', async () => {
    const id = await semAssinatura();
    const antes = await fotografia(id);
    const r = await anexar(id, await folha(demografia, 1, qr(OUTRO_PROJETO_QR, codDemografia, 1)));
    esperarErro(r, 'ERR-045');
    expect(await fotografia(id)).toEqual(antes);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'sem_assinatura' });
  });

  // @trace CA-061, DEC-227, ERR-039
  it('página 1 assinada com QR de outra versão do mesmo formulário ou com `Y` diferente do total → ERR-039', async () => {
    const id = await semAssinatura();
    const antes = await fotografia(id);
    esperarErro(await anexar(id, await folha(demografia, 1, qr(codProjeto, codDemografia, 1, 2, '02'))), 'ERR-039');
    esperarErro(await anexar(id, await folha(demografia, 1, qr(codProjeto, codDemografia, 1, 3))), 'ERR-039');
    expect(await fotografia(id)).toEqual(antes);
  });

  // @trace CA-061, CA-044, FL-001
  it('página 1 assinada do formulário certo → aceita; a aplicação vai para concluida', async () => {
    const id = await semAssinatura();
    const r = await anexar(id, await folha(demografia, 1));
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('concluida');
  });
});

describe('CA-061 — aplicação anterior à v2.9, sem formulário (exemplos 14 e 15)', () => {
  async function antiga(): Promise<{ id: string; imagem1: string }> {
    const r = await enviar(dig, projeto, [await folha(demografia, 1, 'sem')], chaveIdempotencia(), demografia.formId);
    expect(r.status, r.texto).toBe(202);
    const id: string = r.corpo.aplicacao_id;
    await h.seed.semFormulario(id);
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'identificacao_pendente', versao_id: null, formulario_id: null });
    return { id, imagem1: imagensDe(r)[0] };
  }

  // @trace CA-061, DEC-226, ERR-018
  it('exemplo 14: addApplicationPages → ERR-018; nada é gravado', async () => {
    const { id } = await antiga();
    const antes = await fotografia(id);
    esperarErro(await acrescentarFolha(id, await folha(demografia, 2)), 'ERR-018');
    expect(await fotografia(id)).toEqual(antes);
  });

  // @trace CA-061, DEC-223, DEC-229, ERR-004, ERR-018
  it('exemplo 15: o identifyApplication com a página 1 volta ERR-004 e grava o formulário; depois o addApplicationPages é aceito e vai para em_leitura', async () => {
    const { id, imagem1 } = await antiga();
    const ident = await dig.post(`/applications/${id}/identify`, {
      corpo: { versao_id: demografia.versaoId, paginas: [{ imagem_id: imagem1, numero_pagina: 1 }] },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    esperarErro(ident, 'ERR-004');
    // Uma única gravação do formulário, sem mudar mais nada (a versão só vem do QR da folha 2).
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'identificacao_pendente', formulario_id: demografia.formId, versao_id: null });
    expect(await h.inspect.auditoria(A.tenantId)).toContainEqual(expect.objectContaining({ acao: 'form_set_from_version', registro_id: id }));

    const add = await acrescentarFolha(id, await folha(demografia, 2));
    expect(add.status, add.texto).toBe(200);
    expect(add.corpo).toMatchObject({ estado: 'em_leitura', versao_id: demografia.versaoId });
    expect(await h.inspect.aplicacao(id)).toMatchObject({ estado: 'em_leitura', formulario_id: demografia.formId, versao_id: demografia.versaoId, origem_qr: true });

    // A folha 1 (sem QR) é identificada pela IA; a folha 2 tem o QR.
    h.identificador.programar(id, { [imagem1]: { pagina: 1 } });
    await h.worker.processar();
    expect((await h.identificador.chamadas(id)).map((c) => c.imagem_id)).toContain(imagem1);
    expect((await h.inspect.folhas(id)).filter((f) => f.tipo === 'formulario').map((f) => f.numero_pagina)).toEqual([1, 2]);
  });

  // @trace CA-061, DEC-229
  it('o identifyApplication com versão de outro projeto não grava o formulário (ERR-039 vem antes do ERR-004)', async () => {
    const { id, imagem1 } = await antiga();
    const ident = await dig.post(`/applications/${id}/identify`, {
      corpo: { versao_id: formOutroProjeto.versaoId, paginas: [{ imagem_id: imagem1, numero_pagina: 1 }] },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    esperarErro(ident, 'ERR-039');
    expect(await h.inspect.aplicacao(id)).toMatchObject({ formulario_id: null, versao_id: null });
  });

  // @trace CA-061, DEC-221, ERR-039
  it('o identifyApplication recusa versão de outro formulário do projeto quando a aplicação já tem formulário', async () => {
    const id = await pendenteComUmaFolha();
    const r = (await h.inspect.folhas(id))[0];
    const ident = await dig.post(`/applications/${id}/identify`, {
      corpo: { versao_id: habitos.versaoId, paginas: [{ imagem_id: r.imagem_id, numero_pagina: 1 }] },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    esperarErro(ident, 'ERR-039');
    expect(await h.inspect.aplicacao(id)).toMatchObject({ formulario_id: demografia.formId });
  });
});
