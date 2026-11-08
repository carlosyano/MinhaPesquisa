// Nome do arquivo enviado (RF-014, US-013, CA-060; ENT-025, RF-006, RN-028, RN-051; DEC-198, DEC-201,
// DEC-203 (5), DEC-206; T-18). O nome original de cada arquivo fica em cada página que veio dele, com a
// posição da folha na ordem do envio (`ordem_envio`); é dado pessoal: nunca em log, auditoria ou
// mensagem de erro, e é apagado no expurgo da imagem. A eliminação do titular (DEC-206, DEC-210) é
// conferida no CA-023 e no TS-005 (IMP-004).

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EICAR, jpeg, pdfDeImagens } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Arquivo, type Cliente, type Resposta } from '../../support/cliente.js';
import { DIA, MINUTO, entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { ACOES_A1, COL, celulasXlsx, conferida, conteudoSaude, exportada, leituraA1, linhas, revisada } from '../../support/exportacao.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness } from '../../support/harness.js';
import { CPF, comMotivo, concluir, prepararCotacao, semIdentificadores } from '../../support/leitura.js';

let h: Harness;
let T: TenantPronto;
let c: Cliente;
/** Projeto "Saúde 60+", com a versão 1 de "Saúde Geral" publicada, com QR e 2 páginas. */
let saude: string;
let f: FormularioPublicado;
let maria: Resposta;
let joao: Resposta;

interface Pagina {
  imagem_id: string;
  numero_pagina: number | null;
  tipo: string;
  ordem_envio: number;
  nome_arquivo: string | null;
}

const pagina = (n: number) => jpeg(f.paginas[n - 1]);
const jpg = async (nome: string, n: number): Promise<Arquivo> => arquivo(nome, 'image/jpeg', await pagina(n));
const pdf = async (nome: string, numeros = [1, 2]): Promise<Arquivo> => arquivo(nome, 'application/pdf', await pdfDeImagens(await Promise.all(numeros.map(pagina))));

function resumo(paginas: Pagina[]) {
  return paginas.map((p) => ({ ordem_envio: p.ordem_envio, numero_pagina: p.numero_pagina, nome_arquivo: p.nome_arquivo }));
}

async function enviado(arquivos: Arquivo[], estado = 'em_leitura'): Promise<Resposta> {
  const r = await enviar(c, saude, arquivos);
  expect(r.status, r.texto).toBe(202);
  expect(r.corpo.estado).toBe(estado);
  return r;
}

async function paginasDe(id: string): Promise<Pagina[]> {
  const r = await c.get(`/applications/${id}`);
  expect(r.status, r.texto).toBe(200);
  return r.corpo.paginas as Pagina[];
}

/** Linhas exportadas (`linha_por_item`, XLSX) do projeto. */
async function exportadas(projeto = saude): Promise<string[][]> {
  return linhas(await exportada(h, c, { formato: 'xlsx', escopo: 'linha_por_item', projeto_ids: [projeto] }), 'xlsx').slice(1);
}

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  // A leitura da A1 do CA-050 tem a data da aplicação 05/11/2026, que não pode ser futura (ENT-010).
  await h.clock.advance(4 * DIA);
  T = await tenantComUsuaria(h, 'Tenant Nome do Arquivo');
  c = await entrar(h, T.usuaria);
  saude = await projetoCriado(c, 'Saúde 60+');
  f = await formularioPublicado(c, saude, 'Saúde Geral', conteudoSaude());
  maria = await enviado([await pdf('maria.pdf')]);
  joao = await enviado([await jpg('joao.jpg', 1), await jpg('joao-2.jpg', 2)]);
});
// Uma só usuária faz todas as requisições: avançar o relógio evita o limite de 100 por minuto (Bloco P P.7).
beforeEach(async () => {
  await h.clock.advance(MINUTO);
});
afterAll(async () => {
  await h?.close();
});

describe('CA-060 — nome do arquivo e ordem do envio (DEC-198)', () => {
  // @trace CA-060, RF-006, ENT-025, DEC-198
  it('o resultado de cada envio lista as páginas na ordem do envio, com `ordem_envio` e o nome do arquivo de onde vieram', async () => {
    expect(resumo(maria.corpo.paginas)).toEqual([
      { ordem_envio: 1, numero_pagina: 1, nome_arquivo: 'maria.pdf' },
      { ordem_envio: 2, numero_pagina: 2, nome_arquivo: 'maria.pdf' },
    ]);
    expect(resumo(joao.corpo.paginas)).toEqual([
      { ordem_envio: 1, numero_pagina: 1, nome_arquivo: 'joao.jpg' },
      { ordem_envio: 2, numero_pagina: 2, nome_arquivo: 'joao-2.jpg' },
    ]);
  });

  // @trace CA-060, ENT-025, DEC-198
  it('cada página guarda o nome do arquivo, também na consulta da aplicação', async () => {
    const folhas = await h.inspect.folhas(joao.corpo.aplicacao_id);
    expect(folhas.map((x) => [x.ordem_envio, x.nome_arquivo])).toEqual([
      [1, 'joao.jpg'],
      [2, 'joao-2.jpg'],
    ]);
    expect(resumo(await paginasDe(maria.corpo.aplicacao_id))).toEqual(resumo(maria.corpo.paginas));
  });

  // @trace CA-060, RN-028, DEC-198, T-18
  it('nem o log nem a auditoria do upload trazem os nomes dos arquivos', async () => {
    const texto = semIdentificadores((await h.inspect.logs()) + JSON.stringify(await h.inspect.auditoria(T.tenantId)));
    for (const nome of ['maria.pdf', 'joao.jpg', 'joao-2.jpg', 'maria', 'joao']) expect(texto).not.toContain(nome);
  });

  // @trace CA-060, RN-051, DEC-201
  it('exemplo 1: exportação das duas aplicações concluídas → "maria.pdf" nas linhas de Maria; nas de João, o arquivo da página de cada pergunta', async () => {
    const { projeto, form } = await (async () => {
      const p = await projetoCriado(c, 'Exportação com arquivos');
      return { projeto: p, form: await formularioPublicado(c, p, 'Saúde Geral', conteudoSaude()) };
    })();
    const a = await conferida(h, c, projeto, form, leituraA1(), ACOES_A1, 'presente', 'maria.pdf');
    const r = await enviar(c, projeto, [arquivo('joao.jpg', 'image/jpeg', await jpeg(form.paginas[0])), arquivo('joao-2.jpg', 'image/jpeg', await jpeg(form.paginas[1]))]);
    expect(r.status, r.texto).toBe(202);
    const b: string = r.corpo.aplicacao_id;
    h.motor.programar(b, leituraA1({ NOME: { valor: 'João Souza', confianca: 0.97 }, CPF: { valor: CPF.novo, confianca: 0.97 } }));
    await h.worker.processar();
    await revisada(c, b, ACOES_A1);
    const ok = await concluir(c, b);
    expect(ok.status, ok.texto).toBe(200);

    const l = await exportadas(projeto);
    const deMaria = l.filter((x) => x[COL.ID_Aplicacao] === a);
    const deJoao = l.filter((x) => x[COL.ID_Aplicacao] === b);
    expect(deMaria.length).toBeGreaterThan(0);
    expect(deMaria.every((x) => x[COL.Arquivo] === 'maria.pdf')).toBe(true);
    // LOCAL_APLICACAO está na página 1; as demais perguntas exportadas, na página 2 (conteudoSaude).
    for (const x of deJoao) expect([x[COL.Codigo_Pergunta], x[COL.Arquivo]]).toEqual([x[COL.Codigo_Pergunta], x[COL.Codigo_Pergunta] === 'LOCAL_APLICACAO' ? 'joao.jpg' : 'joao-2.jpg']);
    expect(deJoao.some((x) => x[COL.Arquivo] === 'joao.jpg')).toBe(true);
    expect(deJoao.some((x) => x[COL.Arquivo] === 'joao-2.jpg')).toBe(true);
  });

  // @trace CA-060, ENT-025, DEC-203
  it('exemplo 2: nome com 300 caracteres → gravado cortado em 255', async () => {
    const nome = `${'a'.repeat(296)}.pdf`;
    const r = await enviado([await pdf(nome)]);
    const esperado = nome.slice(0, 255);
    expect(r.corpo.paginas.map((p: Pagina) => p.nome_arquivo)).toEqual([esperado, esperado]);
    expect((await h.inspect.folhas(r.corpo.aplicacao_id)).map((x) => x.nome_arquivo)).toEqual([esperado, esperado]);
  });

  // @trace CA-060, DEC-166, DEC-201, T-18
  it('exemplo 3: nome `=SOMA(A1).pdf` → no XLSX, célula de texto e nenhuma fórmula; no CSV, com o apóstrofo', async () => {
    const projeto = await projetoCriado(c, 'Arquivo com fórmula');
    const form = await formularioPublicado(c, projeto, 'Saúde Geral', conteudoSaude());
    const id = await conferida(h, c, projeto, form, leituraA1({ CPF: { valor: CPF.ana, confianca: 0.97 } }), ACOES_A1, 'presente', '=SOMA(A1).pdf');

    const celulas = celulasXlsx(await exportada(h, c, { formato: 'xlsx', escopo: 'linha_por_item', projeto_ids: [projeto] })).slice(1);
    expect(celulas.length).toBeGreaterThan(0);
    for (const linha of celulas) {
      expect(linha[COL.ID_Aplicacao].valor).toBe(id);
      expect(linha[COL.Arquivo]).toEqual({ tipo: 'texto', valor: '=SOMA(A1).pdf' });
    }
    expect(celulas.flat().some((x) => x.tipo === 'formula')).toBe(false);
    const csv = linhas(await exportada(h, c, { formato: 'csv', escopo: 'linha_por_item', projeto_ids: [projeto] }), 'csv').slice(1);
    expect(csv.length).toBeGreaterThan(0);
    expect(csv.every((x) => x[COL.Arquivo] === "'=SOMA(A1).pdf")).toBe(true);
  });

  // @trace CA-060, DEC-203, T-18
  it('exemplo 4: "C:\\fotos\\maria.pdf" → gravado "maria.pdf", sem a pasta; "joão.jpg" em NFD → gravado em NFC', async () => {
    const comPasta = await enviado([await pdf('C:\\fotos\\maria.pdf')]);
    expect(comPasta.corpo.paginas.map((p: Pagina) => p.nome_arquivo)).toEqual(['maria.pdf', 'maria.pdf']);

    const nfd = 'joa\u0303o.jpg';
    const nfc = 'jo\u00e3o.jpg';
    expect(nfd.normalize('NFC')).toBe(nfc);
    const r = await enviado([await jpg(nfd, 1), await jpg('joao-p2.jpg', 2)]);
    expect(r.corpo.paginas[0].nome_arquivo).toBe(nfc);
    expect((await h.inspect.folhas(r.corpo.aplicacao_id))[0].nome_arquivo).toBe(nfc);
  });

  // @trace CA-060, DEC-201, ENT-025
  it('exemplo 5: aplicação com páginas de antes da migração 0010 → Arquivo vazio nas linhas dela', async () => {
    const projeto = await projetoCriado(c, 'Páginas antigas');
    const form = await formularioPublicado(c, projeto, 'Saúde Geral', conteudoSaude());
    const id = await conferida(h, c, projeto, form, leituraA1({ CPF: { valor: CPF.rosa, confianca: 0.97 } }), ACOES_A1);
    await h.seed.paginasAntigas(id);
    expect((await paginasDe(id)).every((p) => p.nome_arquivo === null)).toBe(true);
    const l = (await exportadas(projeto)).filter((x) => x[COL.ID_Aplicacao] === id);
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((x) => x[COL.Arquivo] === '')).toBe(true);
  });

  // @trace CA-060, ENT-025, DEC-198, FL-001
  it('exemplo 6: "ana-p1.jpg" só com a página 1 e depois addApplicationPages com "ana-p2.jpg" → `ordem_envio` 2, continuando a sequência', async () => {
    const r = await enviado([await jpg('ana-p1.jpg', 1)], 'identificacao_pendente');
    const id: string = r.corpo.aplicacao_id;
    expect(resumo(r.corpo.paginas)).toEqual([{ ordem_envio: 1, numero_pagina: 1, nome_arquivo: 'ana-p1.jpg' }]);
    const add = await c.enviarArquivos(`/applications/${id}/pages`, [await jpg('ana-p2.jpg', 2)], { 'idempotency-key': chaveIdempotencia() });
    expect(add.status, add.texto).toBe(200);
    const nova = (add.corpo.paginas as Pagina[]).find((p) => p.nome_arquivo === 'ana-p2.jpg');
    expect(nova?.ordem_envio).toBe(2);
    expect((await h.inspect.folhas(id)).map((x) => [x.ordem_envio, x.nome_arquivo])).toEqual([
      [1, 'ana-p1.jpg'],
      [2, 'ana-p2.jpg'],
    ]);
  });

  // @trace CA-060, ERR-029, RN-028, DEC-198, T-18
  it('exemplo 7: "ok.jpg" e "virus.pdf" recusado pela varredura → ERR-029 com `posicao` 2 e o motivo, sem o nome na resposta nem no log; nada é gravado', async () => {
    const antes = await h.inspect.contagemUpload(T.tenantId);
    const r = await enviar(c, saude, [await jpg('ok.jpg', 1), arquivo('virus.pdf', 'application/pdf', EICAR)]);
    esperarErro(r, 'ERR-029');
    expect(r.corpo.posicao).toBe(2);
    expect(r.corpo.motivo).toBeTruthy();
    for (const nome of ['virus.pdf', 'ok.jpg', 'virus']) expect(r.texto).not.toContain(nome);
    expect(semIdentificadores(await h.inspect.logs())).not.toContain('virus');
    expect(await h.inspect.contagemUpload(T.tenantId)).toEqual(antes);
  });

  // @trace CA-060, DEC-077, DEC-206, RN-030
  it('exemplo 8: aplicação descartada, depois do expurgo físico das imagens → `nome_arquivo` nulo nas páginas', async () => {
    const r = await enviado([await pdf('descartar.pdf')]);
    const id: string = r.corpo.aplicacao_id;
    expect(await h.inspect.nomesArquivo(id)).toEqual(['descartar.pdf', 'descartar.pdf']);
    const d = await c.post(`/applications/${id}/discard`, comMotivo('Folha de teste enviada por engano'));
    expect(d.status, d.texto).toBe(200);
    expect(await h.inspect.nomesArquivo(id)).toEqual([null, null]);
    expect((await paginasDe(id)).every((p) => p.nome_arquivo === null)).toBe(true);
  });

  // @trace CA-060, CA-044, ENT-025, DEC-198
  it('exemplo 9: aplicação em sem_assinatura com 2 folhas; attachSignaturePage com "maria-assinada.jpg" → a folha recebe `ordem_envio` 3 e o nome', async () => {
    const projeto = await projetoCriado(c, 'Assinatura depois');
    const form = await formularioPublicado(c, projeto, 'Saúde Geral', conteudoSaude());
    const id = await conferida(h, c, projeto, form, leituraA1({ CPF: { valor: CPF.terceiro, confianca: 0.97 } }), ACOES_A1, 'ausente', 'maria.pdf');
    const anexada = await c.enviarFormulario(
      `/applications/${id}/signature`,
      [
        ['arquivo', arquivo('maria-assinada.jpg', 'image/jpeg', await jpeg(form.paginas[0]))],
        ['assinatura', 'presente'],
      ],
      { 'idempotency-key': chaveIdempotencia() },
    );
    expect(anexada.status, anexada.texto).toBe(200);
    const folhas = await h.inspect.folhas(id);
    expect(folhas.map((x) => [x.ordem_envio, x.nome_arquivo])).toEqual([
      [1, 'maria.pdf'],
      [2, 'maria.pdf'],
      [3, 'maria-assinada.jpg'],
    ]);
    expect(semIdentificadores(await h.inspect.logs())).not.toContain('maria-assinada');
  });
});
