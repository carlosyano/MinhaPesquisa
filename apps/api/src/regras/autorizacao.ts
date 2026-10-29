// Regras de autorização e de estado do RF-001/RF-002 como funções puras, para que sejam
// testadas sem banco e cobertas pelo teste de mutação (DEC-052). Os controladores só as chamam.

import { ErroApi } from '../infra/erros.js';
import { iguais } from '../infra/cripto.js';
import { DIA, somar } from '../infra/relogio.js';

export type Situacao = 'pendente_convite' | 'ativo' | 'inativo';

/** O perfil é cumulativo (RN-003); sem o perfil exigido → ERR-016 (PLANO §6.1). */
export function exigirPerfil(perfis: readonly string[], perfil: string): void {
  if (!perfis.includes(perfil)) throw new ErroApi('ERR-016');
}

/** Concessão individual só para quem tem analista_individual (DEC-060, DEC-080, Q-030). */
export function exigirConcessivel(perfisAlvo: readonly string[]): void {
  if (!perfisAlvo.includes('analista_individual')) throw new ErroApi('ERR-018');
}

/** 90 dias a partir da concessão (DEC-031). */
export function validadeConcessao(agora: Date): Date {
  return somar(agora, 90 * DIA);
}

/** Vigente = ativa, não revogada e dentro do prazo; nunca depende só do job (ENT-015). */
export function concessaoVigente(c: { ativo: boolean; revogado_em: Date | null; valido_ate: Date }, agora: Date): boolean {
  return c.ativo && c.revogado_em === null && new Date(c.valido_ate).getTime() > agora.getTime();
}

/** Edição de situação: ativo ↔ inativo; usuário em pendente_convite não muda por aqui (ERR-018). */
export function proximaSituacao(atual: Situacao, ativo: boolean | undefined): Situacao {
  if (ativo === undefined) return atual;
  if (atual === 'pendente_convite') throw new ErroApi('ERR-018');
  return ativo ? 'ativo' : 'inativo';
}

/** Verdadeiro quando um admin ativo deixa de sê-lo: só vale se houver outro (RF-001). */
export function exigeOutroAdmin(
  atual: { situacao: Situacao; perfis: readonly string[] },
  nova: { situacao: Situacao; perfis: readonly string[] },
): boolean {
  const era = atual.situacao === 'ativo' && atual.perfis.includes('admin_tenant');
  const sera = nova.situacao === 'ativo' && nova.perfis.includes('admin_tenant');
  return era && !sera;
}

/** Operação de MFA só na etapa gravada na pré-sessão (CA-026b). */
export function exigirEtapa(etapa: string, esperada: 'mfa_verificacao' | 'mfa_cadastro'): void {
  if (etapa !== esperada) throw new ErroApi('ERR-018');
}

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
