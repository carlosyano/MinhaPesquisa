// Erros da API: só códigos do catálogo fechado (REQ §8.2), em Problem Details (RFC 9457).

export interface AuditoriaDeErro {
  acao: string;
  entidade: string;
  registroId?: string | null;
}

export interface ExtrasErro {
  /** Campos inválidos (ERR-001). */
  campos?: string[];
  /** Segundos para o cabeçalho Retry-After (ERR-010, ERR-014). */
  retryAfter?: number;
  /** Texto que substitui o marcador entre colchetes da mensagem do catálogo (ERR-029, ERR-036). */
  substituir?: string;
  /** Motivo exato da recusa de arquivo (ERR-029, extensão `motivo`). */
  motivo?: string;
  /** Evento gravado após o rollback da transação (ERR-002, ERR-023: tentativa auditada). */
  auditar?: AuditoriaDeErro;
}

export class ErroApi extends Error {
  constructor(
    readonly errId: string,
    readonly extras: ExtrasErro = {},
  ) {
    super(errId);
  }
}

export const naoEncontrado = (entidade: string, registroId?: string | null) =>
  new ErroApi('ERR-002', { auditar: { acao: 'ACESSO_FORA_ESCOPO', entidade, registroId: registroId ?? null } });
