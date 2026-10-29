// Núcleo compartilhado pelos módulos: banco, contrato, relógio, auditoria, sessões, tokens
// de uso único, outbox de e-mail e idempotência.

import { randomBytes } from 'node:crypto';
import type { Config } from './config.js';
import { Banco, linha, linhas, sql, type Executor } from './infra/banco.js';
import { Contrato } from './infra/contrato.js';
import { segredoAleatorio, sha256 } from './infra/cripto.js';
import { ErroApi, type AuditoriaDeErro } from './infra/erros.js';
import { HORA, MINUTO, somar } from './infra/relogio.js';

export type Perfil = 'admin_tenant' | 'digitalizador' | 'analista' | 'analista_individual';
export const PERFIS: readonly Perfil[] = ['admin_tenant', 'digitalizador', 'analista', 'analista_individual'];
export const NOMES_PERFIL: Record<Perfil, string> = {
  admin_tenant: 'Administrador do tenant',
  digitalizador: 'Digitalizador',
  analista: 'Analista',
  analista_individual: 'Analista com acesso individual',
};

export type TipoToken = 'convite' | 'recuperacao_senha' | 'reset_mfa';
export const VALIDADE_TOKEN: Record<TipoToken, number> = {
  convite: 24 * HORA, // DEC-032
  recuperacao_senha: 60 * MINUTO, // CA-037
  reset_mfa: 24 * HORA, // DEC-082
};

export const SESSAO_INATIVIDADE = 30 * MINUTO;
export const SESSAO_MAXIMA = 24 * HORA;
export const PRE_SESSAO = 5 * MINUTO;

/** Quem age numa requisição autenticada. */
export interface Ator {
  tenantId: string;
  usuarioId: string;
  ip: string | null;
}

export interface SessaoAtiva extends Ator {
  sessaoId: string;
  perfis: Perfil[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export class Nucleo {
  readonly banco: Banco;
  readonly contrato: Contrato;

  constructor(readonly config: Config) {
    this.banco = new Banco(config.urlBancoApp, config.urlBancoManutencao);
    this.contrato = new Contrato(config.raizRepositorio);
  }

  agora(): Date {
    return this.config.relogio.agora();
  }

  id(): string {
    return this.config.gerarId();
  }

  /**
   * Executa no tenant do ator. Erros com `auditar` (fora de escopo, e-mail indisponível)
   * são gravados na auditoria numa transação nova, depois do rollback.
   */
  async comAtor<T>(ator: Ator, fn: (tx: Executor) => Promise<T>): Promise<T> {
    try {
      return await this.banco.noTenant(ator.tenantId, fn);
    } catch (e) {
      if (e instanceof ErroApi && e.extras.auditar) await this.auditarErro(ator, e.extras.auditar);
      throw e;
    }
  }

  private async auditarErro(ator: Ator, a: AuditoriaDeErro): Promise<void> {
    await this.banco.noTenant(ator.tenantId, (tx) =>
      this.auditar(tx, ator, a.acao, a.entidade, ehUuid(a.registroId) ? a.registroId : null),
    );
  }

  /** Evento de auditoria: só referências, nunca valores pessoais (RN-027). */
  async auditar(
    tx: Executor,
    ator: { tenantId: string; usuarioId: string | null; ip: string | null },
    acao: string,
    entidade: string,
    registroId: string | null,
    detalhes?: Record<string, unknown>,
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, ip, canal, detalhes, criado_em)
      VALUES (${this.id()}, ${ator.tenantId}, ${ator.usuarioId}, ${acao}, ${entidade}, ${registroId},
              ${ator.ip}::inet, 'api', ${detalhes ? JSON.stringify(detalhes) : null}::jsonb, ${this.agora()})`);
  }

  // ───────────────────────────── Sessões ─────────────────────────────

  async criarSessao(
    tx: Executor,
    dados: { tenantId: string; usuarioId: string; tipo: 'pre_sessao' | 'plena'; etapa?: string; tokenId?: string; ip: string | null },
  ): Promise<{ segredo: string; expira: Date }> {
    const agora = this.agora();
    const segredo = segredoAleatorio();
    const expira = somar(agora, dados.tipo === 'plena' ? SESSAO_MAXIMA : PRE_SESSAO);
    await tx.execute(sql`
      INSERT INTO sessao (id, tenant_id, usuario_id, tipo, etapa, token_id, segredo_hash, criada_em,
                          ultima_atividade_em, expira_absoluta_em, ip)
      VALUES (${this.id()}, ${dados.tenantId}, ${dados.usuarioId}, ${dados.tipo}, ${dados.etapa ?? null},
              ${dados.tokenId ?? null}, ${sha256(segredo)}, ${agora}, ${agora}, ${expira}, ${dados.ip}::inet)`);
    return { segredo, expira };
  }

  /** Encerra sessões e pré-sessões do usuário (todas, ou só de um tipo, exceto uma). */
  async revogarSessoes(
    tx: Executor,
    usuarioId: string,
    motivo: string,
    opcoes: { tipo?: 'pre_sessao' | 'plena'; exceto?: string } = {},
  ): Promise<void> {
    await tx.execute(sql`
      UPDATE sessao SET revogada_em = ${this.agora()}, motivo_revogacao = ${motivo}
       WHERE usuario_id = ${usuarioId} AND revogada_em IS NULL
         AND (${opcoes.tipo ?? null}::text IS NULL OR tipo = ${opcoes.tipo ?? null})
         AND (${opcoes.exceto ?? null}::uuid IS NULL OR id <> ${opcoes.exceto ?? null}::uuid)`);
  }

  async contarSessoesPlenas(tx: Executor, usuarioId: string): Promise<number> {
    const agora = this.agora();
    const r = await linha<{ n: number }>(
      tx,
      sql`SELECT count(*)::int AS n FROM sessao
           WHERE usuario_id = ${usuarioId} AND tipo = 'plena' AND revogada_em IS NULL
             AND expira_absoluta_em > ${agora}
             AND ultima_atividade_em > ${new Date(agora.getTime() - SESSAO_INATIVIDADE)}`,
    );
    return r?.n ?? 0;
  }

  // ───────────────────── Tokens de uso único e outbox ─────────────────────

  /**
   * Cria o token e enfileira o e-mail na mesma transação. O segredo do link só nasce no
   * despacho; até lá o hash guardado é de um valor que ninguém conhece (DEC-088).
   */
  async criarTokenComEmail(tx: Executor, tenantId: string, usuarioId: string, tipo: TipoToken): Promise<string> {
    const agora = this.agora();
    const tokenId = this.id();
    await tx.execute(sql`
      INSERT INTO token_uso_unico (id, tenant_id, usuario_id, tipo, token_hash, expira_em, criado_em)
      VALUES (${tokenId}, ${tenantId}, ${usuarioId}, ${tipo}, ${randomBytes(32)},
              ${somar(agora, VALIDADE_TOKEN[tipo])}, ${agora})`);
    await tx.execute(sql`
      INSERT INTO outbox (id, tenant_id, tipo, payload, criado_em)
      VALUES (${this.id()}, ${tenantId}, 'email_token', ${JSON.stringify({ token_id: tokenId })}::jsonb, ${agora})`);
    return tokenId;
  }

  /** Invalida tokens ainda não usados do tipo para o usuário (novo convite, novo reset). */
  async invalidarTokens(tx: Executor, usuarioId: string, tipo: TipoToken): Promise<void> {
    const agora = this.agora();
    await tx.execute(sql`
      UPDATE token_uso_unico SET expira_em = ${agora}
       WHERE usuario_id = ${usuarioId} AND tipo = ${tipo} AND usado_em IS NULL AND expira_em > ${agora}`);
  }

  /** Despacha os e-mails pendentes do outbox (no IMP-001, no próprio processo; DEC-088). */
  async despacharOutbox(): Promise<void> {
    for (;;) {
      const enviado = await this.banco.manutencao(async (tx) => {
        const item = await linha<{ id: string; payload: { token_id: string } }>(
          tx,
          sql`SELECT id, payload FROM outbox WHERE processado_em IS NULL AND tipo = 'email_token'
               ORDER BY criado_em, id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        );
        if (!item) return false;
        const agora = this.agora();
        const t = await linha<{ tipo: TipoToken; email: string; valido: boolean }>(
          tx,
          sql`SELECT t.tipo, u.email, (t.usado_em IS NULL AND t.expira_em > ${agora}) AS valido
                FROM token_uso_unico t JOIN usuario u ON u.id = t.usuario_id
               WHERE t.id = ${item.payload.token_id}`,
        );
        if (t?.valido) {
          const token = segredoAleatorio();
          await tx.execute(sql`UPDATE token_uso_unico SET token_hash = ${sha256(token)} WHERE id = ${item.payload.token_id}`);
          const rota = { convite: 'convite', recuperacao_senha: 'recuperar-senha', reset_mfa: 'novo-mfa' }[t.tipo];
          await this.config.mailer.enviar({
            para: t.email,
            tipo: t.tipo,
            token,
            link: `${this.config.urlWeb}/${rota}#token=${token}`,
          });
        }
        await tx.execute(sql`UPDATE outbox SET processado_em = ${agora}, tentativas = tentativas + 1 WHERE id = ${item.id}`);
        return true;
      });
      if (!enviado) return;
    }
  }

  // ───────────────────────────── Idempotência (P.8) ─────────────────────────────

  /**
   * Executa a operação uma única vez por (usuário, operação, chave). Repetição com o mesmo
   * corpo devolve o ID do recurso já criado; com corpo diferente, ERR-019.
   */
  async idempotente(
    tx: Executor,
    ator: Ator,
    operacao: string,
    chave: string | undefined,
    corpo: unknown,
    executar: () => Promise<{ status: number; recursoId: string }>,
  ): Promise<{ status: number; recursoId: string; repetida: boolean }> {
    if (!chave || chave.length < 16 || chave.length > 64) throw new ErroApi('ERR-001', { campos: ['Idempotency-Key'] });
    const hash = sha256(JSON.stringify(corpo ?? null));
    const agora = this.agora();
    const existente = await linha<{ hash_requisicao: Buffer; resposta: { status: number; recurso_id: string } }>(
      tx,
      sql`SELECT hash_requisicao, resposta FROM chave_idempotencia
           WHERE usuario_id = ${ator.usuarioId} AND operacao = ${operacao} AND chave = ${chave} AND expira_em > ${agora}`,
    );
    if (existente) {
      if (!existente.hash_requisicao.equals(hash)) throw new ErroApi('ERR-019');
      return { status: existente.resposta.status, recursoId: existente.resposta.recurso_id, repetida: true };
    }
    const r = await executar();
    await tx.execute(sql`
      DELETE FROM chave_idempotencia WHERE usuario_id = ${ator.usuarioId} AND operacao = ${operacao} AND chave = ${chave}`);
    await tx.execute(sql`
      INSERT INTO chave_idempotencia (id, tenant_id, usuario_id, chave, operacao, hash_requisicao, resposta, criado_em, expira_em)
      VALUES (${this.id()}, ${ator.tenantId}, ${ator.usuarioId}, ${chave}, ${operacao}, ${hash},
              ${JSON.stringify({ status: r.status, recurso_id: r.recursoId })}::jsonb, ${agora}, ${somar(agora, 24 * HORA)})`);
    return { ...r, repetida: false };
  }

  /** Perfis do usuário (ordem estável). */
  async perfisDe(tx: Executor, usuarioId: string): Promise<Perfil[]> {
    const r = await linhas<{ codigo: Perfil }>(
      tx,
      sql`SELECT p.codigo FROM usuario_perfil up JOIN perfil p ON p.id = up.perfil_id
           WHERE up.usuario_id = ${usuarioId} ORDER BY p.codigo`,
    );
    return r.map((x) => x.codigo);
  }

  /** Projetos efetivos: todos do tenant (vínculo dinâmico, DEC-068) ou os vinculados. */
  async projetosDe(tx: Executor, usuarioId: string): Promise<string[]> {
    const r = await linhas<{ id: string }>(
      tx,
      sql`SELECT p.id FROM projeto p JOIN usuario u ON u.id = ${usuarioId}
           WHERE u.todos_projetos
              OR EXISTS (SELECT 1 FROM vinculo_usuario_projeto v WHERE v.usuario_id = u.id AND v.projeto_id = p.id)
           ORDER BY p.criado_em, p.id`,
    );
    return r.map((x) => x.id);
  }

  async fechar(): Promise<void> {
    await this.banco.fechar();
  }
}
