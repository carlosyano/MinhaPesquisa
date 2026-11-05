// Ambiente de teste exigido por tests/support/harness.ts (IA-TEST do IMP-001, IMP-002, IMP-003,
// IMP-005 e IMP-006, DEC-053). Sobe PostgreSQL 17 real (Testcontainers) com papéis, migrações e RLS, e a
// API real com relógio controlado. O worker de leitura é o real (DEC-124), com o motor simulado
// no lugar do adaptador Claude (DEC-123), e só roda quando o teste pede; nele rodam também as
// tarefas da importação de formulário, com o extrator de estrutura simulado (DEC-141, DEC-142).
// Os scripts de instalação e de redefinição de senha rodam
// pelo mesmo código do script de linha de comando. Só para testes: nunca é importado pela
// aplicação.
//
// Variáveis opcionais:
//   MP_TEST_DATABASE_URL  URL de superusuário de um PostgreSQL 17 já em execução (sem Docker)
//   MP_TEST_PG_IMAGE      imagem do contêiner (padrão postgres:17-alpine)

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { aplicarMigracoes, criarPapeis } from '@minhapesquisa/db';
import { dimensoes, ErroLeitura, type CampoSchema, type ReadEngine, type TipoFalha } from '@minhapesquisa/motor-leitura';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarApi } from './app.js';
import type { Config } from './config.js';
import { linha, linhas, sql } from './infra/banco.js';
import { AntimalwareEicar } from './infra/antimalware.js';
import { ArmazenamentoEmMemoria } from './infra/armazenamento.js';
import { criarFormularioRascunho, gravarConteudo } from './formularios/conteudo.js';
import { normalizarConteudo, type PerguntaEntrada, type RegraEntrada } from './regras/formularios.js';
import { carregarItens, competencia } from './leitura/dominio.js';
import { WorkerLeitura } from './leitura/worker.js';
import type { ExtratorEstrutura } from './leitura/extrator.js';
import { chavePaginaImportacao, pastaImportacao } from './leitura/importacao.js';
import type { PerguntaLida } from './regras/importacao.js';
import { MINUTO } from './infra/relogio.js';
import { criarTenantComUsuaria, instalar, redefinirSenha } from './scripts/instalacao.js';

const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));

async function prepararBanco(): Promise<{ superUrl: string; parar: () => Promise<void> }> {
  const externo = process.env.MP_TEST_DATABASE_URL;
  if (externo) {
    const nome = `mp_teste_${randomBytes(6).toString('hex')}`;
    const c = new pg.Client({ connectionString: externo });
    await c.connect();
    await c.query(`CREATE DATABASE ${nome}`);
    await c.end();
    const url = new URL(externo);
    url.pathname = `/${nome}`;
    return {
      superUrl: url.toString(),
      parar: async () => {
        const d = new pg.Client({ connectionString: externo });
        await d.connect();
        await d.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
        await d.end();
      },
    };
  }
  const conteiner: StartedPostgreSqlContainer = await new PostgreSqlContainer(process.env.MP_TEST_PG_IMAGE ?? 'postgres:17-alpine').start();
  return { superUrl: conteiner.getConnectionUri(), parar: async () => void (await conteiner.stop()) };
}

type Leitura = { valor: string | null; confianca: number; regiao?: { x: number; y: number; largura: number; altura: number } };
type LeituraSimulada = Leitura | { falha: { tipo: TipoFalha; vezes: number }; depois?: Leitura };

interface ChamadaMotor {
  campos: string[];
  pagina: number;
  largura: number;
  altura: number;
  schema: string;
  resultado: 'ok' | TipoFalha;
  em: Date;
}

/**
 * Motor simulado (DEC-123): devolve o que o teste programou para cada campo e registra a chamada
 * como o motor real a receberia. Um campo com `falha` faz falhar a chamada que o contém nas
 * primeiras `vezes` tentativas.
 */
class MotorSimulado {
  private readonly roteiros = new Map<string, Record<string, LeituraSimulada>>();
  private readonly tentativas = new Map<string, number>();
  private readonly registro = new Map<string, ChamadaMotor[]>();
  private custo = { estimadoUsd: 0, realUsd: 0 };

  constructor(private readonly agora: () => Date) {}

  programar(aplicacaoId: string, roteiro: Record<string, LeituraSimulada>): void {
    this.roteiros.set(aplicacaoId, roteiro);
  }

  definirCusto(c: { estimadoUsd: number; realUsd: number }): void {
    this.custo = { ...c };
  }

  chamadas(aplicacaoId: string): ChamadaMotor[] {
    return [...(this.registro.get(aplicacaoId) ?? [])];
  }

  /** `contexto.campos` traduz as chaves opacas do schema (c1, c2…) para as chaves do roteiro. */
  para(contexto: { aplicacaoId: string; pagina: number; campos: string[] }): ReadEngine {
    return {
      estimarCustoUsd: () => this.custo.estimadoUsd,
      lerRecorte: async (img: Buffer, schema: CampoSchema) => {
        const roteiro = this.roteiros.get(contexto.aplicacaoId) ?? {};
        const campos = schema.campos.map((c, k) => contexto.campos[k] ?? c.chave);
        let falha: TipoFalha | undefined;
        for (const c of campos) {
          const chave = `${contexto.aplicacaoId}|${c}`;
          const n = (this.tentativas.get(chave) ?? 0) + 1;
          this.tentativas.set(chave, n);
          const l = roteiro[c];
          if (!falha && l && 'falha' in l && n <= l.falha.vezes) falha = l.falha.tipo;
        }
        const { largura, altura } = dimensoes(img);
        const chamada: ChamadaMotor = { campos, pagina: contexto.pagina, largura, altura, schema: JSON.stringify(schema), resultado: falha ?? 'ok', em: this.agora() };
        this.registro.set(contexto.aplicacaoId, [...(this.registro.get(contexto.aplicacaoId) ?? []), chamada]);
        if (falha) throw new ErroLeitura(falha);
        return {
          custoUsd: this.custo.realUsd,
          leituras: campos.map((codigo, k) => {
            const chave = schema.campos[k].chave;
            const l = roteiro[codigo];
            const lido: Leitura = !l ? { valor: null, confianca: 0.99 } : 'falha' in l ? (l.depois ?? { valor: null, confianca: 0.99 }) : l;
            return { chave, valor: lido.valor, confianca: lido.confianca, regiao: lido.regiao ?? { x: 0, y: 0, largura: 1, altura: 1 } };
          }),
        };
      },
    };
  }
}

type PaginaExtraida = { perguntas: PerguntaLida[] } | { falha: { tipo: TipoFalha; vezes: number }; depois?: { perguntas: PerguntaLida[] } };

interface ChamadaExtrator {
  pagina: number;
  largura: number;
  altura: number;
  resultado: 'ok' | TipoFalha;
  em: Date;
}

/**
 * Extrator de estrutura simulado (DEC-141, como o motor da DEC-123): devolve o que o teste
 * programou para cada página e registra a chamada. Página com `falha` faz falhar as primeiras
 * `vezes` chamadas dela; página não programada não tem nenhuma pergunta.
 */
class ExtratorSimulado {
  private readonly roteiros = new Map<string, Record<number, PaginaExtraida>>();
  private readonly tentativas = new Map<string, number>();
  private readonly registro = new Map<string, ChamadaExtrator[]>();
  private custo = { estimadoUsd: 0, realUsd: 0 };

  constructor(private readonly agora: () => Date) {}

  programar(importacaoId: string, roteiro: Record<number, PaginaExtraida>): void {
    this.roteiros.set(importacaoId, roteiro);
  }

  definirCusto(c: { estimadoUsd: number; realUsd: number }): void {
    this.custo = { ...c };
  }

  chamadas(importacaoId: string): ChamadaExtrator[] {
    return [...(this.registro.get(importacaoId) ?? [])];
  }

  para(contexto: { importacaoId: string; pagina: number }): ExtratorEstrutura {
    return {
      estimarCustoUsd: () => this.custo.estimadoUsd,
      extrairPagina: async (img: Buffer) => {
        const p = this.roteiros.get(contexto.importacaoId)?.[contexto.pagina];
        const chave = `${contexto.importacaoId}|${contexto.pagina}`;
        const n = (this.tentativas.get(chave) ?? 0) + 1;
        this.tentativas.set(chave, n);
        const falha = p && 'falha' in p && n <= p.falha.vezes ? p.falha.tipo : undefined;
        const { largura, altura } = dimensoes(img);
        const chamada: ChamadaExtrator = { pagina: contexto.pagina, largura, altura, resultado: falha ?? 'ok', em: this.agora() };
        this.registro.set(contexto.importacaoId, [...(this.registro.get(contexto.importacaoId) ?? []), chamada]);
        if (falha) throw new ErroLeitura(falha);
        const perguntas = !p ? [] : 'falha' in p ? (p.depois?.perguntas ?? []) : p.perguntas;
        return { perguntas: structuredClone(perguntas), custoUsd: this.custo.realUsd };
      },
    };
  }
}

function urlComo(superUrl: string, usuario: string, senha: string): string {
  const u = new URL(superUrl);
  u.username = usuario;
  u.password = senha;
  return u.toString();
}

export async function criarHarness() {
  const banco = await prepararBanco();
  const senhaApp = randomBytes(18).toString('hex');
  const senhaManut = randomBytes(18).toString('hex');
  const su = new pg.Client({ connectionString: banco.superUrl });
  await su.connect();
  await criarPapeis(su);
  await su.query(`ALTER ROLE mp_app PASSWORD '${senhaApp}'`);
  await su.query(`ALTER ROLE mp_manutencao PASSWORD '${senhaManut}'`);
  await aplicarMigracoes(su);
  await su.end();

  let agora = new Date('2026-11-02T12:00:00.000Z');
  const relogio = { agora: () => new Date(agora) };
  const armazenamento = new ArmazenamentoEmMemoria(relogio.agora);
  await armazenamento.iniciar();
  const motor = new MotorSimulado(relogio.agora);
  const extrator = new ExtratorSimulado(relogio.agora);
  const logs: string[] = [];
  const config: Config = {
    urlBancoApp: urlComo(banco.superUrl, 'mp_app', senhaApp),
    urlBancoManutencao: urlComo(banco.superUrl, 'mp_manutencao', senhaManut),
    raizRepositorio: RAIZ,
    chaveHmacEmail: randomBytes(32),
    chaveCifraCampo: randomBytes(32),
    chaveHmacCpf: randomBytes(32),
    origensPermitidas: [],
    cookiesSeguros: false,
    confiarProxy: true,
    relogio,
    armazenamento,
    antimalware: new AntimalwareEicar(),
    gerarId: randomUUID,
    motorLeitura: (contexto) => motor.para(contexto),
    extratorEstrutura: (contexto) => extrator.para(contexto),
    log: (l) => void logs.push(l),
  };
  const api = await criarApi(config);
  config.origensPermitidas.push(api.url);
  const n = api.nucleo;

  const worker = new WorkerLeitura(n);

  /** Jobs agendados que o relógio faz vencer: as retentativas da leitura (REQ §6.6). */
  async function rodarJobs(): Promise<void> {
    await worker.executarVencidas();
  }

  return {
    baseUrl: api.url,

    clock: {
      now: () => new Date(agora),
      async advance(ms: number) {
        agora = new Date(agora.getTime() + ms);
        await rodarJobs();
      },
    },

    scripts: {
      instalar: (dados: { instituicao: string; nome: string; email: string; senha: string }) => instalar(n, dados),
      redefinirSenha: (novaSenha: string) => redefinirSenha(n, novaSenha),
    },

    seed: {
      tenant: (dados: { nome: string; email: string; nomeUsuaria: string; senha: string }) =>
        n.banco.manutencao((tx) => criarTenantComUsuaria(n, tx, dados)),

      async projeto(tenantId: string, nome: string) {
        const projetoId = n.id();
        await n.banco.manutencao((tx) =>
          tx.execute(sql`INSERT INTO projeto (id, tenant_id, nome, criado_em) VALUES (${projetoId}, ${tenantId}, ${nome}, ${n.agora()})`),
        );
        return { projetoId };
      },

      /** Mesmo caminho do script do administrador da plataforma: grava e audita (seção 2.9). */
      async parametro(d: { tenantId: string | null; projetoId?: string; chave: string; valor: string; competencia?: string }) {
        await n.banco.manutencao(async (tx) => {
          await tx.execute(sql`
            INSERT INTO parametro_configuracao (id, tenant_id, projeto_id, chave, valor, competencia, alterado_em)
            VALUES (${n.id()}, ${d.tenantId}, ${d.projetoId ?? null}, ${d.chave}, ${d.valor}, ${d.competencia ?? null}::date, ${n.agora()})
            ON CONFLICT ON CONSTRAINT uq_parametro DO UPDATE SET valor = EXCLUDED.valor, alterado_em = EXCLUDED.alterado_em`);
          if (d.tenantId) {
            await tx.execute(sql`
              INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, canal, detalhes, criado_em)
              VALUES (${n.id()}, ${d.tenantId}, NULL, 'ALTERAR_PARAMETRO', 'ParametroConfiguracao', NULL, 'script',
                      ${JSON.stringify({ chave: d.chave })}::jsonb, ${n.agora()})`);
          }
        });
      },

      /** Custo já consumido no mês civil corrente (CA-030). */
      async consumoIa(d: { tenantId: string; valorReais: string }) {
        const { inicio } = competencia(n.agora());
        await n.banco.manutencao((tx) =>
          tx.execute(sql`
            INSERT INTO consumo_ia (tenant_id, competencia, valor_reais) VALUES (${d.tenantId}, ${inicio}::date, ${d.valorReais}::numeric)
            ON CONFLICT (tenant_id, competencia) DO UPDATE SET valor_reais = consumo_ia.valor_reais + EXCLUDED.valor_reais`),
        );
      },

      /**
       * Rascunho anterior à REQ v2.4 (PLANO §11): versão 1 gravada direto, com as regras do IMP-002
       * (códigos únicos, sensibilidade da RN-047), sem a injeção nem as recusas da RN-050.
       */
      async rascunhoAntigo(d: { tenantId: string; projetoId: string; nome: string; conteudo: unknown }) {
        const c = d.conteudo as { perguntas: PerguntaEntrada[]; regras_salto: RegraEntrada[] };
        return n.banco.noTenant(d.tenantId, async (tx) => {
          const criado = await criarFormularioRascunho(n, tx, d);
          await gravarConteudo(n, tx, d.tenantId, criado.versaoId, normalizarConteudo(c.perguntas, c.regras_salto), c.regras_salto);
          return criado;
        });
      },

      /** Arquivo de onde sai a página da importação trocado por bytes que não são imagem (FL-004). */
      async corromperPaginaImportacao(importacaoId: string, numeroPagina: number) {
        const i = await n.banco.manutencao((tx) => linha<{ tenant_id: string }>(tx, sql`SELECT tenant_id FROM importacao_formulario WHERE id = ${importacaoId}`));
        if (!i) throw new Error(`importação ${importacaoId} não existe`);
        await armazenamento.gravar(chavePaginaImportacao(i.tenant_id, importacaoId, numeroPagina), Buffer.from('arquivo corrompido'), 'image/jpeg');
      },

      /** Arquivo da página trocado por bytes que não são imagem (DEC-130). */
      async corromperPagina(aplicacaoId: string, numeroPagina: number) {
        const chaves = await n.banco.manutencao((tx) =>
          linhas<{ chave_storage: string }>(
            tx,
            sql`SELECT chave_storage FROM pagina_aplicacao
                 WHERE aplicacao_id = ${aplicacaoId} AND tipo = 'formulario' AND numero_pagina = ${numeroPagina}`,
          ),
        );
        for (const { chave_storage } of chaves) await armazenamento.gravar(chave_storage, Buffer.from('arquivo corrompido'), 'image/jpeg');
      },
    },

    extrator: {
      programar: (importacaoId: string, roteiro: Record<number, PaginaExtraida>) => extrator.programar(importacaoId, roteiro),
      custo: (c: { estimadoUsd: number; realUsd: number }) => extrator.definirCusto(c),
      chamadas: async (importacaoId: string) => extrator.chamadas(importacaoId),
    },

    motor: {
      programar: (aplicacaoId: string, roteiro: Record<string, LeituraSimulada>) => motor.programar(aplicacaoId, roteiro),
      custo: (c: { estimadoUsd: number; realUsd: number }) => motor.definirCusto(c),
      chamadas: async (aplicacaoId: string) => motor.chamadas(aplicacaoId),
    },

    worker: {
      processar: () => worker.processar(),
    },

    inspect: {
      async tenants() {
        return n.banco.manutencao((tx) =>
          linhas<{ tenantId: string; nome: string; usuarios: number }>(
            tx,
            sql`SELECT t.id AS "tenantId", t.nome, (SELECT count(*)::int FROM usuario u WHERE u.tenant_id = t.id) AS usuarios
                  FROM tenant t ORDER BY t.criado_em, t.id`,
          ),
        );
      },

      async sessoesAtivas(usuarioId: string) {
        const agoraJa = n.agora();
        const r = await n.banco.manutencao((tx) =>
          linha<{ n: number }>(
            tx,
            sql`SELECT count(*)::int AS n FROM sessao
                 WHERE usuario_id = ${usuarioId} AND tipo = 'plena' AND revogada_em IS NULL
                   AND expira_absoluta_em > ${agoraJa}
                   AND ultima_atividade_em > ${new Date(agoraJa.getTime() - 30 * MINUTO)}`,
          ),
        );
        return r!.n;
      },

      async auditoria(tenantId: string) {
        const r = await n.banco.manutencao((tx) =>
          linhas<{
            tenant_id: string;
            usuario_id: string | null;
            acao: string;
            entidade: string;
            registro_id: string | null;
            campo: string | null;
            detalhes: unknown;
            criado_em: Date;
          }>(
            tx,
            sql`SELECT tenant_id, usuario_id, acao, entidade, registro_id, campo, detalhes, criado_em
                  FROM auditoria WHERE tenant_id = ${tenantId} ORDER BY criado_em, seq`,
          ),
        );
        return r.map((e) => ({ ...e, criado_em: new Date(e.criado_em) }));
      },

      async historicoStatusProjeto(projetoId: string) {
        const r = await n.banco.manutencao((tx) =>
          linhas<{ status: 'ativo' | 'arquivado'; usuario_id: string; registrado_em: Date }>(
            tx,
            sql`SELECT status_novo AS status, alterado_por AS usuario_id, alterado_em AS registrado_em
                  FROM historico_status_projeto WHERE projeto_id = ${projetoId} ORDER BY alterado_em, id`,
          ),
        );
        return r.map((m) => ({ ...m, registrado_em: new Date(m.registrado_em) }));
      },

      async contagemUpload(tenantId: string) {
        const r = await n.banco.manutencao((tx) =>
          linha<{ aplicacoes: number; imagens: number }>(
            tx,
            sql`SELECT (SELECT count(*)::int FROM aplicacao WHERE tenant_id = ${tenantId}) AS aplicacoes,
                       (SELECT count(*)::int FROM pagina_aplicacao WHERE tenant_id = ${tenantId}) AS imagens`,
          ),
        );
        return { aplicacoes: r!.aplicacoes, imagens: r!.imagens, objetos: await armazenamento.contar(`tenant/${tenantId}/`) };
      },

      async leiturasSolicitadas(aplicacaoId: string) {
        const r = await n.banco.manutencao((tx) =>
          linha<{ n: number }>(
            tx,
            sql`SELECT count(*)::int AS n FROM outbox WHERE tipo = 'leitura.solicitada' AND payload ->> 'aplicacao_id' = ${aplicacaoId}`,
          ),
        );
        return r!.n;
      },

      async mapaLayout(versaoId: string) {
        const r = await n.banco.manutencao((tx) =>
          linha<{ mapa_layout: unknown }>(tx, sql`SELECT mapa_layout FROM versao WHERE id = ${versaoId}`),
        );
        if (!r) throw new Error(`versão ${versaoId} não existe`);
        return (r.mapa_layout ?? null) as never;
      },

      async respondentes(tenantId: string) {
        const r = await n.banco.manutencao((tx) =>
          linhas<{ id: string; nome: string; data_nascimento: string | null; endereco: string | null; cpf_cifrado: string | null; anonimizado: boolean }>(
            tx,
            sql`SELECT id, nome, to_char(data_nascimento, 'YYYY-MM-DD') AS data_nascimento, endereco, cpf_cifrado, anonimizado
                  FROM respondente WHERE tenant_id = ${tenantId} ORDER BY criado_em, id`,
          ),
        );
        return r.map(({ cpf_cifrado, ...x }) => ({ ...x, cpf: n.decifrar(cpf_cifrado) }));
      },

      async aplicacao(aplicacaoId: string) {
        return n.banco.manutencao(async (tx) => {
          const a = await linha<{
            estado: string;
            respondente_id: string | null;
            data_aplicacao: string | null;
            local_aplicacao: string | null;
            motivo_descarte: string | null;
            motivo_reabertura: string | null;
          }>(
            tx,
            sql`SELECT estado, respondente_id, to_char(data_aplicacao, 'YYYY-MM-DD') AS data_aplicacao, local_aplicacao,
                       motivo_descarte, motivo_reabertura
                  FROM aplicacao WHERE id = ${aplicacaoId}`,
          );
          if (!a) throw new Error(`aplicação ${aplicacaoId} não existe`);
          const itens = await carregarItens(n, tx, aplicacaoId);
          return {
            ...a,
            local_aplicacao: n.decifrar(a.local_aplicacao),
            motivo_descarte: n.decifrar(a.motivo_descarte),
            motivo_reabertura: n.decifrar(a.motivo_reabertura),
            itens: itens.map((i) => ({ pergunta_codigo: i.codigo, linha_codigo: i.linha_codigo, valor_ia: i.valor_ia, valor_final: i.valor_final, estado: i.estado })),
          };
        });
      },

      async listaEliminacoes(tenantId: string) {
        const r = await n.banco.manutencao((tx) =>
          linhas<{
            motivo: 'eliminacao' | 'anonimizacao_reabertura' | 'descarte_aplicacao';
            respondente_id_original: string | null;
            aplicacao_id: string | null;
            eliminado_em: Date;
            valido_ate: Date;
          }>(
            tx,
            sql`SELECT motivo, respondente_id_original, aplicacao_id, eliminado_em, valido_ate
                  FROM lista_eliminacoes WHERE tenant_id = ${tenantId} ORDER BY eliminado_em, id`,
          ),
        );
        return r.map((e) => ({ ...e, eliminado_em: new Date(e.eliminado_em), valido_ate: new Date(e.valido_ate) }));
      },

      async logs() {
        return logs.join('\n');
      },

      /** ImportacaoFormulario, as tarefas que restam e os arquivos que restam na pasta (DEC-142). */
      async importacao(importacaoId: string) {
        return n.banco.manutencao(async (tx) => {
          const i = await linha<{ tenant_id: string; estado: string; chave_storage: string | null }>(
            tx,
            sql`SELECT tenant_id, estado, chave_storage FROM importacao_formulario WHERE id = ${importacaoId}`,
          );
          if (!i) throw new Error(`importação ${importacaoId} não existe`);
          const tarefas = await linhas<{ pagina: number; estado: string; tentativas: number }>(
            tx,
            sql`SELECT pagina, situacao AS estado, tentativas FROM tarefa_importacao WHERE importacao_id = ${importacaoId} ORDER BY pagina`,
          );
          return { estado: i.estado, chave_storage: i.chave_storage, objetos: await armazenamento.contar(pastaImportacao(i.tenant_id, importacaoId)), tarefas };
        });
      },

      async contagemImportacao(tenantId: string) {
        const r = await n.banco.manutencao((tx) =>
          linha<{ importacoes: number; formularios: number }>(
            tx,
            sql`SELECT (SELECT count(*)::int FROM importacao_formulario WHERE tenant_id = ${tenantId}) AS importacoes,
                       (SELECT count(*)::int FROM formulario WHERE tenant_id = ${tenantId}) AS formularios`,
          ),
        );
        return { importacoes: r!.importacoes, formularios: r!.formularios, objetos: await armazenamento.contar(`tenant/${tenantId}/importacao/`) };
      },

      /** Valores como estão no banco, sem decifrar (DEC-131). */
      async itensGravados(aplicacaoId: string) {
        return n.banco.manutencao((tx) =>
          linhas<{ pergunta_codigo: string; valor_ia: string | null; valor_final: string | null }>(
            tx,
            sql`SELECT p.codigo AS pergunta_codigo, i.valor_ia, i.valor_final
                  FROM item_resposta i JOIN pergunta p ON p.id = i.pergunta_id
                 WHERE i.aplicacao_id = ${aplicacaoId} ORDER BY p.ordem, i.id`,
          ),
        );
      },
    },

    banco: {
      /** UPDATE direto, sem a API; a recusa do banco devolve o nome da constraint (DEC-131). */
      async tentarAtualizarAplicacao(
        aplicacaoId: string,
        m: { estado?: string; data_aplicacao?: string | null; local_aplicacao?: string | null; versao_id?: string | null },
      ) {
        const muda = (k: keyof typeof m) => (k in m ? 1 : 0);
        try {
          await n.banco.manutencao((tx) =>
            tx.execute(sql`
              UPDATE aplicacao
                 SET estado = CASE WHEN ${muda('estado')} = 1 THEN ${m.estado ?? null} ELSE estado END,
                     data_aplicacao = CASE WHEN ${muda('data_aplicacao')} = 1 THEN ${m.data_aplicacao ?? null}::date ELSE data_aplicacao END,
                     local_aplicacao = CASE WHEN ${muda('local_aplicacao')} = 1 THEN ${m.local_aplicacao ?? null} ELSE local_aplicacao END,
                     versao_id = CASE WHEN ${muda('versao_id')} = 1 THEN ${m.versao_id ?? null}::uuid ELSE versao_id END
               WHERE id = ${aplicacaoId}`),
          );
          return { aceita: true };
        } catch (e) {
          const constraint = (e as { constraint?: string; cause?: { constraint?: string } }).constraint ?? (e as { cause?: { constraint?: string } }).cause?.constraint;
          return { aceita: false, ...(constraint ? { constraint } : {}) };
        }
      },
    },

    async close() {
      await api.fechar();
      await armazenamento.fechar();
      await banco.parar();
    },
  };
}
