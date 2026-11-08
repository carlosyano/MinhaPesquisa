// Modo de demonstração local (DEC-104, DEC-168): sobe PostgreSQL 17, a API real e uma página
// simples para importar um formulário de um modelo, baixar o PDF, enviar fotos reais do
// formulário preenchido e exportar a planilha em formato longo (RF-012). Só para a máquina
// do desenvolvedor: tudo escuta em 127.0.0.1.
//
// Os dados ficam entre as execuções (DEC-168): o banco num contêiner Docker com volume próprio
// (`minhapesquisa-demo-pg`, nunca o PostgreSQL da instalação), as imagens e as exportações em
// disco e os segredos (senhas, chaves de cifra e de HMAC) em estado.json, tudo na pasta da
// demonstração, separada da instalação. A semente (tenant, usuária, projeto e formulário) só
// roda na primeira vez.
//
// Não é a instalação do notebook: o antimalware é o equivalente EICAR (DEC-102), a menos que
// MP_DEFENDER=true peça o Microsoft Defender real (DEC-115, só no Windows). Só dados sintéticos
// (GX-001).
//
// Variáveis opcionais:
//   MP_DEMO_ZERAR=true    apaga o contêiner, o volume e a pasta da demonstração e recomeça
//   MP_DEMO_PASTA         pasta da demonstração (padrão %LOCALAPPDATA%\MinhaPesquisaDemo)
//   MP_DEMO_DATABASE_URL  superusuário de um PostgreSQL 17 já em execução (sem Docker); aí a
//                         demonstração é descartável: banco criado e apagado a cada execução,
//                         imagens em memória e segredos novos
//   MP_DEMO_PORTA         porta da página (padrão 8080)
//   MP_DEFENDER=true      Microsoft Defender (MpCmdRun) em vez do equivalente EICAR
//   MP_DEMO_CHAVE_IA      chave da API da Anthropic para a leitura real (DEC-125); só em memória,
//                         nunca gravada. Sem ela, o envio funciona e a leitura fica parada.
//   MP_DEMO_MODELO        modelo da leitura (padrão: o da instalação, DEC-122)
//   MP_DEMO_COTACAO       cotação do dólar do mês, fictícia (padrão 5.00, DEC-058)

import { aplicarMigracoes, criarPapeis } from '@minhapesquisa/db';
import { AdaptadorClaude } from '@minhapesquisa/motor-leitura';
import { sql } from 'drizzle-orm';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request as requisitarHttp, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { criarApi } from '../app.js';
import type { Config } from '../config.js';
import { AntimalwareDefender, AntimalwareEicar, type Antimalware } from '../infra/antimalware.js';
import { ArmazenamentoEmMemoria } from '../infra/armazenamento.js';
import { ArmazenamentoEmDisco } from '../infra/armazenamento-disco.js';
import { linhas } from '../infra/banco.js';
import { relogioDoSistema } from '../infra/relogio.js';
import { competencia } from '../leitura/dominio.js';
import { ExtratorClaude } from '../leitura/extrator.js';
import { WorkerLeitura } from '../leitura/worker.js';
import { IA_PADRAO } from '../local.js';
import { criarTenantComUsuaria } from '../scripts/instalacao.js';
import { PAGINA_DEMO } from './pagina.js';

const HOST = '127.0.0.1'; // nunca exposto na rede: sem TLS, segredos impressos no terminal
const RAIZ = fileURLToPath(new URL('../../../../', import.meta.url));
const EMAIL = 'ana.silva@example.com';
const CONTEINER = 'minhapesquisa-demo-pg';
const VOLUME = 'minhapesquisa-demo-dados';
const EXTERNO = process.env.MP_DEMO_DATABASE_URL;
const PERSISTENTE = !EXTERNO;
const PASTA = process.env.MP_DEMO_PASTA?.trim() || join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'MinhaPesquisaDemo');
const ARQUIVO_ESTADO = join(PASTA, 'estado.json');

if (process.env.NODE_ENV === 'production') {
  console.error('modo de demonstração recusado com NODE_ENV=production (DEC-104)');
  process.exit(1);
}

/** Segredos e o projeto da semente; em estado.json no modo persistente (DEC-168). */
interface Estado {
  senhaPostgres: string;
  senhaApp: string;
  senhaManut: string;
  senhaUsuaria: string;
  chaveHmacEmail: string;
  chaveCifraCampo: string;
  chaveHmacCpf: string;
  projetoId?: string;
}

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function dockerOk(...args: string[]): boolean {
  try {
    docker(...args);
    return true;
  } catch {
    return false;
  }
}

/** Apaga o contêiner, o volume e a pasta da demonstração. */
function zerar(): void {
  if (dockerOk('container', 'inspect', CONTEINER)) docker('rm', '-f', CONTEINER);
  if (dockerOk('volume', 'inspect', VOLUME)) docker('volume', 'rm', VOLUME);
  rmSync(PASTA, { recursive: true, force: true });
}

function novoEstado(): Estado {
  const chave = () => randomBytes(32).toString('base64');
  return {
    senhaPostgres: randomBytes(18).toString('hex'),
    senhaApp: randomBytes(18).toString('hex'),
    senhaManut: randomBytes(18).toString('hex'),
    // Maiúscula, minúscula e dígito fixos para cumprir a RN-048.
    senhaUsuaria: `Demo${randomBytes(9).toString('base64url')}7a`,
    chaveHmacEmail: chave(),
    chaveCifraCampo: chave(),
    chaveHmacCpf: chave(),
  };
}

function gravarEstado(e: Estado): void {
  mkdirSync(PASTA, { recursive: true });
  writeFileSync(ARQUIVO_ESTADO, JSON.stringify(e, null, 2), { mode: 0o600 });
}

/**
 * Estado desta execução. Sem estado.json não há como decifrar os dados antigos: o contêiner e o
 * volume que sobraram são apagados e tudo recomeça.
 */
function carregarEstado(): Estado {
  if (!PERSISTENTE) return novoEstado();
  if (process.env.MP_DEMO_ZERAR === 'true') {
    zerar();
    console.log('demonstração zerada (MP_DEMO_ZERAR=true)');
  }
  if (existsSync(ARQUIVO_ESTADO)) return JSON.parse(readFileSync(ARQUIVO_ESTADO, 'utf8')) as Estado;
  zerar();
  const e = novoEstado();
  gravarEstado(e);
  return e;
}

function urlComo(superUrl: string, usuario: string, senha: string): string {
  const u = new URL(superUrl);
  u.username = usuario;
  u.password = senha;
  return u.toString();
}

/** Espera o PostgreSQL aceitar conexão (na primeira vez o contêiner ainda inicializa o volume). */
async function esperarBanco(url: string): Promise<void> {
  for (let tentativa = 1; ; tentativa++) {
    const c = new pg.Client({ connectionString: url });
    try {
      await c.connect();
      await c.end();
      return;
    } catch (e) {
      await c.end().catch(() => undefined);
      if (tentativa >= 60) throw e;
      await new Promise((ok) => setTimeout(ok, 1000));
    }
  }
}

async function prepararBanco(estado: Estado): Promise<{ superUrl: string; parar: () => Promise<void> }> {
  if (EXTERNO) {
    const nome = `mp_demo_${randomBytes(6).toString('hex')}`;
    const c = new pg.Client({ connectionString: EXTERNO });
    await c.connect();
    await c.query(`CREATE DATABASE ${nome}`);
    await c.end();
    const url = new URL(EXTERNO);
    url.pathname = `/${nome}`;
    return {
      superUrl: url.toString(),
      parar: async () => {
        const d = new pg.Client({ connectionString: EXTERNO });
        await d.connect();
        await d.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
        await d.end();
      },
    };
  }
  if (!dockerOk('version')) throw new Error('o Docker não está em execução (abra o Docker Desktop ou defina MP_DEMO_DATABASE_URL)');
  if (dockerOk('container', 'inspect', CONTEINER)) docker('start', CONTEINER);
  else {
    // Porta livre escolhida pelo Docker, só em 127.0.0.1.
    docker('run', '-d', '--name', CONTEINER, '-e', `POSTGRES_PASSWORD=${estado.senhaPostgres}`, '-v', `${VOLUME}:/var/lib/postgresql/data`, '-p', `${HOST}::5432`, 'postgres:17-alpine');
  }
  const porta = docker('port', CONTEINER, '5432/tcp').split(/\r?\n/)[0]!.split(':').pop();
  const superUrl = `postgres://postgres:${estado.senhaPostgres}@${HOST}:${porta}/postgres`;
  await esperarBanco(superUrl);
  return { superUrl, parar: async () => void docker('stop', CONTEINER) };
}

/**
 * Formulário sintético de duas páginas: os 5 campos da RN-017, duas perguntas sim/não e uma escolha
 * única com "Outros: ____" (complemento, DEC-197).
 */
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
      q({
        codigo: 'MOTIVO_CONSULTA',
        tipo: 'escolha_unica',
        enunciado: 'Motivo da última consulta',
        pagina: 2,
        opcoes: [
          { codigo: 'rotina', rotulo: 'Rotina', ordem: 1 },
          { codigo: 'dor', rotulo: 'Dor', ordem: 2 },
          { codigo: 'outros', rotulo: 'Outros', ordem: 3, com_complemento: true },
        ],
      }),
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

const estado = carregarEstado();
const banco = await prepararBanco(estado);
const su = new pg.Client({ connectionString: banco.superUrl });
await su.connect();
await criarPapeis(su);
await su.query(`ALTER ROLE mp_app PASSWORD '${estado.senhaApp}'`);
await su.query(`ALTER ROLE mp_manutencao PASSWORD '${estado.senhaManut}'`);
await aplicarMigracoes(su);
await su.end();

const porta = Number(process.env.MP_DEMO_PORTA ?? 8080);
const origens = [`http://${HOST}:${porta}`, `http://localhost:${porta}`];

const armazenamento = PERSISTENTE
  ? new ArmazenamentoEmDisco(join(PASTA, 'arquivos'), relogioDoSistema.agora)
  : new ArmazenamentoEmMemoria(relogioDoSistema.agora);
await armazenamento.iniciar();
const defender = process.env.MP_DEFENDER === 'true';
const antimalware: Antimalware = defender
  ? new AntimalwareDefender({ pastaTemp: join(tmpdir(), 'minhapesquisa-demo-varredura') })
  : new AntimalwareEicar();

// A chave sai do ambiente logo ao ser lida, para não chegar a processos filhos (DEC-125).
const chaveIa = process.env.MP_DEMO_CHAVE_IA?.trim() || undefined;
delete process.env.MP_DEMO_CHAVE_IA;
const ia = { ...IA_PADRAO, modelo: process.env.MP_DEMO_MODELO?.trim() || IA_PADRAO.modelo };
const cotacao = process.env.MP_DEMO_COTACAO?.trim() || '5.00';
if (!/^\d+(\.\d{1,4})?$/.test(cotacao)) {
  console.error('MP_DEMO_COTACAO precisa ser um número com ponto decimal, ex.: 5.00');
  process.exit(1);
}
const motor = chaveIa ? new AdaptadorClaude({ apiKey: chaveIa, ...ia }) : undefined;
const extrator = chaveIa ? new ExtratorClaude({ apiKey: chaveIa, ...ia }) : undefined;

const config: Config = {
  urlBancoApp: urlComo(banco.superUrl, 'mp_app', estado.senhaApp),
  urlBancoManutencao: urlComo(banco.superUrl, 'mp_manutencao', estado.senhaManut),
  raizRepositorio: RAIZ,
  chaveHmacEmail: Buffer.from(estado.chaveHmacEmail, 'base64'),
  chaveCifraCampo: Buffer.from(estado.chaveCifraCampo, 'base64'),
  chaveHmacCpf: Buffer.from(estado.chaveHmacCpf, 'base64'),
  origensPermitidas: origens,
  cookiesSeguros: false, // HTTP local; por isso a demonstração só escuta em 127.0.0.1
  confiarProxy: false,
  relogio: relogioDoSistema,
  armazenamento,
  antimalware,
  gerarId: randomUUID,
  ...(motor ? { motorLeitura: () => motor, localizador: () => motor } : {}),
  ...(extrator ? { extratorEstrutura: () => extrator } : {}),
};
const api = await criarApi(config, 0, HOST);
const n = api.nucleo;

/**
 * Semente da primeira execução: tenant e usuária única (DEC-109) pelo mesmo código da instalação,
 * e projeto e formulário publicados pela própria API (mesmas validações da RN-017 e do layout).
 * Devolve o ID do projeto.
 */
async function semear(): Promise<string> {
  const sessao = await n.banco.manutencao(async (tx) => {
    const { tenantId, usuarioId } = await criarTenantComUsuaria(n, tx, {
      nome: 'Instituto Demonstração',
      nomeUsuaria: 'Ana Silva',
      email: EMAIL,
      senha: estado.senhaUsuaria,
    });
    return n.criarSessao(tx, { tenantId, usuarioId, ip: HOST });
  });
  const chamar = clienteSemente(api.url, origens[0]!, sessao.segredo);
  const idem = () => ({ 'idempotency-key': randomUUID() });
  const projeto = await chamar('POST', '/projects', { nome: 'Pesquisa de demonstração' }, idem());
  const form = await chamar('POST', '/forms', { nome: 'Questionário de demonstração', projeto_id: projeto.corpo.id }, idem());
  const caminhoVersao = `/forms/${form.corpo.id}/versions/${form.corpo.versoes[0].id}`;
  const atual = await chamar('GET', caminhoVersao);
  await chamar('PUT', caminhoVersao, conteudoDemo(), { 'if-match': atual.etag ?? '' });
  await chamar('POST', `${caminhoVersao}/publish`);
  await chamar('POST', '/auth/logout'); // a sessão da semente não fica aberta
  return projeto.corpo.id;
}

const primeiraVez = !estado.projetoId;
if (primeiraVez) {
  // Um tenant sem projeto em estado.json é semente interrompida: recomeçar é o caminho seguro.
  const tenants = await n.banco.manutencao((tx) => linhas(tx, sql`SELECT 1 FROM tenant LIMIT 1`));
  if (tenants.length > 0) {
    console.error('a semente da demonstração ficou pela metade; rode de novo com MP_DEMO_ZERAR=true');
    process.exit(1);
  }
  estado.projetoId = await semear();
  if (PERSISTENTE) gravarEstado(estado);
}

// Cotação do mês corrente e do seguinte (a demonstração pode atravessar a virada do mês).
const meses = [competencia(n.agora()).inicio, competencia(new Date(n.agora().getTime() + 32 * 86_400_000)).inicio];
await n.banco.manutencao(async (tx) => {
  for (const mes of meses) {
    await tx.execute(sql`
      INSERT INTO parametro_configuracao (id, tenant_id, projeto_id, chave, valor, competencia, alterado_em)
      VALUES (${n.id()}, NULL, NULL, 'cotacao_usd_brl', ${cotacao}, ${mes}::date, ${n.agora()})
      ON CONFLICT ON CONSTRAINT uq_parametro DO UPDATE SET valor = EXCLUDED.valor, alterado_em = EXCLUDED.alterado_em`);
  }
});

// Worker de leitura no mesmo processo, como no notebook (DEC-124).
const worker = new WorkerLeitura(n);
let rodando = false;
const ciclo = setInterval(() => {
  if (rodando) return;
  rodando = true;
  worker
    .processar()
    .catch((e: unknown) => n.log(`worker_erro tipo=${(e as Error)?.name ?? typeof e}`))
    .finally(() => (rodando = false));
}, 1000);

// O formulário atual é escolhido na página entre os publicados do projeto (listForms).
const dadosPagina = JSON.stringify({ projetoId: estado.projetoId, email: EMAIL });
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

const guarda = PERSISTENTE
  ? `  dados:   ${PASTA} e o contêiner ${CONTEINER} (${primeiraVez ? 'criados agora' : 'das execuções anteriores'})
Os dados ficam ao encerrar (Ctrl+C). Para recomeçar do zero: MP_DEMO_ZERAR=true.`
  : 'Banco externo (MP_DEMO_DATABASE_URL): tudo some ao encerrar (Ctrl+C).';
console.log(`MinhaPesquisa — modo de demonstração (DEC-104, DEC-168). Só dados sintéticos (GX-001).
  página:  http://${HOST}:${porta}
  e-mail:  ${EMAIL}
  senha:   ${estado.senhaUsuaria}
  antimalware: ${defender ? 'Microsoft Defender' : 'equivalente EICAR'}
  leitura e importação por IA: ${motor ? `${ia.modelo} (cada página lida gera custo real na sua conta da Anthropic)` : 'desligadas (defina MP_DEMO_CHAVE_IA para ligar)'}
  cotação do dólar (fictícia): R$ ${cotacao}
${guarda}`);

async function encerrar(): Promise<void> {
  clearInterval(ciclo);
  pagina.close();
  await api.fechar();
  await armazenamento.fechar();
  await banco.parar();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
