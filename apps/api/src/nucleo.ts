// Núcleo compartilhado pelos módulos: banco, contrato, relógio, auditoria, sessões e
// idempotência.

import type { Config } from './config.js';
import { Banco, linha, sql, type Executor } from './infra/banco.js';
import { Contrato } from './infra/contrato.js';
import { createHmac } from 'node:crypto';
import { cifrar, decifrar, segredoAleatorio, sha256 } from './infra/cripto.js';
import { ErroApi, type AuditoriaDeErro } from './infra/erros.js';
import { HORA, MINUTO, somar } from './infra/relogio.js';

export const SESSAO_INATIVIDADE = 30 * MINUTO;
export const SESSAO_MAXIMA = 24 * HORA;

/** Quem age numa requisição autenticada. */
export interface Ator {
  tenantId: string;
  usuarioId: string;
  ip: string | null;
}

export interface SessaoAtiva extends Ator {
  sessaoId: string;
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
   * Executa no tenant do ator. Erros com `auditar` (fora de escopo)
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
    campo?: string,
  ): Promise<void> {
    await tx.execute(sql`
      INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, campo, ip, canal, detalhes, criado_em)
      VALUES (${this.id()}, ${ator.tenantId}, ${ator.usuarioId}, ${acao}, ${entidade}, ${registroId}, ${campo ?? null},
              ${ator.ip}::inet, 'api', ${detalhes ? JSON.stringify(detalhes) : null}::jsonb, ${this.agora()})`);
  }

  // ───────────────────────────── Cifra de campo e log ─────────────────────────────

  /** Cifra um valor pessoal (AES-256-GCM, DEC-041); null continua null. */
  cifrar(valor: string | null): string | null {
    return valor === null ? null : cifrar(this.config.chaveCifraCampo, valor);
  }

  decifrar(valor: string | null): string | null {
    return valor === null ? null : decifrar(this.config.chaveCifraCampo, valor);
  }

  /** HMAC do CPF canônico (busca e vínculo, ENT-009) ou de outro valor pessoal (ENT-023). */
  hmac(valor: string): Buffer {
    return createHmac('sha256', this.config.chaveHmacCpf).update(valor).digest();
  }

  /** Log operacional: só identificadores e situações, nunca valores lidos nem pessoais (RN-028). */
  log(linha: string): void {
    (this.config.log ?? ((l: string) => console.error(l)))(linha);
  }

  // ───────────────────────────── Sessões ─────────────────────────────

  /** Sessão plena (a única que existe desde o IMP-005; a pré-sessão saiu com o MFA, DEC-108). */
  async criarSessao(tx: Executor, dados: { tenantId: string; usuarioId: string; ip: string | null }): Promise<{ segredo: string; expira: Date }> {
    const agora = this.agora();
    const segredo = segredoAleatorio();
    const expira = somar(agora, SESSAO_MAXIMA);
    await tx.execute(sql`
      INSERT INTO sessao (id, tenant_id, usuario_id, tipo, segredo_hash, criada_em, ultima_atividade_em, expira_absoluta_em, ip)
      VALUES (${this.id()}, ${dados.tenantId}, ${dados.usuarioId}, 'plena', ${sha256(segredo)}, ${agora}, ${agora}, ${expira},
              ${dados.ip}::inet)`);
    return { segredo, expira };
  }

  /** Encerra todas as sessões do usuário (redefinição de senha, CA-037). */
  async revogarSessoes(tx: Executor, usuarioId: string, motivo: string): Promise<void> {
    await tx.execute(sql`
      UPDATE sessao SET revogada_em = ${this.agora()}, motivo_revogacao = ${motivo}
       WHERE usuario_id = ${usuarioId} AND revogada_em IS NULL`);
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

  async fechar(): Promise<void> {
    await this.banco.fechar();
  }
}
