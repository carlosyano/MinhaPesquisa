// Ambiente de teste exigido por tests/support/harness.ts (IA-TEST do IMP-001, IMP-002 e
// IMP-005, DEC-053). Sobe PostgreSQL 17 real (Testcontainers) com papéis, migrações e RLS, e a
// API real com relógio controlado. Os scripts de instalação e de redefinição de senha rodam
// pelo mesmo código do script de linha de comando. Só para testes: nunca é importado pela
// aplicação.
//
// Variáveis opcionais:
//   MP_TEST_DATABASE_URL  URL de superusuário de um PostgreSQL 17 já em execução (sem Docker)
//   MP_TEST_PG_IMAGE      imagem do contêiner (padrão postgres:17-alpine)

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { aplicarMigracoes, criarPapeis } from '@minhapesquisa/db';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarApi } from './app.js';
import type { Config } from './config.js';
import { linha, linhas, sql } from './infra/banco.js';
import { AntimalwareEicar } from './infra/antimalware.js';
import { ArmazenamentoEmMemoria } from './infra/armazenamento.js';
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
  const config: Config = {
    urlBancoApp: urlComo(banco.superUrl, 'mp_app', senhaApp),
    urlBancoManutencao: urlComo(banco.superUrl, 'mp_manutencao', senhaManut),
    raizRepositorio: RAIZ,
    chaveHmacEmail: randomBytes(32),
    origensPermitidas: [],
    cookiesSeguros: false,
    confiarProxy: true,
    relogio,
    armazenamento,
    antimalware: new AntimalwareEicar(),
    gerarId: randomUUID,
  };
  const api = await criarApi(config);
  config.origensPermitidas.push(api.url);
  const n = api.nucleo;

  /** Jobs agendados que o relógio faz vencer. Sem concessões nem e-mail desde o IMP-005. */
  async function rodarJobs(): Promise<void> {}

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
      async parametro(d: { tenantId: string | null; projetoId?: string; chave: string; valor: string }) {
        await n.banco.manutencao(async (tx) => {
          await tx.execute(sql`
            INSERT INTO parametro_configuracao (id, tenant_id, projeto_id, chave, valor, alterado_em)
            VALUES (${n.id()}, ${d.tenantId}, ${d.projetoId ?? null}, ${d.chave}, ${d.valor}, ${n.agora()})
            ON CONFLICT ON CONSTRAINT uq_parametro DO UPDATE SET valor = EXCLUDED.valor, alterado_em = EXCLUDED.alterado_em`);
          if (d.tenantId) {
            await tx.execute(sql`
              INSERT INTO auditoria (id, tenant_id, usuario_id, acao, entidade, registro_id, canal, detalhes, criado_em)
              VALUES (${n.id()}, ${d.tenantId}, NULL, 'ALTERAR_PARAMETRO', 'ParametroConfiguracao', NULL, 'script',
                      ${JSON.stringify({ chave: d.chave })}::jsonb, ${n.agora()})`);
          }
        });
      },
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
            detalhes: unknown;
            criado_em: Date;
          }>(
            tx,
            sql`SELECT tenant_id, usuario_id, acao, entidade, registro_id, detalhes, criado_em
                  FROM auditoria WHERE tenant_id = ${tenantId} ORDER BY criado_em, id`,
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
    },

    async close() {
      await api.fechar();
      await armazenamento.fechar();
      await banco.parar();
    },
  };
}
