// Interface do ambiente de teste (IA-TEST, DEC-053).
//
// Os testes deste diretório falam com a API só por HTTP, como um cliente real. O que não é
// observável pela API (relógio, scripts locais, auditoria, sessões) chega por esta
// interface, que o IA-DEV implementa em `@minhapesquisa/api/test-harness` sem alterar este
// arquivo. Até essa implementação existir, todos os testes falham (vermelho esperado).
//
// Requisitos da implementação:
// - banco PostgreSQL 17 real com as migrações, RLS e papéis da DEC-046 (Testcontainers);
// - relógio e gerador de IDs injetáveis (PLANO §10.2): a API e o job de expiração usam `clock`;
// - o servidor de teste aceita `X-Forwarded-For` como IP do cliente, para que o limite de
//   20 requisições por minuto por IP em rotas públicas (Bloco P P.7) não misture testes.
//   Esse comportamento é só do ambiente de teste; em produção o IP vem do balanceador;
// - dados 100% sintéticos (Q-001).
//
// Revisto no IA-TEST do IMP-005 (CHG-011, DEC-108, DEC-109): sem MFA, convite, e-mail nem
// perfis. Cada tenant tem uma só usuária; os scripts de instalação e de redefinição de senha
// rodam pelo mesmo código dos scripts reais, num banco ainda sem tenant.
//
// Acrescentado no IA-TEST do IMP-002:
// - armazenamento privado das imagens (desde o IMP-005, pasta local, DEC-113); os links
//   assinados de `getPageImage` precisam ser baixáveis pelo processo de teste com `fetch`;
// - antimalware real ou equivalente que reconheça o arquivo de teste EICAR (DEC-042), rodando
//   antes da verificação de tipo, sobre todo arquivo (desde o IMP-005, Microsoft Defender,
//   DEC-115; no CI em Linux, um equivalente que use o mesmo adaptador);
// - nenhum provedor de IA: a leitura (IMP-003) só é solicitada pelo outbox; `inspect` expõe as
//   solicitações para provar quando nada é lido.
//
// Acrescentado no IA-TEST do IMP-003 (DEC-123):
// - o worker de leitura real (pg-boss), com o motor simulado no lugar do adaptador Claude
//   (DEC-043, DEC-122). O worker nunca roda sozinho: só em `worker.processar()` e nos jobs que
//   `clock.advance` fizer vencer (retentativas em 1, 2 e 4 s; retomada da cota na virada do mês).
//   Assim os testes do IMP-002, que não chamam nenhum dos dois, continuam sem leitura;
// - o motor simulado devolve o que o teste programou para cada pergunta e registra cada chamada
//   como o motor real a receberia (recorte e schema), para provar a minimização (RN-038, RN-039);
// - custo das chamadas em dólar, convertido pela `cotacao_usd_brl` do mês (DEC-058), com a
//   reserva prévia do custo estimado e o ajuste pelo custo real (DEC-051);
// - tudo o que a API, o worker e o motor escrevem no log, para provar que não há valores pessoais
//   (RN-028, CA-008).

/** Resultado de um script local: código de saída e tudo o que ele escreveu no terminal. */
export interface SaidaScript {
  codigo: number;
  saida: string;
}

export interface TenantGravado {
  tenantId: string;
  nome: string;
  usuarios: number;
}

export interface EventoAuditoria {
  tenant_id: string;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  registro_id: string | null;
  /** Campo afetado (ex.: CORRECAO_CAMPO em data_nascimento, CA-008); desde o IMP-003. */
  campo: string | null;
  detalhes: unknown;
  criado_em: Date;
}

export interface MudancaStatusProjeto {
  status: 'ativo' | 'arquivado';
  usuario_id: string;
  registrado_em: Date;
}

/** Contagens do tenant usadas para provar que um upload recusado não gravou nada (CA-029). */
export interface ContagemUpload {
  aplicacoes: number;
  imagens: number;
  /** Objetos no armazenamento de imagens do tenant. */
  objetos: number;
}

/** Região normalizada de 0 a 1, com y a partir do topo da página (DEC-048). */
export interface RegiaoNormalizada {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** `Versao.mapa_layout` gravado na publicação (DEC-048, DEC-106). */
export interface MapaLayoutGravado {
  total_paginas: number;
  perguntas: { codigo: string; pagina: number; regiao: RegiaoNormalizada; caixas?: RegiaoNormalizada[] }[];
  assinatura: { pagina: number; regiao: RegiaoNormalizada };
}

/**
 * O que o motor simulado devolve para um campo (RN-045): valor no formato que o provedor leu
 * (nem sempre canônico, ex.: CPF com máscara), confiança bruta e região. `falha` faz a chamada que
 * contém o campo falhar as primeiras `vezes` tentativas: tempo esgotado, erro do provedor ou saída
 * malformada (DEC-123), sempre como falha da chamada inteira.
 */
export type LeituraSimulada =
  | { valor: string | null; confianca: number; regiao?: RegiaoNormalizada }
  | { falha: { tipo: 'tempo_esgotado' | 'erro' | 'malformada'; vezes: number }; depois?: { valor: string | null; confianca: number } };

/**
 * Leituras por pergunta de uma aplicação: chave `CODIGO` ou, na matriz, `CODIGO.linha`.
 * Campo não programado é lido em branco com confiança 0,99.
 */
export type RoteiroLeitura = Record<string, LeituraSimulada>;

/** Uma chamada ao motor, como o motor a recebeu (RN-045): recorte e schema, sem contexto. */
export interface ChamadaMotor {
  /** Perguntas (e linhas) cujos campos foram nesta chamada, ex.: `PRESSAO_ALTA`, `SINTOMAS.dor`. */
  campos: string[];
  /** Página da versão de onde saíram os recortes. */
  pagina: number;
  /** Dimensões da imagem enviada, em pixels. */
  largura: number;
  altura: number;
  /** Schema exatamente como foi passado ao motor, serializado em JSON. */
  schema: string;
  /** Sucesso ou o tipo da falha programada. */
  resultado: 'ok' | 'tempo_esgotado' | 'erro' | 'malformada';
  em: Date;
}

export interface RespondenteGravado {
  id: string;
  /** Decifrados pelo harness; null quando anonimizado. */
  nome: string;
  data_nascimento: string | null;
  endereco: string | null;
  cpf: string | null;
  anonimizado: boolean;
}

export interface AplicacaoGravada {
  estado: string;
  respondente_id: string | null;
  data_aplicacao: string | null;
  local_aplicacao: string | null;
  motivo_descarte: string | null;
  motivo_reabertura: string | null;
  /** Valores de cada item como estão no banco, decifrados (DEC-077: apagados no descarte). */
  itens: { pergunta_codigo: string; linha_codigo: string | null; valor_ia: string | null; valor_final: string | null; estado: string }[];
}

export interface EliminacaoGravada {
  motivo: 'eliminacao' | 'anonimizacao_reabertura' | 'descarte_aplicacao';
  respondente_id_original: string | null;
  aplicacao_id: string | null;
  eliminado_em: Date;
  valido_ate: Date;
}

export interface Harness {
  /** URL base do servidor HTTP já iniciado (ex.: http://127.0.0.1:43210). */
  baseUrl: string;

  clock: {
    now(): Date;
    /** Avança o relógio da API e executa os jobs agendados que vencerem no intervalo. */
    advance(ms: number): Promise<void>;
  };

  scripts: {
    /**
     * Script de instalação (CA-035, PLANO §4.5), com a senha como se digitada no terminal.
     * Código 0 só quando cria o tenant e a conta; recusa (código diferente de 0) sem gravar
     * nada se o banco já tiver tenant ou se a senha não cumprir a RN-048.
     */
    instalar(dados: { instituicao: string; nome: string; email: string; senha: string }): Promise<SaidaScript>;
    /**
     * Script de redefinição de senha da única usuária (CA-037, PLANO §4.5): troca a senha,
     * encerra as sessões e audita `REDEFINICAO_SENHA`. Sem e-mail nem link (DEC-108).
     */
    redefinirSenha(novaSenha: string): Promise<SaidaScript>;
  };

  seed: {
    /**
     * Tenant ativo com a sua única usuária, sem passar pelo script de instalação. Atalho de
     * preparação para testes que não são sobre a instalação: dá uma usuária nova a cada
     * teste e permite dois tenants no mesmo banco para o CA-012 (defesa em profundidade,
     * DEC-116). Os scripts de `scripts` não são usados depois deste atalho.
     */
    tenant(dados: { nome: string; email: string; nomeUsuaria: string; senha: string }): Promise<{
      tenantId: string;
      usuarioId: string;
    }>;
    /** Projeto mínimo do tenant. */
    projeto(tenantId: string, nome: string): Promise<{ projetoId: string }>;
    /**
     * Parâmetro de configuração gravado pelo mesmo caminho do script do administrador da
     * plataforma (REQ seção 2.9), com auditoria. Ex.: `termo_consentimento` do tenant (DEC-094).
     */
    parametro(dados: { tenantId: string | null; projetoId?: string; chave: string; valor: string; competencia?: string }): Promise<void>;
    /**
     * Acrescenta ao custo de IA consumido pelo tenant no mês civil corrente (America/Sao_Paulo,
     * DEC-058) um valor em reais com duas casas (ex.: '499.00'), como se as chamadas já tivessem
     * sido feitas (CA-030).
     */
    consumoIa(dados: { tenantId: string; valorReais: string }): Promise<void>;
  };

  /** Motor de leitura simulado (DEC-123), no lugar do adaptador Claude. */
  motor: {
    /** Leituras da aplicação; vale para as chamadas feitas depois, inclusive nas retentativas. */
    programar(aplicacaoId: string, roteiro: RoteiroLeitura): void;
    /** Custo de cada chamada em dólar: o estimado antes (reserva) e o real depois (DEC-051). Padrão 0. */
    custo(dados: { estimadoUsd: number; realUsd: number }): void;
    /** Chamadas feitas ao motor para a aplicação, em ordem. */
    chamadas(aplicacaoId: string): Promise<ChamadaMotor[]>;
  };

  worker: {
    /** Roda os jobs do worker que já venceram no relógio atual até não sobrar nenhum. */
    processar(): Promise<void>;
  };

  inspect: {
    /** Tenants gravados, com o número de contas de cada um (CA-035). */
    tenants(): Promise<TenantGravado[]>;
    /** Quantas sessões não expiradas a conta tem. */
    sessoesAtivas(usuarioId: string): Promise<number>;
    auditoria(tenantId: string): Promise<EventoAuditoria[]>;
    /** HistoricoStatusProjeto em ordem cronológica, incluindo a criação (DEC-027, CA-027). */
    historicoStatusProjeto(projetoId: string): Promise<MudancaStatusProjeto[]>;
    contagemUpload(tenantId: string): Promise<ContagemUpload>;
    /** Quantas vezes `leitura.solicitada` foi registrada no outbox para a aplicação (FL-001). */
    leiturasSolicitadas(aplicacaoId: string): Promise<number>;
    /** `mapa_layout` da versão publicada; null em rascunho (DEC-048, DEC-106). */
    mapaLayout(versaoId: string): Promise<MapaLayoutGravado | null>;
    /** Respondentes do tenant (RF-005), em ordem de criação. */
    respondentes(tenantId: string): Promise<RespondenteGravado[]>;
    aplicacao(aplicacaoId: string): Promise<AplicacaoGravada>;
    /** ListaEliminacoes do tenant (ENT-019), em ordem de registro. */
    listaEliminacoes(tenantId: string): Promise<EliminacaoGravada[]>;
    /** Tudo o que a API, o worker e o motor escreveram no log desde o início do harness (RN-028). */
    logs(): Promise<string>;
  };

  close(): Promise<void>;
}

export type CriarHarness = () => Promise<Harness>;

// Especificador em variável para que o typecheck dos testes não dependa do código da API.
const MODULO = '@minhapesquisa/api/test-harness';

export async function criarHarness(): Promise<Harness> {
  let mod: { criarHarness?: CriarHarness };
  try {
    mod = (await import(MODULO)) as { criarHarness?: CriarHarness };
  } catch (e) {
    throw new Error(
      `IA-TEST: ${MODULO} ainda não existe; implementar no IMP-001 (IA-DEV). Causa: ${String(e)}`,
    );
  }
  if (typeof mod.criarHarness !== 'function') {
    throw new Error(`IA-TEST: ${MODULO} deve exportar criarHarness(): Promise<Harness>`);
  }
  return mod.criarHarness();
}
