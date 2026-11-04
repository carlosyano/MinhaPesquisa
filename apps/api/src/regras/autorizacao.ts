// Regras de sessão, CSRF e paginação do RF-002 como funções puras, para que sejam testadas
// sem banco e cobertas pelo teste de mutação (DEC-052). Os controladores só as chamam. Sem
// perfis, concessões nem MFA desde o IMP-005 (DEC-108, DEC-109).

import { ErroApi } from '../infra/erros.js';
import { iguais } from '../infra/cripto.js';

export const MAX_SESSOES = 3;

/** No máximo 3 sessões ativas (Bloco P P.2, ERR-021). */
export function limiteSessoesAtingido(ativas: number): boolean {
  return ativas >= MAX_SESSOES;
}

/** Double-submit (cookie = cabeçalho, não vazio) e Origin permitida (DEC-044). */
export function csrfValido(
  cookie: string | undefined,
  cabecalho: string | undefined,
  origem: string | undefined,
  permitidas: readonly string[],
): boolean {
  return !!cookie && typeof cabecalho === 'string' && iguais(cookie, cabecalho) && typeof origem === 'string' && permitidas.includes(origem);
}

/** Paginação: padrão 20, máximo 100, página ≥ 1 (PLANO §5.1); fora disso ERR-001. */
export function paginacao(q: Record<string, string | undefined>): { pagina: number; limite: number } {
  const pagina = q.pagina === undefined ? 1 : Number(q.pagina);
  const limite = q.limite === undefined ? 20 : Number(q.limite);
  if (!Number.isInteger(pagina) || pagina < 1) throw new ErroApi('ERR-001', { campos: ['pagina'] });
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) throw new ErroApi('ERR-001', { campos: ['limite'] });
  return { pagina, limite };
}
