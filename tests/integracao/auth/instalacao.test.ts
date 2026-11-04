// Script de instalação (CA-035, RF-001, RN-006, RN-007, PLANO §4.5). Cada teste sobe um
// ambiente próprio, com o banco migrado e sem tenant, como um notebook recém-preparado.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { Cliente } from '../../support/cliente.js';
import { OUTRA_SENHA, SENHA, emailSintetico, entrar } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
beforeEach(async () => {
  h = await criarHarness();
});
afterEach(async () => {
  await h?.close();
});

const dados = () => ({
  instituicao: 'Instituto Fictício de Pesquisa',
  nome: 'Usuária Fictícia da Instalação',
  email: emailSintetico('instalacao'),
  senha: SENHA,
});

/** O terminal não mostra dado pessoal nem a senha (RN-028, PLANO §4.5). */
function semDadoPessoal(saida: string, d: { nome: string; email: string; senha: string }) {
  for (const valor of [d.nome, d.email, d.senha]) expect(saida).not.toContain(valor);
}

describe('CA-035 — instalação', () => {
  // @trace CA-035, RF-001, RN-006, RN-007, DEC-108
  it('cria o único tenant e a conta; a usuária já entra com a senha, sem MFA', async () => {
    expect(await h.inspect.tenants()).toEqual([]);
    const d = dados();
    const r = await h.scripts.instalar(d);
    expect(r.codigo, r.saida).toBe(0);
    semDadoPessoal(r.saida, d);

    expect(await h.inspect.tenants()).toEqual([{ tenantId: expect.any(String), nome: d.instituicao, usuarios: 1 }]);
    const c = await entrar(h, d);
    const sessao = await c.get('/auth/session');
    expect(sessao.status, sessao.texto).toBe(200);
    expect(sessao.corpo.nome).toBe(d.nome);
  });

  // @trace CA-035, RF-001, RN-006
  it('rodar a instalação de novo é recusado, sem alterar nada', async () => {
    const d = dados();
    expect((await h.scripts.instalar(d)).codigo).toBe(0);
    const antes = await h.inspect.tenants();

    const outra = { instituicao: 'Outra Instituição Fictícia', nome: 'Outra Pessoa Fictícia', email: emailSintetico('segunda'), senha: OUTRA_SENHA };
    const r = await h.scripts.instalar(outra);
    expect(r.codigo).not.toBe(0);
    semDadoPessoal(r.saida, outra);
    expect(await h.inspect.tenants()).toEqual(antes);

    // A conta original continua com a mesma senha; a da segunda tentativa não existe.
    await entrar(h, d);
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: outra.email, senha: outra.senha } }), 'ERR-013');
    esperarErro(await new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: d.email, senha: outra.senha } }), 'ERR-013');
  });

  // @trace CA-035, RN-048, Bloco P P.2
  it.each([
    ['curta', 'Ab1defghi'],
    ['sem maiúscula', 'semmaiusculas1'],
    ['sem minúscula', 'SEMMINUSCULAS1'],
    ['sem dígito', 'SemDigitoAlgum'],
    ['longa demais', `Aa1${'x'.repeat(70)}`],
  ])('senha %s é recusada, sem criar nada', async (_caso, senha) => {
    const d = { ...dados(), senha };
    const r = await h.scripts.instalar(d);
    expect(r.codigo).not.toBe(0);
    semDadoPessoal(r.saida, d);
    expect(await h.inspect.tenants()).toEqual([]);

    // Recusada a senha, a instalação continua possível com uma senha válida.
    expect((await h.scripts.instalar({ ...d, senha: SENHA })).codigo).toBe(0);
  });
});
