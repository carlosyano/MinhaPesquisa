// Ambiente do notebook (DEC-113, DEC-114): pasta de dados da usuária com a chave mestra, os
// segredos do banco e as imagens; configuração não secreta em config.json. Os segredos (senhas
// dos papéis do banco e a conexão de superusuário usada pelo backup) ficam cifrados pelo DPAPI,
// como a chave mestra. Usado pelo main.ts e pelos scripts de scripts/cli.ts.

import { AdaptadorClaude } from '@minhapesquisa/motor-leitura';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import { AntimalwareDefender } from './infra/antimalware.js';
import { ArmazenamentoEmDisco } from './infra/armazenamento-disco.js';
import { carregarChave, derivarChaves, type ProtetorChave } from './infra/chaves.js';
import { relogioDoSistema } from './infra/relogio.js';
import { ExtratorClaude } from './leitura/extrator.js';

/** Raiz do repositório instalado (contrato e catálogo de erros), a partir de apps/api/dist. */
export const RAIZ = fileURLToPath(new URL('../../../', import.meta.url));

export const ARQUIVO_CONFIG = 'config.json';
export const ARQUIVO_SEGREDOS = 'segredos.dpapi';

export interface ConfigLocal {
  versao: 1;
  /** Porta da API em 127.0.0.1. */
  porta: number;
  /** Pasta no disco externo onde ficam os backups (DEC-117). */
  pastaBackup: string;
  /** Pasta dos executáveis do PostgreSQL 17 (pg_dump, pg_restore). */
  binPostgres: string;
  /** Modelo e preços da leitura por IA (DEC-122); padrão: Claude Opus 5.5 a US$ 4 / US$ 20 por milhão de tokens. */
  ia?: { modelo: string; precoUsdPorMTok: { entrada: number; saida: number } };
}

export const IA_PADRAO = { modelo: 'claude-opus-5-5', precoUsdPorMTok: { entrada: 4, saida: 20 } };

export interface SegredosLocais {
  /** Conexão de superusuário do PostgreSQL local (papéis, backup e restauração). */
  urlSuper: string;
  senhaApp: string;
  senhaManutencao: string;
  /** Chave da API da Anthropic (DEC-122); sem ela, nenhuma leitura é feita. */
  chaveApiAnthropic?: string;
}

/** Pasta de dados: MP_DADOS ou %LOCALAPPDATA%\MinhaPesquisa. */
export function pastaDados(): string {
  return process.env.MP_DADOS ?? join(process.env.LOCALAPPDATA ?? process.cwd(), 'MinhaPesquisa');
}

export const pastaImagens = (dir: string) => join(dir, 'imagens');
export const pastaTemp = (dir: string) => join(dir, 'temp');

export function urlComo(urlSuper: string, papel: string, senha: string): string {
  const u = new URL(urlSuper);
  u.username = papel;
  u.password = senha;
  return u.toString();
}

export async function lerConfigLocal(dir: string): Promise<ConfigLocal> {
  if (!existsSync(join(dir, ARQUIVO_CONFIG))) throw new Error('o MinhaPesquisa ainda não foi instalado neste computador');
  return JSON.parse(await readFile(join(dir, ARQUIVO_CONFIG), 'utf8')) as ConfigLocal;
}

export async function gravarConfigLocal(dir: string, c: ConfigLocal): Promise<void> {
  await writeFile(join(dir, ARQUIVO_CONFIG), JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
}

export async function lerSegredos(dir: string, protetor: ProtetorChave): Promise<SegredosLocais> {
  return JSON.parse((await protetor.desproteger(await readFile(join(dir, ARQUIVO_SEGREDOS)))).toString('utf8')) as SegredosLocais;
}

export async function gravarSegredos(dir: string, s: SegredosLocais, protetor: ProtetorChave): Promise<void> {
  await writeFile(join(dir, ARQUIVO_SEGREDOS), await protetor.proteger(Buffer.from(JSON.stringify(s), 'utf8')), { mode: 0o600 });
}

/**
 * Config da API no notebook: chaves derivadas da mestra, pasta de imagens, Defender e tráfego só
 * em 127.0.0.1. Cookies sem Secure porque o tráfego é HTTP local, que não sai do notebook.
 */
export async function montarConfig(
  dir: string,
  local: ConfigLocal,
  protetor: ProtetorChave,
): Promise<{ config: Config; armazenamento: ArmazenamentoEmDisco }> {
  const chaves = derivarChaves(await carregarChave(dir, protetor));
  const s = await lerSegredos(dir, protetor);
  await mkdir(pastaImagens(dir), { recursive: true });
  const armazenamento = new ArmazenamentoEmDisco(pastaImagens(dir), relogioDoSistema.agora);
  const config: Config = {
    urlBancoApp: urlComo(s.urlSuper, 'mp_app', s.senhaApp),
    urlBancoManutencao: urlComo(s.urlSuper, 'mp_manutencao', s.senhaManutencao),
    raizRepositorio: RAIZ,
    chaveHmacEmail: chaves.hmacEmail,
    chaveCifraCampo: chaves.cifraCampo,
    chaveHmacCpf: chaves.hmacCpf,
    origensPermitidas: [`http://127.0.0.1:${local.porta}`, `http://localhost:${local.porta}`],
    cookiesSeguros: false,
    confiarProxy: false,
    relogio: relogioDoSistema,
    armazenamento,
    antimalware: new AntimalwareDefender({ pastaTemp: join(pastaTemp(dir), 'varredura') }),
    gerarId: randomUUID,
  };
  if (s.chaveApiAnthropic) {
    const motor = new AdaptadorClaude({ apiKey: s.chaveApiAnthropic, ...(local.ia ?? IA_PADRAO) });
    config.motorLeitura = () => motor;
    const extrator = new ExtratorClaude({ apiKey: s.chaveApiAnthropic, ...(local.ia ?? IA_PADRAO) });
    config.extratorEstrutura = () => extrator;
  }
  return { config, armazenamento };
}
