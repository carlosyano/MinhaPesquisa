// PDF imprimível (CA-028, DEC-005, DEC-048, T-14). O QR é lido pelos testes a partir do PDF
// renderizado, sem conhecer o formato: basta ser legível, distinto por página e por versão e
// não carregar identificadores internos (identificador opaco).
// O termo da página 1 é o parâmetro `termo_consentimento` do tenant, com texto padrão
// provisório na REQ seção 2.9 (DEC-094).
// A pergunta de CPF sai com 11 caixas, uma por dígito (DEC-105), e o mapa de layout grava a
// região de cada caixa (DEC-106). O teste confere as caixas na página renderizada a partir
// das regiões do mapa, sem conhecer as medidas usadas pela API.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lerPdf, luminancias } from '../../support/arquivos.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComAdmin, type TenantPronto } from '../../support/cenarios.js';
import {
  PAGINAS_VERSAO,
  caminhoVersao,
  conteudoValido,
  formularioPublicado,
  projetoCriado,
  publicar,
  salvarConteudo,
  type FormularioPublicado,
} from '../../support/formularios.js';
import { criarHarness, type Harness, type MapaLayoutGravado, type RegiaoNormalizada } from '../../support/harness.js';

let h: Harness;
let T: TenantPronto;
let admin: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  T = await tenantComAdmin(h, 'Tenant PDF');
  admin = await entrar(h, T.admin);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia');
});
afterAll(async () => {
  await h?.close();
});

const semHifen = (id: string) => id.replace(/-/g, '');
const normalizar = (t: string) => t.replace(/\s+/g, ' ').trim();

describe('CA-028 — PDF imprimível', () => {
  // @trace CA-028, DEC-005
  it('uma página impressa por página da versão, cada uma com QR legível e distinto', () => {
    expect(f.paginas).toHaveLength(PAGINAS_VERSAO);
    const conteudos = f.paginas.map((p) => p.qr?.conteudo);
    expect(conteudos.every((c) => typeof c === 'string' && c.length > 0), JSON.stringify(conteudos)).toBe(true);
    expect(new Set(conteudos).size).toBe(PAGINAS_VERSAO);
  });

  // @trace CA-028, T-14, DEC-048
  it('o QR é opaco: não contém IDs de tenant, projeto, formulário nem versão', () => {
    for (const p of f.paginas) {
      const c = p.qr!.conteudo.toLowerCase();
      for (const id of [T.tenantId, projeto, f.formId, f.versaoId]) {
        expect(c, `página ${p.numero}`).not.toContain(id.toLowerCase());
        expect(c, `página ${p.numero}`).not.toContain(semHifen(id).toLowerCase());
      }
    }
  });

  // @trace CA-028, RN-041, DEC-006
  it('a primeira página traz o termo de consentimento com campo de assinatura', () => {
    const texto = f.paginas[0].texto.toLowerCase();
    expect(texto).toContain('consentimento');
    expect(texto).toContain('assinatura');
    for (const p of f.paginas.slice(1)) expect(p.texto.toLowerCase(), `página ${p.numero}`).not.toContain('consentimento');
  });

  // @trace CA-028, DEC-094
  it('sem parâmetro do tenant, a página 1 traz o texto padrão do termo e o campo "Assinatura do respondente"', () => {
    const texto = normalizar(f.paginas[0].texto);
    expect(texto).toContain('Termo de consentimento.');
    expect(texto).toContain('Autorizo o uso das minhas respostas a este formulário');
    expect(texto).toContain('Assinatura do respondente');
  });

  // @trace CA-028, DEC-094, RN-041
  it('com termo_consentimento do tenant, o PDF usa o texto do tenant', async () => {
    const termo = 'Termo do Tenant Fictício: autorizo a Clínica Exemplo a usar estas respostas.';
    await h.seed.parametro({ tenantId: T.tenantId, chave: 'termo_consentimento', valor: termo });
    const outro = await formularioPublicado(admin, projeto, 'Demografia com termo do tenant');
    const texto = normalizar(outro.paginas[0].texto);
    expect(texto).toContain(termo);
    expect(texto).not.toContain('Autorizo o uso das minhas respostas a este formulário');
    expect(texto).toContain('Assinatura do respondente');
  });

  // @trace CA-028, RF-004
  it('os enunciados aparecem na página definida para cada pergunta', () => {
    for (const q of conteudoValido().perguntas) {
      const pagina = f.paginas[q.pagina - 1];
      expect(pagina.texto, `${q.codigo} na página ${q.pagina}`).toContain(String(q.enunciado));
    }
  });

  // @trace CA-028, RN-042
  it('gerar de novo devolve os mesmos QR; outra versão tem QR diferentes', async () => {
    const outra = await admin.baixar(`${caminhoVersao(f.formId, f.versaoId)}/pdf`);
    expect(outra.status).toBe(200);
    expect((await lerPdf(outra.bytes)).map((p) => p.qr?.conteudo)).toEqual(f.paginas.map((p) => p.qr?.conteudo));

    const v2 = await admin.post(`/forms/${f.formId}/versions`, {
      corpo: { copiar_de_versao_id: f.versaoId },
      headers: { 'idempotency-key': chaveIdempotencia() },
    });
    expect(v2.status, v2.texto).toBe(201);
    const id2 = v2.corpo.resumo.id as string;
    expect((await salvarConteudo(admin, f.formId, id2, conteudoValido())).status).toBe(200);
    expect((await publicar(admin, f.formId, id2)).status).toBe(200);
    const pdf2 = await admin.baixar(`${caminhoVersao(f.formId, id2)}/pdf`);
    expect(pdf2.status).toBe(200);
    const qr2 = (await lerPdf(pdf2.bytes)).map((p) => p.qr?.conteudo);
    for (const c of qr2) expect(f.paginas.map((p) => p.qr?.conteudo)).not.toContain(c);
  });
});

describe('CA-028 — CPF com uma caixa por dígito (DEC-105, DEC-106)', () => {
  let mapa: MapaLayoutGravado;
  let cpf: MapaLayoutGravado['perguntas'][number];

  beforeAll(async () => {
    const m = await h.inspect.mapaLayout(f.versaoId);
    expect(m, 'mapa_layout da versão publicada').not.toBeNull();
    mapa = m!;
    const q = mapa.perguntas.find((p) => p.codigo === 'CPF');
    expect(q, 'pergunta CPF no mapa').toBeDefined();
    cpf = q!;
  });

  const dentro = (c: RegiaoNormalizada, r: RegiaoNormalizada) =>
    c.x >= r.x && c.y >= r.y && c.x + c.largura <= r.x + r.largura && c.y + c.altura <= r.y + r.altura;

  // @trace CA-028, DEC-106, DEC-048
  it('o mapa grava 11 caixas na pergunta CPF, na ordem dos dígitos, dentro da região da pergunta', () => {
    const caixas = cpf.caixas ?? [];
    expect(caixas).toHaveLength(11);
    for (const [i, c] of caixas.entries()) {
      expect(c.largura, `caixa ${i + 1}`).toBeGreaterThan(0);
      expect(c.altura, `caixa ${i + 1}`).toBeGreaterThan(0);
      expect(dentro(c, cpf.regiao), `caixa ${i + 1} dentro da pergunta`).toBe(true);
      if (i > 0) {
        const ant = caixas[i - 1];
        expect(c.x, `caixa ${i + 1} à direita da anterior, sem sobrepor`).toBeGreaterThan(ant.x + ant.largura);
        expect(Math.abs(c.y - ant.y), `caixa ${i + 1} na mesma linha`).toBeLessThan(0.002);
      }
    }
  });

  // @trace DEC-106
  it('só a pergunta do tipo cpf tem caixas no mapa', () => {
    for (const p of mapa.perguntas.filter((q) => q.codigo !== 'CPF')) expect(p.caixas, p.codigo).toBeUndefined();
  });

  // @trace CA-028, DEC-105
  it('no PDF, cada caixa tem borda escura e interior claro, separada da seguinte por espaço em branco', async () => {
    const pagina = f.paginas[cpf.pagina - 1];
    const lum = await luminancias(pagina.png);
    const px = (c: RegiaoNormalizada) => ({
      x0: c.x * lum.largura,
      x1: (c.x + c.largura) * lum.largura,
      y0: c.y * lum.altura,
      y1: (c.y + c.altura) * lum.altura,
    });
    const ESCURO = 160;
    const CLARO = 230;
    // Menor luminância numa faixa de ±3 px em torno da coordenada (borda fina com antisserrilhado).
    const minimoX = (x: number, y: number) => Math.min(...[-3, -2, -1, 0, 1, 2, 3].map((d) => lum.em(x + d, y)));
    const minimoY = (x: number, y: number) => Math.min(...[-3, -2, -1, 0, 1, 2, 3].map((d) => lum.em(x, y + d)));
    const caixas = (cpf.caixas ?? []).map(px);
    expect(caixas).toHaveLength(11);
    for (const [i, c] of caixas.entries()) {
      const meioY = (c.y0 + c.y1) / 2;
      const meioX = (c.x0 + c.x1) / 2;
      expect(minimoX(c.x0, meioY), `caixa ${i + 1}: borda esquerda`).toBeLessThan(ESCURO);
      expect(minimoX(c.x1, meioY), `caixa ${i + 1}: borda direita`).toBeLessThan(ESCURO);
      expect(minimoY(meioX, c.y0), `caixa ${i + 1}: borda de cima`).toBeLessThan(ESCURO);
      expect(minimoY(meioX, c.y1), `caixa ${i + 1}: borda de baixo`).toBeLessThan(ESCURO);
      expect(lum.em(meioX, meioY), `caixa ${i + 1}: interior`).toBeGreaterThan(CLARO);
      if (i > 0) {
        const vao = (caixas[i - 1].x1 + c.x0) / 2;
        expect(lum.em(vao, meioY), `vão entre as caixas ${i} e ${i + 1}`).toBeGreaterThan(CLARO);
      }
    }
  });
});
