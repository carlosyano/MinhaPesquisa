// RF-012: exportação em formato longo (CA-021, CA-050, CA-051; RN-051, PLANO §4.9, DEC-163 a
// DEC-166). O pedido só grava a Exportacao `enfileirada` e a tarefa; o arquivo é do worker
// (exportacao/worker.ts). No IMP-007 só existe o escopo `linha_por_item` (DEC-164).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { projetoNoEscopo } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao } from '../http.js';
import { linha, sql, type Executor } from '../infra/banco.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { MINUTO, somar } from '../infra/relogio.js';
import { ehUuid, Nucleo } from '../nucleo.js';
import { arrayUuid } from '../regras/exportacao.js';

interface LinhaExportacao {
  id: string;
  status: string;
  criado_em: Date;
  chave_storage: string | null;
  expira_em: Date | null;
}

interface PedidoExportacao {
  formato: 'csv' | 'xlsx';
  escopo: string;
  projeto_ids: string[];
  filtros?: unknown[];
  periodo?: { de: string; ate: string };
  rotulos?: string;
}

/** Validade do link do arquivo, igual à das imagens (DEC-113, RNF-007). */
const VALIDADE_LINK = 5 * MINUTO;

@Controller()
export class ExportacaoController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private async exportacao(tx: Executor, id: string): Promise<LinhaExportacao> {
    if (!ehUuid(id)) throw naoEncontrado('Exportacao', null);
    const e = await linha<LinhaExportacao>(tx, sql`SELECT id, status, criado_em, chave_storage, expira_em FROM exportacao WHERE id = ${id}`);
    if (!e) throw naoEncontrado('Exportacao', id);
    return e;
  }

  /** ExportStatus: o link só com `concluida`, o arquivo ainda guardado e antes de `expira_em` (DEC-069). */
  private async corpo(e: LinhaExportacao) {
    const agora = this.n.agora();
    const expira = e.expira_em ? new Date(e.expira_em) : null;
    const disponivel = e.status === 'concluida' && e.chave_storage !== null && expira !== null && expira > agora;
    return {
      id: e.id,
      status: e.status,
      criado_em: new Date(e.criado_em).toISOString(),
      url_download: disponivel ? await this.n.config.armazenamento.urlAssinada(e.chave_storage!, somar(agora, VALIDADE_LINK)) : null,
      expira_em: expira ? expira.toISOString() : null,
    };
  }

  @Post('exports')
  @HttpCode(202)
  async exportData(@Body() corpo: unknown, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const campos = this.n.contrato.validarCorpo('exportData', corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
    const p = corpo as PedidoExportacao;
    // Agregado e linha a linha chegam com o IMP-004 (DEC-164); os filtros do dashboard também (DEC-163).
    if (p.escopo !== 'linha_por_item') throw new ErroApi('ERR-001', { campos: ['escopo'] });
    if (p.filtros !== undefined) throw new ErroApi('ERR-001', { campos: ['filtros'] });
    if (p.periodo && p.periodo.de > p.periodo.ate) throw new ErroApi('ERR-001', { campos: ['periodo'] });
    return this.n.comAtor(s, async (tx) => {
      for (const id of p.projeto_ids) await projetoNoEscopo(tx, id);
      const feito = await this.n.idempotente(tx, s, 'exportData', chave, corpo, async () => {
        const id = this.n.id();
        const agora = this.n.agora();
        await tx.execute(sql`
          INSERT INTO exportacao (id, tenant_id, usuario_id, projeto_ids, formato, escopo, periodo_de, periodo_ate, criado_em)
          VALUES (${id}, ${s.tenantId}, ${s.usuarioId}, ${arrayUuid(p.projeto_ids)}::uuid[], ${p.formato}, ${p.escopo},
                  ${p.periodo?.de ?? null}::date, ${p.periodo?.ate ?? null}::date, ${agora})`);
        await tx.execute(sql`
          INSERT INTO tarefa_exportacao (id, tenant_id, exportacao_id, executar_em, criada_em)
          VALUES (${this.n.id()}, ${s.tenantId}, ${id}, ${agora}, ${agora})`);
        // Vale como o registro da exibição completa do CPF (DEC-072); sem valores (RN-028).
        await this.n.auditar(tx, s, 'EXPORTAR_DADOS', 'Exportacao', id, {
          escopo: p.escopo,
          formato: p.formato,
          projetos: p.projeto_ids,
          ...(p.periodo ? { periodo: p.periodo } : {}),
        });
        return { status: 202, recursoId: id };
      });
      return this.corpo(await this.exportacao(tx, feito.recursoId));
    });
  }

  @Get('exports/:exportId')
  async getExport(@Param('exportId') id: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.comAtor(s, async (tx) => this.corpo(await this.exportacao(tx, id)));
  }
}
