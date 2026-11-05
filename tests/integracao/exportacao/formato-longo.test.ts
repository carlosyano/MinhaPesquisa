// Exportação em formato longo (RF-012, US-012, RN-051, CA-021, CA-050, CA-051; DEC-153 a DEC-165).
// As aplicações chegam a `concluida` pela API, com o motor de leitura simulado (DEC-123). Cada
// cenário que precisa de dados próprios tem o seu projeto, porque a exportação recorta por projeto.
// O relógio do harness começa em 02/11/2026; ele é adiantado para 06/11/2026 antes de tudo, porque a
// data da aplicação do CA-050 (05/11/2026) não pode ser futura (ENT-010).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jpeg } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { Cliente, chaveIdempotencia } from '../../support/cliente.js';
import { DIA, MINUTO, entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import {
  ACOES_A1,
  COLUNAS,
  LINHAS_A1,
  celulasXlsx,
  conferida,
  consultarExportacao,
  conteudoSaude,
  exportada,
  itens,
  lida,
  leituraA1,
  linhas,
  pedirExportacao,
} from '../../support/exportacao.js';
import { arquivo, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { CPF, prepararCotacao, semIdentificadores } from '../../support/leitura.js';
import { BOM } from '../../support/planilha.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;
/** Projeto "Saúde 60+" do CA-050, com a versão da tabela. */
let saude: string;
let f: FormularioPublicado;
let a1: string;
let a2: string;
let emRevisao: string;
let deOutroProjeto: string;

const ID_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
/** CPF sintético válido só do cenário das fórmulas, para o nome "@Maria" não esbarrar em outro cadastro. */
const CPF_FORMULAS = '27483749245';

function corpo(projetoIds: string[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { formato: 'xlsx', escopo: 'linha_por_item', projeto_ids: projetoIds, ...extra };
}

/** Projeto novo com a versão do CA-050 publicada. */
async function projetoComFormulario(nome: string): Promise<{ projeto: string; form: FormularioPublicado }> {
  const projeto = await projetoCriado(c, nome);
  return { projeto, form: await formularioPublicado(c, projeto, nome, conteudoSaude()) };
}

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  await h.clock.advance(4 * DIA);
  T = await tenantComUsuaria(h, 'Tenant Exportação');
  c = await entrar(h, T.usuaria);
  saude = await projetoCriado(c, 'Saúde 60+');
  f = await formularioPublicado(c, saude, 'Saúde 60+', conteudoSaude());
  a1 = await conferida(h, c, saude, f, leituraA1(), ACOES_A1);
  await h.clock.advance(MINUTO);
  a2 = await conferida(
    h,
    c,
    saude,
    f,
    leituraA1({ NOME: { valor: 'Joana Pereira', confianca: 0.97 }, CPF: { valor: CPF.novo, confianca: 0.97 } }),
    ACOES_A1,
    'ausente',
  );
  emRevisao = await lida(h, c, saude, f, leituraA1({ CPF: { valor: CPF.outro, confianca: 0.97 } }));
  await h.clock.advance(MINUTO);
  const outro = await projetoComFormulario('Outro projeto');
  deOutroProjeto = await conferida(h, c, outro.projeto, outro.form, leituraA1({ CPF: { valor: CPF.terceiro, confianca: 0.97 }, NOME: { valor: 'Rosa Lima', confianca: 0.97 } }), ACOES_A1);
});
// Uma só usuária faz quase todas as requisições: avançar o relógio a cada teste evita o limite de
// 100 requisições por minuto por usuária (Bloco P P.7), que não é o assunto aqui.
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

describe('CA-050 — planilha em formato longo (RN-051)', () => {
  // @trace CA-050, CA-021, RN-051, DEC-154, DEC-155, DEC-156, DEC-157, DEC-158, DEC-160, DEC-162, DEC-165
  it('XLSX do "Saúde 60+": cabeçalho da RN-051, só as 8 linhas da A1, na ordem da tabela', async () => {
    const a = await exportada(h, c, corpo([saude]));
    const l = linhas(a, 'xlsx');
    expect(l[0]).toEqual([...COLUNAS]);
    expect(itens(l)).toEqual(LINHAS_A1.map((x) => [...x]));
    for (const linha of l.slice(1)) expect(linha.slice(0, 4)).toEqual([a1, '52998224725', 'Maria da Silva', '2026-11-05']);
    const ids = new Set(l.slice(1).map((x) => x[0]));
    for (const fora of [a2, emRevisao, deOutroProjeto]) expect(ids.has(fora)).toBe(false);
    const perguntas = new Set(l.slice(1).map((x) => x[4]));
    for (const ident of ['NOME', 'DATA_NASCIMENTO', 'CPF', 'DATA_APLICACAO']) expect(perguntas.has(ident)).toBe(false);
  });

  // @trace CA-050, DEC-155, DEC-165, DEC-166
  it('XLSX: uma planilha "Dados"; CPF e datas são texto, o PESO é número, e nenhuma célula é fórmula', async () => {
    const a = await exportada(h, c, corpo([saude]));
    expect(a.contentType).toMatch(/^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
    const celulas = celulasXlsx(a);
    expect(celulas[0].every((x) => x.tipo === 'texto')).toBe(true);
    for (const linha of celulas.slice(1)) {
      expect(linha[1]).toEqual({ tipo: 'texto', valor: '52998224725' });
      expect(linha[3]).toEqual({ tipo: 'texto', valor: '2026-11-05' });
      expect(linha.some((x) => x.tipo === 'formula')).toBe(false);
    }
    const peso = celulas.find((x) => x[4].valor === 'PESO')!;
    expect(peso[6]).toEqual({ tipo: 'numero', valor: '72.5' });
    const local = celulas.find((x) => x[4].valor === 'LOCAL_APLICACAO')!;
    expect(local[6]).toEqual({ tipo: 'texto', valor: 'Clínica Centro' });
  });

  // @trace CA-050, RN-051, RN-028, DEC-072, DEC-165
  it('a auditoria registra o pedido uma vez (escopo, formato e projetos) e a conclusão com as contagens, sem valores', async () => {
    const antes = (await h.inspect.auditoria(T.tenantId)).length;
    const a = await exportada(h, c, corpo([saude]));
    const novos = (await h.inspect.auditoria(T.tenantId)).slice(antes);
    const pedido = novos.filter((e) => e.acao === 'EXPORTAR_DADOS');
    const conclusao = novos.filter((e) => e.acao === 'EXPORTACAO_CONCLUIDA');
    expect(pedido).toHaveLength(1);
    expect(conclusao).toHaveLength(1);
    expect(pedido[0]).toMatchObject({ usuario_id: T.usuaria.usuarioId, registro_id: a.id });
    expect(conclusao[0].registro_id).toBe(a.id);
    const detalhesPedido = JSON.stringify(pedido[0].detalhes);
    for (const esperado of ['linha_por_item', 'xlsx', saude]) expect(detalhesPedido).toContain(esperado);
    // Uma aplicação (A1) e as suas 8 linhas.
    expect(Object.values(conclusao[0].detalhes as Record<string, unknown>)).toEqual(expect.arrayContaining([1, 8]));
    const texto = semIdentificadores(JSON.stringify(novos));
    for (const pessoal of [CPF.joana, '529.982.247-25', 'Maria da Silva', 'Clínica Centro', '72.5', 'geladeira']) {
      expect(texto).not.toContain(pessoal);
    }
  });

  // @trace RN-028, RN-051
  it('nada do conteúdo exportado vai para o log', async () => {
    await exportada(h, c, corpo([saude]));
    await exportada(h, c, corpo([saude], { formato: 'csv' }));
    const logs = semIdentificadores(await h.inspect.logs());
    for (const pessoal of [CPF.joana, '529.982.247-25', 'Maria da Silva', 'Clínica Centro']) expect(logs).not.toContain(pessoal);
  });

  // @trace RF-012, DEC-165, DEC-069, RNF-007
  it('pedido → 202 enfileirada, sem link; depois do worker, concluida com link local e expira_em em 7 dias', async () => {
    const r = await pedirExportacao(c, corpo([saude]));
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ status: 'enfileirada' });
    expect(r.corpo.url_download ?? null).toBeNull();
    expect((await h.inspect.exportacao(r.corpo.id)).objetos).toBe(0);
    const antes = await consultarExportacao(c, r.corpo.id);
    expect(antes.status, antes.texto).toBe(200);
    expect(antes.corpo.status).toBe('enfileirada');
    expect(antes.corpo.url_download ?? null).toBeNull();

    await h.worker.processar();
    const depois = await consultarExportacao(c, r.corpo.id);
    expect(depois.corpo.status).toBe('concluida');
    expect(new URL(depois.corpo.url_download).hostname).toBe('127.0.0.1');
    expect(new Date(depois.corpo.expira_em).getTime() - h.clock.now().getTime()).toBe(7 * DIA);
    const gravada = await h.inspect.exportacao(r.corpo.id);
    expect(gravada).toMatchObject({ status: 'concluida', formato: 'xlsx', escopo: 'linha_por_item', objetos: 1 });
    expect(gravada.chave_storage).toBe(`tenant/${T.tenantId}/exportacao/${r.corpo.id}.xlsx`);
  });

  // @trace CA-021, DEC-157, RN-051
  it('aplicação sem assinatura entra depois que a página assinada é anexada e ela vai para concluida (CA-044)', async () => {
    const { projeto, form } = await projetoComFormulario('Assinatura depois');
    const id = await conferida(h, c, projeto, form, leituraA1({ CPF: { valor: CPF.ana, confianca: 0.97 }, NOME: { valor: 'Ana Souza', confianca: 0.97 } }), ACOES_A1, 'ausente');
    expect(itens(linhas(await exportada(h, c, corpo([projeto])), 'xlsx'))).toEqual([]);

    const anexada = await c.enviarFormulario(
      `/applications/${id}/signature`,
      [
        ['arquivo', arquivo('p1-assinada.jpg', 'image/jpeg', await jpeg(form.paginas[0]))],
        ['assinatura', 'presente'],
      ],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(anexada.status, anexada.texto).toBe(200);
    expect(anexada.corpo.estado).toBe('concluida');
    const l = linhas(await exportada(h, c, corpo([projeto])), 'xlsx');
    expect(new Set(l.slice(1).map((x) => x[0]))).toEqual(new Set([id]));
  });

  // @trace RN-051, DEC-160
  it('linhas em ordem de Data_Aplicacao e de ID_Aplicacao; várias aplicações e vários projetos no mesmo arquivo', async () => {
    const { projeto, form } = await projetoComFormulario('Ordem');
    const cpfs = [CPF.rosa, CPF.pendente, CPF.reaberta];
    const datas = ['2026-11-04', '2026-11-03', '2026-11-04'];
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push(
        await conferida(
          h,
          c,
          projeto,
          form,
          leituraA1({ CPF: { valor: cpfs[i], confianca: 0.97 }, NOME: { valor: `Pessoa Fictícia ${i + 1}`, confianca: 0.97 }, DATA_APLICACAO: { valor: datas[i], confianca: 0.97 } }),
          ACOES_A1,
        ),
      );
      await h.clock.advance(MINUTO);
    }
    const l = linhas(await exportada(h, c, corpo([projeto, saude])), 'xlsx').slice(1);
    const esperado = [
      { id: ids[1], data: '2026-11-03' },
      ...[ids[0], ids[2]].sort().map((id) => ({ id, data: '2026-11-04' })),
      { id: a1, data: '2026-11-05' },
    ];
    // Cada aplicação em um bloco contínuo de 8 linhas, na ordem esperada.
    expect(l).toHaveLength(8 * esperado.length);
    esperado.forEach(({ id, data }, i) => {
      for (const linha of l.slice(8 * i, 8 * (i + 1))) {
        expect(linha[0]).toBe(id);
        expect(linha[3]).toBe(data);
      }
      expect(itens([[], ...l.slice(8 * i, 8 * (i + 1))])).toEqual(LINHAS_A1.map((x) => [...x]));
    });
  });

  // @trace RN-051, DEC-156, DEC-158
  it('multipla_escolha: uma linha por opção na ordem da versão; matriz e item sem resposta com a situação', async () => {
    const { projeto, form } = await projetoComFormulario('Tipos');
    await conferida(
      h,
      c,
      projeto,
      form,
      leituraA1({
        CPF: { valor: CPF.corrigido, confianca: 0.97 },
        NOME: { valor: 'Clara Nunes Fictícia', confianca: 0.97 },
        BENS_POSSUIDOS: { valor: 'geladeira;televisao', confianca: 0.97 },
        'SATISFACAO_COM.moradia': { valor: 'ruim', confianca: 0.4 },
        'SATISFACAO_COM.saude': { valor: 'regular', confianca: 0.97 },
        PESO: { valor: '60', confianca: 0.4 },
        FUMA: { valor: 'sim', confianca: 0.97 },
        DOENCAS: { valor: 'diabetes;hipertensao', confianca: 0.97 },
      }),
      { 'SATISFACAO_COM.moradia': 'rasurado', PESO: 'nao_se_aplica' },
    );
    expect(itens(linhas(await exportada(h, c, corpo([projeto])), 'xlsx'))).toEqual([
      ['LOCAL_APLICACAO', '', 'Clínica Centro', '', 'respondida'],
      ['BENS_POSSUIDOS', '', 'geladeira', 'Geladeira', 'respondida'],
      ['BENS_POSSUIDOS', '', 'televisao', 'Televisão', 'respondida'],
      ['SATISFACAO_COM', 'moradia', '', '', 'rasurado'],
      ['SATISFACAO_COM', 'saude', 'regular', 'Regular', 'respondida'],
      ['PESO', '', '', '', 'nao_se_aplica'],
      ['FUMA', '', 'sim', 'Sim', 'respondida'],
      ['DOENCAS', '', 'diabetes', 'Diabetes', 'respondida'],
      ['DOENCAS', '', 'hipertensao', 'Hipertensão', 'respondida'],
    ]);
  });
});

describe('CA-051 — recorte, formato, fórmulas e retenção (RN-051)', () => {
  // @trace CA-051, DEC-163, ERR-001
  it('exemplo 1: com `filtros` → ERR-001 (campos: filtros); nada é gravado', async () => {
    const antes = await h.inspect.contagemExportacao(T.tenantId);
    const r = await pedirExportacao(c, corpo([saude], { filtros: [{ tipo: 'idade', operador: 'em', valores: ['60-64'] }] }));
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['filtros']);
    await h.worker.processar();
    expect(await h.inspect.contagemExportacao(T.tenantId)).toEqual(antes);
  });

  // @trace CA-051, ERR-002, RN-023, TS-001
  it('exemplo 2: projeto inexistente ou de outro tenant em projeto_ids → ERR-002; nada é gravado', async () => {
    const antes = await h.inspect.contagemExportacao(T.tenantId);
    esperarErro(await pedirExportacao(c, corpo([saude, ID_INEXISTENTE])), 'ERR-002');
    const B = await tenantComUsuaria(h, 'Tenant B exportação');
    const b = await entrar(h, B.usuaria);
    const antesB = await h.inspect.contagemExportacao(B.tenantId);
    esperarErro(await pedirExportacao(b, corpo([saude])), 'ERR-002');
    await h.worker.processar();
    expect(await h.inspect.contagemExportacao(T.tenantId)).toEqual(antes);
    expect(await h.inspect.contagemExportacao(B.tenantId)).toEqual(antesB);
  });

  // @trace CA-051, RN-051
  it.each(['xlsx', 'csv'] as const)('exemplo 3: período de 2026-12-01 a 2026-12-31, sem aplicação nele → concluida, só o cabeçalho (%s)', async (formato) => {
    const a = await exportada(h, c, corpo([saude], { formato, periodo: { de: '2026-12-01', ate: '2026-12-31' } }));
    expect(linhas(a, formato)).toEqual([[...COLUNAS]]);
  });

  // @trace RN-051
  it('período inclui as duas pontas pela data da aplicação', async () => {
    const dentro = await exportada(h, c, corpo([saude], { periodo: { de: '2026-11-05', ate: '2026-11-05' } }));
    expect(itens(linhas(dentro, 'xlsx'))).toHaveLength(8);
    const antes = await exportada(h, c, corpo([saude], { periodo: { de: '2026-10-01', ate: '2026-11-04' } }));
    expect(itens(linhas(antes, 'xlsx'))).toEqual([]);
  });

  // @trace CA-051, DEC-159, DEC-165
  it('exemplo 4: CSV com as mesmas colunas e linhas do XLSX, em UTF-8 com BOM, `;` e CRLF', async () => {
    const xlsx = linhas(await exportada(h, c, corpo([saude])), 'xlsx');
    const a = await exportada(h, c, corpo([saude], { formato: 'csv' }));
    expect(a.contentType).toMatch(/^text\/csv/);
    expect(a.bytes.toString('utf8').startsWith(`${BOM}ID_Aplicacao;CPF;Nome;`)).toBe(true);
    expect(a.bytes.toString('utf8').endsWith('\r\n')).toBe(true);
    expect(linhas(a, 'csv')).toEqual(xlsx);
    expect((await h.inspect.exportacao(a.id)).chave_storage).toBe(`tenant/${T.tenantId}/exportacao/${a.id}.csv`);
  });

  describe('exemplos 5 a 7: neutralização de fórmulas (DEC-166)', () => {
    let projeto: string;
    let id: string;
    beforeAll(async () => {
      const p = await projetoComFormulario('Fórmulas');
      projeto = p.projeto;
      id = await conferida(
        h,
        c,
        projeto,
        p.form,
        leituraA1({
          CPF: { valor: CPF_FORMULAS, confianca: 0.97 },
          NOME: { valor: '@Maria', confianca: 0.97 },
          LOCAL_APLICACAO: { valor: '=HYPERLINK("http://exemplo.invalid")', confianca: 0.97 },
          PESO: { valor: '-3', confianca: 0.97 },
        }),
        ACOES_A1,
      );
    });

    // @trace CA-051, DEC-166, RN-037
    it('csv: o texto que começa com = ou @ recebe o apóstrofo; o número -3 sai como está', async () => {
      const l = linhas(await exportada(h, c, corpo([projeto], { formato: 'csv' })), 'csv').slice(1);
      expect(l.length).toBeGreaterThan(0);
      for (const linha of l) expect(linha.slice(0, 3)).toEqual([id, CPF_FORMULAS, "'@Maria"]);
      expect(l.find((x) => x[4] === 'LOCAL_APLICACAO')![6]).toBe(`'=HYPERLINK("http://exemplo.invalid")`);
      expect(l.find((x) => x[4] === 'PESO')![6]).toBe('-3');
    });

    // @trace CA-051, DEC-166, DEC-165, RN-037
    it('xlsx: o texto sai sem apóstrofo, em célula de texto; o -3 é célula numérica; nenhuma célula é fórmula', async () => {
      const celulas = celulasXlsx(await exportada(h, c, corpo([projeto]))).slice(1);
      expect(celulas.length).toBeGreaterThan(0);
      for (const linha of celulas) {
        expect(linha[0]).toEqual({ tipo: 'texto', valor: id });
        expect(linha[2]).toEqual({ tipo: 'texto', valor: '@Maria' });
      }
      expect(celulas.find((x) => x[4].valor === 'LOCAL_APLICACAO')![6]).toEqual({ tipo: 'texto', valor: '=HYPERLINK("http://exemplo.invalid")' });
      expect(celulas.find((x) => x[4].valor === 'PESO')![6]).toEqual({ tipo: 'numero', valor: '-3' });
      expect(celulas.flat().some((x) => x.tipo === 'formula')).toBe(false);
    });
  });

  // @trace DEC-166, RN-037
  it.each(['+SOMA(1;2)', '-2+3', '@SOMA(A1)'])('texto que começa com %s: apóstrofo no CSV; no XLSX, como está, em célula de texto', async (local) => {
    const { projeto, form } = await projetoComFormulario(`Prefixo ${local}`);
    await conferida(h, c, projeto, form, leituraA1({ CPF: { valor: CPF.maria, confianca: 0.97 }, LOCAL_APLICACAO: { valor: local, confianca: 0.97 } }), ACOES_A1);
    const csv = linhas(await exportada(h, c, corpo([projeto], { formato: 'csv' })), 'csv');
    expect(csv.find((x) => x[4] === 'LOCAL_APLICACAO')![6]).toBe(`'${local}`);
    const xlsx = celulasXlsx(await exportada(h, c, corpo([projeto])));
    expect(xlsx.find((x) => x[4].valor === 'LOCAL_APLICACAO')![6]).toEqual({ tipo: 'texto', valor: local });
    expect(xlsx.flat().some((x) => x.tipo === 'formula')).toBe(false);
  });

  // @trace CA-051, DEC-069, RN-030, DEC-165
  it('exemplo 8: 8 dias depois de concluída, o arquivo é apagado e getExport traz url_download nulo', async () => {
    const a = await exportada(h, c, corpo([saude]));
    expect((await h.inspect.exportacao(a.id)).objetos).toBe(1);

    await h.clock.advance(6 * DIA);
    // O avanço do relógio encerra as sessões ociosas; um novo login segue o teste.
    let s = await entrar(h, T.usuaria);
    const ainda = await consultarExportacao(s, a.id);
    expect(ainda.corpo.status).toBe('concluida');
    expect(ainda.corpo.url_download).toBeTruthy();
    expect((await h.inspect.exportacao(a.id)).objetos).toBe(1);

    await h.clock.advance(2 * DIA);
    s = await entrar(h, T.usuaria);
    const depois = await consultarExportacao(s, a.id);
    expect(depois.status, depois.texto).toBe(200);
    expect(depois.corpo.url_download).toBeNull();
    const gravada = await h.inspect.exportacao(a.id);
    expect(gravada.objetos).toBe(0);
    expect(gravada.chave_storage).toBeNull();
    c = s;
  });
});

describe('exportData e getExport no IMP-007 (DEC-164, REQ §6.5)', () => {
  // @trace DEC-164, ERR-001
  it.each(['agregado', 'linha_a_linha'])('escopo %s → ERR-001 (campos: escopo) até o IMP-004; nada é gravado', async (escopo) => {
    const antes = await h.inspect.contagemExportacao(T.tenantId);
    const r = await pedirExportacao(c, corpo([saude], { escopo }));
    esperarErro(r, 'ERR-001');
    expect(r.corpo.campos).toEqual(['escopo']);
    expect(await h.inspect.contagemExportacao(T.tenantId)).toEqual(antes);
  });

  // @trace RF-012, ERR-001
  it.each([
    ['formato inválido', { formato: 'ods' }],
    ['projeto_ids vazio', { projeto_ids: [] }],
    ['campo desconhecido', { colunas: ['CPF'] }],
    ['período sem a data final', { periodo: { de: '2026-11-01' } }],
  ])('%s → ERR-001; nada é gravado', async (_n, extra) => {
    const antes = await h.inspect.contagemExportacao(T.tenantId);
    esperarErro(await pedirExportacao(c, corpo([saude], extra)), 'ERR-001');
    expect(await h.inspect.contagemExportacao(T.tenantId)).toEqual(antes);
  });

  // @trace RF-012, RN-051
  it('`rotulos` é ignorado no formato longo: a planilha traz código e rótulo', async () => {
    const comCodigos = await exportada(h, c, corpo([saude], { rotulos: 'codigos' }));
    expect(itens(linhas(comCodigos, 'xlsx'))).toEqual(LINHAS_A1.map((x) => [...x]));
  });

  // @trace REQ §6.5, ERR-019
  it('mesma chave e mesmo corpo → mesma exportação, sem duplicar; mesma chave e outro corpo → ERR-019', async () => {
    const chave = chaveIdempotencia();
    const antes = await h.inspect.contagemExportacao(T.tenantId);
    const a = await pedirExportacao(c, corpo([saude]), chave);
    const b = await pedirExportacao(c, corpo([saude]), chave);
    expect(a.status, a.texto).toBe(202);
    expect(b.status, b.texto).toBe(202);
    expect(b.corpo.id).toBe(a.corpo.id);
    expect((await h.inspect.contagemExportacao(T.tenantId)).exportacoes).toBe(antes.exportacoes + 1);
    esperarErro(await pedirExportacao(c, corpo([saude], { formato: 'csv' }), chave), 'ERR-019');
  });

  // @trace RN-023, TS-001, ERR-002
  it('exportação de outro tenant responde 404 ERR-002, igual a ID inexistente', async () => {
    const r = await pedirExportacao(c, corpo([saude]));
    expect(r.status, r.texto).toBe(202);
    const B = await tenantComUsuaria(h, 'Tenant C exportação');
    const b = await entrar(h, B.usuaria);
    esperarErro(await consultarExportacao(b, r.corpo.id), 'ERR-002');
    esperarErro(await consultarExportacao(b, ID_INEXISTENTE), 'ERR-002');
  });

  // @trace RF-002, RF-012
  it('sem sessão → 401 no pedido e na consulta', async () => {
    const r = await pedirExportacao(c, corpo([saude]));
    const anonimo = new Cliente(h.baseUrl);
    expect((await pedirExportacao(anonimo, corpo([saude]))).status).toBe(401);
    expect((await consultarExportacao(anonimo, r.corpo.id)).status).toBe(401);
  });
});
