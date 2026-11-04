// Modo de demonstração local (DEC-104): sobe PostgreSQL 17 descartável, a API real e uma página
// simples para baixar o PDF e enviar fotos reais do formulário preenchido. Só para a máquina
// do desenvolvedor: tudo escuta em 127.0.0.1, os segredos são gerados a cada execução e nada
// sobrevive ao encerramento (banco no contêiner, imagens em memória).
//
// Não é a instalação do notebook: o armazenamento é o em memória dos testes e o antimalware é
// o equivalente EICAR (DEC-102), a menos que MP_CLAMD_HOST aponte para um clamd real. Só dados
// sintéticos (GX-001).
//
// Variáveis opcionais:
//   MP_DEMO_DATABASE_URL  superusuário de um PostgreSQL 17 já em execução (sem Docker)
//   MP_DEMO_PORTA         porta da página (padrão 8080)
//   MP_CLAMD_HOST, MP_CLAMD_PORTA  clamd real em vez do equivalente EICAR

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { aplicarMigracoes, criarPapeis } from '@minhapesquisa/db';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, request as requisitarHttp, type IncomingMessage, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarApi } from '../app.js';
import type { Config } from '../config.js';
import { AntimalwareClamd, AntimalwareEicar, type Antimalware } from '../infra/antimalware.js';
import { ArmazenamentoEmMemoria } from '../infra/armazenamento.js';
import { relogioDoSistema } from '../infra/relogio.js';
import { criarTenantComUsuaria } from '../scripts/instalacao.js';
import { PAGINA_DEMO } from './pagina.js';

const HOST = '127.0.0.1'; // nunca exposto na rede: sem TLS, segredos impressos no terminal
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const EMAIL = 'ana.silva@example.com';

if (process.env.NODE_ENV === 'production') {
  console.error('modo de demonstração recusado com NODE_ENV=production (DEC-104)');
  process.exit(1);
}

function urlComo(superUrl: string, usuario: string, senha: string): string {
  const u = new URL(superUrl);
  u.username = usuario;
  u.password = senha;
  return u.toString();
}

async function prepararBanco(): Promise<{ superUrl: string; parar: () => Promise<void> }> {
  const externo = process.env.MP_DEMO_DATABASE_URL;
  if (externo) {
    const nome = `mp_demo_${randomBytes(6).toString('hex')}`;
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
  const conteiner = await new PostgreSqlContainer('postgres:17-alpine').start();
  return { superUrl: conteiner.getConnectionUri(), parar: async () => void (await conteiner.stop()) };
}

/** Formulário sintético de duas páginas: os 5 campos da RN-017 e duas perguntas sim/não. */
function conteudoDemo() {
  let ordem = 0;
  const q = (p: Record<string, unknown>) => ({ ...p, ordem: ++ordem });
  return {
    perguntas: [
      q({ codigo: 'NOME', tipo: 'texto_curto', enunciado: 'Nome completo', pagina: 1, campo_respondente: 'nome' }),
      q({ codigo: 'DATA_NASCIMENTO', tipo: 'data', enunciado: 'Data de nascimento', pagina: 1, campo_respondente: 'data_nascimento' }),
      q({ codigo: 'CPF', tipo: 'cpf', enunciado: 'CPF', pagina: 1, campo_respondente: 'cpf' }),
      q({ codigo: 'DATA_APLICACAO', tipo: 'data', enunciado: 'Data da aplicação', pagina: 1, campo_aplicacao: 'data_aplicacao' }),
      q({ codigo: 'LOCAL_APLICACAO', tipo: 'texto_curto', enunciado: 'Local da aplicação', pagina: 1, campo_aplicacao: 'local_aplicacao' }),
      q({ codigo: 'PRATICA_ATIVIDADE', tipo: 'sim_nao', enunciado: 'Pratica atividade física?', pagina: 2 }),
      q({ codigo: 'DORME_BEM', tipo: 'sim_nao', enunciado: 'Dorme bem à noite?', pagina: 2 }),
    ],
    regras_salto: [],
  };
}

/** Cliente da própria API, com sessão criada direto no banco (não consome o TOTP do usuário). */
function clienteSemente(base: string, origem: string, sessao: string) {
  const csrf = randomBytes(16).toString('hex');
  return async (metodo: string, caminho: string, corpo?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { cookie: `mp_session=${sessao}; mp_csrf=${csrf}`, accept: 'application/json, application/problem+json', ...extra };
    if (metodo !== 'GET') Object.assign(headers, { origin: origem, 'x-csrf-token': csrf });
    if (corpo !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(base + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const texto = await r.text();
    if (r.status >= 400) throw new Error(`${metodo} ${caminho} → ${r.status} ${texto.slice(0, 300)}`);
    return { corpo: texto ? JSON.parse(texto) : undefined, etag: r.headers.get('etag') };
  };
}

/** Repassa tudo que não é a página para a API, para que o navegador fale com uma só origem. */
function proxy(apiUrl: string, req: IncomingMessage, res: ServerResponse): void {
  const alvo = new URL(req.url ?? '/', apiUrl);
  const headers = { ...req.headers, host: alvo.host };
  const p = requisitarHttp(alvo, { method: req.method, headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  p.on('error', () => res.writeHead(502).end());
  req.pipe(p);
}

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

const porta = Number(process.env.MP_DEMO_PORTA ?? 8080);
const origens = [`http://${HOST}:${porta}`, `http://localhost:${porta}`];

const armazenamento = new ArmazenamentoEmMemoria(relogioDoSistema.agora);
await armazenamento.iniciar();
const antimalware: Antimalware = process.env.MP_CLAMD_HOST
  ? new AntimalwareClamd(process.env.MP_CLAMD_HOST, Number(process.env.MP_CLAMD_PORTA ?? 3310))
  : new AntimalwareEicar();

const config: Config = {
  urlBancoApp: urlComo(banco.superUrl, 'mp_app', senhaApp),
  urlBancoManutencao: urlComo(banco.superUrl, 'mp_manutencao', senhaManut),
  raizRepositorio: RAIZ,
  chaveHmacEmail: randomBytes(32),
  origensPermitidas: origens,
  cookiesSeguros: false, // HTTP local; por isso a demonstração só escuta em 127.0.0.1
  confiarProxy: false,
  relogio: relogioDoSistema,
  armazenamento,
  antimalware,
  gerarId: randomUUID,
};
const api = await criarApi(config, 0, HOST);
const n = api.nucleo;

// Tenant e a usuária única (DEC-109), pelo mesmo código da instalação, com senha gerada.
// A senha leva maiúscula, minúscula e dígito fixos para cumprir a RN-048.
const senha = `Demo${randomBytes(9).toString('base64url')}7a`;
const sessao = await n.banco.manutencao(async (tx) => {
  const { tenantId, usuarioId } = await criarTenantComUsuaria(n, tx, {
    nome: 'Instituto Demonstração',
    nomeUsuaria: 'Ana Silva',
    email: EMAIL,
    senha,
  });
  return n.criarSessao(tx, { tenantId, usuarioId, ip: HOST });
});

// Projeto e formulário publicados pela própria API (mesmas validações da RN-017 e do layout).
const chamar = clienteSemente(api.url, origens[0]!, sessao.segredo);
const idem = () => ({ 'idempotency-key': randomUUID() });
const projeto = await chamar('POST', '/projects', { nome: 'Pesquisa de demonstração' }, idem());
const form = await chamar('POST', '/forms', { nome: 'Questionário de demonstração', projeto_id: projeto.corpo.id }, idem());
const formId: string = form.corpo.id;
const versaoId: string = form.corpo.versoes[0].id;
const caminhoVersao = `/forms/${formId}/versions/${versaoId}`;
const atual = await chamar('GET', caminhoVersao);
await chamar('PUT', caminhoVersao, conteudoDemo(), { 'if-match': atual.etag ?? '' });
await chamar('POST', `${caminhoVersao}/publish`);
await chamar('POST', '/auth/logout'); // a sessão da semente não fica aberta

const dadosPagina = JSON.stringify({ projetoId: projeto.corpo.id, formId, versaoId, email: EMAIL });
const pagina = createServer((req, res) => {
  const caminho = (req.url ?? '/').split('?')[0];
  if (req.method === 'GET' && caminho === '/') {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'self'; img-src 'self' http://127.0.0.1:*; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      'cache-control': 'no-store',
    });
    res.end(PAGINA_DEMO.replace('__DADOS__', dadosPagina.replace(/</g, '\\u003c')));
    return;
  }
  proxy(api.url, req, res);
});
await new Promise<void>((ok) => pagina.listen(porta, HOST, ok));

console.log(`MinhaPesquisa — modo de demonstração (DEC-104). Só dados sintéticos (GX-001).
  página:  http://${HOST}:${porta}
  e-mail:  ${EMAIL}
  senha:   ${senha}
  antimalware: ${process.env.MP_CLAMD_HOST ? `clamd em ${process.env.MP_CLAMD_HOST}` : 'equivalente EICAR (sem ClamAV)'}
Tudo some ao encerrar (Ctrl+C).`);

async function encerrar(): Promise<void> {
  pagina.close();
  await api.fechar();
  await armazenamento.fechar();
  await banco.parar();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
