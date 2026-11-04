// Ambiente de teste exigido por tests/support/harness.ts (IA-TEST do IMP-001, DEC-053).
// Sobe PostgreSQL 17 real (Testcontainers) com papéis, migrações e RLS, e a API real com
// relógio controlado e e-mail capturado em memória. Só para testes: nunca é importado pela
// aplicação em produção.
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
import { cifrar, decifrar, hashSenha, novoSegredoTotp, normalizarEmail, sha256 } from './infra/cripto.js';
import { AntimalwareEicar } from './infra/antimalware.js';
import { ArmazenamentoEmMemoria } from './infra/armazenamento.js';
import { MailerEmMemoria } from './infra/mailer.js';
import { MINUTO } from './infra/relogio.js';
import type { Perfil } from './nucleo.js';
import { criarTenant } from './scripts/tenant.js';

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
  const mailer = new MailerEmMemoria(relogio.agora);
  const armazenamento = new ArmazenamentoEmMemoria(relogio.agora);
  await armazenamento.iniciar();
  const config: Config = {
    urlBancoApp: urlComo(banco.superUrl, 'mp_app', senhaApp),
    urlBancoManutencao: urlComo(banco.superUrl, 'mp_manutencao', senhaManut),
    raizRepositorio: RAIZ,
    chaveHmacEmail: randomBytes(32),
    chaveCifraMfa: randomBytes(32),
    origensPermitidas: [],
    urlWeb: 'https://app.minhapesquisa.example.com.br',
    cookiesSeguros: false,
    confiarProxy: true,
    relogio,
    mailer,
    armazenamento,
    antimalware: new AntimalwareEicar(),
    gerarId: randomUUID,
  };
  const api = await criarApi(config);
  config.origensPermitidas.push(api.url);
  const n = api.nucleo;

  /** Jobs agendados que o relógio faz vencer: expiração de concessões e outbox. */
  async function rodarJobs(): Promise<void> {
    await n.banco.manutencao((tx) =>
      tx.execute(sql`UPDATE concessao_acesso_individual SET ativo = false WHERE ativo AND valido_ate <= ${n.agora()}`),
    );
    await n.despacharOutbox();
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

    mail: {
      enviados: () => mailer.enviados.map((m) => ({ para: m.para, tipo: m.tipo, token: m.token, enviado_em: m.enviado_em })),
    },

    seed: {
      tenant: (dados: { nome: string; emailAdmin: string; nomeAdmin: string }) => criarTenant(n, dados),

      async projeto(tenantId: string, nome: string) {
        const projetoId = n.id();
        await n.banco.manutencao((tx) =>
          tx.execute(sql`INSERT INTO projeto (id, tenant_id, nome, criado_em) VALUES (${projetoId}, ${tenantId}, ${nome}, ${n.agora()})`),
        );
        return { projetoId };
      },

      async usuarioAtivo(d: {
        tenantId: string;
        email: string;
        nome: string;
        senha: string;
        perfis: Perfil[];
        todosProjetos?: boolean;
        projetos?: string[];
      }) {
        const usuarioId = n.id();
        const segredoTotp = novoSegredoTotp();
        const todos = d.todosProjetos ?? !d.projetos?.length;
        const hash = await hashSenha(d.senha);
        await n.banco.manutencao(async (tx) => {
          await tx.execute(sql`
            INSERT INTO usuario (id, tenant_id, email, nome, senha_hash, mfa_secret, mfa_ativo, situacao, todos_projetos, criado_em)
            VALUES (${usuarioId}, ${d.tenantId}, ${normalizarEmail(d.email)}, ${d.nome}, ${hash},
                    ${cifrar(n.config.chaveCifraMfa, segredoTotp)}, true, 'ativo', ${todos}, ${n.agora()})`);
          for (const codigo of d.perfis) {
            await tx.execute(sql`
              INSERT INTO usuario_perfil (id, tenant_id, usuario_id, perfil_id, criado_em)
              SELECT ${n.id()}, ${d.tenantId}, ${usuarioId}, id, ${n.agora()} FROM perfil
               WHERE tenant_id = ${d.tenantId} AND codigo = ${codigo}`);
          }
          for (const projetoId of todos ? [] : (d.projetos ?? [])) {
            await tx.execute(sql`
              INSERT INTO vinculo_usuario_projeto (id, tenant_id, usuario_id, projeto_id, criado_em)
              VALUES (${n.id()}, ${d.tenantId}, ${usuarioId}, ${projetoId}, ${n.agora()})`);
          }
        });
        return { usuarioId, segredoTotp };
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
      async usuario(usuarioId: string) {
        const u = await n.banco.manutencao((tx) =>
          linha<{ situacao: 'pendente_convite' | 'ativo' | 'inativo'; mfa_ativo: boolean; mfa_secret: string | null }>(
            tx,
            sql`SELECT situacao, mfa_ativo, mfa_secret FROM usuario WHERE id = ${usuarioId}`,
          ),
        );
        if (!u) throw new Error(`usuário ${usuarioId} não existe`);
        return {
          situacao: u.situacao,
          mfa_ativo: u.mfa_ativo,
          impressao_segredo_totp: u.mfa_secret ? sha256(decifrar(n.config.chaveCifraMfa, u.mfa_secret)).toString('hex') : null,
        };
      },

      async sessoesAtivas(usuarioId: string) {
        const agoraJa = n.agora();
        return n.banco.manutencao((tx) =>
          linhas<{ tipo: 'pre_sessao' | 'plena'; etapa: 'mfa_verificacao' | 'mfa_cadastro' | null }>(
            tx,
            sql`SELECT tipo, etapa FROM sessao
                 WHERE usuario_id = ${usuarioId} AND revogada_em IS NULL AND expira_absoluta_em > ${agoraJa}
                   AND (tipo = 'pre_sessao' OR ultima_atividade_em > ${new Date(agoraJa.getTime() - 30 * MINUTO)})
                 ORDER BY criada_em`,
          ),
        );
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
