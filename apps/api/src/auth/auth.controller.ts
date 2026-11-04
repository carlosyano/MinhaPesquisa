// RF-002: login com senha local, sessão e logout (CA-026; PLANO §4.6; DEC-087, DEC-108).
// Sem MFA, pré-sessão, convite nem recuperação por e-mail desde o IMP-005: a senha esquecida
// é redefinida pelo script local (scripts/instalacao.ts, CA-037).

import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import {
  exigirCsrf,
  exigirSessao,
  gravarSessao,
  ipDe,
  limitarPublica,
  limparCookies,
  type Req as Requisicao,
  type Res as Resposta,
} from '../http.js';
import { linha, sql } from '../infra/banco.js';
import { conferirSenha, hmacEmail, normalizarEmail } from '../infra/cripto.js';
import { ErroApi } from '../infra/erros.js';
import { Nucleo, SESSAO_INATIVIDADE } from '../nucleo.js';
import { limiteSessoesAtingido } from '../regras/autorizacao.js';

export const NUCLEO = Symbol('Nucleo');

interface Login {
  usuario_id: string;
  tenant_id: string;
  senha_hash: string;
  situacao: string;
  tenant_ativo: boolean;
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
    // Mesma resposta para conta inexistente, senha errada, conta inativa e tenant inativo.
    if (!u || !senhaOk || u.situacao !== 'ativo' || !u.tenant_ativo) {
      await this.registrarFalha(email);
      throw new ErroApi('ERR-013');
    }

    // Senha certa cria a sessão direto, sem MFA (DEC-108), até 3 sessões ativas (ERR-021).
    const r = await this.n.banco.noTenant(u.tenant_id, async (tx) => {
      if (limiteSessoesAtingido(await this.n.contarSessoesPlenas(tx, u.usuario_id))) throw new ErroApi('ERR-021');
      const { segredo } = await this.n.criarSessao(tx, { tenantId: u.tenant_id, usuarioId: u.usuario_id, ip: ipDe(req) });
      const nome = await linha<{ nome: string }>(
        tx,
        sql`UPDATE usuario SET ultimo_login = ${this.n.agora()} WHERE id = ${u.usuario_id} RETURNING nome`,
      );
      return { segredo, nome: nome!.nome };
    });
    await this.limparFalhas(email);
    gravarSessao(this.n, res, r.segredo);
    return {
      usuario_id: u.usuario_id,
      nome: r.nome,
      expira_em: new Date(this.n.agora().getTime() + SESSAO_INATIVIDADE).toISOString(),
    };
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
      return { usuario_id: s.usuarioId, nome: r!.nome, expira_em: new Date(r!.expira).toISOString() };
    });
  }
}
