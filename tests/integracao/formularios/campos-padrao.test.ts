// Campos obrigatórios padronizados em todo rascunho (RN-050, CA-048, DEC-134, DEC-135, DEC-145,
// DEC-146, DEC-147) e pergunta que não cabe na página (DEC-143). O rascunho anterior à REQ v2.4 é
// gravado direto no banco pelo harness (`seed.rascunhoAntigo`), porque a API não grava mais
// conteúdo sem as 5 marcações.
//
// Altura (S-12 do PLANO §12.3): o termo de consentimento é o padrão (nenhum `termo_consentimento`
// gravado) e a pergunta que estoura a página é uma escolha única com 60 opções, mais alta que
// qualquer página do PDF (área útil de uma página sem o termo: menos de 700 pt; cada opção ocupa
// ao menos uma linha de texto).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { MINUTO, entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import {
  caminhoVersao,
  conteudoValido,
  criarFormulario,
  projetoCriado,
  publicar,
  salvarConteudo,
  type Conteudo,
  type Pergunta,
} from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { CAMPOS_RN050, CODIGOS_RN050, emOrdem, porCodigo } from '../../support/importacao.js';

let h: Harness;
let T: TenantPronto;
let admin: Cliente;
let projeto: string;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComUsuaria(h, 'Tenant Campos padrão');
  admin = await entrar(h, T.usuaria);
  projeto = await projetoCriado(admin, 'Saúde 60+');
});
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

/** Escolha única com 60 opções: não cabe em nenhuma página do PDF (DEC-143). */
function listaLonga(pagina: number, ordem: number): Pergunta {
  return {
    codigo: 'LISTA_LONGA',
    tipo: 'escolha_unica',
    enunciado: 'Qual bairro?',
    pagina,
    ordem,
    opcoes: Array.from({ length: 60 }, (_, i) => ({ codigo: `bairro_${i + 1}`, rotulo: `Bairro fictício ${i + 1}`, ordem: i + 1 })),
  };
}

function trocar(c: Conteudo, codigo: string, mudanca: Record<string, unknown>): Conteudo {
  return { ...c, perguntas: c.perguntas.map((p) => (p.codigo === codigo ? ({ ...p, ...mudanca } as Pergunta) : p)) };
}

function sem(c: Conteudo, codigo: string): Conteudo {
  return { ...c, perguntas: c.perguntas.filter((p) => p.codigo !== codigo) };
}

async function conteudoAtual(formId: string, versaoId: string): Promise<{ perguntas: (Pergunta & Record<string, any>)[]; regras_salto: unknown[] }> {
  const v = await admin.get(caminhoVersao(formId, versaoId));
  expect(v.status, v.texto).toBe(200);
  return v.corpo.conteudo;
}

/** Recusa com ERR-001, os códigos esperados em `campos` e o rascunho inalterado. */
async function esperarRecusa(formId: string, versaoId: string, c: Conteudo, campos: string[]): Promise<void> {
  const antes = await admin.get(caminhoVersao(formId, versaoId));
  const r = await salvarConteudo(admin, formId, versaoId, c);
  esperarErro(r, 'ERR-001');
  expect(r.corpo.campos).toEqual(campos);
  const depois = await admin.get(caminhoVersao(formId, versaoId));
  expect(depois.corpo).toEqual(antes.corpo);
  expect(depois.headers.get('etag')).toBe(antes.headers.get('etag'));
}

function esperarCincoCampos(perguntas: Pergunta[]): void {
  const ordenadas = emOrdem(perguntas);
  expect(ordenadas.slice(0, 5).map((p) => p.codigo)).toEqual(CODIGOS_RN050);
  ordenadas.slice(0, 5).forEach((p, i) => {
    expect(p, p.codigo).toMatchObject({ ...CAMPOS_RN050[i], pagina: 1, obrigatorio: true });
  });
}

describe('CA-048 — rascunho com os campos obrigatórios padronizados', () => {
  // @trace CA-048, RN-050, DEC-135
  it('exemplo 1: a versão 1 do createForm já tem os 5 campos, obrigatórios, no início da página 1', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono');
    const c = await conteudoAtual(formId, versaoId);
    expect(c.perguntas).toHaveLength(5);
    esperarCincoCampos(c.perguntas);
    expect(c.regras_salto).toEqual([]);
  });

  // @trace CA-048, RN-050, DEC-135
  it('createVersion sem versão de origem também nasce com os 5 campos', async () => {
    const { formId } = await criarFormulario(admin, projeto, 'Sono v2');
    const r = await admin.post(`/forms/${formId}/versions`, { corpo: {}, headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(r.status, r.texto).toBe(201);
    expect(r.corpo.resumo).toMatchObject({ numero: 2, status: 'rascunho' });
    expect(r.corpo.conteudo.perguntas).toHaveLength(5);
    esperarCincoCampos(r.corpo.conteudo.perguntas);
  });

  // @trace CA-048, RN-050
  it('exemplo 2: gravar NOME com o enunciado "Nome do participante" → aceito, com o enunciado novo', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono enunciado');
    const s = await salvarConteudo(admin, formId, versaoId, trocar(conteudoValido(), 'NOME', { enunciado: 'Nome do participante' }));
    expect(s.status, s.texto).toBe(200);
    expect(porCodigo(s.corpo.conteudo.perguntas, 'NOME')).toMatchObject({ enunciado: 'Nome do participante', campo_respondente: 'nome' });
  });

  // @trace CA-048, RN-050, DEC-145, RN-047
  it('exemplo 3: CPF gravado com texto_curto, código DOC e sem obrigatorio → aceito e reaplicado (CPF, cpf, obrigatório)', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono CPF');
    let c = trocar(conteudoValido(), 'CPF', { codigo: 'DOC', tipo: 'texto_curto' });
    c = trocar(c, 'DATA_APLICACAO', { sensibilidade: 'saude', obrigatorio: false });
    const s = await salvarConteudo(admin, formId, versaoId, c);
    expect(s.status, s.texto).toBe(200);
    const salvo = s.corpo.conteudo.perguntas as Pergunta[];
    expect(salvo.map((p) => p.codigo)).not.toContain('DOC');
    expect(porCodigo(salvo, 'CPF')).toMatchObject({ tipo: 'cpf', campo_respondente: 'cpf', obrigatorio: true, sensibilidade: 'identificacao' });
    expect(porCodigo(salvo, 'DATA_APLICACAO')).toMatchObject({ obrigatorio: true, sensibilidade: 'outro' });
    expect(await conteudoAtual(formId, versaoId)).toEqual(s.corpo.conteudo);
    expect((await publicar(admin, formId, versaoId)).status).toBe(200);
  });

  // @trace RN-050, DEC-145, DEC-095
  it('a reaplicação vem antes da validação das regras de salto: a regra pode citar o código padronizado', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono salto');
    // O local vai para o fim, com outro código; a regra já cita LOCAL_APLICACAO, que só existe depois da reaplicação.
    const c = trocar(conteudoValido(), 'LOCAL_APLICACAO', { codigo: 'ONDE', pagina: 4, ordem: 60 });
    c.regras_salto = [{ pergunta_origem_codigo: 'ESTADO_CIVIL', pergunta_destino_codigo: 'LOCAL_APLICACAO', opcao_codigo: 'casado' }];
    const s = await salvarConteudo(admin, formId, versaoId, c);
    expect(s.status, s.texto).toBe(200);
    expect(porCodigo(s.corpo.conteudo.perguntas, 'LOCAL_APLICACAO')).toMatchObject({ pagina: 4, campo_aplicacao: 'local_aplicacao' });
    expect(s.corpo.conteudo.regras_salto).toEqual(c.regras_salto);
  });

  // @trace CA-048, RN-050, ERR-001
  it('exemplo 4: sem a pergunta marcada como CPF → ERR-001 (campos: CPF); nada muda', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono sem CPF');
    await esperarRecusa(formId, versaoId, sem(conteudoValido(), 'CPF'), ['CPF']);
  });

  // @trace CA-048, RN-050, ERR-001
  it('exemplo 5: duas perguntas marcadas como local_aplicacao → ERR-001 (campos: LOCAL_APLICACAO)', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono dois locais');
    const c = conteudoValido();
    c.perguntas.push({ codigo: 'OUTRO_LOCAL', tipo: 'texto_curto', enunciado: 'Outro local', pagina: 2, ordem: 50, campo_aplicacao: 'local_aplicacao' });
    await esperarRecusa(formId, versaoId, c, ['LOCAL_APLICACAO']);
  });

  // @trace CA-048, RN-050, ERR-001
  it('exemplo 6: pergunta sem marcação com o código NOME → ERR-001 (campos: NOME)', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono código NOME');
    const c = trocar(conteudoValido(), 'NOME', { codigo: 'NOME_RESP' });
    c.perguntas.push({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome do acompanhante', pagina: 2, ordem: 50 });
    await esperarRecusa(formId, versaoId, c, ['NOME']);
  });

  // @trace RN-050, ERR-001
  it('todas as violações vêm juntas: primeiro na ordem da tabela, depois na ordem das perguntas', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono violações');
    const c = trocar(sem(conteudoValido(), 'CPF'), 'NOME', { codigo: 'NOME_RESP' });
    c.perguntas.push(
      { codigo: 'DATA_NASCIMENTO_2', tipo: 'data', enunciado: 'Nascimento (de novo)', pagina: 2, ordem: 50, campo_respondente: 'data_nascimento' },
      { codigo: 'LOCAL_APLICACAO_2', tipo: 'texto_curto', enunciado: 'Outro local', pagina: 2, ordem: 51, campo_aplicacao: 'local_aplicacao' },
      { codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome do acompanhante', pagina: 3, ordem: 52 },
    );
    await esperarRecusa(formId, versaoId, c, ['DATA_NASCIMENTO', 'CPF', 'LOCAL_APLICACAO', 'NOME']);
  });

  // @trace CA-048, DEC-143, ERR-001
  it('exemplo 7: pergunta que passa do rodapé da página 1 → ERR-001 com o código da pergunta', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sono página cheia');
    const c = conteudoValido();
    c.perguntas.push(listaLonga(1, 50));
    await esperarRecusa(formId, versaoId, c, ['LISTA_LONGA']);
    // Em qualquer outra página ela também não cabe.
    const c2 = conteudoValido();
    c2.perguntas.push(listaLonga(2, 50));
    await esperarRecusa(formId, versaoId, c2, ['LISTA_LONGA']);
  });

  // @trace CA-048, RN-050, DEC-145, DEC-147
  it('exemplo 8: createVersion copiando uma versão cuja pergunta de nome tem o código NOME_RESP → a cópia tem NOME', async () => {
    let antigo = trocar(conteudoValido(), 'NOME', { codigo: 'NOME_RESP', enunciado: 'Nome do respondente' });
    antigo = trocar(antigo, 'CPF', { codigo: 'CPF_RESP' });
    // Pergunta comum com um código reservado (DEC-147): ganha sufixo na cópia.
    antigo.perguntas.push({ codigo: 'CPF', tipo: 'texto_curto', enunciado: 'CPF do acompanhante', pagina: 3, ordem: 50 });
    const { formId, versaoId } = await h.seed.rascunhoAntigo({ tenantId: T.tenantId, projetoId: projeto, nome: 'Antigo NOME_RESP', conteudo: antigo });
    const pub = await publicar(admin, formId, versaoId);
    expect(pub.status, pub.texto).toBe(200);

    const r = await admin.post(`/forms/${formId}/versions`, { corpo: { copiar_de_versao_id: versaoId }, headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(r.status, r.texto).toBe(201);
    const perguntas = r.corpo.conteudo.perguntas as Pergunta[];
    expect(porCodigo(perguntas, 'NOME')).toMatchObject({ enunciado: 'Nome do respondente', campo_respondente: 'nome', obrigatorio: true });
    expect(porCodigo(perguntas, 'CPF')).toMatchObject({ campo_respondente: 'cpf', tipo: 'cpf' });
    const acompanhante = porCodigo(perguntas, 'CPF_2');
    expect(acompanhante.enunciado).toBe('CPF do acompanhante');
    expect(acompanhante.campo_respondente ?? null).toBeNull();
    expect(perguntas.map((p) => p.codigo)).not.toContain('NOME_RESP');
    expect(perguntas.map((p) => p.codigo)).not.toContain('CPF_RESP');
    expect(perguntas).toHaveLength(antigo.perguntas.length);

    // A versão de origem, publicada, não muda.
    const origem = await conteudoAtual(formId, versaoId);
    expect(origem.perguntas.map((p) => p.codigo)).toContain('NOME_RESP');
  });

  // @trace CA-048, DEC-146, ERR-001
  it('exemplo 9: createForm no projeto arquivado "Antigo" → ERR-001 (campos: projeto); nada é criado', async () => {
    const antigo = await projetoCriado(admin, 'Antigo');
    expect((await admin.post(`/projects/${antigo}/archive`)).status).toBe(200);
    const r = await admin.post('/forms', { corpo: { nome: 'Sono', projeto_id: antigo }, headers: { 'idempotency-key': chaveIdempotencia() } });
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['projeto']);
    expect((await admin.get(`/projects/${antigo}/forms`)).corpo.itens).toEqual([]);
  });
});

describe('RN-050 — rascunho anterior à REQ v2.4', () => {
  // @trace RN-050, CA-036
  it('a próxima gravação segue a RN-050 sem injetar: sem DATA_APLICACAO → ERR-001; com ela → aceita', async () => {
    const { formId, versaoId } = await h.seed.rascunhoAntigo({ tenantId: T.tenantId, projetoId: projeto, nome: 'Antigo sem data', conteudo: sem(conteudoValido(), 'DATA_APLICACAO') });
    const antes = await conteudoAtual(formId, versaoId);
    expect(antes.perguntas.map((p) => p.codigo)).not.toContain('DATA_APLICACAO');

    await esperarRecusa(formId, versaoId, sem(conteudoValido(), 'DATA_APLICACAO'), ['DATA_APLICACAO']);
    expect((await conteudoAtual(formId, versaoId)).perguntas.map((p) => p.codigo)).not.toContain('DATA_APLICACAO');

    const s = await salvarConteudo(admin, formId, versaoId, conteudoValido());
    expect(s.status, s.texto).toBe(200);
    esperarCincoCampos(s.corpo.conteudo.perguntas);
  });

  // @trace DEC-143, ERR-036
  it('publicação de pergunta que não cabe na página → ERR-036 com o código em campos; continua em rascunho', async () => {
    const c = conteudoValido();
    c.perguntas.push(listaLonga(4, 50));
    const { formId, versaoId } = await h.seed.rascunhoAntigo({ tenantId: T.tenantId, projetoId: projeto, nome: 'Antigo página cheia', conteudo: c });
    const r = await publicar(admin, formId, versaoId);
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo).toMatchObject({ errorCode: 'ERR-036', campos: ['LISTA_LONGA'] });
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo.resumo.status).toBe('rascunho');
  });
});
