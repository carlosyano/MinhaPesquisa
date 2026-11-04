// Interface do ambiente de teste (IA-TEST, DEC-053).
//
// Os testes deste diretório falam com a API só por HTTP, como um cliente real. O que não é
// observável pela API (relógio, e-mails enviados, auditoria, estado do MFA) chega por esta
// interface, que o IA-DEV implementa em `@minhapesquisa/api/test-harness` sem alterar este
// arquivo. Até essa implementação existir, todos os testes falham (vermelho esperado).
//
// Requisitos da implementação:
// - banco PostgreSQL 17 real com as migrações, RLS e papéis da DEC-046 (Testcontainers);
// - relógio e gerador de IDs injetáveis (PLANO §10.2): a API e o job de expiração usam `clock`;
// - envio de e-mail substituído por captura em memória; nenhum e-mail sai do processo;
// - o servidor de teste aceita `X-Forwarded-For` como IP do cliente, para que o limite de
//   20 requisições por minuto por IP em rotas públicas (Bloco P P.7) não misture testes.
//   Esse comportamento é só do ambiente de teste; em produção o IP vem do balanceador;
// - dados 100% sintéticos (Q-001).
//
// Acrescentado no IA-TEST do IMP-002:
// - armazenamento de objetos real ou equivalente (ex.: MinIO em contêiner), privado; os links
//   assinados de `getPageImage` precisam ser baixáveis pelo processo de teste com `fetch`;
// - antimalware real ou equivalente que reconheça o arquivo de teste EICAR (DEC-042), rodando
//   antes da verificação de tipo, sobre todo arquivo;
// - nenhum provedor de IA: a leitura (IMP-003) só é solicitada pelo outbox; `inspect` expõe as
//   solicitações para provar quando nada é lido.

export type Perfil = 'admin_tenant' | 'digitalizador' | 'analista' | 'analista_individual';

export type TipoEmail = 'convite' | 'recuperacao_senha' | 'reset_mfa';

export interface EmailCapturado {
  para: string;
  tipo: TipoEmail;
  /** Token em claro extraído do link do e-mail. */
  token: string;
  enviado_em: Date;
}

export interface EventoAuditoria {
  tenant_id: string;
  usuario_id: string | null;
  acao: string;
  entidade: string;
  registro_id: string | null;
  detalhes: unknown;
  criado_em: Date;
}

export interface EstadoUsuario {
  situacao: 'pendente_convite' | 'ativo' | 'inativo';
  mfa_ativo: boolean;
  /** Hash estável do segredo TOTP gravado (nunca o segredo), ou null se não houver segredo. */
  impressao_segredo_totp: string | null;
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

export interface SessaoAtiva {
  tipo: 'pre_sessao' | 'plena';
  etapa: 'mfa_verificacao' | 'mfa_cadastro' | null;
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

export interface Harness {
  /** URL base do servidor HTTP já iniciado (ex.: http://127.0.0.1:43210). */
  baseUrl: string;

  clock: {
    now(): Date;
    /** Avança o relógio da API e executa os jobs agendados que vencerem no intervalo. */
    advance(ms: number): Promise<void>;
  };

  mail: {
    enviados(): EmailCapturado[];
  };

  seed: {
    /**
     * Cria o tenant pelo mesmo caminho do script de criação (CA-035): tenant ativo e primeiro
     * administrador em `pendente_convite`, com convite de 24 h capturado em `mail`.
     */
    tenant(dados: { nome: string; emailAdmin: string; nomeAdmin: string }): Promise<{
      tenantId: string;
      adminId: string;
    }>;
    /** Projeto mínimo do tenant. Até o IMP-002 os projetos só nascem por aqui. */
    projeto(tenantId: string, nome: string): Promise<{ projetoId: string }>;
    /**
     * Usuário já ativo, com senha e MFA cadastrados, sem passar pelo convite. Atalho de
     * preparação para testes que não são sobre o convite. Sem `todosProjetos` nem `projetos`,
     * o vínculo é "todos os projetos" (RN-004).
     */
    usuarioAtivo(dados: {
      tenantId: string;
      email: string;
      nome: string;
      senha: string;
      perfis: Perfil[];
      todosProjetos?: boolean;
      projetos?: string[];
    }): Promise<{ usuarioId: string; segredoTotp: string }>;
    /**
     * Parâmetro de configuração gravado pelo mesmo caminho do script do administrador da
     * plataforma (REQ seção 2.9), com auditoria. Ex.: `termo_consentimento` do tenant (DEC-094).
     */
    parametro(dados: { tenantId: string | null; projetoId?: string; chave: string; valor: string }): Promise<void>;
  };

  inspect: {
    usuario(usuarioId: string): Promise<EstadoUsuario>;
    sessoesAtivas(usuarioId: string): Promise<SessaoAtiva[]>;
    auditoria(tenantId: string): Promise<EventoAuditoria[]>;
    /** HistoricoStatusProjeto em ordem cronológica, incluindo a criação (DEC-027, CA-027). */
    historicoStatusProjeto(projetoId: string): Promise<MudancaStatusProjeto[]>;
    contagemUpload(tenantId: string): Promise<ContagemUpload>;
    /** Quantas vezes `leitura.solicitada` foi registrada no outbox para a aplicação (FL-001). */
    leiturasSolicitadas(aplicacaoId: string): Promise<number>;
    /** `mapa_layout` da versão publicada; null em rascunho (DEC-048, DEC-106). */
    mapaLayout(versaoId: string): Promise<MapaLayoutGravado | null>;
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
