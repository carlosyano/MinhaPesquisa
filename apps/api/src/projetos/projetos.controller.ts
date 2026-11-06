// RF-003: projetos e ciclo de vida (CA-027, DEC-027, RN-004). Sem grupo mínimo desde o IMP-005 (DEC-110).
// Desde o IMP-006, os dados do ciclo de coleta (DEC-137, CA-049): o nome do coordenador é dado
// pessoal e não entra em auditoria nem em log (RN-027, RN-028).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { COLUNAS_PROJETO, etag, projetoNoEscopo, type LinhaProjeto } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi } from '../infra/erros.js';
import { Nucleo, type SessaoAtiva } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';

interface ProjetoCriar {
  nome: string;
  descricao?: string;
  objetivo?: string | null;
  coordenador?: string | null;
  coleta_inicio?: string | null;
  coleta_fim?: string | null;
}

type ProjetoAtualizar = Partial<ProjetoCriar>;

/** `coleta_fim` antes de `coleta_inicio`, depois de aplicada a alteração → ERR-001 (DEC-137). */
function conferirColeta(inicio: string | null, fim: string | null): void {
  if (inicio && fim && fim < inicio) throw new ErroApi('ERR-001', { campos: ['coleta_fim'] });
}

@Controller('projects')
export class ProjetosController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private corpo(p: LinhaProjeto) {
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      objetivo: p.objetivo,
      coordenador: p.coordenador,
      coleta_inicio: p.coleta_inicio,
      coleta_fim: p.coleta_fim,
      status: p.status,
      criado_em: new Date(p.criado_em).toISOString(),
      // Padrão do próximo envio de papel antigo, só leitura (DEC-179, DEC-192).
      padrao_data_aplicacao: p.padrao_data_aplicacao,
      padrao_local_aplicacao: this.n.decifrar(p.padrao_local_aplicacao),
    };
  }

  private async historico(tx: Executor, s: SessaoAtiva, projetoId: string, anterior: string | null, novo: string): Promise<void> {
    await tx.execute(sql`
      INSERT INTO historico_status_projeto (id, tenant_id, projeto_id, status_anterior, status_novo, alterado_em, alterado_por)
      VALUES (${this.n.id()}, ${s.tenantId}, ${projetoId}, ${anterior}, ${novo}, ${this.n.agora()}, ${s.usuarioId})`);
  }

  @Get()
  async listProjects(@Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    const { pagina, limite } = paginacao(q);
    return this.n.comAtor(s, async (tx) => {
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM projeto`))!.n;
      const ps = await linhas<LinhaProjeto>(
        tx,
        sql`SELECT ${COLUNAS_PROJETO} FROM projeto
             ORDER BY criado_em, id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      );
      return { itens: ps.map((p) => this.corpo(p)), meta: { pagina, limite, total } };
    });
  }

  @Post()
  @HttpCode(201)
  async createProject(
    @Body() corpo: ProjetoCriar,
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('createProject', corpo);
    conferirColeta(corpo.coleta_inicio ?? null, corpo.coleta_fim ?? null);
    const r = await this.n.comAtor(s, async (tx) => {
      const feito = await this.n.idempotente(tx, s, 'createProject', chave, corpo, async () => {
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO projeto (id, tenant_id, nome, descricao, objetivo, coordenador, coleta_inicio, coleta_fim, status, criado_em)
          VALUES (${id}, ${s.tenantId}, ${corpo.nome}, ${corpo.descricao ?? null}, ${corpo.objetivo ?? null}, ${corpo.coordenador ?? null},
                  ${corpo.coleta_inicio ?? null}::date, ${corpo.coleta_fim ?? null}::date, 'ativo', ${this.n.agora()})`);
        await this.historico(tx, s, id, null, 'ativo');
        await this.n.auditar(tx, s, 'CRIAR_PROJETO', 'Projeto', id);
        return { status: 201, recursoId: id };
      });
      const p = await projetoNoEscopo(tx, feito.recursoId);
      return { p, corpo: this.corpo(p) };
    });
    res.header('ETag', etag(r.p.versao));
    return r.corpo;
  }

  @Get(':projectId')
  async getProject(@Param('projectId') id: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const p = await projetoNoEscopo(tx, id);
      return { p, corpo: this.corpo(p) };
    });
    res.header('ETag', etag(r.p.versao));
    return r.corpo;
  }

  @Patch(':projectId')
  async updateProject(
    @Param('projectId') id: string,
    @Body() corpo: ProjetoAtualizar,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const atual = await projetoNoEscopo(tx, id, true);
      this.validar('updateProject', corpo);
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      if (ifMatch !== etag(atual.versao)) throw new ErroApi('ERR-017');
      const valor = <K extends keyof ProjetoAtualizar & keyof LinhaProjeto>(k: K) => (corpo[k] === undefined ? atual[k] : corpo[k]);
      const inicio = valor('coleta_inicio');
      const fim = valor('coleta_fim');
      conferirColeta(inicio, fim);
      await tx.execute(sql`
        UPDATE projeto SET nome = ${corpo.nome ?? atual.nome}, descricao = ${valor('descricao')}, objetivo = ${valor('objetivo')},
                           coordenador = ${valor('coordenador')}, coleta_inicio = ${inicio}::date, coleta_fim = ${fim}::date,
                           versao = versao + 1
         WHERE id = ${id}`);
      const campos = Object.keys(corpo);
      await this.n.auditar(tx, s, 'ALTERAR_PROJETO', 'Projeto', id, { campos });
      const p = await projetoNoEscopo(tx, id);
      return { p, corpo: this.corpo(p) };
    });
    res.header('ETag', etag(r.p.versao));
    return r.corpo;
  }

  private async mudarStatus(req: Requisicao, id: string, de: 'ativo' | 'arquivado', para: 'ativo' | 'arquivado', acao: string) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const atual = await projetoNoEscopo(tx, id, true);
      if (atual.status !== de) throw new ErroApi('ERR-018');
      await tx.execute(sql`UPDATE projeto SET status = ${para}, versao = versao + 1 WHERE id = ${id}`);
      await this.historico(tx, s, id, de, para);
      await this.n.auditar(tx, s, acao, 'Projeto', id);
      return this.corpo(await projetoNoEscopo(tx, id));
    });
  }

  @Post(':projectId/archive')
  @HttpCode(200)
  archiveProject(@Param('projectId') id: string, @Req() req: Requisicao) {
    return this.mudarStatus(req, id, 'ativo', 'arquivado', 'ARQUIVAR_PROJETO');
  }

  @Post(':projectId/unarchive')
  @HttpCode(200)
  unarchiveProject(@Param('projectId') id: string, @Req() req: Requisicao) {
    return this.mudarStatus(req, id, 'arquivado', 'ativo', 'REATIVAR_PROJETO');
  }
}
