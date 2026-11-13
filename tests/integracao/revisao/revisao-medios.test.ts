// Médios da revisão focada do IMP-003 tratados antes do aceite (DEC-131): CPF de pergunta comum
// cifrado (RN-025), conclusões simultâneas do mesmo CPF (RN-015), reversão em cadeia (CA-042,
// PLANO §4.4), checks de aplicação no banco (ENT-010) e o que o motor recebe: chaves opacas e o
// recorte de cada campo (RN-045).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { formularioPublicado, projetoCriado, type Conteudo, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import {
  abrir,
  calibrarConfianca,
  comMotivo,
  concluida,
  concluir,
  consultar,
  conteudoLeitura,
  CPF,
  enviarELer,
  item,
  leiturasCompletas,
  prepararCotacao,
  prontaParaConcluir,
} from '../../support/leitura.js';

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

/** Versão de leitura com uma pergunta comum do tipo cpf, fora da identificação do respondente. */
function comCpfAcompanhante(): Conteudo {
  const c = conteudoLeitura();
  const ordem = Math.max(...c.perguntas.map((p) => p.ordem)) + 1;
  c.perguntas.push({ codigo: 'CPF_ACOMPANHANTE', tipo: 'cpf', enunciado: 'CPF do acompanhante', pagina: 4, ordem, sensibilidade: 'outro' });
  return c;
}

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  await calibrarConfianca(h);
  A = await tenantComUsuaria(h, 'Tenant A');
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', comCpfAcompanhante());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

const reabrir = (id: string, motivo: string) => dig.post(`/applications/${id}/reopen`, comMotivo(motivo));

async function nomeDoCpf(cpf: string): Promise<string> {
  const r = (await h.inspect.respondentes(A.tenantId)).filter((x) => x.cpf === cpf);
  expect(r).toHaveLength(1);
  return r[0].nome;
}

/** Conclui uma aplicação do CPF com o nome lido, escolhendo gravar o nome da aplicação. */
async function mudarNome(cpf: string, nome: string): Promise<string> {
  const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: nome, confianca: 0.97 } });
  await abrir(dig, id);
  const r = await concluir(dig, id, { assinatura: 'presente', manter_cadastro: { nome: 'aplicacao' } });
  expect(r.status, r.texto).toBe(200);
  expect(r.corpo.estado).toBe('concluida');
  return id;
}

describe('DEC-131 (1) — CPF de pergunta comum fica cifrado (RN-025)', () => {
  // @trace DEC-131, RN-025, RN-013
  it('o CPF lido numa pergunta do tipo cpf sem campo_respondente não fica em claro no banco; a revisão aberta o mostra', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas({ CPF_ACOMPANHANTE: { valor: CPF.outro, confianca: 0.97 } }));
    const gravado = (await h.inspect.itensGravados(id)).find((i) => i.pergunta_codigo === 'CPF_ACOMPANHANTE')!;
    expect(gravado.valor_ia).toBeTruthy();
    expect(gravado.valor_ia).not.toContain(CPF.outro);
    expect(item((await consultar(dig, id)).corpo, 'CPF_ACOMPANHANTE').valor_ia).not.toBe(CPF.outro);
    expect(item((await abrir(dig, id)).corpo, 'CPF_ACOMPANHANTE').valor_ia).toBe(CPF.outro);
  });
});

describe('DEC-131 (2) — conclusões simultâneas do mesmo CPF (RN-015)', () => {
  // @trace DEC-131, RN-015, CA-014b
  it('duas aplicações do mesmo CPF novo concluídas ao mesmo tempo → as duas concluem no mesmo respondente', async () => {
    const extra = { CPF: { valor: CPF.terceiro, confianca: 0.97 } };
    const a = await prontaParaConcluir(h, dig, projeto, f, extra);
    const b = await prontaParaConcluir(h, dig, projeto, f, extra);
    const [ra, rb] = await Promise.all([concluir(dig, a), concluir(dig, b)]);
    expect(ra.status, ra.texto).toBe(200);
    expect(rb.status, rb.texto).toBe(200);
    expect([ra.corpo.estado, rb.corpo.estado]).toEqual(['concluida', 'concluida']);
    const respondentes = (await h.inspect.respondentes(A.tenantId)).filter((x) => x.cpf === CPF.terceiro);
    expect(respondentes).toHaveLength(1);
    expect((await h.inspect.aplicacao(a)).respondente_id).toBe(respondentes[0].id);
    expect((await h.inspect.aplicacao(b)).respondente_id).toBe(respondentes[0].id);
  });
});

describe('DEC-131 (3) — reversão em cadeia (CA-042, PLANO §4.4)', () => {
  // @trace DEC-131, CA-042, DEC-063
  it('reabrir a última e depois a anterior volta o atributo ao valor de antes das duas', async () => {
    const cpf = CPF.ana;
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Lúcia Ramos', confianca: 0.97 } });
    const primeira = await mudarNome(cpf, 'Lúcia R. Ramos');
    const segunda = await mudarNome(cpf, 'Lúcia Ramos Pinto');

    expect((await reabrir(segunda, 'Conferência do nome')).status).toBe(200);
    expect(await nomeDoCpf(cpf)).toBe('Lúcia R. Ramos');
    expect((await reabrir(primeira, 'Conferência do nome')).status).toBe(200);
    expect(await nomeDoCpf(cpf)).toBe('Lúcia Ramos');
  });

  // @trace DEC-131, CA-042, PLANO §4.4
  it('reabrir a anterior primeiro mantém o atributo, com auditoria; reabrir a última depois volta ao valor de antes das duas', async () => {
    const cpf = CPF.rosa;
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Teresa Lima', confianca: 0.97 } });
    const primeira = await mudarNome(cpf, 'Teresa C. Lima');
    const segunda = await mudarNome(cpf, 'Teresa Campos Lima');

    const antes = (await h.inspect.auditoria(A.tenantId)).length;
    expect((await reabrir(primeira, 'Conferência do nome')).status).toBe(200);
    expect(await nomeDoCpf(cpf)).toBe('Teresa Campos Lima');
    const novos = (await h.inspect.auditoria(A.tenantId)).slice(antes);
    expect(novos).toContainEqual(
      expect.objectContaining({ acao: 'REVERTER_CADASTRO', campo: 'nome', detalhes: expect.objectContaining({ resultado: 'mantido' }) }),
    );
    expect(JSON.stringify(novos)).not.toContain('Teresa');

    expect((await reabrir(segunda, 'Conferência do nome')).status).toBe(200);
    expect(await nomeDoCpf(cpf)).toBe('Teresa Lima');
  });
});

describe('DEC-131 (4) — checks de aplicação no banco (ENT-010, PLANO §5.3)', () => {
  // @trace DEC-131, ENT-010, CA-009
  it('o banco recusa aplicação concluída sem data ou sem local da aplicação', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: CPF.pendente, confianca: 0.97 } });
    const semData = await h.banco.tentarAtualizarAplicacao(id, { data_aplicacao: null });
    expect(semData.aceita).toBe(false);
    const semLocal = await h.banco.tentarAtualizarAplicacao(id, { local_aplicacao: null });
    expect(semLocal.aceita).toBe(false);
  });

  // @trace DEC-131, ENT-010
  it('o banco recusa aplicação fora de identificacao_pendente e de descartada sem versão', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    expect((await h.banco.tentarAtualizarAplicacao(id, { versao_id: null })).aceita).toBe(false);
    expect((await h.banco.tentarAtualizarAplicacao(id, { estado: 'descartada', versao_id: null })).aceita).toBe(true);
  });
});

describe('DEC-131 (5) — o que o motor recebe (RN-045)', () => {
  // @trace DEC-131, RN-045, RN-038
  it('chaves opacas no schema, sem o código da pergunta, e uma chave por campo do gabarito (sem número de recorte)', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const chamadas = await h.motor.chamadas(id);
    expect(chamadas.length).toBeGreaterThan(0);
    for (const c of chamadas) {
      for (const codigo of c.campos) expect(c.schema, codigo).not.toContain(codigo.split('.')[0]);
      const schema = JSON.parse(c.schema) as { campos: { chave: string; recorte?: number }[] };
      expect(schema.campos.map((x) => x.chave)).toEqual(schema.campos.map((_, i) => `c${i + 1}`));
      expect(schema.campos.every((x) => x.recorte === undefined)).toBe(true);
      expect(schema.campos).toHaveLength(c.campos.length);
    }
  });
});
