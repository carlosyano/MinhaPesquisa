// RF-003: projetos e ciclo de vida (CA-027, DEC-027, RN-004). Sem grupo mínimo desde o IMP-005 (DEC-110).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { etag, projetoNoEscopo, type LinhaProjeto } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi } from '../infra/erros.js';
import { Nucleo, type SessaoAtiva } from '../nucleo.js';
import { paginacao } from '../regras/autorizacao.js';

interface ProjetoCriar {
  nome: string;
  descricao?: string;
}

type ProjetoAtualizar = Partial<ProjetoCriar>;

@Controller('projects')
export class ProjetosController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private corpo(p: LinhaProjeto) {
    return { id: p.id, nome: p.nome, descricao: p.descricao, status: p.status, criado_em: new Date(p.criado_em).toISOString() };
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
        sql`SELECT id, nome, descricao, status, criado_em, versao FROM projeto
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
    const r = await this.n.comAtor(s, async (tx) => {
      const feito = await this.n.idempotente(tx, s, 'createProject', chave, corpo, async () => {
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO projeto (id, tenant_id, nome, descricao, status, criado_em)
          VALUES (${id}, ${s.tenantId}, ${corpo.nome}, ${corpo.descricao ?? null}, 'ativo', ${this.n.agora()})`);
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
      await tx.execute(sql`
        UPDATE projeto SET nome = ${corpo.nome ?? atual.nome},
                           descricao = ${corpo.descricao === undefined ? atual.descricao : corpo.descricao},
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
