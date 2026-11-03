// Configuração da API. Em produção vem do ambiente e do gerenciador de segredos; nos testes,
// do harness. Nenhum segredo fica no repositório.

import type { Antimalware } from './infra/antimalware.js';
import type { Armazenamento } from './infra/armazenamento.js';
import type { Mailer } from './infra/mailer.js';
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
  /** Chave de 32 bytes para cifrar o segredo TOTP (AES-256-GCM, DEC-085). */
  chaveCifraMfa: Buffer;
  /** Origens aceitas no cabeçalho Origin das mutações (CSRF, Bloco P P.2). */
  origensPermitidas: string[];
  /** URL pública da aplicação web, usada nos links dos e-mails. */
  urlWeb: string;
  /** Cookies com atributo Secure (sempre em produção). */
  cookiesSeguros: boolean;
  /** Aceitar X-Forwarded-For como IP do cliente. Só atrás de proxy confiável ou em teste. */
  confiarProxy: boolean;
  relogio: Relogio;
  mailer: Mailer;
  /** Imagens das páginas (DEC-101). */
  armazenamento: Armazenamento;
  /** Varredura de todo arquivo recebido (DEC-042, DEC-102). */
  antimalware: Antimalware;
  /** Gera IDs (UUID v4); injetável para testes determinísticos. */
  gerarId: () => string;
}
