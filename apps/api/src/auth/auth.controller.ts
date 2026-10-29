// RF-002: login, MFA, sessão, convite, recuperação de senha e reset de MFA
// (CA-026, CA-026b, CA-035, CA-037, CA-037b; PLANO §4.5 e §4.6; DEC-050, DEC-082 a DEC-087).

import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  exigirCsrf,
  exigirPreSessao,
  exigirSessao,
  gravarPreSessao,
  gravarSessao,
  ipDe,
  limitarPublica,
  limparCookies,
  type PreSessao,
  type Req as Requisicao,
  type Res as Resposta,
} from '../http.js';
import { linha, sql, type Executor } from '../infra/banco.js';
import {
  cifrar,
  conferirSenha,
  conferirTotp,
  decifrar,
  hashSenha,
  hmacEmail,
  normalizarEmail,
  novoSegredoTotp,
  senhaAceita,
  sha256,
  uriOtpauth,
} from '../infra/cripto.js';
import { ErroApi } from '../infra/erros.js';
import { MAX_SESSOES, Nucleo, SESSAO_INATIVIDADE } from '../nucleo.js';

export const NUCLEO = Symbol('Nucleo');

interface Login {
  usuario_id: string;
  tenant_id: string;
  senha_hash: string;
  situacao: string;
  mfa_ativo: boolean;
  tenant_ativo: boolean;
}

interface Token {
  token_id: string;
  tenant_id: string;
  usuario_id: string;
  expira_em: Date;
  usado_em: Date | null;
}

interface UsuarioMfa {
  email: string;
  nome: string;
  situacao: string;
  mfa_ativo: boolean;
  mfa_secret: string | null;
  mfa_ultimo_passo: string | null;
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(NUCLEO) private readonly n: Nucleo) {}

  // ───────────────────────── falhas e bloqueio (DEC-087) ─────────────────────────

  private async exigirNaoBloqueado(email: string): Promise<void> {
    const ate = await this.n.banco.semTenant((ex) =>
      linha<{ b: Date | null }>(ex, sql`SELECT auth_falha_bloqueio(${hmacEmail(this.n.config.chaveHmacEmail, email)}, ${this.n.agora()}) AS b`),
    );
    if (ate?.b) {
      throw new ErroApi('ERR-014', { retryAfter: Math.max(1, Math.ceil((new Date(ate.b).getTime() - this.n.agora().getTime()) / 1000)) });
    }
  }

  private async registrarFalha(email: string): Promise<void> {
    await this.n.banco.semTenant((ex) =>
      ex.execute(sql`SELECT auth_falha_registrar(${hmacEmail(this.n.config.chaveHmacEmail, email)}, ${this.n.agora()}, ${this.n.id()})`),
    );
  }

  private async limparFalhas(email: string): Promise<void> {
    await this.n.banco.semTenant((ex) => ex.execute(sql`SELECT auth_falha_limpar(${hmacEmail(this.n.config.chaveHmacEmail, email)})`));
  }

  private validar(operacao: string, corpo: unknown): void {
    const campos = this.n.contrato.validarCorpo(operacao, corpo);
    if (campos) throw new ErroApi('ERR-001', { campos });
  }

  private exigirPoliticaSenha(senha: string, campo: string): void {
    if (!senhaAceita(senha)) throw new ErroApi('ERR-001', { campos: [campo] });
  }

  private async buscarToken(token: string, tipo: string): Promise<Token> {
    const t = await this.n.banco.semTenant((ex) =>
      linha<Token>(ex, sql`SELECT * FROM auth_buscar_token(${sha256(token)}, ${tipo})`),
    );
    if (!t || t.usado_em || new Date(t.expira_em) <= this.n.agora()) throw new ErroApi('ERR-011');
    return t;
  }

  private async usuarioMfa(tx: Executor, usuarioId: string, bloquear = false): Promise<UsuarioMfa> {
    const u = await linha<UsuarioMfa>(
      tx,
      bloquear
        ? sql`SELECT email, nome, situacao, mfa_ativo, mfa_secret, mfa_ultimo_passo FROM usuario WHERE id = ${usuarioId} FOR UPDATE`
        : sql`SELECT email, nome, situacao, mfa_ativo, mfa_secret, mfa_ultimo_passo FROM usuario WHERE id = ${usuarioId}`,
    );
    if (!u) throw new ErroApi('ERR-015');
    return u;
  }

  private async infoSessao(tx: Executor, usuarioId: string, nome: string, expira: Date) {
    return {
      usuario_id: usuarioId,
      nome,
      perfis: await this.n.perfisDe(tx, usuarioId),
      projetos: await this.n.projetosDe(tx, usuarioId),
      expira_em: expira.toISOString(),
    };
  }

  /** Cria a sessão plena ao fim do MFA, respeitando o limite de 3 sessões (ERR-021). */
  private async abrirSessaoPlena(tx: Executor, pre: PreSessao, nome: string) {
    if ((await this.n.contarSessoesPlenas(tx, pre.usuarioId)) >= MAX_SESSOES) throw new ErroApi('ERR-021');
    const { segredo } = await this.n.criarSessao(tx, { tenantId: pre.tenantId, usuarioId: pre.usuarioId, tipo: 'plena', ip: pre.ip });
    const expira = new Date(this.n.agora().getTime() + SESSAO_INATIVIDADE);
    return { segredo, info: await this.infoSessao(tx, pre.usuarioId, nome, expira) };
  }

  // ───────────────────────────── login ─────────────────────────────

  @Post('login')
  @HttpCode(200)
  async login(@Body() corpo: { email: string; senha: string }, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    limitarPublica(this.n, req);
    this.validar('login', corpo);
    const email = normalizarEmail(corpo.email);
    await this.exigirNaoBloqueado(email);

    const u = await this.n.banco.semTenant((ex) => linha<Login>(ex, sql`SELECT * FROM auth_buscar_login(${email})`));
    const senhaOk = await conferirSenha(u?.senha_hash, corpo.senha);
    // Mesma resposta para conta inexistente, senha errada, inativa, convite pendente,
    // MFA não cadastrado (DEC-082) e tenant inativo (DEC-070, DEC-083).
    if (!u || !senhaOk || u.situacao !== 'ativo' || !u.mfa_ativo || !u.tenant_ativo) {
      await this.registrarFalha(email);
      throw new ErroApi('ERR-013');
    }

    const { segredo } = await this.n.banco.noTenant(u.tenant_id, (tx) =>
      this.n.criarSessao(tx, { tenantId: u.tenant_id, usuarioId: u.usuario_id, tipo: 'pre_sessao', etapa: 'mfa_verificacao', ip: ipDe(req) }),
    );
    gravarPreSessao(this.n, res, segredo);
    return { etapa: 'mfa_verificacao' };
  }

  @Post('mfa/verify')
  @HttpCode(200)
  async verifyMfa(@Body() corpo: { codigo: string }, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const pre = await exigirPreSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('verifyMfa', corpo);
    if (pre.etapa !== 'mfa_verificacao') throw new ErroApi('ERR-018');

    const u = await this.n.banco.noTenant(pre.tenantId, (tx) => this.usuarioMfa(tx, pre.usuarioId));
    if (!u.mfa_ativo || !u.mfa_secret) throw new ErroApi('ERR-018');
    await this.exigirNaoBloqueado(u.email);

    const passo = conferirTotp(
      decifrar(this.n.config.chaveCifraMfa, u.mfa_secret),
      corpo.codigo,
      this.n.agora(),
      u.mfa_ultimo_passo === null ? null : Number(u.mfa_ultimo_passo),
    );
    if (passo === null) {
      await this.registrarFalha(u.email);
      throw new ErroApi('ERR-012');
    }

    const r = await this.n.banco.noTenant(pre.tenantId, async (tx) => {
      // Anti-reuso: só avança se ninguém usou um passo igual ou posterior entre a leitura e aqui.
      const avancou = await tx.execute(sql`
        UPDATE usuario SET mfa_ultimo_passo = ${passo}, ultimo_login = ${this.n.agora()}
         WHERE id = ${pre.usuarioId} AND mfa_ativo AND (mfa_ultimo_passo IS NULL OR mfa_ultimo_passo < ${passo})`);
      if (!avancou.rowCount) throw new ErroApi('ERR-012');
      const aberta = await this.abrirSessaoPlena(tx, pre, u.nome);
      await this.n.revogarSessoes(tx, pre.usuarioId, 'mfa_verificado', { tipo: 'pre_sessao' });
      return aberta;
    });
    await this.limparFalhas(u.email);
    gravarSessao(this.n, res, r.segredo);
    return r.info;
  }

  @Post('mfa/setup/start')
  @HttpCode(200)
  async startMfaSetup(@Req() req: Requisicao) {
    const pre = await exigirPreSessao(this.n, req);
    exigirCsrf(this.n, req);
    if (pre.etapa !== 'mfa_cadastro') throw new ErroApi('ERR-018');
    return this.n.banco.noTenant(pre.tenantId, async (tx) => {
      // mfa_ativo relido na mesma transação que grava o segredo (CA-026b).
      const u = await this.usuarioMfa(tx, pre.usuarioId, true);
      if (u.mfa_ativo) throw new ErroApi('ERR-018');
      const segredo = novoSegredoTotp(); // repetição sobrescreve o segredo não confirmado (DEC-086)
      await tx.execute(sql`UPDATE usuario SET mfa_secret = ${cifrar(this.n.config.chaveCifraMfa, segredo)} WHERE id = ${pre.usuarioId}`);
      return { otpauth_uri: uriOtpauth(segredo, u.email), segredo_base32: segredo };
    });
  }

  @Post('mfa/setup')
  @HttpCode(200)
  async setupMfa(@Body() corpo: { codigo: string }, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const pre = await exigirPreSessao(this.n, req);
    exigirCsrf(this.n, req);
    this.validar('setupMfa', corpo);
    if (pre.etapa !== 'mfa_cadastro') throw new ErroApi('ERR-018');

    const u = await this.n.banco.noTenant(pre.tenantId, (tx) => this.usuarioMfa(tx, pre.usuarioId));
    if (u.mfa_ativo || !u.mfa_secret) throw new ErroApi('ERR-018');
    await this.exigirNaoBloqueado(u.email);
    const passo = conferirTotp(decifrar(this.n.config.chaveCifraMfa, u.mfa_secret), corpo.codigo, this.n.agora(), null);
    if (passo === null) {
      await this.registrarFalha(u.email);
      throw new ErroApi('ERR-012');
    }

    const r = await this.n.banco.noTenant(pre.tenantId, async (tx) => {
      const ativou = await tx.execute(sql`
        UPDATE usuario
           SET mfa_ativo = true, mfa_ultimo_passo = ${passo}, ultimo_login = ${this.n.agora()},
               situacao = CASE WHEN situacao = 'pendente_convite' THEN 'ativo' ELSE situacao END,
               versao = versao + 1
         WHERE id = ${pre.usuarioId} AND NOT mfa_ativo AND mfa_secret = ${u.mfa_secret}`);
      if (!ativou.rowCount) throw new ErroApi('ERR-018');
      // O convite ou o link de reset só é consumido aqui (CA-035, CA-037b).
      if (pre.tokenId) await tx.execute(sql`UPDATE token_uso_unico SET usado_em = ${this.n.agora()} WHERE id = ${pre.tokenId}`);
      const aberta = await this.abrirSessaoPlena(tx, pre, u.nome);
      // Demais pré-sessões encerradas: respondem ERR-018 daqui em diante (CA-026b, ex. 4).
      await this.n.revogarSessoes(tx, pre.usuarioId, 'mfa_concluido', { tipo: 'pre_sessao' });
      await this.n.auditar(tx, { tenantId: pre.tenantId, usuarioId: pre.usuarioId, ip: pre.ip }, 'CADASTRO_MFA', 'Usuario', pre.usuarioId);
      return aberta;
    });
    await this.limparFalhas(u.email);
    gravarSessao(this.n, res, r.segredo);
    return r.info;
  }

  // ───────────────────────────── sessão ─────────────────────────────

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    const s = await exigirSessao(this.n, req);
    exigirCsrf(this.n, req);
    await this.n.banco.noTenant(s.tenantId, (tx) =>
      tx.execute(sql`UPDATE sessao SET revogada_em = ${this.n.agora()}, motivo_revogacao = 'logout' WHERE id = ${s.sessaoId}`),
    );
    limparCookies(this.n, res);
  }

  @Get('session')
  async getCurrentSession(@Req() req: Requisicao) {
    const s = await exigirSessao(this.n, req);
    return this.n.banco.noTenant(s.tenantId, async (tx) => {
      const r = await linha<{ nome: string; expira: Date }>(
        tx,
        sql`SELECT u.nome, least(se.ultima_atividade_em + interval '30 minutes', se.expira_absoluta_em) AS expira
              FROM sessao se JOIN usuario u ON u.id = se.usuario_id WHERE se.id = ${s.sessaoId}`,
      );
      return this.infoSessao(tx, s.usuarioId, r!.nome, new Date(r!.expira));
    });
  }

  // ───────────────────────── recuperação de senha (CA-037) ─────────────────────────

  @Post('password/reset')
  @HttpCode(202)
  async resetPassword(@Body() corpo: { email: string }, @Req() req: Requisicao) {
    limitarPublica(this.n, req);
    this.validar('resetPassword', corpo);
    const u = await this.n.banco.semTenant((ex) =>
      linha<Login>(ex, sql`SELECT * FROM auth_buscar_login(${normalizarEmail(corpo.email)})`),
    );
    if (u && u.situacao === 'ativo' && u.tenant_ativo) {
      await this.n.banco.noTenant(u.tenant_id, (tx) => this.n.criarTokenComEmail(tx, u.tenant_id, u.usuario_id, 'recuperacao_senha'));
      await this.n.despacharOutbox();
    }
    // Mesma resposta exista ou não a conta (CA-037).
    return { mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.' };
  }

  @Post('password/reset/confirm')
  @HttpCode(204)
  async confirmPasswordReset(@Body() corpo: { token: string; nova_senha: string }, @Req() req: Requisicao) {
    limitarPublica(this.n, req);
    this.validar('confirmPasswordReset', corpo);
    const t = await this.buscarToken(corpo.token, 'recuperacao_senha');
    this.exigirPoliticaSenha(corpo.nova_senha, 'nova_senha');
    const hash = await hashSenha(corpo.nova_senha);
    await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      const usado = await tx.execute(sql`
        UPDATE token_uso_unico SET usado_em = ${this.n.agora()} WHERE id = ${t.token_id} AND usado_em IS NULL`);
      if (!usado.rowCount) throw new ErroApi('ERR-011');
      await tx.execute(sql`UPDATE usuario SET senha_hash = ${hash}, versao = versao + 1 WHERE id = ${t.usuario_id}`);
      await this.n.revogarSessoes(tx, t.usuario_id, 'senha_redefinida');
      await this.n.auditar(tx, { tenantId: t.tenant_id, usuarioId: t.usuario_id, ip: ipDe(req) }, 'REDEFINIR_SENHA', 'Usuario', t.usuario_id);
    });
  }

  // ───────────────────────── convite (CA-035) ─────────────────────────

  @Post('invites/accept')
  @HttpCode(200)
  async acceptInvite(@Body() corpo: { token: string; senha: string }, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    limitarPublica(this.n, req);
    this.validar('acceptInvite', corpo);
    const t = await this.buscarToken(corpo.token, 'convite');
    this.exigirPoliticaSenha(corpo.senha, 'senha');
    const hash = await hashSenha(corpo.senha);
    const { segredo } = await this.n.banco.noTenant(t.tenant_id, async (tx) => {
      // Dentro das 24 h o mesmo convite redefine a senha e cria nova pré-sessão; só é
      // consumido quando o setupMfa conclui.
      const ok = await tx.execute(sql`
        UPDATE usuario SET senha_hash = ${hash}, versao = versao + 1
         WHERE id = ${t.usuario_id} AND situacao = 'pendente_convite' AND NOT mfa_ativo`);
      if (!ok.rowCount) throw new ErroApi('ERR-011');
      return this.n.criarSessao(tx, {
        tenantId: t.tenant_id,
        usuarioId: t.usuario_id,
        tipo: 'pre_sessao',
        etapa: 'mfa_cadastro',
        tokenId: t.token_id,
        ip: ipDe(req),
      });
    });
    gravarPreSessao(this.n, res, segredo);
    return { etapa: 'mfa_cadastro' };
  }

  // ───────────────────────── reset de MFA (CA-037b, DEC-082) ─────────────────────────

  @Post('mfa-reset/accept')
  @HttpCode(200)
  async acceptMfaReset(@Body() corpo: { token: string; senha: string }, @Req() req: Requisicao, @Res({ passthrough: true }) res: Resposta) {
    limitarPublica(this.n, req);
    this.validar('acceptMfaReset', corpo);
    const t = await this.buscarToken(corpo.token, 'reset_mfa');
    const u = await this.n.banco.noTenant(t.tenant_id, (tx) =>
      linha<{ email: string; senha_hash: string; situacao: string; mfa_ativo: boolean }>(
        tx,
        sql`SELECT email, senha_hash, situacao, mfa_ativo FROM usuario WHERE id = ${t.usuario_id}`,
      ),
    );
    if (!u || u.situacao !== 'ativo' || u.mfa_ativo) throw new ErroApi('ERR-011');
    await this.exigirNaoBloqueado(u.email);
    if (!(await conferirSenha(u.senha_hash, corpo.senha))) {
      await this.registrarFalha(u.email); // senha errada não consome o link
      throw new ErroApi('ERR-013');
    }
    const { segredo } = await this.n.banco.noTenant(t.tenant_id, (tx) =>
      this.n.criarSessao(tx, {
        tenantId: t.tenant_id,
        usuarioId: t.usuario_id,
        tipo: 'pre_sessao',
        etapa: 'mfa_cadastro',
        tokenId: t.token_id,
        ip: ipDe(req),
      }),
    );
    gravarPreSessao(this.n, res, segredo);
    return { etapa: 'mfa_cadastro' };
  }
}

