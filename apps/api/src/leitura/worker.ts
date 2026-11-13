// Worker da leitura por IA (RF-007, FL-001, FL-002; DEC-051, DEC-103, DEC-124, DEC-216, DEC-220).
//
// - Identificação (RN-052, DEC-216): cada `leitura.solicitada` do outbox cria uma tarefa por folha
//   ainda não identificada (pulada se a usuária já informou a página no `identifyApplication`); a
//   identificação recebe a página inteira e os códigos das perguntas e devolve só a página e a
//   confiança. Com todas as folhas identificadas, a conferência das páginas decide entre
//   `identificacao_pendente` (ERR-004) e a leitura: aplica ou apaga data e local do envio (DEC-186),
//   cria os itens da versão (um por pergunta e por linha de matriz), os sem leitura já resolvidos
//   (FL-002, regra 0), e uma tarefa de leitura por página.
// - Leitura: a página inteira, sem metadados e com o lado maior de no máximo 2.000 px, e o gabarito
//   das perguntas dela; o motor devolve valor, confiança e região por campo e, na página 1, a região
//   da assinatura. Reserva o custo estimado (DEC-051), chama o motor fora da transação e grava o que
//   foi lido. Falha → novas tentativas em 1 e 2 s; na 3ª falha, a aplicação vai para erro_leitura
//   (REQ §6.6, DEC-129). Página que não se lê do disco também é falha da tarefa, e nenhum erro de uma
//   tarefa interrompe as demais (DEC-130).
// - Cota: teto atingido ou mês sem cotação do dólar → aguardando_cota, preservando o que já foi
//   lido; a retomada roda a cada `processar` e lê só o que falta (FL-001).
//
// - Importação de formulário: as tarefas da `tarefa_importacao` rodam no mesmo ciclo e relógio
//   (DEC-142, importacao.ts).
//
// - Exportação: as tarefas da `tarefa_exportacao` e o expurgo dos arquivos vencidos rodam no mesmo
//   ciclo e relógio (DEC-165, exportacao/worker.ts).
//
// Nada do conteúdo lido entra no log (RN-028): só IDs, página e resultado.

import { ErroLeitura, type GabaritoPagina, type PerguntasPorPagina, type ReadEngine, type ResultadoIdentificacao, type ResultadoLeitura, type TipoCampo } from '@minhapesquisa/motor-leitura';
import sharp from 'sharp';
import { parametro } from '../escopo.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { MINUTO, SEGUNDO, somar } from '../infra/relogio.js';
import type { ContextoIdentificacao } from '../config.js';
import type { Nucleo } from '../nucleo.js';
import { canonizar, estadoComplemento, type EstadoItem } from '../regras/leitura.js';
import { comFolga, conferirPaginas, envoltoria, type FolhaLocalizada } from '../regras/papel-antigo.js';
import { lerConteudoQr } from '../regras/upload.js';
import {
  ajustar,
  Avaliacao,
  carregarItens,
  carregarRegras,
  chaveItem,
  cotaDoTenant,
  cpfDaAplicacao,
  ehComplemento,
  gravarItem,
  limiteConfianca,
  reservar,
  type Item,
  type Regiao,
} from './dominio.js';
import { WorkerExportacao } from '../exportacao/worker.js';
import { WorkerImportacao } from './importacao.js';

/** Esperas antes da 2ª e da 3ª chamada (REQ §6.6, DEC-129); depois da 3ª falha, erro_leitura. */
export const ESPERAS_MS = [1 * SEGUNDO, 2 * SEGUNDO];

/** `localizacao` é a identificação da página de uma folha; `demais` é a leitura de uma página (DEC-216). */
type Grupo = 'demais' | 'localizacao';
/** Item que o motor lê: o de complemento é lido com a sua pergunta, sem chave própria (DEC-203 (3)). */
const lido = (i: Item) => i.estado === 'pendente_leitura' && !ehComplemento(i);
/** Maior lado da imagem enviada ao provedor (DEC-220 (5)). */
const LADO_MAXIMO = 2000;

interface Tarefa {
  id: string;
  tenant_id: string;
  aplicacao_id: string;
  /** Página da leitura; na identificação, a ordem de envio da folha. */
  pagina: number;
  grupo: Grupo;
  tentativas: number;
  /** Folha da tarefa de identificação. */
  pagina_aplicacao_id: string | null;
}

/** Região de uma pergunta na folha (DEC-174): `linha` é o código da linha da matriz. */
export interface RegiaoGravada extends Regiao {
  codigo: string;
  linha: string | null;
}

/** Folha de formulário da aplicação, com o que a localização gravou (ENT-025). */
interface Folha {
  id: string;
  ordem_envio: number;
  qr_codigo: string | null;
  numero_pagina: number | null;
  chave_storage: string;
  regioes: RegiaoGravada[] | null;
  pagina_localizada: number | null;
  confianca_localizacao: string | null;
  localizada_em: Date | null;
}

interface Aplicacao {
  id: string;
  estado: string;
  versao_id: string;
  projeto_id: string;
  paginas_informadas: boolean;
}

interface ItemNovo {
  pergunta_id: string;
  linha_id: string | null;
  opcao_id: string | null;
  chave: string;
  pagina: number;
  estado: string;
  valor_final: string | null;
}

interface PreparadaIdentificacao {
  identificador: Pick<ReadEngine, 'identificarPagina' | 'estimarCustoIdentificacaoUsd'>;
  imagem: Buffer;
  perguntas: PerguntasPorPagina;
  estimadoUsd: number;
  inicio: string;
  cotacao: string;
}

interface Preparada {
  motor: Pick<ReadEngine, 'estimarCustoUsd' | 'lerPagina'>;
  imagem: Buffer;
  gabarito: GabaritoPagina;
  /** Chave do item (código da pergunta e linha) de cada chave opaca, na mesma ordem. */
  chaves: string[];
  /** Folha da página, onde ficam as regiões lidas. */
  folhaId: string;
  estimadoUsd: number;
  inicio: string;
  cotacao: string;
}

const sistema = (tenantId: string) => ({ tenantId, usuarioId: null, ip: null });

export class WorkerLeitura {
  private readonly importacao: WorkerImportacao;
  private readonly exportacao: WorkerExportacao;

  constructor(private readonly n: Nucleo) {
    this.importacao = new WorkerImportacao(n);
    this.exportacao = new WorkerExportacao(n);
  }

  /** Roda o que já venceu: despacho do outbox, retomada da cota e tarefas, até não sobrar nada. */
  async processar(): Promise<void> {
    await this.despachar();
    await this.retomarCota();
    await this.importacao.retomarCota();
    while ((await this.executarVencidas()) > 0) await this.despachar();
  }

  /** Só as tarefas já criadas que venceram no relógio (retentativas), sem despachar nada novo. */
  async executarVencidas(): Promise<number> {
    return (await this.executarLeituras()) + (await this.importacao.executarVencidas()) + (await this.exportacao.executarVencidas());
  }

  private async executarLeituras(): Promise<number> {
    const agora = this.n.agora();
    const vencidas = await this.n.banco.manutencao((tx) =>
      linhas<Tarefa>(
        tx,
        sql`SELECT id, tenant_id, aplicacao_id, pagina, grupo, tentativas, pagina_aplicacao_id FROM tarefa_leitura
             WHERE situacao = 'pendente' AND executar_em <= ${agora}
             ORDER BY executar_em, aplicacao_id, pagina, grupo`,
      ),
    );
    for (const t of vencidas) {
      try {
        if (t.grupo === 'localizacao') await this.executarIdentificacao(t);
        else await this.executar(t);
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

  /**
   * Avança a aplicação em leitura: identifica as folhas que faltam; com todas identificadas e ainda
   * sem itens, confere as páginas e cria os itens; depois, uma tarefa de leitura por página com
   * campos pendentes.
   */
  private async preparar(tx: Executor, tenantId: string, aplicacaoId: string): Promise<void> {
    const a = await linha<Aplicacao>(
      tx,
      sql`SELECT id, estado, versao_id, projeto_id, paginas_informadas FROM aplicacao WHERE id = ${aplicacaoId} FOR UPDATE`,
    );
    if (!a || a.estado !== 'em_leitura' || !a.versao_id) return;
    const temItens = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM item_resposta WHERE aplicacao_id = ${aplicacaoId}`))!.n > 0;
    if (!temItens) {
      const folhas = await this.folhas(tx, aplicacaoId);
      // A página informada pela usuária dispensa a identificação (DEC-220 (5), RN-052, item 3a).
      const faltam = folhas.filter((f) => !f.localizada_em && !(a.paginas_informadas && f.numero_pagina !== null));
      for (const f of faltam) {
        await tx.execute(sql`
          INSERT INTO tarefa_leitura (id, tenant_id, aplicacao_id, pagina, grupo, pagina_aplicacao_id, executar_em, criada_em)
          VALUES (${this.n.id()}, ${tenantId}, ${aplicacaoId}, ${f.ordem_envio}, 'localizacao', ${f.id}, ${this.n.agora()}, ${this.n.agora()})
          ON CONFLICT (aplicacao_id, pagina, grupo) WHERE situacao = 'pendente' DO NOTHING`);
      }
      if (faltam.length) return;
      if (!(await this.concluirIdentificacao(tx, tenantId, a, folhas))) return;
    }
    const pendentes = (await carregarItens(this.n, tx, aplicacaoId)).filter(lido);
    for (const pagina of new Set(pendentes.map((i) => i.pagina))) {
      await tx.execute(sql`
        INSERT INTO tarefa_leitura (id, tenant_id, aplicacao_id, pagina, grupo, executar_em, criada_em)
        VALUES (${this.n.id()}, ${tenantId}, ${aplicacaoId}, ${pagina}, 'demais', ${this.n.agora()}, ${this.n.agora()})
        ON CONFLICT (aplicacao_id, pagina, grupo) WHERE situacao = 'pendente' DO NOTHING`);
    }
    await this.finalizarSeCompleta(tx, tenantId, aplicacaoId);
  }

  private folhas(tx: Executor, aplicacaoId: string): Promise<Folha[]> {
    return linhas<Folha>(
      tx,
      sql`SELECT id, ordem_envio, qr_codigo, numero_pagina, chave_storage, regioes, pagina_localizada,
                 confianca_localizacao::text AS confianca_localizacao, localizada_em
            FROM pagina_aplicacao WHERE aplicacao_id = ${aplicacaoId} AND tipo = 'formulario' AND expurgada_em IS NULL
           ORDER BY ordem_envio, id`,
    );
  }

  /**
   * Fim da identificação (RN-052, item 3; FL-001): confere as páginas; na pendência, a aplicação vai a
   * identificacao_pendente com ERR-004, sem ler nada. Senão grava as páginas, aplica ou apaga data e
   * local do envio (DEC-186) e cria os itens: `nao_consta` sem leitura (DEC-179) e os demais
   * pendentes de leitura, com a região vinda da própria leitura (DEC-216). Devolve se a leitura segue.
   */
  private async concluirIdentificacao(tx: Executor, tenantId: string, a: Aplicacao, folhas: Folha[]): Promise<boolean> {
    const v = (await linha<{ numero: number; total_paginas: number; papel_antigo: boolean }>(
      tx,
      sql`SELECT numero, total_paginas, papel_antigo FROM versao WHERE id = ${a.versao_id}`,
    ))!;
    const perguntas = await perguntasDaVersao(tx, a.versao_id);
    const comPerguntas = new Set(perguntas.map((p) => p.pagina));
    const semPerguntas = new Set(Array.from({ length: v.total_paginas }, (_, i) => i + 1).filter((n) => !comPerguntas.has(n)));
    const limite = Number(await parametro(tx, 'limite_confianca_localizacao', tenantId, a.projeto_id));
    const conferir: FolhaLocalizada[] = folhas.map((f) => {
      const qr = f.qr_codigo ? lerConteudoQr(f.qr_codigo) : null;
      return {
        id: f.id,
        paginaQr: qr && qr.versao === v.numero ? qr.pagina : null,
        paginaLocalizada: f.pagina_localizada,
        confianca: f.confianca_localizacao === null ? null : Number(f.confianca_localizacao),
        numeroPagina: f.numero_pagina,
      };
    });
    const paginas = conferirPaginas(conferir, { total: v.total_paginas, semPerguntas, limite, informadas: a.paginas_informadas });
    if (!paginas) {
      await tx.execute(sql`UPDATE aplicacao SET estado = 'identificacao_pendente', aviso = 'ERR-004', versao = versao + 1 WHERE id = ${a.id}`);
      await this.cancelarTarefas(tx, a.id);
      await this.n.auditar(tx, sistema(tenantId), 'LOCALIZACAO_PENDENTE', 'Aplicacao', a.id, { folhas: folhas.length });
      this.n.log(`localizacao_pendente aplicacao=${a.id}`);
      return false;
    }
    for (const f of folhas) {
      // A folha da página sem perguntas não tem regiões nem leitura (RN-052, item 3c).
      await tx.execute(sql`UPDATE pagina_aplicacao SET numero_pagina = ${paginas.get(f.id)!}, regioes = NULL WHERE id = ${f.id}`);
    }

    // Data e local do envio só valem com a pergunta `nao_consta` correspondente (DEC-182, DEC-185, DEC-186).
    const envio = (await linha<{ data_aplicacao: string | null; local_aplicacao: string | null }>(
      tx,
      sql`SELECT to_char(data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao, local_aplicacao FROM aplicacao WHERE id = ${a.id}`,
    ))!;
    const naoConsta = (campo: string) => v.papel_antigo && perguntas.some((p) => p.nao_consta && p.campo_aplicacao === campo);
    const data = naoConsta('data_aplicacao') ? envio.data_aplicacao : null;
    const local = naoConsta('local_aplicacao') ? this.n.decifrar(envio.local_aplicacao) : null;
    await tx.execute(sql`UPDATE aplicacao SET data_aplicacao = ${data}::date, local_aplicacao = ${this.n.cifrar(local)} WHERE id = ${a.id}`);

    const novos: ItemNovo[] = [];
    for (const p of perguntas) {
      for (const l of p.linhas.length ? p.linhas : [null]) {
        const base = { pergunta_id: p.id, linha_id: l?.id ?? null, opcao_id: null, chave: l ? `${p.codigo}.${l.codigo}` : p.codigo, pagina: p.pagina };
        if (p.nao_consta) {
          const valor = p.campo_aplicacao === 'data_aplicacao' ? data : p.campo_aplicacao === 'local_aplicacao' ? local : null;
          const estado = p.campo_aplicacao === null ? 'em_branco' : valor === null ? 'a_revisar' : 'corrigido';
          novos.push({ ...base, estado, valor_final: valor });
          continue;
        }
        novos.push({ ...base, estado: 'pendente_leitura', valor_final: null });
      }
    }
    // Um item de complemento por opção com complemento, lido com a pergunta (RN-045, DEC-203 (2)); sem
    // leitura da pergunta, já avaliado pela pré-regra 1b, com o complemento sem leitura.
    const limiteItem = await limiteConfianca(tx, tenantId, a.projeto_id);
    for (const p of perguntas) {
      const q = novos.find((x) => x.pergunta_id === p.id && x.linha_id === null);
      if (!q) continue;
      for (const o of p.complementos) {
        const estado: EstadoItem =
          q.estado === 'pendente_leitura'
            ? 'pendente_leitura'
            : estadoComplemento({ opcao: o.codigo, pergunta: { estado: q.estado as EstadoItem, valor: q.valor_final, pelaUsuaria: false }, lido: null, limite: limiteItem });
        novos.push({ ...q, opcao_id: o.id, chave: `${q.chave}+${o.codigo}`, estado, valor_final: null });
      }
    }
    for (const x of novos) {
      await tx.execute(sql`
        INSERT INTO item_resposta (id, tenant_id, aplicacao_id, pergunta_id, linha_id, opcao_id, estado, valor_final)
        VALUES (${this.n.id()}, ${tenantId}, ${a.id}, ${x.pergunta_id}, ${x.linha_id}, ${x.opcao_id}, ${x.estado}, ${x.valor_final})
        ON CONFLICT ON CONSTRAINT uq_item DO NOTHING`);
    }
    await this.n.auditar(tx, sistema(tenantId), 'LOCALIZACAO_CONCLUIDA', 'Aplicacao', a.id, { folhas: folhas.length });
    return true;
  }

  // ───────────────────────────── identificação de uma folha ─────────────────────────────

  private async executarIdentificacao(t: Tarefa): Promise<void> {
    const p = await this.n.banco.noTenant(t.tenant_id, (tx) => this.prepararIdentificacao(tx, t));
    if (!p) return;
    let resultado: ResultadoIdentificacao | undefined;
    let falha: ErroLeitura | undefined;
    try {
      resultado = await p.identificador.identificarPagina(p.imagem, p.perguntas);
    } catch (e) {
      falha = e instanceof ErroLeitura ? e : new ErroLeitura('erro', e instanceof Error ? e.name : 'erro');
    }
    await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      await ajustar(tx, t.tenant_id, p.inicio, p.cotacao, p.estimadoUsd, resultado?.custoUsd ?? 0);
      if (resultado) await this.gravarIdentificacao(tx, t, resultado);
      else await this.registrarFalha(tx, t, falha!);
    });
  }

  /** Confere o estado, monta a entrada sem projeto nem tenant (RN-045), estima e reserva a cota (DEC-051). */
  private async prepararIdentificacao(tx: Executor, t: Tarefa): Promise<PreparadaIdentificacao | undefined> {
    const a = await linha<Aplicacao>(tx, sql`SELECT id, estado, versao_id, projeto_id, paginas_informadas FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`);
    if (!a || a.estado !== 'em_leitura' || !a.versao_id) {
      await this.encerrarTarefa(tx, t.id, 'cancelada');
      return undefined;
    }
    const folhas = await this.folhas(tx, t.aplicacao_id);
    const posicao = folhas.findIndex((f) => f.id === t.pagina_aplicacao_id);
    const f = folhas[posicao];
    if (!f || f.localizada_em) {
      await this.encerrarTarefa(tx, t.id, f ? 'concluida' : 'cancelada');
      await this.preparar(tx, t.tenant_id, t.aplicacao_id);
      return undefined;
    }
    const cota = await cotaDoTenant(this.n, tx, t.tenant_id);
    if (!cota.cotacao) {
      await this.pausarPorCota(tx, t.aplicacao_id, 'sem_cotacao');
      return undefined;
    }
    const v = (await linha<{ numero: number; total_paginas: number }>(tx, sql`SELECT numero, total_paginas FROM versao WHERE id = ${a.versao_id}`))!;
    const qr = f.qr_codigo ? lerConteudoQr(f.qr_codigo) : null;
    const contexto: ContextoIdentificacao = { aplicacaoId: t.aplicacao_id, imagemId: f.id, paginaQr: qr && qr.versao === v.numero ? qr.pagina : null, posicao: posicao + 1 };
    const identificador = this.n.config.identificador?.(contexto);
    if (!identificador) {
      // Sem chave do provedor configurada: a tarefa espera, sem contar tentativa.
      this.n.log(`identificacao_sem_identificador aplicacao=${t.aplicacao_id}`);
      await tx.execute(sql`UPDATE tarefa_leitura SET executar_em = ${somar(this.n.agora(), MINUTO)} WHERE id = ${t.id}`);
      return undefined;
    }
    // Só os códigos das perguntas por página (`CODIGO` ou, na matriz, `CODIGO.linha`); a pergunta
    // `nao_consta` não está impressa (DEC-179), e a página sem perguntas segue na lista, vazia.
    const perguntas: PerguntasPorPagina = {};
    for (let n = 1; n <= v.total_paginas; n++) perguntas[n] = [];
    for (const p of (await perguntasDaVersao(tx, a.versao_id)).filter((x) => !x.nao_consta)) {
      perguntas[p.pagina].push(...(p.linhas.length ? p.linhas.map((l) => `${p.codigo}.${l.codigo}`) : [p.codigo]));
    }
    let imagem: Buffer;
    let estimadoUsd: number;
    try {
      imagem = await paraOProvedor(await this.n.config.armazenamento.ler(f.chave_storage));
      estimadoUsd = identificador.estimarCustoIdentificacaoUsd(imagem, perguntas);
    } catch {
      // Arquivo sumido ou corrompido: falha da tarefa, com as mesmas retentativas (DEC-130).
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página ilegível'));
      return undefined;
    }
    if (!(await reservar(tx, t.tenant_id, cota, estimadoUsd))) {
      await this.pausarPorCota(tx, t.aplicacao_id, 'teto');
      return undefined;
    }
    return { identificador, imagem, perguntas, estimadoUsd, inicio: cota.inicio, cotacao: cota.cotacao };
  }

  /** Grava a página indicada na folha (ENT-025) e avança a aplicação (RN-052, item 3b). */
  private async gravarIdentificacao(tx: Executor, t: Tarefa, r: ResultadoIdentificacao): Promise<void> {
    const a = await linha<{ estado: string }>(tx, sql`SELECT estado FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`);
    await this.encerrarTarefa(tx, t.id, 'concluida');
    this.n.log(`identificacao aplicacao=${t.aplicacao_id} folha=${t.pagina} resultado=ok tentativa=${t.tentativas + 1}`);
    // Descartada durante a chamada: nada é gravado (DEC-077).
    if (!a || !['em_leitura', 'aguardando_cota'].includes(a.estado)) return;
    await tx.execute(sql`
      UPDATE pagina_aplicacao SET pagina_localizada = ${r.pagina}, confianca_localizacao = ${r.confianca}, localizada_em = ${this.n.agora()}
       WHERE id = ${t.pagina_aplicacao_id}`);
    if (a.estado === 'em_leitura') await this.preparar(tx, t.tenant_id, t.aplicacao_id);
  }

  // ───────────────────────────── execução de uma tarefa de leitura ─────────────────────────────

  private async executar(t: Tarefa): Promise<void> {
    const preparada = await this.n.banco.noTenant(t.tenant_id, (tx) => this.prepararChamada(tx, t));
    if (!preparada) return;
    let resultado: ResultadoLeitura | undefined;
    let falha: ErroLeitura | undefined;
    try {
      resultado = await preparada.motor.lerPagina(preparada.imagem, preparada.gabarito);
    } catch (e) {
      falha = e instanceof ErroLeitura ? e : new ErroLeitura('erro', e instanceof Error ? e.name : 'erro');
    }
    await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      await ajustar(tx, t.tenant_id, preparada.inicio, preparada.cotacao, preparada.estimadoUsd, resultado?.custoUsd ?? 0);
      const daOpaca = new Map(preparada.gabarito.campos.map((c, k) => [c.chave, preparada.chaves[k]]));
      if (resultado) await this.gravarLeitura(tx, t, preparada.folhaId, resultado.leituras.map((l) => ({ ...l, chave: daOpaca.get(l.chave) ?? '' })), resultado.regiao_assinatura);
      else await this.registrarFalha(tx, t, falha!);
    });
  }

  /** Primeira fase, numa transação: confere o estado, monta o gabarito da página, estima e reserva a cota. */
  private async prepararChamada(tx: Executor, t: Tarefa): Promise<Preparada | undefined> {
    const a = await linha<{ estado: string; projeto_id: string }>(tx, sql`SELECT estado, projeto_id FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`);
    if (!a || a.estado !== 'em_leitura') {
      await this.encerrarTarefa(tx, t.id, 'cancelada');
      return undefined;
    }
    const alvo = (await carregarItens(this.n, tx, t.aplicacao_id)).filter((i) => lido(i) && i.pagina === t.pagina);
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
    const pagina = await linha<{ id: string; chave_storage: string }>(
      tx,
      sql`SELECT id, chave_storage FROM pagina_aplicacao
           WHERE aplicacao_id = ${t.aplicacao_id} AND tipo = 'formulario' AND numero_pagina = ${t.pagina} AND expurgada_em IS NULL
           ORDER BY ordem_envio LIMIT 1`,
    );
    if (!pagina) {
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página sem imagem'));
      return undefined;
    }
    let imagem: Buffer;
    try {
      imagem = await paraOProvedor(await this.n.config.armazenamento.ler(pagina.chave_storage));
    } catch {
      // Arquivo sumido ou corrompido: falha da tarefa, com as mesmas retentativas (DEC-130).
      await this.registrarFalha(tx, t, new ErroLeitura('erro', 'página ilegível'));
      return undefined;
    }
    const gabarito: GabaritoPagina = {
      pagina: t.pagina,
      procurar_assinatura: t.pagina === 1,
      campos: alvo.map((i, k) => ({
        chave: `c${k + 1}`,
        tipo: i.tipo,
        ...(i.opcoes.length ? { opcoes: i.opcoes } : i.tipo === 'sim_nao' ? { opcoes: ['sim', 'nao'] } : {}),
        ...(i.valor_min !== null ? { valor_min: i.valor_min } : {}),
        ...(i.valor_max !== null ? { valor_max: i.valor_max } : {}),
        ...(i.complementos.length && !i.linha_id ? { complementos: i.complementos } : {}),
      })),
    };
    const estimadoUsd = motor.estimarCustoUsd(imagem, gabarito);
    if (!(await reservar(tx, t.tenant_id, cota, estimadoUsd))) {
      await this.pausarPorCota(tx, t.aplicacao_id, 'teto');
      return undefined;
    }
    return { motor, imagem, gabarito, chaves, folhaId: pagina.id, estimadoUsd, inicio: cota.inicio, cotacao: cota.cotacao };
  }

  private async gravarLeitura(
    tx: Executor,
    t: Tarefa,
    folhaId: string,
    leituras: { chave: string; valor: string | null; confianca: number; regiao: Regiao | null; complementos?: Record<string, { valor: string | null; confianca: number }> }[],
    regiaoAssinatura: Regiao | null,
  ): Promise<void> {
    const a = await linha<{ estado: string; versao_id: string; projeto_id: string }>(
      tx,
      sql`SELECT estado, versao_id, projeto_id FROM aplicacao WHERE id = ${t.aplicacao_id} FOR UPDATE`,
    );
    await this.encerrarTarefa(tx, t.id, 'concluida');
    this.n.log(`leitura aplicacao=${t.aplicacao_id} pagina=${t.pagina} resultado=ok tentativa=${t.tentativas + 1}`);
    // Descartada (ou fora de leitura) durante a chamada: nada do que foi lido é gravado (DEC-077).
    if (!a || !['em_leitura', 'aguardando_cota'].includes(a.estado)) return;
    const itens = await carregarItens(this.n, tx, t.aplicacao_id);
    const porChave = new Map(itens.map((i) => [chaveItem(i), i]));
    const lidos: Item[] = [];
    const regioes: RegiaoGravada[] = [];
    for (const l of leituras) {
      const i = porChave.get(l.chave);
      if (!i || i.estado !== 'pendente_leitura') continue;
      i.valor_ia = canonizar(i.tipo, l.valor);
      i.confianca = l.confianca;
      i.regiao = l.regiao;
      lidos.push(i);
      if (l.regiao) regioes.push({ codigo: i.codigo, linha: i.linha_codigo, ...l.regiao });
      // Complemento ausente na resposta fica sem leitura (confiança nula, pré-regra 1b, c).
      for (const c of itens.filter((x) => ehComplemento(x) && x.pergunta_id === i.pergunta_id && x.estado === 'pendente_leitura')) {
        const comp = l.complementos?.[c.opcao_codigo!];
        if (!comp) continue;
        c.valor_ia = comp.valor === null || comp.valor.trim() === '' ? null : comp.valor.trim();
        c.confianca = comp.confianca;
        c.regiao = l.regiao;
      }
    }
    const av = new Avaliacao(itens, await carregarRegras(tx, a.versao_id), await limiteConfianca(tx, t.tenant_id, a.projeto_id));
    av.lidos(lidos);
    for (const i of av.alterados) await gravarItem(this.n, tx, i, null);
    // As regiões da página e a da assinatura vêm da leitura e ficam na folha (ENT-025, DEC-216).
    await tx.execute(sql`
      UPDATE pagina_aplicacao SET regioes = ${JSON.stringify(regioes)}::jsonb,
             regiao_assinatura = CASE WHEN ${t.pagina === 1} THEN ${regiaoAssinatura ? JSON.stringify(regiaoAssinatura) : null}::jsonb ELSE regiao_assinatura END
       WHERE id = ${folhaId}`);
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

/**
 * Recorte da região de um item para a tela de revisão, feito na hora: o motor nunca recebe recorte
 * (DEC-216, DEC-220 (5)). Sem região, a página inteira. A região é a lida pela leitura, com a folga de
 * 2% de cada lado, limitada à imagem.
 */
export async function recortar(pagina: Buffer, itens: Pick<Item, 'pergunta_id' | 'regiao'>[]): Promise<Buffer> {
  const meta = await sharp(pagina).metadata();
  const W = meta.width ?? 1;
  const H = meta.height ?? 1;
  const regioes = itens.flatMap((i) => (i.regiao ? [i.regiao] : []));
  const r = regioes.length ? comFolga(envoltoria(regioes)) : { x: 0, y: 0, largura: 1, altura: 1 };
  const left = Math.max(0, Math.floor(r.x * W));
  const top = Math.max(0, Math.floor(r.y * H));
  const width = Math.max(1, Math.min(W - left, Math.ceil(r.largura * W)));
  const height = Math.max(1, Math.min(H - top, Math.ceil(r.altura * H)));
  return sharp(pagina).extract({ left, top, width, height }).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Página inteira para o provedor: sem metadados e com o lado maior de no máximo 2.000 px; dentro do
 * limite, a imagem guardada segue como está (DEC-220 (5)).
 */
export async function paraOProvedor(pagina: Buffer): Promise<Buffer> {
  const meta = await sharp(pagina).metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) <= LADO_MAXIMO) return pagina;
  return sharp(pagina).resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside' }).jpeg({ quality: 90 }).toBuffer();
}

export interface PerguntaVersao {
  id: string;
  codigo: string;
  enunciado: string;
  tipo: TipoCampo;
  pagina: number;
  sensibilidade: string;
  campo_aplicacao: string | null;
  nao_consta: boolean;
  linhas: { id: string; codigo: string }[];
  /** Opções com complemento, na ordem (DEC-197). */
  complementos: { id: string; codigo: string }[];
}

/** Perguntas da versão na ordem, com as linhas da matriz na ordem delas. */
export async function perguntasDaVersao(tx: Executor, versaoId: string): Promise<PerguntaVersao[]> {
  return linhas<PerguntaVersao>(
    tx,
    sql`SELECT p.id, p.codigo, p.enunciado, p.tipo, p.pagina, p.sensibilidade, p.campo_aplicacao, p.nao_consta,
               coalesce((SELECT json_agg(json_build_object('id', l.id, 'codigo', l.codigo) ORDER BY l.ordem)
                           FROM linha_matriz l WHERE l.pergunta_id = p.id), '[]'::json) AS linhas,
               coalesce((SELECT json_agg(json_build_object('id', o.id, 'codigo', o.codigo) ORDER BY o.ordem)
                           FROM opcao o WHERE o.pergunta_id = p.id AND o.com_complemento), '[]'::json) AS complementos
          FROM pergunta p WHERE p.versao_id = ${versaoId} ORDER BY p.ordem`,
  );
}
