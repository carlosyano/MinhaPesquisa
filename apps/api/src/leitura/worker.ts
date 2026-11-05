// Worker da leitura por IA (RF-007, FL-001, FL-002; DEC-051, DEC-103, DEC-124).
//
// - Despacho: cada `leitura.solicitada` do outbox cria os itens da versão (um por pergunta e por
//   linha de matriz) e uma tarefa por página e grupo de envio: identificação (nome, nascimento,
//   CPF) nunca vai na mesma chamada que os demais campos (RN-038, RN-039).
// - Tarefa: recorta da página só as regiões dos campos pendentes (mapa de layout, DEC-048), reserva
//   o custo estimado (DEC-051), chama o motor fora da transação e grava o que foi lido. Falha →
//   novas tentativas em 1 e 2 s; na 3ª falha, a aplicação vai para erro_leitura (REQ §6.6,
//   DEC-129). Página que não se lê do disco também é falha da tarefa, e nenhum erro de uma
//   tarefa interrompe as demais (DEC-130).
// - Cota: teto atingido ou mês sem cotação do dólar → aguardando_cota, preservando o que já foi
//   lido; a retomada roda a cada `processar` e lê só o que falta (FL-001).
//
// Nada do conteúdo lido entra no log (RN-028): só IDs, página, grupo e resultado.

import { ErroLeitura, type CampoSchema, type ReadEngine } from '@minhapesquisa/motor-leitura';
import sharp from 'sharp';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { MINUTO, SEGUNDO, somar } from '../infra/relogio.js';
import type { Nucleo } from '../nucleo.js';
import { canonizar } from '../regras/leitura.js';
import {
  ajustar,
  Avaliacao,
  carregarItens,
  carregarRegras,
  chaveItem,
  cotaDoTenant,
  cpfDaAplicacao,
  gravarItem,
  limiteConfianca,
  reservar,
  type Item,
  type Regiao,
} from './dominio.js';

/** Esperas antes da 2ª e da 3ª chamada (REQ §6.6, DEC-129); depois da 3ª falha, erro_leitura. */
export const ESPERAS_MS = [1 * SEGUNDO, 2 * SEGUNDO];

type Grupo = 'identificacao' | 'demais';
const grupoDe = (i: Pick<Item, 'sensibilidade'>): Grupo => (i.sensibilidade === 'identificacao' ? 'identificacao' : 'demais');

interface Tarefa {
  id: string;
  tenant_id: string;
  aplicacao_id: string;
  pagina: number;
  grupo: Grupo;
  tentativas: number;
}

interface Preparada {
  motor: ReadEngine;
  recorte: Buffer;
  schema: CampoSchema;
  /** Chave do item (código da pergunta e linha) de cada chave opaca, na mesma ordem. */
  chaves: string[];
  estimadoUsd: number;
  inicio: string;
  cotacao: string;
}

const sistema = (tenantId: string) => ({ tenantId, usuarioId: null, ip: null });

export class WorkerLeitura {
  constructor(private readonly n: Nucleo) {}

  /** Roda o que já venceu: despacho do outbox, retomada da cota e tarefas, até não sobrar nada. */
  async processar(): Promise<void> {
    await this.despachar();
    await this.retomarCota();
    while ((await this.executarVencidas()) > 0) await this.despachar();
  }

  /** Só as tarefas já criadas que venceram no relógio (retentativas), sem despachar nada novo. */
  async executarVencidas(): Promise<number> {
    const agora = this.n.agora();
    const vencidas = await this.n.banco.manutencao((tx) =>
      linhas<Tarefa>(
        tx,
        sql`SELECT id, tenant_id, aplicacao_id, pagina, grupo, tentativas FROM tarefa_leitura
             WHERE situacao = 'pendente' AND executar_em <= ${agora}
             ORDER BY executar_em, aplicacao_id, pagina, grupo`,
      ),
    );
    for (const t of vencidas) {
      try {
        await this.executar(t);
      } catch (e) {
        // Erro fora do motor: conta como falha da tarefa, para não travar a fila nela (DEC-130).
        const nome = e instanceof Error ? e.name : 'erro';
        this.n.log(`worker_erro aplicacao=${t.aplicacao_id} pagina=${t.pagina} grupo=${t.grupo} erro=${nome}`);
        await this.n.banco.noTenant(t.tenant_id, (tx) => this.registrarFalha(tx, t, new ErroLeitura('erro', nome)));
      }
    }
    return vencidas.length;
  }

  // ───────────────────────────── despacho e retomada ─────────────────────────────

  private async despachar(): Promise<void> {
    const pedidos = await this.n.banco.manutencao((tx) =>
      linhas<{ id: string; tenant_id: string; aplicacao_id: string }>(
        tx,
        sql`SELECT id, tenant_id, payload ->> 'aplicacao_id' AS aplicacao_id FROM outbox
             WHERE tipo = 'leitura.solicitada' AND processado_em IS NULL ORDER BY criado_em, id`,
      ),
    );
    for (const p of pedidos) {
      await this.n.banco.noTenant(p.tenant_id, async (tx) => {
        await this.preparar(tx, p.tenant_id, p.aplicacao_id);
        await tx.execute(sql`UPDATE outbox SET processado_em = ${this.n.agora()}, tentativas = tentativas + 1 WHERE id = ${p.id}`);
      });
    }
  }

  /** aguardando_cota → em_leitura quando o mês tem cotação e o teto não foi atingido (FL-001). */
  private async retomarCota(): Promise<void> {
    const aguardando = await this.n.banco.manutencao((tx) =>
      linhas<{ id: string; tenant_id: string }>(tx, sql`SELECT id, tenant_id FROM aplicacao WHERE estado = 'aguardando_cota' ORDER BY criada_em, id`),
    );
    for (const a of aguardando) {
      await this.n.banco.noTenant(a.tenant_id, async (tx) => {
        const cota = await cotaDoTenant(this.n, tx, a.tenant_id);
        if (!cota.cotacao || cota.atingido) return;
        const r = await linhas(
          tx,
          sql`UPDATE aplicacao SET estado = 'em_leitura', aviso = NULL, versao = versao + 1
               WHERE id = ${a.id} AND estado = 'aguardando_cota' RETURNING id`,
        );
        if (r.length) {
          this.n.log(`leitura_retomada aplicacao=${a.id}`);
          await this.preparar(tx, a.tenant_id, a.id);
        }
      });
    }
  }

  /** Cria os itens que faltam e uma tarefa por página e grupo com campos pendentes. */
  private async preparar(tx: Executor, tenantId: string, aplicacaoId: string): Promise<void> {
    const a = await linha<{ estado: string; versao_id: string }>(tx, sql`SELECT estado, versao_id FROM aplicacao WHERE id = ${aplicacaoId} FOR UPDATE`);
    if (!a || a.estado !== 'em_leitura' || !a.versao_id) return;
    const mapa = (await linha<{ m: { perguntas: { codigo: string; regiao: Regiao }[] } | null }>(tx, sql`SELECT mapa_layout AS m FROM versao WHERE id = ${a.versao_id}`))?.m;
    const regioes = new Map((mapa?.perguntas ?? []).map((p) => [p.codigo, p.regiao]));
    const perguntas = await linhas<{ id: string; codigo: string; linhas: string[] | null }>(
      tx,
      sql`SELECT p.id, p.codigo, (SELECT array_agg(l.id ORDER BY l.ordem) FROM linha_matriz l WHERE l.pergunta_id = p.id) AS linhas
            FROM pergunta p WHERE p.versao_id = ${a.versao_id} ORDER BY p.ordem`,
    );
    for (const p of perguntas) {
      const regiao = regioes.get(p.codigo) ?? null;
      for (const linhaId of p.linhas?.length ? p.linhas : [null]) {
        await tx.execute(sql`
          INSERT INTO item_resposta (id, tenant_id, aplicacao_id, pergunta_id, linha_id, estado, regiao_imagem)
          VALUES (${this.n.id()}, ${tenantId}, ${aplicacaoId}, ${p.id}, ${linhaId}, 'pendente_leitura',
                  ${regiao ? JSON.stringify(regiao) : null}::jsonb)
          ON CONFLICT ON CONSTRAINT uq_item DO NOTHING`);
      }
    }
    const pendentes = (await carregarItens(this.n, tx, aplicacaoId)).filter((i) => i.estado === 'pendente_leitura');
    const lotes = new Set(pendentes.map((i) => `${i.pagina}|${grupoDe(i)}`));
    for (const lote of lotes) {
      const [pagina, grupo] = lote.split('|');
      await tx.execute(sql`
        INSERT INTO tarefa_leitura (id, tenant_id, aplicacao_id, pagina, grupo, executar_em, criada_em)
        VALUES (${this.n.id()}, ${tenantId}, ${aplicacaoId}, ${Number(pagina)}, ${grupo}, ${this.n.agora()}, ${this.n.agora()})
        ON CONFLICT (aplicacao_id, pagina, grupo) WHERE situacao = 'pendente' DO NOTHING`);
    }
    await this.finalizarSeCompleta(tx, tenantId, aplicacaoId);
  }

  // ───────────────────────────── execução de uma tarefa ─────────────────────────────

  private async executar(t: Tarefa): Promise<void> {
    const preparada = await this.n.banco.noTenant(t.tenant_id, (tx) => this.prepararChamada(tx, t));
    if (!preparada) return;
    let resultado: Awaited<ReturnType<ReadEngine['lerRecorte']>> | undefined;
    let falha: ErroLeitura | undefined;
    try {
      resultado = await preparada.motor.lerRecorte(preparada.recorte, preparada.schema);
    } catch (e) {
      falha = e instanceof ErroLeitura ? e : new ErroLeitura('erro', e instanceof Error ? e.name : 'erro');
    }
    await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      await ajustar(tx, t.tenant_id, preparada.inicio, preparada.cotacao, preparada.estimadoUsd, resultado?.custoUsd ?? 0);
      const daOpaca = new Map(preparada.schema.campos.map((c, k) => [c.chave, preparada.chaves[k]]));
      if (resultado) await this.gravarLeitura(tx, t, resultado.leituras.map((l) => ({ ...l, chave: daOpaca.get(l.chave) ?? '' })));
      else await this.registrarFalha(tx, t, falha!);
    });
  }

  /** Primeira fase, numa transação: confere o estado, recorta, estima e reserva a cota. */
  private async prepararChamada(tx: Executor, t: Tarefa): Promise<Preparada | undefined> {
    const a = await linha<{ estado: string; projeto_id: string }>(tx, sql`SELECT estado, projeto_id FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`);
    if (!a || a.estado !== 'em_leitura') {
      await this.encerrarTarefa(tx, t.id, 'cancelada');
      return undefined;
    }
    const alvo = (await carregarItens(this.n, tx, t.aplicacao_id)).filter((i) => i.estado === 'pendente_leitura' && i.pagina === t.pagina && grupoDe(i) === t.grupo);
    if (!alvo.length) {
      await this.encerrarTarefa(tx, t.id, 'concluida');
      await this.finalizarSeCompleta(tx, t.tenant_id, t.aplicacao_id);
      return undefined;
    }
    const cota = await cotaDoTenant(this.n, tx, t.tenant_id);
    if (!cota.cotacao) {
      await this.pausarPorCota(tx, t.aplicacao_id, 'sem_cotacao');
      return undefined;
    }
    // O motor vê só chaves opacas na ordem dos campos (c1, c2…), nunca o código da pergunta (RN-045).
    const chaves = alvo.map(chaveItem);
    const motor = this.n.config.motorLeitura?.({ aplicacaoId: t.aplicacao_id, pagina: t.pagina, campos: chaves });
    if (!motor) {
      // Sem chave do provedor configurada: a tarefa espera, sem contar tentativa.
      this.n.log(`leitura_sem_motor aplicacao=${t.aplicacao_id}`);
      await tx.execute(sql`UPDATE tarefa_leitura SET executar_em = ${somar(this.n.agora(), MINUTO)} WHERE id = ${t.id}`);
      return undefined;
    }
    const pagina = await linha<{ chave_storage: string }>(
      tx,
      sql`SELECT chave_storage FROM pagina_aplicacao
           WHERE aplicacao_id = ${t.aplicacao_id} AND tipo = 'formulario' AND numero_pagina = ${t.pagina} AND expurgada_em IS NULL
           ORDER BY ordem_envio LIMIT 1`,
    );
    if (!pagina) {
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página sem imagem'));
      return undefined;
    }
    let recorte: Buffer;
    try {
      recorte = await recortar(await this.n.config.armazenamento.ler(pagina.chave_storage), alvo);
    } catch {
      // Arquivo sumido ou corrompido: falha da tarefa, com as mesmas retentativas (DEC-130).
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página ilegível'));
      return undefined;
    }
    // Um recorte por pergunta, na ordem de `recortar`: as linhas da matriz dividem o mesmo (DEC-131).
    const recorteDa = new Map<string, number>();
    for (const i of alvo) if (!recorteDa.has(i.pergunta_id)) recorteDa.set(i.pergunta_id, recorteDa.size + 1);
    const schema: CampoSchema = {
      campos: alvo.map((i, k) => ({
        chave: `c${k + 1}`,
        recorte: recorteDa.get(i.pergunta_id)!,
        tipo: i.tipo,
        ...(i.opcoes.length ? { opcoes: i.opcoes } : i.tipo === 'sim_nao' ? { opcoes: ['sim', 'nao'] } : {}),
        ...(i.valor_min !== null ? { valor_min: i.valor_min } : {}),
        ...(i.valor_max !== null ? { valor_max: i.valor_max } : {}),
      })),
    };
    const estimadoUsd = motor.estimarCustoUsd(recorte, schema);
    if (!(await reservar(tx, t.tenant_id, cota, estimadoUsd))) {
      await this.pausarPorCota(tx, t.aplicacao_id, 'teto');
      return undefined;
    }
    return { motor, recorte, schema, chaves, estimadoUsd, inicio: cota.inicio, cotacao: cota.cotacao };
  }

  private async gravarLeitura(tx: Executor, t: Tarefa, leituras: { chave: string; valor: string | null; confianca: number }[]): Promise<void> {
    const a = await linha<{ estado: string; versao_id: string; projeto_id: string }>(
      tx,
      sql`SELECT estado, versao_id, projeto_id FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`,
    );
    await this.encerrarTarefa(tx, t.id, 'concluida');
    this.n.log(`leitura aplicacao=${t.aplicacao_id} pagina=${t.pagina} grupo=${t.grupo} resultado=ok tentativa=${t.tentativas + 1}`);
    // Descartada (ou fora de leitura) durante a chamada: nada do que foi lido é gravado (DEC-077).
    if (!a || !['em_leitura', 'aguardando_cota'].includes(a.estado)) return;
    const itens = await carregarItens(this.n, tx, t.aplicacao_id);
    const porChave = new Map(itens.map((i) => [chaveItem(i), i]));
    const lidos: Item[] = [];
    for (const l of leituras) {
      const i = porChave.get(l.chave);
      if (!i || i.estado !== 'pendente_leitura') continue;
      i.valor_ia = canonizar(i.tipo, l.valor);
      i.confianca = l.confianca;
      lidos.push(i);
    }
    const av = new Avaliacao(itens, await carregarRegras(tx, a.versao_id), await limiteConfianca(tx, t.tenant_id, a.projeto_id));
    av.lidos(lidos);
    for (const i of av.alterados) await gravarItem(this.n, tx, i);
    await tx.execute(sql`UPDATE aplicacao SET versao = versao + 1 WHERE id = ${t.aplicacao_id}`);
    if (a.estado === 'em_leitura') await this.finalizarSeCompleta(tx, t.tenant_id, t.aplicacao_id);
  }

  private async registrarFalha(tx: Executor, t: Tarefa, falha: ErroLeitura): Promise<void> {
    const tipo = falha.tipo;
    const tentativa = t.tentativas + 1;
    // O detalhe é texto fixo do motor (classe do erro, status HTTP), nunca conteúdo lido (RN-028).
    this.n.log(`leitura aplicacao=${t.aplicacao_id} pagina=${t.pagina} grupo=${t.grupo} resultado=${tipo} tentativa=${tentativa} detalhe="${falha.message}"`);
    if (tentativa <= ESPERAS_MS.length) {
      await tx.execute(sql`
        UPDATE tarefa_leitura SET tentativas = ${tentativa}, ultima_falha = ${tipo},
               executar_em = ${somar(this.n.agora(), ESPERAS_MS[tentativa - 1])}
         WHERE id = ${t.id}`);
      return;
    }
    await tx.execute(sql`UPDATE tarefa_leitura SET tentativas = ${tentativa}, ultima_falha = ${tipo}, situacao = 'falhou' WHERE id = ${t.id}`);
    const r = await linhas(
      tx,
      sql`UPDATE aplicacao SET estado = 'erro_leitura', aviso = 'ERR-041', versao = versao + 1
           WHERE id = ${t.aplicacao_id} AND estado = 'em_leitura' RETURNING id`,
    );
    await this.cancelarTarefas(tx, t.aplicacao_id);
    if (r.length) await this.n.auditar(tx, sistema(t.tenant_id), 'LEITURA_FALHOU', 'Aplicacao', t.aplicacao_id, { tentativas: tentativa, falha: tipo });
  }

  // ───────────────────────────── estado da aplicação ─────────────────────────────

  /** Todos os campos lidos → em_revisao (FL-001). */
  private async finalizarSeCompleta(tx: Executor, tenantId: string, aplicacaoId: string): Promise<void> {
    const r = await linha<{ pendentes: number }>(
      tx,
      sql`SELECT count(*)::int AS pendentes FROM item_resposta WHERE aplicacao_id = ${aplicacaoId} AND estado = 'pendente_leitura'`,
    );
    if (r!.pendentes > 0) return;
    const cpf = cpfDaAplicacao(await carregarItens(this.n, tx, aplicacaoId));
    const feita = await linhas(
      tx,
      sql`UPDATE aplicacao SET estado = 'em_revisao', aviso = NULL, versao = versao + 1, cpf_hash = ${cpf ? this.n.hmac(cpf) : null}
           WHERE id = ${aplicacaoId} AND estado = 'em_leitura' RETURNING id`,
    );
    if (feita.length) {
      await this.cancelarTarefas(tx, aplicacaoId);
      await this.n.auditar(tx, sistema(tenantId), 'LEITURA_CONCLUIDA', 'Aplicacao', aplicacaoId);
    }
  }

  /** Teto atingido ou mês sem cotação: aguarda, preservando os itens já lidos (FL-001). */
  private async pausarPorCota(tx: Executor, aplicacaoId: string, motivo: 'teto' | 'sem_cotacao'): Promise<void> {
    await tx.execute(sql`UPDATE aplicacao SET estado = 'aguardando_cota', aviso = 'ERR-003', versao = versao + 1 WHERE id = ${aplicacaoId}`);
    await this.cancelarTarefas(tx, aplicacaoId);
    this.n.log(`leitura_aguardando_cota aplicacao=${aplicacaoId} motivo=${motivo}`);
  }

  private async cancelarTarefas(tx: Executor, aplicacaoId: string): Promise<void> {
    await tx.execute(sql`UPDATE tarefa_leitura SET situacao = 'cancelada' WHERE aplicacao_id = ${aplicacaoId} AND situacao = 'pendente'`);
  }

  private async encerrarTarefa(tx: Executor, id: string, situacao: 'concluida' | 'cancelada'): Promise<void> {
    await tx.execute(sql`UPDATE tarefa_leitura SET situacao = ${situacao} WHERE id = ${id}`);
  }
}

/** Altura da faixa preta entre dois recortes empilhados (DEC-131). */
const FAIXA = 8;

/**
 * Recortes das regiões dos campos (uma por pergunta; a matriz inteira num só), empilhados numa
 * imagem e separados por uma faixa preta: o motor nunca recebe a página inteira (RN-038, DEC-048)
 * e sabe onde começa cada recorte (DEC-131).
 */
export async function recortar(pagina: Buffer, itens: Pick<Item, 'pergunta_id' | 'regiao'>[]): Promise<Buffer> {
  const meta = await sharp(pagina).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  const vistas = new Set<string>();
  const partes: { input: Buffer; largura: number; altura: number }[] = [];
  for (const i of itens) {
    if (vistas.has(i.pergunta_id)) continue;
    vistas.add(i.pergunta_id);
    const r = i.regiao ?? { x: 0, y: 0, largura: 1, altura: 0.1 };
    const left = Math.max(0, Math.floor(r.x * W));
    const top = Math.max(0, Math.floor(r.y * H));
    const width = Math.max(1, Math.min(W - left, Math.ceil(r.largura * W)));
    const height = Math.max(1, Math.min(H - top, Math.ceil(r.altura * H)));
    partes.push({ input: await sharp(pagina).extract({ left, top, width, height }).toBuffer(), largura: width, altura: height });
  }
  const largura = Math.max(...partes.map((p) => p.largura));
  const altura = partes.reduce((s, p) => s + p.altura, 0) + FAIXA * (partes.length - 1);
  const faixa = await sharp({ create: { width: largura, height: FAIXA, channels: 3, background: '#000000' } }).png().toBuffer();
  let y = 0;
  const composicao: { input: Buffer; left: number; top: number }[] = [];
  partes.forEach((p, k) => {
    if (k > 0) {
      composicao.push({ input: faixa, left: 0, top: y });
      y += FAIXA;
    }
    composicao.push({ input: p.input, left: 0, top: y });
    y += p.altura;
  });
  return sharp({ create: { width: largura, height: altura, channels: 3, background: '#ffffff' } })
    .composite(composicao)
    .jpeg({ quality: 90 })
    .toBuffer();
}
