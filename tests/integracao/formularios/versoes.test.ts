// Formulários e versões (RF-004, CA-001, CA-036, TS-006, RN-017, RN-042, RN-047, REQ §6.5).
// O vínculo das respostas já lidas à versão 1 (último passo do CA-001) só é observável com a
// leitura, no IMP-003.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import {
  caminhoVersao,
  conteudoValido,
  criarFormulario,
  formularioPublicado,
  projetoCriado,
  publicar,
  salvarConteudo,
  type Conteudo,
} from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let admin: Cliente;
let projeto: string;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComUsuaria(h, 'Tenant Formulários');
  admin = await entrar(h, T.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
});
afterAll(async () => {
  await h?.close();
});

function sem(conteudo: Conteudo, codigo: string): Conteudo {
  return { ...conteudo, perguntas: conteudo.perguntas.filter((p) => p.codigo !== codigo) };
}

describe('RF-004 — rascunho e publicação', () => {
  // @trace RF-004, RN-018, RN-019
  it('createForm cria a versão 1 vazia em rascunho; o conteúdo salvo volta igual na leitura', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Demografia');
    const v = await admin.get(caminhoVersao(formId, versaoId));
    expect(v.status, v.texto).toBe(200);
    expect(v.corpo.resumo).toMatchObject({ id: versaoId, formulario_id: formId, numero: 1, status: 'rascunho' });
    expect(v.corpo.conteudo).toEqual({ perguntas: [], regras_salto: [] });

    const s = await salvarConteudo(admin, formId, versaoId, conteudoValido());
    expect(s.status, s.texto).toBe(200);
    const codigos = s.corpo.conteudo.perguntas.map((p: { codigo: string }) => p.codigo);
    expect(codigos).toEqual(conteudoValido().perguntas.map((p) => p.codigo));
    const civil = s.corpo.conteudo.perguntas.find((p: { codigo: string }) => p.codigo === 'ESTADO_CIVIL');
    expect(civil.opcoes.map((o: { codigo: string }) => o.codigo)).toEqual(['solteiro', 'casado', 'viuvo']);
    expect(s.corpo.conteudo.regras_salto).toEqual(conteudoValido().regras_salto);
  });

  // @trace RN-047
  it('sim_nao recebe as opções fixas sim e nao; campo do respondente e aplicador ficam com sensibilidade identificacao', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Estrutura');
    const c = conteudoValido();
    c.perguntas = c.perguntas.map((p) => (p.codigo === 'NOME' || p.codigo === 'CPF' ? { ...p, sensibilidade: 'saude' } : p));
    c.perguntas.push({ codigo: 'APLICADOR', tipo: 'texto_curto', enunciado: 'Aplicador', pagina: 1, ordem: 99, campo_aplicacao: 'aplicador' });
    const s = await salvarConteudo(admin, formId, versaoId, c);
    expect(s.status, s.texto).toBe(200);
    const por = (codigo: string) => s.corpo.conteudo.perguntas.find((p: { codigo: string }) => p.codigo === codigo);
    expect(por('PRESSAO_ALTA').opcoes.map((o: { codigo: string }) => o.codigo)).toEqual(['sim', 'nao']);
    for (const codigo of ['NOME', 'DATA_NASCIMENTO', 'CPF', 'APLICADOR']) expect(por(codigo).sensibilidade, codigo).toBe('identificacao');
    expect(por('PRESSAO_ALTA').sensibilidade).toBe('saude');
  });

  // @trace REQ §6.5, ERR-017, ERR-001
  it('edição de rascunho exige If-Match atual: antigo → ERR-017; ausente → ERR-001', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Concorrência');
    const etag = (await admin.get(caminhoVersao(formId, versaoId))).headers.get('etag')!;
    const ok = await admin.requisitar('PUT', caminhoVersao(formId, versaoId), { corpo: conteudoValido(), headers: { 'if-match': etag } });
    expect(ok.status, ok.texto).toBe(200);
    esperarErro(await admin.requisitar('PUT', caminhoVersao(formId, versaoId), { corpo: sem(conteudoValido(), 'ALIMENTOS'), headers: { 'if-match': etag } }), 'ERR-017');
    esperarErro(await admin.requisitar('PUT', caminhoVersao(formId, versaoId), { corpo: sem(conteudoValido(), 'ALIMENTOS') }), 'ERR-001');
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo.conteudo.perguntas).toHaveLength(conteudoValido().perguntas.length);
  });

  // @trace CA-028, ERR-018
  it('versão em rascunho não gera PDF (ERR-018)', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sem PDF');
    expect((await salvarConteudo(admin, formId, versaoId, conteudoValido())).status).toBe(200);
    esperarErro(await admin.get(`${caminhoVersao(formId, versaoId)}/pdf`), 'ERR-018');
  });
});

describe('DEC-095 / DEC-097 — validação no rascunho (RN-021, RN-047)', () => {
  type Regra = Conteudo['regras_salto'][number];
  const regra = (origem: string, destino: string, opcao: string): Regra => ({
    pergunta_origem_codigo: origem,
    pergunta_destino_codigo: destino,
    opcao_codigo: opcao,
  });
  const invalidas: [string, Regra[]][] = [
    ['origem que não é sim_nao nem escolha_unica', [regra('QUAIS_MEDICAMENTOS', 'HORAS_SONO', 'sim')]],
    ['opção inexistente na origem', [regra('USA_MEDICAMENTO', 'QUAIS_MEDICAMENTOS', 'talvez')]],
    ['autorreferência', [regra('USA_MEDICAMENTO', 'USA_MEDICAMENTO', 'sim')]],
    ['destino antes da origem', [regra('USA_MEDICAMENTO', 'PRESSAO_ALTA', 'sim')]],
    ['ciclo entre duas regras', [regra('USA_MEDICAMENTO', 'ESTADO_CIVIL', 'sim'), regra('ESTADO_CIVIL', 'USA_MEDICAMENTO', 'casado')]],
  ];

  // @trace DEC-095, RN-021, ERR-001
  it.each(invalidas)('regra de salto com %s → ERR-001; rascunho inalterado', async (_caso, regras) => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Saltos inválidos');
    expect((await salvarConteudo(admin, formId, versaoId, conteudoValido())).status).toBe(200);
    const antes = (await admin.get(caminhoVersao(formId, versaoId))).corpo;
    esperarErro(await salvarConteudo(admin, formId, versaoId, { ...conteudoValido(), regras_salto: regras }), 'ERR-001');
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo).toEqual(antes);
  });

  // @trace DEC-095, RN-021
  it('regra com origem escolha_unica, opção existente e destino posterior é aceita', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Salto válido');
    const c = { ...conteudoValido(), regras_salto: [...conteudoValido().regras_salto, regra('ESTADO_CIVIL', 'HORAS_SONO', 'viuvo')] };
    const s = await salvarConteudo(admin, formId, versaoId, c);
    expect(s.status, s.texto).toBe(200);
    expect(s.corpo.conteudo.regras_salto).toEqual(c.regras_salto);
  });

  // @trace DEC-097, RN-039, ERR-001
  it('sensibilidade identificacao em pergunta comum → ERR-001; saude e outro são aceitas', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sensibilidade');
    const com = (valor: string): Conteudo => ({
      ...conteudoValido(),
      perguntas: conteudoValido().perguntas.map((p) => (p.codigo === 'PRESSAO_ALTA' ? { ...p, sensibilidade: valor } : p)),
    });
    esperarErro(await salvarConteudo(admin, formId, versaoId, com('identificacao')), 'ERR-001');
    for (const valor of ['outro', 'saude']) {
      const s = await salvarConteudo(admin, formId, versaoId, com(valor));
      expect(s.status, s.texto).toBe(200);
      expect(s.corpo.conteudo.perguntas.find((p: { codigo: string }) => p.codigo === 'PRESSAO_ALTA').sensibilidade).toBe(valor);
    }
  });
});

describe('DEC-096 — estrutura da RN-047 na publicação', () => {
  const matrizSemLinhas = {
    codigo: 'SINTOMAS',
    tipo: 'matriz',
    enunciado: 'Com que frequência sente',
    pagina: 4,
    ordem: 40,
    opcoes: [
      { codigo: 'nunca', rotulo: 'Nunca', ordem: 1 },
      { codigo: 'sempre', rotulo: 'Sempre', ordem: 2 },
    ],
  };
  const multiplaSemNenhuma = (c: Conteudo): Conteudo => ({
    ...c,
    perguntas: c.perguntas.map((p) =>
      p.codigo === 'ALIMENTOS' ? { ...p, opcoes: (p.opcoes as { codigo: string }[]).filter((o) => o.codigo !== 'nenhuma_das_anteriores') } : p,
    ),
  });

  async function publicarCom(c: Conteudo): Promise<{ formId: string; versaoId: string; r: Awaited<ReturnType<typeof publicar>> }> {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Estrutura RN-047');
    const s = await salvarConteudo(admin, formId, versaoId, c);
    expect(s.status, s.texto).toBe(200);
    return { formId, versaoId, r: await publicar(admin, formId, versaoId) };
  }

  // @trace DEC-096, RN-047, ERR-036
  it('matriz sem linhas → ERR-036 com o código da pergunta em campos', async () => {
    const c = conteudoValido();
    c.perguntas.push(matrizSemLinhas);
    const { formId, versaoId, r } = await publicarCom(c);
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo).toMatchObject({ errorCode: 'ERR-036', campos: ['SINTOMAS'] });
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo.resumo.status).toBe('rascunho');
  });

  // @trace DEC-096, RN-047, ERR-036
  it('múltipla escolha sem nenhuma_das_anteriores → ERR-036 com o código da pergunta', async () => {
    const { r } = await publicarCom(multiplaSemNenhuma(conteudoValido()));
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo).toMatchObject({ errorCode: 'ERR-036', campos: ['ALIMENTOS'] });
  });

  // @trace DEC-096, RN-017, RN-047
  it('falta de campo da RN-017 e estrutura inválida vêm juntas em campos', async () => {
    const { r } = await publicarCom(multiplaSemNenhuma(sem(conteudoValido(), 'LOCAL_APLICACAO')));
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo.errorCode).toBe('ERR-036');
    expect([...r.corpo.campos].sort()).toEqual(['ALIMENTOS', 'local_aplicacao']);
  });
});

describe('CA-036 — publicação exige os campos obrigatórios (RN-017)', () => {
  // @trace CA-036, RN-017, ERR-036
  it('sem pergunta data_aplicacao → ERR-036 com campos = [data_aplicacao]; versão continua em rascunho', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Sem data');
    expect((await salvarConteudo(admin, formId, versaoId, sem(conteudoValido(), 'DATA_APLICACAO'))).status).toBe(200);
    const r = await publicar(admin, formId, versaoId);
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo).toMatchObject({ errorCode: 'ERR-036', campos: ['data_aplicacao'] });
    expect(r.corpo.detail).toMatch(/^Publicação recusada: faltam .*data_aplicacao/);
    expect(r.corpo.correlationId).toBe(r.headers.get('x-correlation-id'));
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo.resumo.status).toBe('rascunho');
  });

  // @trace CA-036, RN-017
  it('versão vazia → ERR-036 lista os 5 campos', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Vazio');
    const r = await publicar(admin, formId, versaoId);
    expect(r.status, r.texto).toBe(400);
    expect(r.corpo.errorCode).toBe('ERR-036');
    expect([...r.corpo.campos].sort()).toEqual(['cpf', 'data_aplicacao', 'data_nascimento', 'local_aplicacao', 'nome']);
  });

  // @trace CA-036, RN-017
  it('pergunta marcada como CPF com tipo diferente de cpf não conta: ERR-036 com campos = [cpf]', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'CPF errado');
    const c = conteudoValido();
    c.perguntas = c.perguntas.map((p) => (p.codigo === 'CPF' ? { ...p, tipo: 'texto_curto' } : p));
    const s = await salvarConteudo(admin, formId, versaoId, c);
    if (s.status === 200) {
      const r = await publicar(admin, formId, versaoId);
      expect(r.status, r.texto).toBe(400);
      expect(r.corpo).toMatchObject({ errorCode: 'ERR-036', campos: ['cpf'] });
    } else {
      // Recusar já no rascunho também cumpre a RN-017: a versão nunca chega a ser publicada.
      esperarErro(s, 'ERR-001');
    }
    expect((await admin.get(caminhoVersao(formId, versaoId))).corpo.resumo.status).toBe('rascunho');
  });

  // @trace CA-036, RF-004
  it('com os 5 campos a versão é publicada com data de publicação', async () => {
    const { formId, versaoId } = await criarFormulario(admin, projeto, 'Completo');
    expect((await salvarConteudo(admin, formId, versaoId, conteudoValido())).status).toBe(200);
    const r = await publicar(admin, formId, versaoId);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.resumo.status).toBe('publicada');
    expect(new Date(r.corpo.resumo.publicada_em)).toEqual(h.clock.now());
  });
});

describe('CA-001 / TS-006 — versão publicada é imutável (RN-042)', () => {
  // @trace CA-001, TS-006, RN-042, ERR-009
  it('alterar ou acrescentar pergunta na versão publicada → ERR-009; nada muda', async () => {
    const f = await formularioPublicado(admin, projeto, 'Demografia publicada');
    const antes = await admin.get(caminhoVersao(f.formId, f.versaoId));
    const etag = antes.headers.get('etag')!;

    const alterada = conteudoValido();
    alterada.perguntas = alterada.perguntas.map((p) => (p.codigo === 'PRESSAO_ALTA' ? { ...p, enunciado: 'Pressão alta (alterado)?' } : p));
    esperarErro(await admin.requisitar('PUT', caminhoVersao(f.formId, f.versaoId), { corpo: alterada, headers: { 'if-match': etag } }), 'ERR-009');

    const acrescida = conteudoValido();
    acrescida.perguntas.push({ codigo: 'NOVA_PERGUNTA', tipo: 'sim_nao', enunciado: 'Nova?', pagina: 4, ordem: 50 });
    esperarErro(await admin.requisitar('PUT', caminhoVersao(f.formId, f.versaoId), { corpo: acrescida, headers: { 'if-match': etag } }), 'ERR-009');
    esperarErro(await publicar(admin, f.formId, f.versaoId), 'ERR-009');

    const depois = await admin.get(caminhoVersao(f.formId, f.versaoId));
    expect(depois.corpo).toEqual(antes.corpo);
    expect(depois.headers.get('etag')).toBe(etag);
  });

  // @trace CA-001, RN-042
  it('versão 2 nasce em rascunho como cópia da 1, aceita alteração e a 1 continua igual e publicada', async () => {
    const f = await formularioPublicado(admin, projeto, 'Demografia v2');
    const v1 = (await admin.get(caminhoVersao(f.formId, f.versaoId))).corpo;
    const criada = await admin.post(`/forms/${f.formId}/versions`, {
      corpo: { copiar_de_versao_id: f.versaoId },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(criada.status, criada.texto).toBe(201);
    expect(criada.corpo.resumo).toMatchObject({ formulario_id: f.formId, numero: 2, status: 'rascunho' });
    expect(criada.corpo.conteudo).toEqual(v1.conteudo);

    const v2 = criada.corpo.resumo.id as string;
    const alterada = conteudoValido();
    alterada.perguntas = alterada.perguntas.map((p) => (p.codigo === 'PRESSAO_ALTA' ? { ...p, enunciado: 'Tem hipertensão?' } : p));
    const s = await salvarConteudo(admin, f.formId, v2, alterada);
    expect(s.status, s.texto).toBe(200);
    expect(s.corpo.conteudo.perguntas.find((p: { codigo: string }) => p.codigo === 'PRESSAO_ALTA').enunciado).toBe('Tem hipertensão?');
    expect((await publicar(admin, f.formId, v2)).status).toBe(200);

    expect((await admin.get(caminhoVersao(f.formId, f.versaoId))).corpo).toEqual(v1);
    const lista = await admin.get(`/projects/${projeto}/forms`);
    const form = lista.corpo.itens.find((x: { id: string }) => x.id === f.formId);
    expect(form.versoes.map((v: { numero: number; status: string }) => [v.numero, v.status])).toEqual([
      [1, 'publicada'],
      [2, 'publicada'],
    ]);
  });
});
