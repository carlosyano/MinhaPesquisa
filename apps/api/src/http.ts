// Camada HTTP comum: cookies, sessão, CSRF, limites de requisição e o filtro
// que converte qualquer erro em Problem Details do catálogo (Bloco P P.2, P.6, P.7).

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { linha, sql } from './infra/banco.js';
import { segredoAleatorio, sha256 } from './infra/cripto.js';
import { ErroApi } from './infra/erros.js';
import { MINUTO } from './infra/relogio.js';
import type { Nucleo, SessaoAtiva } from './nucleo.js';
import { csrfValido } from './regras/autorizacao.js';

export const COOKIE_SESSAO = 'mp_session';
export const COOKIE_CSRF = 'mp_csrf';

type Req = FastifyRequest & { cookies: Record<string, string | undefined>; correlationId?: string };
type Res = FastifyReply & {
  setCookie(nome: string, valor: string, opcoes: Record<string, unknown>): FastifyReply;
  clearCookie(nome: string, opcoes: Record<string, unknown>): FastifyReply;
};
export type { Req, Res };

export function ipDe(req: Req): string | null {
  return req.ip ?? null;
}

// ───────────────────────────── Cookies ─────────────────────────────

function opcoesCookie(n: Nucleo, httpOnly: boolean, path = '/') {
  return { httpOnly, secure: n.config.cookiesSeguros, sameSite: 'lax' as const, path };
}

export function gravarSessao(n: Nucleo, res: Res, segredo: string): void {
  res.setCookie(COOKIE_SESSAO, segredo, opcoesCookie(n, true));
  res.setCookie(COOKIE_CSRF, segredoAleatorio(), opcoesCookie(n, false));
}

export function limparCookies(n: Nucleo, res: Res): void {
  res.clearCookie(COOKIE_SESSAO, opcoesCookie(n, true));
  res.clearCookie(COOKIE_CSRF, opcoesCookie(n, false));
}

// ───────────────────────────── Sessão ─────────────────────────────

interface Resolvida {
  sessao_id: string;
  tenant_id: string;
  usuario_id: string;
  tipo: 'pre_sessao' | 'plena';
  etapa: 'mfa_verificacao' | 'mfa_cadastro' | null;
  token_id: string | null;
  estado: 'valida' | 'encerrada_mfa_concluido' | 'invalida';
}

async function resolver(n: Nucleo, segredo: string | undefined): Promise<Resolvida | undefined> {
  if (!segredo) return undefined;
  return n.banco.semTenant((ex) =>
    linha<Resolvida>(ex, sql`SELECT * FROM auth_resolver_sessao(${sha256(segredo)}, ${n.agora()})`),
  );
}

/** Sessão plena válida; senão ERR-015. Sem perfis: a usuária pode tudo (DEC-109). */
export async function exigirSessao(n: Nucleo, req: Req): Promise<SessaoAtiva> {
  const r = await resolver(n, req.cookies[COOKIE_SESSAO]);
  if (!r || r.tipo !== 'plena' || r.estado !== 'valida') throw new ErroApi('ERR-015');
  const s: SessaoAtiva = { sessaoId: r.sessao_id, tenantId: r.tenant_id, usuarioId: r.usuario_id, ip: ipDe(req) };
  limitar(n, `usuario:${s.usuarioId}`, 100);
  return s;
}

// ───────────────────────────── CSRF ─────────────────────────────

/** Double-submit (cookie + cabeçalho) e Origin em toda mutação autenticada (DEC-044). */
export function exigirCsrf(n: Nucleo, req: Req): void {
  const cabecalho = req.headers['x-csrf-token'];
  if (!csrfValido(req.cookies[COOKIE_CSRF], typeof cabecalho === 'string' ? cabecalho : undefined, req.headers.origin, n.config.origensPermitidas)) {
    throw new ErroApi('ERR-016');
  }
}

// ───────────────────── Limite de requisições (P.7) ─────────────────────
// Janela fixa de 1 min em memória, por instância. Suficiente para a v1 com uma instância;
// com várias instâncias passa a um armazenamento compartilhado.

const janelas = new WeakMap<Nucleo, Map<string, { inicio: number; n: number }>>();

export function limitar(n: Nucleo, chave: string, limite: number): void {
  let mapa = janelas.get(n);
  if (!mapa) janelas.set(n, (mapa = new Map()));
  const agora = n.agora().getTime();
  const inicio = agora - (agora % MINUTO);
  const j = mapa.get(chave);
  if (!j || j.inicio !== inicio) {
    mapa.set(chave, { inicio, n: 1 });
    if (mapa.size > 50_000) mapa.clear();
    return;
  }
  j.n += 1;
  if (j.n > limite) throw new ErroApi('ERR-010', { retryAfter: Math.ceil((inicio + MINUTO - agora) / 1000) });
}

export function limitarPublica(n: Nucleo, req: Req): void {
  limitar(n, `ip:${ipDe(req)}`, 20);
}

// ───────────────────────── Filtro de erros (P.6) ─────────────────────────

@Catch()
export class FiltroErros implements ExceptionFilter {
  constructor(private readonly n: Nucleo) {}

  catch(erro: unknown, host: ArgumentsHost): void {
    const req = host.switchToHttp().getRequest<Req>();
    const res = host.switchToHttp().getResponse<Res>();
    let api: ErroApi;
    if (erro instanceof ErroApi) api = erro;
    else if (erro instanceof HttpException) {
      const s = erro.getStatus();
      api = new ErroApi(s === 404 ? 'ERR-002' : s === 429 ? 'ERR-010' : s < 500 ? 'ERR-001' : 'ERR-020');
    } else if ((erro as { statusCode?: number })?.statusCode && (erro as { statusCode: number }).statusCode < 500) {
      api = new ErroApi('ERR-001'); // corpo malformado, tipo de conteúdo errado, corpo grande demais
    } else {
      // Erro inesperado: registra só o tipo e a correlação, nunca dados da requisição.
      console.error(`erro_interno correlationId=${req.correlationId} tipo=${(erro as Error)?.name ?? typeof erro}`);
      api = new ErroApi('ERR-020');
    }
    const def = this.n.contrato.erros.get(api.errId) ?? this.n.contrato.erros.get('ERR-020')!;
    const corpo: Record<string, unknown> = {
      type: `https://api.minhapesquisa.example.com.br/errors/${api.errId}`,
      title: def.titulo,
      status: def.status,
      detail: api.extras.substituir !== undefined ? def.mensagem.replace(/\[[^\]]+\]/, api.extras.substituir) : def.mensagem,
      errorCode: api.errId,
      correlationId: req.correlationId,
    };
    if (api.extras.campos?.length) corpo.campos = api.extras.campos;
    if (api.extras.motivo) corpo.motivo = api.extras.motivo;
    if (api.extras.retryAfter !== undefined) res.header('Retry-After', String(api.extras.retryAfter));
    res.status(def.status).header('Content-Type', 'application/problem+json; charset=utf-8').send(JSON.stringify(corpo));
  }
}
