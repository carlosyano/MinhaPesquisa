// Linha de comando do notebook (PLANO §4.5, §9.2; DEC-113, DEC-114, DEC-117). Uso:
//   npm run local -- instalar [--sem-bitlocker]
//   npm run local -- redefinir-senha
//   npm run local -- backup
//   npm run local -- agendar-backup [HH:MM]
//   npm run local -- testar-restauracao
//   npm run local -- restaurar <arquivo.mpbak>
// Senhas são digitadas no terminal sem eco. Nenhum comando imprime nome, e-mail, senha nem a
// conexão do banco (RN-028). Códigos de saída: 0 feito, 1 recusado, 2 dado inválido.

import { aplicarMigracoes, criarPapeis } from '@minhapesquisa/db';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { caminhoNoDisco } from '../infra/armazenamento-disco.js';
import {
  ARQUIVO_RECUPERACAO,
  carregarChave,
  chaveGuardada,
  desembrulharComSenha,
  guardarChave,
  novaChaveMestra,
  protetorDpapi,
} from '../infra/chaves.js';
import { senhaAceita } from '../infra/cripto.js';
import { relogioDoSistema } from '../infra/relogio.js';
import {
  gravarConfigLocal,
  gravarSegredos,
  lerConfigLocal,
  lerSegredos,
  montarConfig,
  pastaDados,
  pastaImagens,
  pastaTemp,
  type ConfigLocal,
} from '../local.js';
import { Nucleo } from '../nucleo.js';
import {
  backupsAApagar,
  cifrarBackup,
  dataDoBackup,
  decifrarBackup,
  lerMestraEmbrulhada,
  nomeBackup,
  restauracaoVencida,
} from './backup.js';
import { MENSAGEM, instalar, redefinirSenha, type SaidaScript } from './instalacao.js';

const PORTA_PADRAO = 8080;
const BIN_PG_PADRAO = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const ARQUIVO_TESTE_RESTAURACAO = 'ultimo-teste-restauracao.json';

class Recusa extends Error {
  constructor(
    mensagem: string,
    readonly codigo = 1,
  ) {
    super(mensagem);
  }
}

// ───────────────────────────── terminal ─────────────────────────────

async function perguntar(rotulo: string, oculto = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  if (oculto) {
    // Mostra só o rótulo; o que é digitado não aparece.
    const r = rl as unknown as { _writeToOutput: (s: string) => void };
    let rotuloMostrado = false;
    r._writeToOutput = (s) => {
      if (!rotuloMostrado) process.stdout.write(s);
      rotuloMostrado = true;
    };
  }
  try {
    const v = await rl.question(rotulo);
    if (oculto) process.stdout.write('\n');
    return oculto ? v : v.trim();
  } finally {
    rl.close();
  }
}

async function senhaConfirmada(rotulo: string): Promise<string> {
  const a = await perguntar(`${rotulo}: `, true);
  if (!senhaAceita(a)) throw new Recusa(MENSAGEM.senhaFora, 2);
  if ((await perguntar(`${rotulo} (de novo): `, true)) !== a) throw new Recusa('As senhas digitadas não conferem. Nada foi alterado.', 2);
  return a;
}

async function valor(nomeEnv: string, rotulo: string, oculto = false): Promise<string> {
  return process.env[nomeEnv] || (await perguntar(`${rotulo}: `, oculto));
}

// ───────────────────────────── processos ─────────────────────────────

/** Roda um executável com a senha do banco pelo ambiente, nunca pela linha de comando. */
function rodar(exe: string, args: string[], o: { senhaPg?: string; erro: string }): Promise<void> {
  return new Promise((ok, erro) => {
    const env = o.senhaPg === undefined ? process.env : { ...process.env, PGPASSWORD: o.senhaPg };
    execFile(exe, args, { env, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (e) => (e ? erro(new Error(o.erro)) : ok()));
  });
}

const tar = () => (process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar');
const exe = (local: ConfigLocal, nome: string) => join(local.binPostgres, process.platform === 'win32' ? `${nome}.exe` : nome);

/** Conexão sem a senha (vai pelo PGPASSWORD) e a senha à parte. */
function semSenha(url: string): { url: string; senha: string } {
  const u = new URL(url);
  const senha = decodeURIComponent(u.password);
  u.password = '';
  return { url: u.toString(), senha };
}

function naBase(url: string, banco: string): string {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
}

async function comSuper<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function contarArquivos(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  return (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
}

/** BitLocker ligado no disco do sistema (T-08). 1 = protegido, pela propriedade do Shell. */
function bitLockerLigado(): Promise<boolean> {
  const script =
    "(New-Object -ComObject Shell.Application).NameSpace($env:SystemDrive + '\\').Self.ExtendedProperty('System.Volume.BitLockerProtection')";
  return new Promise((ok) =>
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 30_000 }, (e, saida) =>
      ok(!e && saida.trim() === '1'),
    ),
  );
}

async function comNucleo<T>(dir: string, local: ConfigLocal, fn: (n: Nucleo) => Promise<T>): Promise<T> {
  const { config } = await montarConfig(dir, local, protetorDpapi);
  const n = new Nucleo(config);
  try {
    return await fn(n);
  } finally {
    await n.fechar();
  }
}

/** Papéis com senhas novas e migrações em dia; devolve as senhas para os segredos locais. */
async function prepararBanco(urlSuper: string): Promise<{ senhaApp: string; senhaManutencao: string }> {
  const senhaApp = randomBytes(24).toString('hex');
  const senhaManutencao = randomBytes(24).toString('hex');
  await comSuper(urlSuper, async (c) => {
    await criarPapeis(c);
    await c.query(`ALTER ROLE mp_app PASSWORD '${senhaApp}'`);
    await c.query(`ALTER ROLE mp_manutencao PASSWORD '${senhaManutencao}'`);
    await aplicarMigracoes(c);
  });
  return { senhaApp, senhaManutencao };
}

// ───────────────────────────── comandos ─────────────────────────────

async function cmdInstalar(args: string[]): Promise<SaidaScript> {
  if (!args.includes('--sem-bitlocker') && !(await bitLockerLigado())) {
    throw new Recusa('Instalação recusada: ligue o BitLocker no disco do sistema antes de instalar (T-08). Nada foi criado.');
  }
  const dir = pastaDados();
  const urlSuper = await valor('MP_DB_SUPER_URL', 'Conexão de superusuário do PostgreSQL local', true);
  const jaInstalado = await comSuper(urlSuper, async (c) => {
    const t = await c.query<{ existe: boolean }>("SELECT to_regclass('public.tenant') IS NOT NULL AS existe");
    return t.rows[0]!.existe && (await c.query<{ n: number }>('SELECT count(*)::int AS n FROM tenant')).rows[0]!.n > 0;
  });
  if (jaInstalado) return { codigo: 1, saida: MENSAGEM.jaInstalada };

  const pastaBackup = await valor('MP_PASTA_BACKUP', 'Pasta de backup no disco externo');
  const dados = {
    instituicao: await perguntar('Nome da instituição: '),
    nome: await perguntar('Seu nome: '),
    email: await perguntar('Seu e-mail: '),
    senha: await senhaConfirmada('Senha de acesso'),
  };
  const guardada = await chaveGuardada(dir);
  // A senha de recuperação abre a cópia da chave que vai no backup (DEC-114). Sem ela, o
  // backup não pode ser restaurado em outro notebook.
  const senhaRecuperacao = guardada ? null : await senhaConfirmada('Senha de recuperação da chave (guarde longe do notebook)');

  await mkdir(dir, { recursive: true });
  const local: ConfigLocal = { versao: 1, porta: PORTA_PADRAO, pastaBackup, binPostgres: process.env.MP_PG_BIN ?? BIN_PG_PADRAO };
  const senhas = await prepararBanco(urlSuper);
  if (senhaRecuperacao) await guardarChave(dir, novaChaveMestra(), protetorDpapi, senhaRecuperacao);
  await gravarSegredos(dir, { urlSuper, ...senhas }, protetorDpapi);
  await gravarConfigLocal(dir, local);
  const r = await comNucleo(dir, local, (n) => instalar(n, dados));
  if (r.codigo === 0 && !existsSync(exe(local, 'pg_dump'))) {
    r.saida += '\nAviso: pg_dump não encontrado na pasta do PostgreSQL; ajuste binPostgres no config.json antes do primeiro backup.';
  }
  return r;
}

async function cmdRedefinirSenha(): Promise<SaidaScript> {
  const dir = pastaDados();
  const local = await lerConfigLocal(dir);
  const senha = await perguntar('Nova senha: ', true);
  if (senhaAceita(senha) && (await perguntar('Nova senha (de novo): ', true)) !== senha) {
    throw new Recusa('As senhas digitadas não conferem. Nada foi alterado.', 2);
  }
  return comNucleo(dir, local, (n) => redefinirSenha(n, senha));
}

async function cmdBackup(): Promise<SaidaScript> {
  const dir = pastaDados();
  const local = await lerConfigLocal(dir);
  if (!existsSync(local.pastaBackup)) throw new Recusa('Backup recusado: a pasta de backup não foi encontrada. Conecte o disco externo.');
  const s = await lerSegredos(dir, protetorDpapi);
  const mestra = await carregarChave(dir, protetorDpapi);
  const agora = relogioDoSistema.agora();
  await mkdir(pastaTemp(dir), { recursive: true });
  await mkdir(pastaImagens(dir), { recursive: true });
  const tmp = await mkdtemp(join(pastaTemp(dir), 'backup-'));
  try {
    const pgc = semSenha(s.urlSuper);
    await rodar(exe(local, 'pg_dump'), ['--format=custom', '--file', join(tmp, 'banco.dump'), '--dbname', pgc.url], {
      senhaPg: pgc.senha,
      erro: 'pg_dump falhou',
    });
    const manifesto = { versao: 1, criado_em: agora.toISOString(), imagens: await contarArquivos(pastaImagens(dir)) };
    await writeFile(join(tmp, 'manifesto.json'), JSON.stringify(manifesto));
    const pacote = join(tmp, 'pacote.tar');
    await rodar(tar(), ['-cf', pacote, '-C', tmp, 'banco.dump', 'manifesto.json', '-C', dir, 'imagens', ARQUIVO_RECUPERACAO], {
      erro: 'empacotamento falhou',
    });
    const nome = nomeBackup(agora);
    const destino = join(local.pastaBackup, nome);
    await cifrarBackup(pacote, destino, { mestra, mestraEmbrulhada: await readFile(join(dir, ARQUIVO_RECUPERACAO)) });

    const apagar = backupsAApagar(await readdir(local.pastaBackup), agora);
    for (const a of apagar) await rm(join(local.pastaBackup, a), { force: true });

    const linhas = [
      `Backup gravado: ${nome} (${((await stat(destino)).size / 1024 / 1024).toFixed(1)} MB, ${manifesto.imagens} imagens).`,
      `Backups com mais de 90 dias apagados: ${apagar.length}.`,
    ];
    if (restauracaoVencida(await ultimoTesteRestauracao(local), agora)) {
      linhas.push('Aviso: o teste mensal de restauração está vencido. Rode: npm run local -- testar-restauracao');
    }
    return { codigo: 0, saida: linhas.join('\n') };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function cmdAgendarBackup(args: string[]): Promise<SaidaScript> {
  const hora = args[0] ?? '20:00';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Recusa('Horário inválido: use HH:MM.', 2);
  const cli = fileURLToPath(import.meta.url);
  await rodar(
    'schtasks.exe',
    ['/Create', '/F', '/SC', 'DAILY', '/ST', hora, '/TN', 'MinhaPesquisa\\backup', '/TR', `"${process.execPath}" "${cli}" backup`],
    { erro: 'não foi possível agendar o backup no Agendador de Tarefas' },
  );
  return { codigo: 0, saida: `Backup diário agendado para ${hora} (Agendador de Tarefas, MinhaPesquisa\\backup).` };
}

async function ultimoTesteRestauracao(local: ConfigLocal): Promise<Date | null> {
  try {
    const r = JSON.parse(await readFile(join(local.pastaBackup, ARQUIVO_TESTE_RESTAURACAO), 'utf8')) as { em: string; ok: boolean };
    return r.ok ? new Date(r.em) : null;
  } catch {
    return null;
  }
}

/** Decifra e desempacota um backup numa pasta temporária, com a mestra aberta pela senha de recuperação. */
async function abrirBackup(arquivo: string, senhaRecuperacao: string, tmp: string): Promise<{ mestra: Buffer; pasta: string }> {
  let mestra: Buffer;
  try {
    mestra = await desembrulharComSenha(await lerMestraEmbrulhada(arquivo), senhaRecuperacao);
  } catch {
    throw new Recusa('Senha de recuperação errada ou arquivo que não é backup do MinhaPesquisa. Nada foi alterado.');
  }
  const pacote = join(tmp, 'pacote.tar');
  await decifrarBackup(arquivo, pacote, mestra);
  const pasta = join(tmp, 'conteudo');
  await mkdir(pasta);
  await rodar(tar(), ['-xf', pacote, '-C', pasta], { erro: 'desempacotamento falhou' });
  await rm(pacote);
  return { mestra, pasta };
}

async function cmdTestarRestauracao(): Promise<SaidaScript> {
  const dir = pastaDados();
  const local = await lerConfigLocal(dir);
  const s = await lerSegredos(dir, protetorDpapi);
  const backups = (await readdir(local.pastaBackup)).filter((n) => dataDoBackup(n)).sort();
  const ultimo = backups.at(-1);
  if (!ultimo) throw new Recusa('Nenhum backup encontrado na pasta de backup.');

  const inicio = Date.now();
  const senhaRecuperacao = await perguntar('Senha de recuperação da chave: ', true);
  await mkdir(pastaTemp(dir), { recursive: true });
  const tmp = await mkdtemp(join(pastaTemp(dir), 'restauracao-'));
  const banco = `mp_teste_restauracao_${nomeBackup(relogioDoSistema.agora()).slice(14, 29).replace('-', '_')}`;
  const pgc = semSenha(naBase(s.urlSuper, banco));
  let criado = false;
  try {
    const { mestra, pasta } = await abrirBackup(join(local.pastaBackup, ultimo), senhaRecuperacao, tmp);
    const mesmaChave = mestra.equals(await carregarChave(dir, protetorDpapi));
    const manifesto = JSON.parse(await readFile(join(pasta, 'manifesto.json'), 'utf8')) as { imagens: number };
    const imagens = await contarArquivos(join(pasta, 'imagens'));

    await comSuper(s.urlSuper, (c) => c.query(`CREATE DATABASE ${banco}`));
    criado = true;
    await rodar(exe(local, 'pg_restore'), ['--exit-on-error', '--dbname', pgc.url, join(pasta, 'banco.dump')], {
      senhaPg: pgc.senha,
      erro: 'pg_restore falhou',
    });
    const conferencia = await comSuper(naBase(s.urlSuper, banco), async (c) => {
      const tenants = (await c.query<{ n: number }>('SELECT count(*)::int AS n FROM tenant')).rows[0]!.n;
      const chaves = (await c.query<{ chave_storage: string }>('SELECT chave_storage FROM pagina_aplicacao')).rows;
      const faltando = chaves.filter((r) => !existsSync(caminhoNoDisco(join(pasta, 'imagens'), r.chave_storage))).length;
      return { tenants, paginas: chaves.length, faltando };
    });

    const ok = mesmaChave && conferencia.tenants === 1 && conferencia.faltando === 0 && imagens === manifesto.imagens;
    const duracao = Math.round((Date.now() - inicio) / 1000);
    await writeFile(
      join(local.pastaBackup, ARQUIVO_TESTE_RESTAURACAO),
      JSON.stringify({ em: relogioDoSistema.agora().toISOString(), backup: ultimo, ok, duracao_s: duracao }),
    );
    const linhas = [
      `Backup testado: ${ultimo}. Duração: ${duracao} s.`,
      `Banco restaurado: ${conferencia.tenants} tenant, ${conferencia.paginas} páginas; imagens: ${imagens} de ${manifesto.imagens}; páginas sem imagem: ${conferencia.faltando}.`,
      mesmaChave ? 'A senha de recuperação abre a chave deste notebook.' : 'Atenção: o backup foi feito com outra chave mestra.',
      ok ? 'Teste de restauração aprovado.' : 'Teste de restauração REPROVADO: verifique o backup antes de depender dele.',
    ];
    return { codigo: ok ? 0 : 1, saida: linhas.join('\n') };
  } finally {
    if (criado) await comSuper(s.urlSuper, (c) => c.query(`DROP DATABASE IF EXISTS ${banco} WITH (FORCE)`));
    await rm(tmp, { recursive: true, force: true });
  }
}

async function cmdRestaurar(args: string[]): Promise<SaidaScript> {
  const arquivo = args[0];
  if (!arquivo || !existsSync(arquivo)) throw new Recusa('Informe o arquivo .mpbak a restaurar.', 2);
  const dir = pastaDados();
  if (await chaveGuardada(dir)) {
    throw new Recusa('Restauração recusada: este computador já tem uma instalação. Use uma pasta de dados nova (MP_DADOS).');
  }
  const urlSuper = await valor('MP_DB_SUPER_URL', 'Conexão de superusuário do PostgreSQL local (banco vazio)', true);
  const pastaBackup = await valor('MP_PASTA_BACKUP', 'Pasta de backup no disco externo');
  const vazio = await comSuper(urlSuper, async (c) => {
    const r = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'");
    return r.rows[0]!.n === 0;
  });
  if (!vazio) throw new Recusa('Restauração recusada: o banco informado não está vazio. Nada foi alterado.');
  const senhaRecuperacao = await perguntar('Senha de recuperação da chave: ', true);

  await mkdir(pastaTemp(dir), { recursive: true });
  const tmp = await mkdtemp(join(pastaTemp(dir), 'restauracao-'));
  try {
    const { mestra, pasta } = await abrirBackup(arquivo, senhaRecuperacao, tmp);
    const local: ConfigLocal = { versao: 1, porta: PORTA_PADRAO, pastaBackup, binPostgres: process.env.MP_PG_BIN ?? BIN_PG_PADRAO };
    await comSuper(urlSuper, (c) => criarPapeis(c));
    const pgc = semSenha(urlSuper);
    await rodar(exe(local, 'pg_restore'), ['--exit-on-error', '--dbname', pgc.url, join(pasta, 'banco.dump')], {
      senhaPg: pgc.senha,
      erro: 'pg_restore falhou',
    });
    const senhas = await prepararBanco(urlSuper);
    await cp(join(pasta, 'imagens'), pastaImagens(dir), { recursive: true, errorOnExist: true, force: false });
    await guardarChave(dir, mestra, protetorDpapi, senhaRecuperacao);
    await gravarSegredos(dir, { urlSuper, ...senhas }, protetorDpapi);
    await gravarConfigLocal(dir, local);
    return {
      codigo: 0,
      saida:
        'Restauração concluída. Antes de voltar a usar, reaplique as eliminações registradas fora do notebook ' +
        'depois da data do backup (DEC-062, runbook de restauração).',
    };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ───────────────────────────── entrada ─────────────────────────────

const COMANDOS: Record<string, (args: string[]) => Promise<SaidaScript>> = {
  instalar: cmdInstalar,
  'redefinir-senha': cmdRedefinirSenha,
  backup: cmdBackup,
  'agendar-backup': cmdAgendarBackup,
  'testar-restauracao': cmdTestarRestauracao,
  restaurar: cmdRestaurar,
};

const [comando = '', ...resto] = process.argv.slice(2);
const executar = COMANDOS[comando];
if (!executar) {
  console.error(`Comandos: ${Object.keys(COMANDOS).join(', ')}`);
  process.exit(2);
}
try {
  const r = await executar(resto);
  console.log(r.saida);
  process.exitCode = r.codigo;
} catch (e) {
  console.error(e instanceof Recusa ? e.message : `Erro: ${(e as Error).message}`);
  process.exitCode = e instanceof Recusa ? e.codigo : 1;
}
