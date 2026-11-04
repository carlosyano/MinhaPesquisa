// Descarte (CA-033, DEC-077) e reabertura com reversão de cadastro (CA-042, DEC-078, RN-014,
// PLANO §4.4). Os efeitos sobre relatórios ("sai dos relatórios") são observáveis no IMP-004.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { semQr } from '../../support/arquivos.js';
import { esperarErro } from '../../support/catalogo.js';
import type { Cliente } from '../../support/cliente.js';
import { DIA, entrar, tenantComUsuaria, type TenantPronto } from '../../support/cenarios.js';
import { arquivo, enviar, formularioPublicado, projetoCriado, type FormularioPublicado } from '../../support/formularios.js';
import { criarHarness, type Harness, type RespondenteGravado } from '../../support/harness.js';
import {
  abrir,
  comMotivo,
  concluida,
  concluir,
  confirmarPendentes,
  consultar,
  conteudoLeitura,
  CPF,
  enviarELer,
  item,
  leiturasCompletas,
  paginasJpeg,
  prepararCotacao,
  prontaParaConcluir,
  revisar,
  semIdentificadores,
} from '../../support/leitura.js';

let h: Harness;
let A: TenantPronto;
let dig: Cliente;
let projeto: string;
let f: FormularioPublicado;

beforeAll(async () => {
  h = await criarHarness();
  await prepararCotacao(h);
  A = await tenantComUsuaria(h, 'Tenant A');
  const admin = await entrar(h, A.usuaria);
  projeto = await projetoCriado(admin, 'Saúde Idoso');
  f = await formularioPublicado(admin, projeto, 'Demografia', conteudoLeitura());
  dig = await entrar(h, A.usuaria);
});
afterAll(async () => {
  await h?.close();
});

async function porCpf(cpf: string): Promise<RespondenteGravado> {
  const r = (await h.inspect.respondentes(A.tenantId)).filter((x) => x.cpf === cpf);
  expect(r, `respondente com o CPF ${cpf.slice(0, 3)}…`).toHaveLength(1);
  return r[0];
}

async function porId(id: string): Promise<RespondenteGravado> {
  const r = (await h.inspect.respondentes(A.tenantId)).find((x) => x.id === id);
  expect(r).toBeTruthy();
  return r!;
}

const descartar = (id: string, motivo: string) => dig.post(`/applications/${id}/discard`, comMotivo(motivo));
const reabrir = (id: string, motivo: string) => dig.post(`/applications/${id}/reopen`, comMotivo(motivo));

describe('CA-033 — descarte de aplicação (DEC-077)', () => {
  // @trace CA-033, DEC-077, RN-030, RN-027, FL-001
  it('em_revisao → descartada: imagens e valores lidos apagados, ListaEliminacoes por 180 dias, auditoria sem o motivo', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    const paginas = (await consultar(dig, id)).corpo.paginas as { imagem_id: string }[];
    const antes = await h.inspect.contagemUpload(A.tenantId);
    const motivo = 'Páginas de duas pessoas no mesmo envio';

    const r = await descartar(id, motivo);
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('descartada');
    expect((await h.inspect.contagemUpload(A.tenantId)).objetos).toBe(antes.objetos - paginas.length);

    const gravada = await h.inspect.aplicacao(id);
    expect(gravada).toMatchObject({ estado: 'descartada', motivo_descarte: motivo });
    expect(gravada.itens.length).toBeGreaterThan(0);
    for (const i of gravada.itens) expect(i, i.pergunta_codigo).toMatchObject({ valor_ia: null, valor_final: null });
    for (const i of (await consultar(dig, id)).corpo.itens) expect(i).toMatchObject({ valor_ia: null, valor_final: null });

    const lista = (await h.inspect.listaEliminacoes(A.tenantId)).filter((e) => e.aplicacao_id === id);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ motivo: 'descarte_aplicacao', respondente_id_original: null });
    expect(lista[0].valido_ate.getTime() - lista[0].eliminado_em.getTime()).toBe(180 * DIA);

    const eventos = (await h.inspect.auditoria(A.tenantId)).filter((e) => e.registro_id === id);
    expect(eventos).toContainEqual(expect.objectContaining({ usuario_id: A.usuaria.usuarioId }));
    expect(semIdentificadores(JSON.stringify(eventos))).not.toContain('duas pessoas');
    expect(semIdentificadores(await h.inspect.logs())).not.toContain('duas pessoas');

    esperarErro(await dig.get(`/applications/${id}/pages/${paginas[0].imagem_id}/image`), 'ERR-018');
  });

  // @trace CA-033, FL-001
  it('identificacao_pendente também pode ser descartada', async () => {
    const imgs = await paginasJpeg(f);
    imgs[0] = arquivo('p1.jpg', 'image/jpeg', await semQr(f.paginas[0]));
    const r = await enviar(dig, projeto, imgs);
    expect(r.corpo.estado).toBe('identificacao_pendente');
    const d = await descartar(r.corpo.aplicacao_id, 'Página do formulário errado');
    expect(d.status, d.texto).toBe(200);
    expect(d.corpo.estado).toBe('descartada');
  });

  // @trace CA-033, FL-001, ERR-018, ERR-001
  it('concluida ou já descartada → 409 ERR-018; motivo com menos de 3 caracteres → 400 ERR-001', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: '78778932807', confianca: 0.97 } });
    esperarErro(await descartar(id, 'Agrupamento errado'), 'ERR-018');
    const outra = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    esperarErro(await descartar(outra, 'ab'), 'ERR-001');
    expect((await descartar(outra, 'Agrupamento errado')).status).toBe(200);
    esperarErro(await descartar(outra, 'Agrupamento errado de novo'), 'ERR-018');
  });
});

describe('CA-042 — reabertura de aplicação concluída', () => {
  // @trace CA-042, FL-001, FL-002
  it('concluida → em_revisao com o motivo gravado; itens confirmados voltam a a_revisar com o valor final preservado', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: '79217421812', confianca: 0.97 } });
    const r = await reabrir(id, 'CPF conferido de novo com a respondente');
    expect(r.status, r.texto).toBe(200);
    expect(r.corpo.estado).toBe('em_revisao');
    const app = (await abrir(dig, id)).corpo;
    expect(item(app, 'NOME')).toMatchObject({ estado: 'a_revisar', valor_final: 'Maria Silva' });
    expect(item(app, 'DATA_NASCIMENTO').estado).toBe('a_revisar');
    expect((await h.inspect.aplicacao(id)).motivo_reabertura).toBe('CPF conferido de novo com a respondente');
    expect(await h.inspect.auditoria(A.tenantId)).toContainEqual(expect.objectContaining({ registro_id: id, usuario_id: A.usuaria.usuarioId }));
  });

  // @trace CA-042, FL-001, ERR-018, ERR-001
  it('reabrir fora de concluida ou sem_assinatura → 409 ERR-018; sem motivo → 400 ERR-001', async () => {
    const id = await enviarELer(h, dig, projeto, f, leiturasCompletas());
    esperarErro(await reabrir(id, 'Motivo qualquer'), 'ERR-018');
    const c = await concluida(h, dig, projeto, f, { CPF: { valor: '09679290832', confianca: 0.97 } });
    esperarErro(await reabrir(c, ''), 'ERR-001');
    expect((await consultar(dig, c)).corpo.estado).toBe('concluida');
  });

  // @trace CA-042, RN-014, DEC-078, CA-014b
  it('CPF corrigido na reabertura → o vínculo passa ao respondente do CPF novo; o antigo, sem aplicação concluída, é anonimizado', async () => {
    const id = await concluida(h, dig, projeto, f, { CPF: { valor: CPF.reaberta, confianca: 0.97 } });
    const antigo = await porCpf(CPF.reaberta);
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(antigo.id);

    expect((await reabrir(id, 'CPF lido com um dígito trocado')).status).toBe(200);
    await h.worker.processar();
    const aberta = await abrir(dig, id);
    const r = await revisar(dig, id, [{ item_id: item(aberta.corpo, 'CPF').id, acao: 'corrigir', valor_final: CPF.corrigido }], aberta.headers.get('etag')!);
    expect(r.status, r.texto).toBe(200);
    await confirmarPendentes(dig, id);
    const c = await concluir(dig, id);
    expect(c.status, c.texto).toBe(200);
    expect(c.corpo.estado).toBe('concluida');
    await h.worker.processar();

    const novo = await porCpf(CPF.corrigido);
    expect(novo.id).not.toBe(antigo.id);
    expect((await h.inspect.aplicacao(id)).respondente_id).toBe(novo.id);
    expect(await porId(antigo.id)).toMatchObject({ nome: 'ANONIMIZADO', cpf: null, data_nascimento: null, endereco: null, anonimizado: true });
    const lista = (await h.inspect.listaEliminacoes(A.tenantId)).filter((e) => e.respondente_id_original === antigo.id);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ motivo: 'anonimizacao_reabertura', aplicacao_id: null });
    expect(semIdentificadores(JSON.stringify(await h.inspect.auditoria(A.tenantId)))).not.toContain(CPF.reaberta);
  });

  // @trace CA-042, DEC-063, PLANO §4.4
  it('as alterações de cadastro feitas pela aplicação reaberta são revertidas ao valor anterior, com auditoria', async () => {
    const cpf = CPF.joana;
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Joana Prado', confianca: 0.97 } });
    const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Joana P. Prado', confianca: 0.97 } });
    await abrir(dig, id);
    expect((await concluir(dig, id, { assinatura: 'presente', manter_cadastro: { nome: 'aplicacao' } })).corpo.estado).toBe('concluida');
    const r = await porCpf(cpf);
    expect(r.nome).toBe('Joana P. Prado');

    const antes = (await h.inspect.auditoria(A.tenantId)).length;
    expect((await reabrir(id, 'Nome conferido no documento')).status).toBe(200);
    await h.worker.processar();
    expect(await porId(r.id)).toMatchObject({ nome: 'Joana Prado', anonimizado: false });
    const novos = (await h.inspect.auditoria(A.tenantId)).slice(antes);
    expect(novos.some((e) => e.campo === 'nome' && (e.registro_id === r.id || e.registro_id === id))).toBe(true);
    expect(JSON.stringify(novos)).not.toContain('Prado');
  });

  // @trace CA-042, DEC-063, PLANO §4.4
  it('atributo alterado depois por outra aplicação não é revertido', async () => {
    const cpf = CPF.maria;
    const mudar = async (nome: string) => {
      const id = await prontaParaConcluir(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: nome, confianca: 0.97 } });
      await abrir(dig, id);
      expect((await concluir(dig, id, { assinatura: 'presente', manter_cadastro: { nome: 'aplicacao' } })).corpo.estado).toBe('concluida');
      return id;
    };
    await concluida(h, dig, projeto, f, { CPF: { valor: cpf, confianca: 0.97 }, NOME: { valor: 'Lia Costa', confianca: 0.97 } });
    const segunda = await mudar('Lia M. Costa');
    await mudar('Lia Maria Costa');

    expect((await reabrir(segunda, 'Conferência do nome')).status).toBe(200);
    await h.worker.processar();
    expect(await porCpf(cpf)).toMatchObject({ nome: 'Lia Maria Costa', anonimizado: false });
  });
});
