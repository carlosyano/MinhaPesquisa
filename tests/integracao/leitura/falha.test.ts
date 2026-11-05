// Falha da leitura e nova leitura (CA-041, RF-007, FL-001, REQ §6.6). Retentativas automáticas
// em 1 e 2 s pelo relógio do harness, 3 chamadas no total (DEC-129); tempo esgotado, erro do
// provedor e saída malformada são falhas da chamada (DEC-123).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esperarErro } from '../../support/catalogo.js';
import { chaveIdempotencia, type Cliente } from '../../support/cliente.js';
import { entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness, type RoteiroLeitura } from '../../support/harness.js';
import { consultar, conteudoLeitura, enviarELer, leiturasCompletas, paginasJpeg, calibrarConfianca, prepararCotacao } from '../../support/leitura.js';

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  await calibrarConfianca(h);
  A = await tenantComUsuaria(h, 'Tenant A');
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

async function estado(id: string): Promise<string> {
  return (await consultar(dig, id)).corpo.estado;
}

/** Avança o relógio pelas esperas das retentativas (1 e 2 s, DEC-129) com folga, rodando o worker. */
async function esgotarRetentativas(): Promise<void> {
  for (const ms of [1_000, 2_000, 4_000, 8_000]) {
    await h.clock.advance(ms);
    await h.worker.processar();
  }
}

function falhando(tipo: 'tempo_esgotado' | 'erro' | 'malformada', vezes: number): RoteiroLeitura {
  return leiturasCompletas({ HORAS_SONO: { falha: { tipo, vezes }, depois: { valor: '7', confianca: 0.97 } } });
}

async function tentativasDoCampo(id: string, campo: string): Promise<string[]> {
  return (await h.motor.chamadas(id)).filter((c) => c.campos.includes(campo)).map((c) => c.resultado);
}

describe('CA-041 — retentativas automáticas', () => {
  // @trace CA-041, RF-007, REQ §6.6, DEC-123
  it.each(['tempo_esgotado', 'erro', 'malformada'] as const)('%s em duas tentativas e sucesso na seguinte → em_revisao', async (tipo) => {
    const id = await enviarELer(h, dig, projeto, f, falhando(tipo, 2));
    expect(await estado(id)).toBe('em_leitura'); // primeira falha: a retentativa espera 1 s
    await esgotarRetentativas();
    expect(await estado(id)).toBe('em_revisao');
    expect(await tentativasDoCampo(id, 'HORAS_SONO')).toEqual([tipo, tipo, 'ok']);
  });

  // @trace CA-041, ERR-041, FL-001, DEC-129
  it('falha persistente → erro_leitura na terceira falha, com auditoria; exatamente 3 chamadas', async () => {
    const id = await enviarELer(h, dig, projeto, f, falhando('tempo_esgotado', 10));
    expect(await estado(id)).toBe('em_leitura');
    await h.clock.advance(1_000);
    await h.worker.processar();
    expect(await estado(id)).toBe('em_leitura'); // duas falhas: a terceira chamada espera 2 s
    await h.clock.advance(2_000);
    await h.worker.processar();
    expect(await estado(id)).toBe('erro_leitura');
    await esgotarRetentativas();
    const tentativas = await tentativasDoCampo(id, 'HORAS_SONO');
    expect(tentativas).toEqual(['tempo_esgotado', 'tempo_esgotado', 'tempo_esgotado']);
    expect(await h.inspect.auditoria(A.tenantId)).toContainEqual(expect.objectContaining({ registro_id: id }));
  });
});

describe('CA-041 — o digitalizador manda ler de novo (retryReading)', () => {
  // @trace CA-041, FL-001, RF-008
  it('erro_leitura → 202 em_leitura; a nova leitura termina em em_revisao', async () => {
    const id = await enviarELer(h, dig, projeto, f, falhando('erro', 10));
    await esgotarRetentativas();
    expect(await estado(id)).toBe('erro_leitura');

    h.motor.programar(id, leiturasCompletas());
    const r = await dig.post(`/applications/${id}/retry`, { headers: { 'idempotency-key': chaveIdempotencia() } });
    expect(r.status, r.texto).toBe(202);
    expect(r.corpo).toMatchObject({ id, estado: 'em_leitura' });
    await h.worker.processar();
    expect(await estado(id)).toBe('em_revisao');
  });

  // @trace FL-001, ERR-018
  it('retryReading fora de erro_leitura → 409 ERR-018, sem nova leitura', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const antes = (await h.motor.chamadas(id)).length;
    esperarErro(await dig.post(`/applications/${id}/retry`, { headers: { 'idempotency-key': chaveIdempotencia() } }), 'ERR-018');
    await h.worker.processar();
    expect(await h.motor.chamadas(id)).toHaveLength(antes);
    expect(await estado(id)).toBe('em_revisao');
  });

  // @trace FL-001, ERR-018
  it('retryReading com a leitura ainda em andamento (em_leitura) → 409 ERR-018', async () => {
    const r = await enviar(dig, projeto, await paginasJpeg(f));
    expect(r.corpo.estado).toBe('em_leitura');
    esperarErro(await dig.post(`/applications/${r.corpo.aplicacao_id}/retry`, { headers: { 'idempotency-key': chaveIdempotencia() } }), 'ERR-018');
  });
});
