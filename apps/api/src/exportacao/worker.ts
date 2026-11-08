// Job da exportação (RF-012, RN-051, PLANO §4.9, DEC-165, DEC-166), no mesmo worker e relógio da
// leitura (DEC-124): uma tarefa por exportação, sem retentativa. Lê as aplicações numa só
// transação, decifra o CPF e os itens cifrados só em memória, grava o arquivo pela interface
// Armazenamento e conclui com `expira_em`. Também apaga os arquivos vencidos (DEC-069).
//
// Nada do conteúdo entra no log nem na auditoria (RN-028): só IDs e contagens.

import { parametro } from '../escopo.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { gerarCsv, gerarXlsx, TIPO_ARQUIVO } from '../infra/planilha.js';
import { DIA, SEGUNDO, somar } from '../infra/relogio.js';
import { carregarItens } from '../leitura/dominio.js';
import type { Nucleo } from '../nucleo.js';
import { arrayUuid, COLUNAS, linhasDaAplicacao, type Celula } from '../regras/exportacao.js';

/** Tempo máximo do job (REQ §6.6); passou, a exportação vai para `falhou`, sem arquivo. */
export const TEMPO_MAXIMO_MS = 60 * SEGUNDO;

export const chaveExportacao = (tenantId: string, exportacaoId: string, formato: 'csv' | 'xlsx') =>
  `tenant/${tenantId}/exportacao/${exportacaoId}.${formato}`;

interface Tarefa {
  id: string;
  tenant_id: string;
  exportacao_id: string;
}

interface Pedido {
  id: string;
  usuario_id: string;
  projeto_ids: string[];
  formato: 'csv' | 'xlsx';
  escopo: string;
  periodo_de: string | null;
  periodo_ate: string | null;
  status: string;
}

const sistema = (tenantId: string) => ({ tenantId, usuarioId: null, ip: null });

export class WorkerExportacao {
  constructor(private readonly n: Nucleo) {}

  /** Tarefas vencidas e arquivos vencidos; devolve quantas tarefas rodou. */
  async executarVencidas(): Promise<number> {
    await this.apagarVencidos();
    const agora = this.n.agora();
    const tarefas = await this.n.banco.manutencao((tx) =>
      linhas<Tarefa>(
        tx,
        sql`SELECT id, tenant_id, exportacao_id FROM tarefa_exportacao
             WHERE situacao = 'pendente' AND executar_em <= ${agora} ORDER BY executar_em, id`,
      ),
    );
    for (const t of tarefas) await this.executar(t);
    return tarefas.length;
  }

  private async executar(t: Tarefa): Promise<void> {
    const pedido = await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      const p = await linha<Pedido>(
        tx,
        sql`SELECT id, usuario_id, projeto_ids, formato, escopo, to_char(periodo_de, 'YYYY-MM-DD') AS periodo_de,
                   to_char(periodo_ate, 'YYYY-MM-DD') AS periodo_ate, status
              FROM exportacao WHERE id = ${t.exportacao_id} FOR UPDATE`,
      );
      if (!p || p.status !== 'enfileirada') {
        await tx.execute(sql`UPDATE tarefa_exportacao SET situacao = 'concluida' WHERE id = ${t.id}`);
        return undefined;
      }
      await tx.execute(sql`UPDATE exportacao SET status = 'em_andamento' WHERE id = ${p.id}`);
      return p;
    });
    if (!pedido) return;
    const chave = chaveExportacao(t.tenant_id, pedido.id, pedido.formato);
    let gravado = false;
    try {
      await comPrazo(TEMPO_MAXIMO_MS, async () => {
        const { arquivo, aplicacoes, total } = await this.n.banco.noTenant(t.tenant_id, (tx) => this.gerar(tx, pedido));
        await this.n.config.armazenamento.gravar(chave, arquivo, TIPO_ARQUIVO[pedido.formato]);
        gravado = true;
        await this.n.banco.noTenant(t.tenant_id, async (tx) => {
          const agora = this.n.agora();
          const dias = Number(await parametro(tx, 'retencao_exportacao_dias', t.tenant_id, null));
          await tx.execute(sql`
            UPDATE exportacao SET status = 'concluida', chave_storage = ${chave}, concluida_em = ${agora}, expira_em = ${somar(agora, dias * DIA)}
             WHERE id = ${pedido.id}`);
          await tx.execute(sql`UPDATE tarefa_exportacao SET situacao = 'concluida' WHERE id = ${t.id}`);
          await this.n.auditar(tx, sistema(t.tenant_id), 'EXPORTACAO_CONCLUIDA', 'Exportacao', pedido.id, { aplicacoes, linhas: total });
        });
        this.n.log(`exportacao_concluida exportacao=${pedido.id} aplicacoes=${aplicacoes} linhas=${total}`);
      });
    } catch (e) {
      if (gravado) await this.n.config.armazenamento.apagar(chave).catch(() => undefined);
      this.n.log(`exportacao_falhou exportacao=${pedido.id} erro=${e instanceof Error ? e.name : 'erro'}`);
      await this.n.banco.noTenant(t.tenant_id, async (tx) => {
        await tx.execute(sql`UPDATE exportacao SET status = 'falhou', chave_storage = NULL WHERE id = ${pedido.id} AND status = 'em_andamento'`);
        await tx.execute(sql`UPDATE tarefa_exportacao SET situacao = 'falhou' WHERE id = ${t.id}`);
        await this.n.auditar(tx, sistema(t.tenant_id), 'EXPORTACAO_FALHOU', 'Exportacao', pedido.id);
      });
    }
  }

  /** Formato longo (RN-051): aplicações concluídas com assinatura, dos projetos e do período. */
  private async gerar(tx: Executor, p: Pedido): Promise<{ arquivo: Buffer; aplicacoes: number; total: number }> {
    const aplicacoes = await linhas<{ id: string; data_aplicacao: string; versao_id: string; nome: string | null; cpf_cifrado: string | null }>(
      tx,
      sql`SELECT a.id, to_char(a.data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao, a.versao_id, r.nome, r.cpf_cifrado
            FROM aplicacao a LEFT JOIN respondente r ON r.id = a.respondente_id
           WHERE a.projeto_id = ANY(${arrayUuid(p.projeto_ids)}::uuid[]) AND a.estado = 'concluida'
             AND (a.assinatura = 'presente' OR EXISTS (SELECT 1 FROM versao v WHERE v.id = a.versao_id AND v.papel_antigo)) -- DEC-172
             AND (${p.periodo_de}::date IS NULL OR a.data_aplicacao BETWEEN ${p.periodo_de}::date AND ${p.periodo_ate}::date)
           ORDER BY a.data_aplicacao, a.id`,
    );
    const opcoesDaVersao = new Map<string, Map<string, { codigo: string; rotulo: string }[]>>();
    const todas: Celula[][] = [];
    for (const a of aplicacoes) {
      let opcoes = opcoesDaVersao.get(a.versao_id);
      if (!opcoes) {
        const os = await linhas<{ pergunta_id: string; codigo: string; rotulo: string }>(
          tx,
          sql`SELECT o.pergunta_id, o.codigo, o.rotulo FROM opcao o JOIN pergunta p ON p.id = o.pergunta_id
               WHERE p.versao_id = ${a.versao_id} ORDER BY o.pergunta_id, o.ordem`,
        );
        opcoes = new Map();
        for (const o of os) opcoes.set(o.pergunta_id, [...(opcoes.get(o.pergunta_id) ?? []), { codigo: o.codigo, rotulo: o.rotulo }]);
        opcoesDaVersao.set(a.versao_id, opcoes);
      }
      // Ordem da versão: página, ordem da pergunta e linha da matriz (carregarItens já ordena a linha).
      const naoConsta = new Set(
        (await linhas<{ id: string }>(tx, sql`SELECT id FROM pergunta WHERE versao_id = ${a.versao_id} AND nao_consta`)).map((x) => x.id),
      );
      const itens = (await carregarItens(this.n, tx, a.id))
        .map((i, k) => ({ i, k }))
        .sort((x, y) => x.i.pagina - y.i.pagina || x.i.ordem - y.i.ordem || x.k - y.k)
        .map(({ i }) => ({ ...i, nao_consta: naoConsta.has(i.pergunta_id) }));
      // Arquivo da folha de formulário de cada página, a primeira na ordem do envio (DEC-201).
      const arquivos = new Map<number, string>();
      const folhas = await linhas<{ numero_pagina: number; nome_arquivo: string }>(
        tx,
        sql`SELECT numero_pagina, nome_arquivo FROM pagina_aplicacao
             WHERE aplicacao_id = ${a.id} AND tipo = 'formulario' AND numero_pagina IS NOT NULL AND expurgada_em IS NULL AND nome_arquivo IS NOT NULL
             ORDER BY ordem_envio`,
      );
      for (const f of folhas) if (!arquivos.has(f.numero_pagina)) arquivos.set(f.numero_pagina, f.nome_arquivo);
      todas.push(...linhasDaAplicacao({ id: a.id, cpf: this.n.decifrar(a.cpf_cifrado) ?? '', nome: a.nome ?? '', data_aplicacao: a.data_aplicacao, itens, opcoes, arquivos }));
    }
    const arquivo = p.formato === 'csv' ? gerarCsv(COLUNAS, todas) : gerarXlsx(COLUNAS, todas, this.n.agora());
    return { arquivo, aplicacoes: aplicacoes.length, total: todas.length };
  }

  /** Apaga os arquivos com `expira_em` vencido e grava `chave_storage` NULL (DEC-069). */
  private async apagarVencidos(): Promise<void> {
    const agora = this.n.agora();
    const vencidas = await this.n.banco.manutencao((tx) =>
      linhas<{ id: string; tenant_id: string; chave_storage: string }>(
        tx,
        sql`SELECT id, tenant_id, chave_storage FROM exportacao WHERE chave_storage IS NOT NULL AND expira_em <= ${agora}`,
      ),
    );
    for (const v of vencidas) {
      try {
        await this.n.config.armazenamento.apagar(v.chave_storage);
      } catch (e) {
        // Fica para o próximo ciclo; o link já não é mais servido depois de expira_em.
        this.n.log(`exportacao_expurgo_erro exportacao=${v.id} erro=${e instanceof Error ? e.name : 'erro'}`);
        continue;
      }
      await this.n.banco.noTenant(v.tenant_id, (tx) => tx.execute(sql`UPDATE exportacao SET chave_storage = NULL WHERE id = ${v.id}`));
      this.n.log(`exportacao_expurgada exportacao=${v.id}`);
    }
  }
}

/** Corre `fn` com prazo em tempo real; passou, rejeita (REQ §6.6). */
async function comPrazo<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const prazo = new Promise<never>((_, falhar) => {
    timer = setTimeout(() => falhar(new Error('TempoEsgotado')), ms);
  });
  try {
    return await Promise.race([fn(), prazo]);
  } finally {
    clearTimeout(timer);
  }
}
