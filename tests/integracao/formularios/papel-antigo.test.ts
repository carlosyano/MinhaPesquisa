// Formulário de papel antigo (RF-013, RF-011, RF-004, CA-058, DEC-175, DEC-179, DEC-181, DEC-189,
// DEC-190, ENT-006): importação na página do original, campos injetados no início da página 1,
// `total_paginas` e a sua cópia, `mapa_layout` nulo e a marca imutável depois da publicação.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente, type Resposta } from '../../support/cliente.js';
import { entrar, MINUTO, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { caminhoVersao, projetoCriado, publicar, salvarConteudo, type Conteudo, type Pergunta } from '../../support/formularios.js';
import { criarHarness, type Harness, type RoteiroImportacao } from '../../support/harness.js';
import { CODIGOS_RN050, emOrdem, importar, lida, modeloPdf, porCodigo, processarComRetentativas, consultarImportacao } from '../../support/importacao.js';
import { conteudoCondicoes, conteudoMemorias, papelAntigoPublicado, rascunhoAntigo } from '../../support/papel-antigo.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;
let projeto: string;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComUsuaria(h, 'Tenant Memórias');
  c = await entrar(h, T.usuaria);
  projeto = await projetoCriado(c, 'Saúde Idoso');
});
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

const MEDICAMENTOS = Array.from({ length: 60 }, (_, i) => `Medicamento fictício ${i + 1}`);

/** O original do CA-058: página 1 com "Nome:" e o estado civil; página 2 com pressão, local e os 60 medicamentos; página 3 sem pergunta. */
function original(comNome = true): RoteiroImportacao {
  return {
    1: {
      perguntas: [
        ...(comNome ? [lida('Nome:', 'texto_curto', { campo_padrao: 'nome' })] : []),
        lida('Estado civil', 'escolha_unica', { opcoes: ['Solteiro', 'Casado'] }),
      ],
    },
    2: {
      perguntas: [
        lida('Pressão alta?', 'sim_nao'),
        lida('Local:', 'texto_curto', { campo_padrao: 'local_aplicacao' }),
        lida('Medicamentos em uso', 'multipla_escolha', { opcoes: MEDICAMENTOS }),
      ],
    },
    3: { perguntas: [] },
  };
}

interface Importada {
  imp: Record<string, any>;
  versao: Resposta;
  perguntas: (Pergunta & Record<string, any>)[];
}

async function importarAntigo(roteiro: RoteiroImportacao, papelAntigo: boolean | undefined = true): Promise<Importada> {
  const r = await importar(c, projeto, [await modeloPdf(3, 'antigo.pdf')], { nome: 'Memórias Antigas', papelAntigo });
  expect(r.status, r.texto).toBe(202);
  h.extrator.programar(r.corpo.id, roteiro);
  await processarComRetentativas(h);
  const imp = (await consultarImportacao(c, r.corpo.id)).corpo;
  expect(imp.estado, JSON.stringify(imp)).toBe('concluida');
  const versao = await c.get(caminhoVersao(imp.formulario_id, imp.versao_id));
  expect(versao.status, versao.texto).toBe(200);
  return { imp, versao, perguntas: versao.corpo.conteudo.perguntas };
}

function codigosDaPagina(perguntas: Pergunta[], pagina: number): string[] {
  return emOrdem(perguntas).filter((p) => p.pagina === pagina).map((p) => p.codigo);
}

describe('CA-058 — importação de formulário de papel antigo (DEC-181, DEC-190)', () => {
  let m: Importada;
  beforeAll(async () => {
    m = await importarAntigo(original());
  });

  // @trace CA-058, DEC-181, ENT-006
  it('a versão 1, em rascunho, tem papel_antigo, total_paginas = 3 e nenhum aviso nao_cabe; publicada, mapa_layout nulo', async () => {
    expect(m.versao.corpo.resumo).toMatchObject({ numero: 1, status: 'rascunho', papel_antigo: true });
    expect(m.versao.corpo.conteudo).toMatchObject({ papel_antigo: true, total_paginas: 3 });
    expect((m.imp.avisos as { motivo: string }[]).filter((a) => a.motivo === 'nao_cabe')).toEqual([]);
    const p = await publicar(c, m.imp.formulario_id, m.imp.versao_id);
    expect(p.status, p.texto).toBe(200);
    expect(await h.inspect.mapaLayout(m.imp.versao_id)).toBeNull();
    expect((await c.get(caminhoVersao(m.imp.formulario_id, m.imp.versao_id))).corpo.conteudo.total_paginas).toBe(3);
  });

  // @trace CA-058, DEC-181
  it('exemplos 1 a 5: cada pergunta fica na página do original; NOME e LOCAL_APLICACAO sem nao_consta; MEDICAMENTOS_EM_USO sem descarte', async () => {
    expect(porCodigo(m.perguntas, 'NOME')).toMatchObject({ pagina: 1, campo_respondente: 'nome' });
    expect(porCodigo(m.perguntas, 'NOME').nao_consta ?? false).toBe(false);
    expect(porCodigo(m.perguntas, 'ESTADO_CIVIL').pagina).toBe(1);
    expect(porCodigo(m.perguntas, 'PRESSAO_ALTA').pagina).toBe(2);
    expect(porCodigo(m.perguntas, 'LOCAL_APLICACAO')).toMatchObject({ pagina: 2, campo_aplicacao: 'local_aplicacao' });
    expect(porCodigo(m.perguntas, 'LOCAL_APLICACAO').nao_consta ?? false).toBe(false);
    expect(porCodigo(m.perguntas, 'MEDICAMENTOS_EM_USO')).toMatchObject({ pagina: 2, tipo: 'multipla_escolha' });
    expect(porCodigo(m.perguntas, 'MEDICAMENTOS_EM_USO').opcoes).toHaveLength(60);
    expect(m.perguntas.filter((p) => p.pagina === 3)).toEqual([]);
  });

  // @trace CA-058, DEC-179, DEC-190
  it('exemplo 6: CPF, DATA_NASCIMENTO e DATA_APLICACAO injetadas no início da página 1, na ordem da RN-050, com nao_consta', async () => {
    expect(codigosDaPagina(m.perguntas, 1)).toEqual(['DATA_NASCIMENTO', 'CPF', 'DATA_APLICACAO', 'NOME', 'ESTADO_CIVIL']);
    for (const codigo of ['DATA_NASCIMENTO', 'CPF', 'DATA_APLICACAO']) expect(porCodigo(m.perguntas, codigo).nao_consta, codigo).toBe(true);
  });

  // @trace CA-058, DEC-181, DEC-190
  it('exemplo 7: original sem "Nome:" → NOME injetado no início da página 1, antes de DATA_NASCIMENTO, sem nao_consta', async () => {
    const semNome = await importarAntigo(original(false));
    expect(codigosDaPagina(semNome.perguntas, 1)).toEqual(['NOME', 'DATA_NASCIMENTO', 'CPF', 'DATA_APLICACAO', 'ESTADO_CIVIL']);
    expect(porCodigo(semNome.perguntas, 'NOME').nao_consta ?? false).toBe(false);
  });

  // @trace CA-058, CA-045, CA-047
  it('exemplo 8: o mesmo arquivo sem papel_antigo → como no CA-045: os 5 campos no início da página 1, MEDICAMENTOS_EM_USO descartada com nao_cabe, nenhuma nao_consta', async () => {
    const oficial = await importarAntigo(original(), undefined);
    expect(oficial.versao.corpo.resumo.papel_antigo ?? false).toBe(false);
    expect(oficial.versao.corpo.conteudo.total_paginas ?? null).toBeNull();
    expect(codigosDaPagina(oficial.perguntas, 1).slice(0, 5)).toEqual(CODIGOS_RN050);
    expect(oficial.perguntas.map((p) => p.codigo)).not.toContain('MEDICAMENTOS_EM_USO');
    expect(oficial.imp.avisos).toContainEqual({ pagina: 2, posicao: 3, motivo: 'nao_cabe' });
    expect(oficial.perguntas.filter((p) => p.nao_consta === true)).toEqual([]);
  });
});

describe('ENT-006 / DEC-189 — total_paginas, cópia de versão e marca de papel antigo', () => {
  async function copiar(formId: string, origem: string, extra: Record<string, unknown> = {}): Promise<Resposta> {
    return c.post(`/forms/${formId}/versions`, { corpo: { copiar_de_versao_id: origem, ...extra }, headers: { 'idempotency-key': chaveIdempotencia() } });
  }

  async function conteudoDe(formId: string, versaoId: string): Promise<Conteudo & Record<string, any>> {
    const v = await c.get(caminhoVersao(formId, versaoId));
    expect(v.status, v.texto).toBe(200);
    return v.corpo.conteudo;
  }

  // @trace DEC-189, ENT-006, DEC-179
  it('cópia de papel antigo leva o total_paginas e a marca; cópia com papel_antigo = false apaga o total e retira nao_consta', async () => {
    const v = await papelAntigoPublicado(c, projeto, 'Memórias para copiar', conteudoMemorias(), 3);
    const antiga = await copiar(v.formId, v.versaoId);
    expect(antiga.status, antiga.texto).toBe(201);
    expect(antiga.corpo.resumo.papel_antigo).toBe(true);
    expect(await conteudoDe(v.formId, antiga.corpo.resumo.id)).toMatchObject({ papel_antigo: true, total_paginas: 3 });

    const oficial = await copiar(v.formId, v.versaoId, { papel_antigo: false });
    expect(oficial.status, oficial.texto).toBe(201);
    expect(oficial.corpo.resumo.papel_antigo).toBe(false);
    const c2 = await conteudoDe(v.formId, oficial.corpo.resumo.id);
    expect(c2.total_paginas ?? null).toBeNull();
    expect(c2.perguntas.filter((p: Pergunta) => p.nao_consta === true)).toEqual([]);
  });

  // @trace DEC-189, ENT-006
  it('origem publicada sem total informado → a publicação grava a maior página, e a cópia leva esse total', async () => {
    const v = await papelAntigoPublicado(c, projeto, 'Condições sem total', conteudoCondicoes());
    expect(await conteudoDe(v.formId, v.versaoId)).toMatchObject({ total_paginas: 2 });
    const copia = await copiar(v.formId, v.versaoId);
    expect(copia.status, copia.texto).toBe(201);
    expect(await conteudoDe(v.formId, copia.corpo.resumo.id)).toMatchObject({ papel_antigo: true, total_paginas: 2 });
  });

  // @trace ENT-006, DEC-181, ERR-001
  it('total_paginas menor que a maior página das perguntas, ou fora do papel antigo → ERR-001', async () => {
    const menor = await rascunhoAntigo(c, projeto, 'Total menor', conteudoMemorias(), 1);
    esperarErro(menor.gravado, 'ERR-001');

    const oficial = await c.post('/forms', { corpo: { nome: 'Oficial com total', projeto_id: projeto }, headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(oficial.status, oficial.texto).toBe(201);
    const atual = await c.get(caminhoVersao(oficial.corpo.id, oficial.corpo.versoes[0].id));
    esperarErro(await salvarConteudo(c, oficial.corpo.id, oficial.corpo.versoes[0].id, { ...atual.corpo.conteudo, total_paginas: 3 }), 'ERR-001');
  });

  // @trace DEC-181, DEC-143
  it('a medida de "caber na página" (DEC-143) não vale no papel antigo', async () => {
    const c1 = conteudoCondicoes();
    c1.perguntas.push({
      codigo: 'MEDICAMENTOS_EM_USO',
      tipo: 'multipla_escolha',
      enunciado: 'Medicamentos em uso',
      pagina: 2,
      ordem: c1.perguntas.length + 1,
      opcoes: MEDICAMENTOS.map((rotulo, i) => ({ codigo: `med_${i + 1}`, rotulo, ordem: i + 1 })),
    });
    const r = await rascunhoAntigo(c, projeto, 'Alta demais', c1);
    expect(r.gravado.status, r.gravado.texto).toBe(200);
    const p = await publicar(c, r.formId, r.versaoId);
    expect(p.status, p.texto).toBe(200);
  });

  // @trace DEC-175, RN-042, ERR-009
  it('a marca papel_antigo não muda depois da publicação', async () => {
    const v = await papelAntigoPublicado(c, projeto, 'Marca imutável', conteudoCondicoes());
    const r = await salvarConteudo(c, v.formId, v.versaoId, { ...conteudoCondicoes(), papel_antigo: false } as Conteudo);
    esperarErro(r, 'ERR-009');
    expect((await c.get(caminhoVersao(v.formId, v.versaoId))).corpo.resumo.papel_antigo).toBe(true);
  });
});
