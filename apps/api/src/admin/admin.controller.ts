// RF-001: usuários, perfis, vínculos a projetos e concessões de acesso individual
// (CA-012, CA-016, CA-025, CA-035, CA-037b, CA-038; RN-003, RN-004; DEC-031, DEC-060, DEC-080).
// Ordem de autorização (PLANO §6.1): fora de escopo → 404 auditado; sem perfil → 403.

import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { NUCLEO } from '../auth/auth.controller.js';
import { exigirCsrf, exigirSessao, type Req as Requisicao, type Res as Resposta } from '../http.js';
import { linha, linhas, sql, type Executor } from '../infra/banco.js';
import { normalizarEmail, SENHA_INDEFINIDA } from '../infra/cripto.js';
import { ErroApi, naoEncontrado } from '../infra/erros.js';
import { DIA, somar } from '../infra/relogio.js';
import { ehUuid, Nucleo, type Perfil, type SessaoAtiva } from '../nucleo.js';

const VALIDADE_CONCESSAO = 90 * DIA; // DEC-031

interface UsuarioCriar {
  email: string;
  nome: string;
  perfis: Perfil[];
  todos_projetos?: boolean;
  projetos?: string[];
}

interface UsuarioAtualizar {
  nome?: string;
  perfis?: Perfil[];
  todos_projetos?: boolean;
  projetos?: string[];
  ativo?: boolean;
}

interface LinhaUsuario {
  id: string;
  email: string;
  nome: string;
  todos_projetos: boolean;
  mfa_ativo: boolean;
  situacao: 'pendente_convite' | 'ativo' | 'inativo';
  criado_em: Date;
  versao: number;
}

const etag = (versao: number) => `"${versao}"`;

function codigoPg(e: unknown): string | undefined {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}

function pagina(q: Record<string, string | undefined>): { pagina: number; limite: number } {
  const p = q.pagina === undefined ? 1 : Number(q.pagina);
  const l = q.limite === undefined ? 20 : Number(q.limite);
  if (!Number.isInteger(p) || p < 1) throw new ErroApi('ERR-001', { campos: ['pagina'] });
  if (!Number.isInteger(l) || l < 1 || l > 100) throw new ErroApi('ERR-001', { campos: ['limite'] });
  return { pagina: p, limite: l };
}

@Controller('admin')
export class AdminController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  private exigirAdmin(s: SessaoAtiva): void {
    if (!s.perfis.includes('admin_tenant')) throw new ErroApi('ERR-016');
  }

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private async linhaUsuario(tx: Executor, id: string, bloquear = false): Promise<LinhaUsuario> {
    if (!ehUuid(id)) throw naoEncontrado('Usuario', null);
    const u = await linha<LinhaUsuario>(
      tx,
      bloquear
        ? sql`SELECT id, email, nome, todos_projetos, mfa_ativo, situacao, criado_em, versao FROM usuario WHERE id = ${id} FOR UPDATE`
        : sql`SELECT id, email, nome, todos_projetos, mfa_ativo, situacao, criado_em, versao FROM usuario WHERE id = ${id}`,
    );
    if (!u) throw naoEncontrado('Usuario', id);
    return u;
  }

  private async usuario(tx: Executor, u: LinhaUsuario) {
    return {
      id: u.id,
      email: u.email,
      nome: u.nome,
      perfis: await this.n.perfisDe(tx, u.id),
      todos_projetos: u.todos_projetos,
      projetos: await this.n.projetosDe(tx, u.id),
      mfa_ativo: u.mfa_ativo,
      situacao: u.situacao,
      criado_em: new Date(u.criado_em).toISOString(),
    };
  }

  /** Projetos informados no corpo precisam ser do tenant (RLS); senão 404 auditado (§5.2). */
  private async exigirProjetos(tx: Executor, ids: string[] | undefined): Promise<void> {
    if (!ids?.length) return;
    const achados = await linhas<{ id: string }>(
      tx,
      sql`SELECT id FROM projeto WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb)::uuid)`,
    );
    const faltante = ids.find((id) => !achados.some((a) => a.id === id));
    if (faltante) throw naoEncontrado('Projeto', faltante);
  }

  private async gravarPerfis(tx: Executor, s: SessaoAtiva, usuarioId: string, perfis: Perfil[]): Promise<void> {
    await tx.execute(sql`DELETE FROM usuario_perfil WHERE usuario_id = ${usuarioId}`);
    for (const codigo of perfis) {
      await tx.execute(sql`
        INSERT INTO usuario_perfil (id, tenant_id, usuario_id, perfil_id, criado_em, criado_por)
        SELECT ${this.n.id()}, ${s.tenantId}, ${usuarioId}, p.id, ${this.n.agora()}, ${s.usuarioId}
          FROM perfil p WHERE p.codigo = ${codigo}`);
    }
  }

  private async gravarVinculos(tx: Executor, s: SessaoAtiva, usuarioId: string, projetos: string[]): Promise<void> {
    await tx.execute(sql`DELETE FROM vinculo_usuario_projeto WHERE usuario_id = ${usuarioId}`);
    for (const projetoId of projetos) {
      await tx.execute(sql`
        INSERT INTO vinculo_usuario_projeto (id, tenant_id, usuario_id, projeto_id, criado_em, criado_por)
        VALUES (${this.n.id()}, ${s.tenantId}, ${usuarioId}, ${projetoId}, ${this.n.agora()}, ${s.usuarioId})`);
    }
  }

  // ───────────────────────────── usuários ─────────────────────────────

  @Get('users')
  async listUsers(@Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    this.exigirAdmin(s);
    const { pagina: p, limite } = pagina(q);
    return this.n.comAtor(s, async (tx) => {
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM usuario`))!.n;
      const us = await linhas<LinhaUsuario>(
        tx,
        sql`SELECT id, email, nome, todos_projetos, mfa_ativo, situacao, criado_em, versao FROM usuario
             ORDER BY criado_em, id LIMIT ${limite} OFFSET ${(p - 1) * limite}`,
      );
      const itens = [];
      for (const u of us) itens.push(await this.usuario(tx, u));
      return { itens, meta: { pagina: p, limite, total } };
    });
  }

  @Post('users')
  @HttpCode(201)
  async createTenantUser(
    @Body() corpo: UsuarioCriar,
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.exigirAdmin(s);
    this.validar('createTenantUser', corpo);

    const r = await this.n.comAtor(s, async (tx) => {
      const feito = await this.n.idempotente(tx, s, 'createTenantUser', chave, corpo, async () => {
        await this.exigirProjetos(tx, corpo.projetos);
        const id = this.n.id();
        const todos = corpo.todos_projetos ?? !corpo.projetos?.length;
        try {
          await tx.execute(sql`
            INSERT INTO usuario (id, tenant_id, email, nome, senha_hash, situacao, todos_projetos, criado_em)
            VALUES (${id}, ${s.tenantId}, ${normalizarEmail(corpo.email)}, ${corpo.nome}, ${SENHA_INDEFINIDA},
                    'pendente_convite', ${todos}, ${this.n.agora()})`);
        } catch (e) {
          // E-mail único global (DEC-054): mesma resposta para qualquer tenant (DEC-065).
          if (codigoPg(e) === '23505') throw new ErroApi('ERR-023', { auditar: { acao: 'EMAIL_INDISPONIVEL', entidade: 'Usuario' } });
          throw e;
        }
        await this.gravarPerfis(tx, s, id, corpo.perfis);
        if (!todos) await this.gravarVinculos(tx, s, id, corpo.projetos ?? []);
        await this.n.criarTokenComEmail(tx, s.tenantId, id, 'convite');
        await this.n.auditar(tx, s, 'CRIAR_USUARIO', 'Usuario', id, { perfis: corpo.perfis });
        return { status: 201, recursoId: id };
      });
      const u = await this.linhaUsuario(tx, feito.recursoId);
      return { u, corpo: await this.usuario(tx, u) };
    });
    await this.n.despacharOutbox();
    res.header('ETag', etag(r.u.versao));
    return r.corpo;
  }

  @Get('users/:userId')
  async getUser(@Param('userId') id: string, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    const r = await this.n.comAtor(s, async (tx) => {
      const u = await this.linhaUsuario(tx, id);
      this.exigirAdmin(s);
      return { u, corpo: await this.usuario(tx, u) };
    });
    res.header('ETag', etag(r.u.versao));
    return r.corpo;
  }

  @Patch('users/:userId')
  async updateUser(
    @Param('userId') id: string,
    @Body() corpo: UsuarioAtualizar,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: Requisicao,
    @Res({ passthrough: true }) res: Resposta,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('updateUser', corpo);

    const r = await this.n.comAtor(s, async (tx) => {
      const atual = await this.linhaUsuario(tx, id, true);
      this.exigirAdmin(s);
      if (!ifMatch) throw new ErroApi('ERR-001', { campos: ['If-Match'] });
      if (ifMatch !== etag(atual.versao)) throw new ErroApi('ERR-017');
      await this.exigirProjetos(tx, corpo.projetos);

      let situacao = atual.situacao;
      if (corpo.ativo !== undefined) {
        if (atual.situacao === 'pendente_convite') throw new ErroApi('ERR-018');
        situacao = corpo.ativo ? 'ativo' : 'inativo';
      }
      const perfisAtuais = await this.n.perfisDe(tx, id);
      const perfis = corpo.perfis ?? perfisAtuais;

      // Não deixa o tenant sem administrador ativo (RF-001).
      const eraAdminAtivo = atual.situacao === 'ativo' && perfisAtuais.includes('admin_tenant');
      const seguiraAdminAtivo = situacao === 'ativo' && perfis.includes('admin_tenant');
      if (eraAdminAtivo && !seguiraAdminAtivo) {
        const outros = await linha<{ n: number }>(
          tx,
          sql`SELECT count(*)::int AS n FROM usuario u
               WHERE u.id <> ${id} AND u.situacao = 'ativo'
                 AND EXISTS (SELECT 1 FROM usuario_perfil up JOIN perfil p ON p.id = up.perfil_id
                              WHERE up.usuario_id = u.id AND p.codigo = 'admin_tenant')`,
        );
        if (!outros?.n) throw new ErroApi('ERR-018');
      }

      const todos = corpo.todos_projetos ?? (corpo.projetos ? false : atual.todos_projetos);
      await tx.execute(sql`
        UPDATE usuario SET nome = ${corpo.nome ?? atual.nome}, situacao = ${situacao}, todos_projetos = ${todos},
                           versao = versao + 1
         WHERE id = ${id}`);
      if (corpo.perfis) await this.gravarPerfis(tx, s, id, corpo.perfis);
      if (corpo.projetos || corpo.todos_projetos !== undefined) {
        await this.gravarVinculos(tx, s, id, todos ? [] : (corpo.projetos ?? []));
      }
      if (situacao === 'inativo' && atual.situacao !== 'inativo') {
        await this.n.revogarSessoes(tx, id, 'usuario_desativado'); // efeito imediato
      }
      await this.n.auditar(tx, s, 'ATUALIZAR_USUARIO', 'Usuario', id, { campos: Object.keys(corpo).sort() });
      const u = await this.linhaUsuario(tx, id);
      return { u, corpo: await this.usuario(tx, u) };
    });
    res.header('ETag', etag(r.u.versao));
    return r.corpo;
  }

  @Post('users/:userId/invite')
  @HttpCode(202)
  async inviteUser(@Param('userId') id: string, @Headers('idempotency-key') chave: string | undefined, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    await this.n.comAtor(s, async (tx) => {
      const u = await this.linhaUsuario(tx, id, true);
      this.exigirAdmin(s);
      await this.n.idempotente(tx, s, 'inviteUser', chave, { id }, async () => {
        if (u.situacao !== 'pendente_convite') throw new ErroApi('ERR-018');
        await this.n.invalidarTokens(tx, id, 'convite');
        await this.n.criarTokenComEmail(tx, s.tenantId, id, 'convite');
        await this.n.auditar(tx, s, 'REENVIAR_CONVITE', 'Usuario', id);
        return { status: 202, recursoId: id };
      });
    });
    await this.n.despacharOutbox();
    return { mensagem: 'Convite enviado' };
  }

  @Post('users/:userId/mfa-reset')
  @HttpCode(204)
  async resetMfa(@Param('userId') id: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    await this.n.comAtor(s, async (tx) => {
      await this.linhaUsuario(tx, id, true);
      this.exigirAdmin(s);
      // PLANO §4.5: segredo apagado, sessões encerradas, links anteriores invalidados.
      await tx.execute(sql`
        UPDATE usuario SET mfa_ativo = false, mfa_secret = NULL, mfa_ultimo_passo = NULL, versao = versao + 1 WHERE id = ${id}`);
      await this.n.revogarSessoes(tx, id, 'reset_mfa');
      await this.n.invalidarTokens(tx, id, 'reset_mfa');
      await this.n.criarTokenComEmail(tx, s.tenantId, id, 'reset_mfa');
      await this.n.auditar(tx, s, 'RESET_MFA', 'Usuario', id);
    });
    await this.n.despacharOutbox();
  }

  // ─────────────────────── concessões de acesso individual ───────────────────────

  private concessao(g: { id: string; usuario_id: string; projeto_id: string; concedido_em: Date; valido_ate: Date; revogado_em: Date | null; vigente: boolean }) {
    return {
      id: g.id,
      usuario_id: g.usuario_id,
      projeto_id: g.projeto_id,
      concedido_em: new Date(g.concedido_em).toISOString(),
      valido_ate: new Date(g.valido_ate).toISOString(),
      revogado_em: g.revogado_em ? new Date(g.revogado_em).toISOString() : null,
      vigente: g.vigente,
    };
  }

  /** Vigente = ativa e dentro do prazo; nunca depende só do job de expiração (ENT-015). */
  private consultaConcessoes(onde: ReturnType<typeof sql>) {
    return sql`SELECT id, usuario_id, projeto_id, concedido_em, valido_ate, revogado_em,
                      (ativo AND revogado_em IS NULL AND valido_ate > ${this.n.agora()}) AS vigente
                 FROM concessao_acesso_individual WHERE ${onde}`;
  }

  @Get('individual-access-grants')
  async listIndividualAccessGrants(@Query() q: Record<string, string | undefined>, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    this.exigirAdmin(s);
    const { pagina: p, limite } = pagina(q);
    if (q.somente_vigentes !== undefined && !['true', 'false'].includes(q.somente_vigentes)) {
      throw new ErroApi('ERR-001', { campos: ['somente_vigentes'] });
    }
    const soVigentes = q.somente_vigentes !== 'false';
    const agora = this.n.agora();
    const filtro = soVigentes ? sql`ativo AND revogado_em IS NULL AND valido_ate > ${agora}` : sql`true`;
    return this.n.comAtor(s, async (tx) => {
      const total = (await linha<{ n: number }>(tx, sql`SELECT count(*)::int AS n FROM concessao_acesso_individual WHERE ${filtro}`))!.n;
      const gs = await linhas<Parameters<AdminController['concessao']>[0]>(
        tx,
        sql`${this.consultaConcessoes(filtro)} ORDER BY concedido_em DESC, id LIMIT ${limite} OFFSET ${(p - 1) * limite}`,
      );
      return { itens: gs.map((g) => this.concessao(g)), meta: { pagina: p, limite, total } };
    });
  }

  @Post('individual-access-grants')
  @HttpCode(201)
  async grantIndividualAccess(
    @Body() corpo: { usuario_id: string; projeto_id: string; justificativa: string },
    @Headers('idempotency-key') chave: string | undefined,
    @Req() req: Requisicao,
  ) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.exigirAdmin(s);
    this.validar('grantIndividualAccess', corpo);
    return this.n.comAtor(s, async (tx) => {
      const feito = await this.n.idempotente(tx, s, 'grantIndividualAccess', chave, corpo, async () => {
        await this.linhaUsuario(tx, corpo.usuario_id, true);
        await this.exigirProjetos(tx, [corpo.projeto_id]);
        // DEC-060, DEC-080, Q-030: só para quem tem o perfil analista_individual.
        if (!(await this.n.perfisDe(tx, corpo.usuario_id)).includes('analista_individual')) throw new ErroApi('ERR-018');
        const agora = this.n.agora();
        // Expiradas deixam de ocupar o par antes de checar a vigente (job só mantém o flag).
        await tx.execute(sql`
          UPDATE concessao_acesso_individual SET ativo = false
           WHERE usuario_id = ${corpo.usuario_id} AND projeto_id = ${corpo.projeto_id} AND ativo AND valido_ate <= ${agora}`);
        const vigente = await linha(
          tx,
          sql`SELECT 1 FROM concessao_acesso_individual
               WHERE usuario_id = ${corpo.usuario_id} AND projeto_id = ${corpo.projeto_id} AND ativo`,
        );
        if (vigente) throw new ErroApi('ERR-018');
        const id = this.n.id();
        await tx.execute(sql`
          INSERT INTO concessao_acesso_individual (id, tenant_id, usuario_id, projeto_id, justificativa, concedido_em, valido_ate, criado_por)
          VALUES (${id}, ${s.tenantId}, ${corpo.usuario_id}, ${corpo.projeto_id}, ${corpo.justificativa}, ${agora},
                  ${somar(agora, VALIDADE_CONCESSAO)}, ${s.usuarioId})`);
        await this.n.auditar(tx, s, 'CONCEDER_ACESSO_INDIVIDUAL', 'ConcessaoAcessoIndividual', id, { projeto_id: corpo.projeto_id });
        return { status: 201, recursoId: id };
      });
      const g = await linha<Parameters<AdminController['concessao']>[0]>(tx, this.consultaConcessoes(sql`id = ${feito.recursoId}`));
      return this.concessao(g!);
    });
  }

  @Delete('individual-access-grants/:grantId')
  @HttpCode(204)
  async revokeAccess(@Param('grantId') id: string, @Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    await this.n.comAtor(s, async (tx) => {
      if (!ehUuid(id)) throw naoEncontrado('ConcessaoAcessoIndividual', null);
      const g = await linha<{ usuario_id: string; ativo: boolean }>(
        tx,
        sql`SELECT usuario_id, ativo FROM concessao_acesso_individual WHERE id = ${id} FOR UPDATE`,
      );
      if (!g) throw naoEncontrado('ConcessaoAcessoIndividual', id);
      this.exigirAdmin(s);
      const agora = this.n.agora();
      await tx.execute(sql`
        UPDATE concessao_acesso_individual SET ativo = false, revogado_em = coalesce(revogado_em, ${agora}),
               revogado_por = coalesce(revogado_por, ${s.usuarioId})
         WHERE id = ${id}`);
      await this.n.revogarSessoes(tx, g.usuario_id, 'acesso_revogado'); // efeito imediato (CA-038)
      await this.n.auditar(tx, s, 'REVOGAR_ACESSO_INDIVIDUAL', 'ConcessaoAcessoIndividual', id);
    });
  }
}
