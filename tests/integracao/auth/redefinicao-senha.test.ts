// Script de redefinição de senha (CA-037, RF-001, RN-007, PLANO §4.5, DEC-108). Cada teste
// sobe um ambiente próprio e instala pelo script, para que exista uma só usuária.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { Cliente } from '../../support/cliente.js';
import { OUTRA_SENHA, SENHA, emailSintetico, entrar } from '../../support/cenarios.js';
import { criarHarness, type Harness } from '../../support/harness.js';

let h: Harness;
const usuaria = {
  instituicao: 'Instituto Fictício de Pesquisa',
  nome: 'Usuária Fictícia da Redefinição',
  email: emailSintetico('redefinicao'),
  senha: SENHA,
};
let tenantId: string;
let usuarioId: string;

beforeEach(async () => {
  h = await criarHarness();
  const r = await h.scripts.instalar(usuaria);
  expect(r.codigo, r.saida).toBe(0);
  tenantId = (await h.inspect.tenants())[0].tenantId;
  const c = await entrar(h, usuaria);
  usuarioId = (await c.get('/auth/session')).corpo.usuario_id;
  expect((await c.post('/auth/logout')).status).toBe(204);
});
afterEach(async () => {
  await h?.close();
});

const login = (senha: string) => new Cliente(h.baseUrl).post('/auth/login', { corpo: { email: usuaria.email, senha } });

describe('CA-037 — redefinição de senha por script', () => {
  // @trace CA-037, RF-001, RN-007
  it('troca a senha e encerra todas as sessões ativas', async () => {
    const sessoes = [await entrar(h, usuaria), await entrar(h, usuaria)];
    expect(await h.inspect.sessoesAtivas(usuarioId)).toBe(2);

    const r = await h.scripts.redefinirSenha(OUTRA_SENHA);
    expect(r.codigo, r.saida).toBe(0);

    for (const c of sessoes) esperarErro(await c.get('/auth/session'), 'ERR-015');
    expect(await h.inspect.sessoesAtivas(usuarioId)).toBe(0);
    esperarErro(await login(SENHA), 'ERR-013');
    await entrar(h, { email: usuaria.email, senha: OUTRA_SENHA });
  });

  // @trace CA-037, RN-007, RN-028
  it('a redefinição fica na auditoria e nem a auditoria nem o terminal mostram a senha', async () => {
    const r = await h.scripts.redefinirSenha(OUTRA_SENHA);
    expect(r.codigo, r.saida).toBe(0);
    for (const valor of [OUTRA_SENHA, SENHA, usuaria.email, usuaria.nome]) expect(r.saida).not.toContain(valor);

    const eventos = (await h.inspect.auditoria(tenantId)).filter((e) => e.acao === 'REDEFINICAO_SENHA');
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ registro_id: usuarioId, criado_em: h.clock.now() });
    const texto = JSON.stringify(eventos[0]);
    expect(texto).not.toContain(OUTRA_SENHA);
    expect(texto).not.toContain(SENHA);
  });

  // @trace CA-037, RN-048, Bloco P P.2
  it.each([
    ['curta', 'Ab1defghi'],
    ['sem maiúscula', 'semmaiusculas1'],
    ['sem dígito', 'SemDigitoAlgum'],
  ])('nova senha %s é recusada: a senha e as sessões ficam como estavam', async (_caso, senha) => {
    const c = await entrar(h, usuaria);
    const r = await h.scripts.redefinirSenha(senha);
    expect(r.codigo).not.toBe(0);
    expect(r.saida).not.toContain(senha);

    expect((await c.get('/auth/session')).status).toBe(200);
    await entrar(h, usuaria);
    expect((await h.inspect.auditoria(tenantId)).filter((e) => e.acao === 'REDEFINICAO_SENHA')).toEqual([]);
  });

  // @trace CA-037, RF-001, RN-006
  it('sem instalação não há conta a redefinir', async () => {
    const vazio = await criarHarness();
    try {
      const r = await vazio.scripts.redefinirSenha(OUTRA_SENHA);
      expect(r.codigo).not.toBe(0);
      expect(await vazio.inspect.tenants()).toEqual([]);
    } finally {
      await vazio.close();
    }
  });
});
