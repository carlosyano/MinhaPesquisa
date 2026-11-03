// PDF imprimível (CA-028, DEC-005, DEC-048, T-14). O QR é lido pelos testes a partir do PDF
// renderizado, sem conhecer o formato: basta ser legível, distinto por página e por versão e
// não carregar identificadores internos (identificador opaco).
// O texto do termo de consentimento não está definido na REQ; aqui se exige só que a página 1
// traga o termo e o campo de assinatura (ver a questão aberta no PR do IA-TEST do IMP-002).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lerPdf } from '../../support/arquivos.js';
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
import { criarHarness, type Harness } from '../../support/harness.js';

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
