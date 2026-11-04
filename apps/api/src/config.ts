// Configuração da API. No notebook vem do ambiente e das chaves locais (DEC-113, DEC-114);
// nos testes, do harness. Nenhum segredo fica no repositório.

import type { Antimalware } from './infra/antimalware.js';
import type { Armazenamento } from './infra/armazenamento.js';
import type { Relogio } from './infra/relogio.js';

export interface Config {
  /** Conexão como mp_app (sujeito a RLS com FORCE). */
  urlBancoApp: string;
  /** Conexão como mp_manutencao (BYPASSRLS), só para jobs e outbox (DEC-046). */
  urlBancoManutencao: string;
  /** Raiz do repositório, de onde vêm o contrato e o catálogo de erros. */
  raizRepositorio: string;
  /** Chave de 32 bytes para HMAC do e-mail (falhas de login). */
  chaveHmacEmail: Buffer;
  /** Origens aceitas no cabeçalho Origin das mutações (CSRF, Bloco P P.2). */
  origensPermitidas: string[];
  /** Cookies com atributo Secure (sempre em produção). */
  cookiesSeguros: boolean;
  /** Aceitar X-Forwarded-For como IP do cliente. Só atrás de proxy confiável ou em teste. */
  confiarProxy: boolean;
  relogio: Relogio;
  /** Imagens das páginas (DEC-101). */
  armazenamento: Armazenamento;
  /** Varredura de todo arquivo recebido (DEC-042, DEC-102). */
  antimalware: Antimalware;
  /** Gera IDs (UUID v4); injetável para testes determinísticos. */
  gerarId: () => string;
}
