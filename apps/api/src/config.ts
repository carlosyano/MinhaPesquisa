// Configuração da API. No notebook vem do ambiente e das chaves locais (DEC-113, DEC-114);
// nos testes, do harness. Nenhum segredo fica no repositório.

import type { Localizador, ReadEngine } from '@minhapesquisa/motor-leitura';
import type { Antimalware } from './infra/antimalware.js';
import type { ExtratorEstrutura } from './leitura/extrator.js';
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
  /** Chave de 32 bytes da cifra de campo (AES-256-GCM, DEC-041, DEC-114). */
  chaveCifraCampo: Buffer;
  /** Chave de 32 bytes do HMAC do CPF (busca e vínculo do respondente, ENT-009). */
  chaveHmacCpf: Buffer;
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
  /**
   * Motor de leitura (DEC-043, DEC-122) para cada chamada. O contexto só serve para o motor
   * simulado dos testes (DEC-123); o motor real recebe só o recorte e o schema (RN-045).
   * Sem motor configurado, nenhuma leitura é feita.
   */
  motorLeitura?: (contexto: { aplicacaoId: string; pagina: number; campos: string[] }) => ReadEngine;
  /**
   * Localização das perguntas (RN-052, DEC-174) para cada folha. O contexto só serve para o
   * localizador simulado dos testes; o real recebe só a página e as perguntas (RN-045). Sem
   * localizador configurado, nenhuma folha é localizada, e a aplicação espera em `em_leitura`.
   */
  localizador?: (contexto: ContextoLocalizacao) => Localizador;
  /**
   * Extrator de estrutura da importação de formulário (DEC-141) para cada chamada; o contexto só
   * serve para o extrator simulado dos testes. Sem extrator configurado, nenhuma página é lida.
   */
  extratorEstrutura?: (contexto: { importacaoId: string; pagina: number }) => ExtratorEstrutura;
  /** Destino do log operacional (sem dado pessoal, RN-028); padrão: saída de erro. */
  log?: (linha: string) => void;
}

/** O que o localizador simulado precisa para o padrão da DEC-174 (6); nada disso vai ao provedor. */
export interface ContextoLocalizacao {
  aplicacaoId: string;
  imagemId: string;
  /** Página do QR legível da folha, quando há. */
  paginaQr: number | null;
  /** Posição da folha entre as folhas de formulário da aplicação, na ordem do envio, a partir de 1. */
  posicao: number;
  /** Regiões do `mapa_layout` da versão por código, quando há (versão oficial). */
  mapa: { codigo: string; pagina: number; regiao: { x: number; y: number; largura: number; altura: number } }[] | null;
  /** Região da assinatura na página 1 pelo `mapa_layout`, quando há. */
  assinatura: { x: number; y: number; largura: number; altura: number } | null;
}
