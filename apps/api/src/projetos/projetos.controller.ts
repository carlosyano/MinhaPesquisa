// RF-003: projetos, grupo mínimo e ciclo de vida (CA-027, DEC-027, DEC-055, RN-004, RN-026).

import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { etag, parametro, projetoNoEscopo, type LinhaProjeto } from '../escopo.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { ErroApi } from '../infra/erros.js';
import { Nucleo, type SessaoAtiva } from '../nucleo.js';
import { exigirPerfil, paginacao } from '../regras/autorizacao.js';

interface ProjetoCriar {
  nome: string;
  descricao?: string;
  grupo_minimo?: number;
}

type ProjetoAtualizar = Partial<ProjetoCriar>;

@Controller('projects')
export class ProjetosController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private async corpo(tx: Executor, s: SessaoAtiva, p: LinhaProjeto) {
    return {
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      status: p.status,
      grupo_minimo: Number(await parametro(tx, 'grupo_minimo', s.tenantId, p.id)),
      criado_em: new Date(p.criado_em).toISOString(),
    };
  }

  private async gravarGrupoMinimo(tx: Executor, s: SessaoAtiva, projetoId: string, valor: number): Promise<void> {
    await tx.execute(sql`
      INSERT INTO parametro_configuracao (id, tenant_id, projeto_id, chave, valor, alterado_em, alterado_por)
      VALUES (${this.n.id()}, ${s.tenantId}, ${projetoId}, 'grupo_minimo', ${String(valor)}, ${this.n.agora()}, ${s.usuarioId})
      ON CONFLICT ON CONSTRAINT uq_parametro
      DO UPDATE SET valor = EXCLUDED.valor, alterado_em = EXCLUDED.alterado_em, alterado_por = EXCLUDED.alterado_por`);
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
      const filtro = sql`EXISTS (SELECT 1 FROM usuario u WHERE u.id = ${s.usuarioId}
                           AND (u.todos_projetos OR EXISTS (SELECT 1 FROM vinculo_usuario_projeto v
                                                             WHERE v.usuario_id = u.id AND v.projeto_id = p.id)))`;
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM projeto p WHERE ${filtro}`))!.n;
      const ps = await linhas<LinhaProjeto>(
        tx,
        sql`SELECT id, nome, descricao, status, criado_em, versao FROM projeto p WHERE ${filtro}
             ORDER BY criado_em, id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`,
      );
      const itens = [];
      for (const p of ps) itens.push(await this.corpo(tx, s, p));
      return { itens, meta: { pagina, limite, total } };
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
    exigirPerfil(s.perfis, 'admin_tenant');
    this.validar('createProject', corpo);
    const r = await this.n.comAtor(s, async (tx) => {
      const feito = await this.n.idempotente(tx, s, 'createProject', chave, corpo, async () => {
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO projeto (id, tenant_id, nome, descricao, status, criado_em)
          VALUES (${id}, ${s.tenantId}, ${corpo.nome}, ${corpo.descricao ?? null}, 'ativo', ${this.n.agora()})`);
        if (corpo.grupo_minimo !== undefined) await this.gravarGrupoMinimo(tx, s, id, corpo.grupo_minimo);
        await this.historico(tx, s, id, null, 'ativo');
        await this.n.auditar(tx, s, 'CRIAR_PROJETO', 'Projeto', id);
        return { status: 201, recursoId: id };
      });
      const p = await projetoNoEscopo(this.n, tx, s, feito.recursoId);
      return { p, corpo: await this.corpo(tx, s, p) };
    });
    res.header('ETag', etag(r.p.versao));
    return r.corpo;
  }

  @Get(':projectId')
  async getProject(@Param('projectId') id: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const p = await projetoNoEscopo(this.n, tx, s, id);
      return { p, corpo: await this.corpo(tx, s, p) };
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
      const atual = await projetoNoEscopo(this.n, tx, s, id, true);
      exigirPerfil(s.perfis, 'admin_tenant');
      this.validar('updateProject', corpo);
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      if (ifMatch !== etag(atual.versao)) throw new ErroApi('ERR-017');
      await tx.execute(sql`
        UPDATE projeto SET nome = ${corpo.nome ?? atual.nome},
                           descricao = ${corpo.descricao === undefined ? atual.descricao : corpo.descricao},
                           versao = versao + 1
         WHERE id = ${id}`);
      const campos = Object.keys(corpo);
      if (corpo.grupo_minimo !== undefined) await this.gravarGrupoMinimo(tx, s, id, corpo.grupo_minimo);
      await this.n.auditar(tx, s, 'ALTERAR_PROJETO', 'Projeto', id, { campos });
      const p = await projetoNoEscopo(this.n, tx, s, id);
      return { p, corpo: await this.corpo(tx, s, p) };
    });
    res.header('ETag', etag(r.p.versao));
    return r.corpo;
  }

  private async mudarStatus(req: Requisicao, id: string, de: 'ativo' | 'arquivado', para: 'ativo' | 'arquivado', acao: string) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    return this.n.comAtor(s, async (tx) => {
      const atual = await projetoNoEscopo(this.n, tx, s, id, true);
      exigirPerfil(s.perfis, 'admin_tenant');
      if (atual.status !== de) throw new ErroApi('ERR-018');
      await tx.execute(sql`UPDATE projeto SET status = ${para}, versao = versao + 1 WHERE id = ${id}`);
      await this.historico(tx, s, id, de, para);
      await this.n.auditar(tx, s, acao, 'Projeto', id);
      return this.corpo(tx, s, await projetoNoEscopo(this.n, tx, s, id));
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
