// Backup diário cifrado do notebook (DEC-117, DEC-114, DEC-033). Regras puras (nome com a data,
// retenção máxima de 90 dias, aviso de teste de restauração vencido) e a cifra do arquivo. O
// pacote (dump do banco, imagens e cópia de recuperação da chave) é montado por scripts/cli.ts.
//
// Formato do .mpbak: "MPB1" | tamanho da mestra embrulhada (uint16) | mestra embrulhada pela
// senha de recuperação | iv (12) | conteúdo cifrado (AES-256-GCM, chave de backup derivada da
// mestra; o cabeçalho entra como dado autenticado) | etiqueta (16).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { derivarChaves } from '../infra/chaves.js';

export const RETENCAO_BACKUP_DIAS = 90;
const DIA = 24 * 60 * 60 * 1000;
const NOME = /^minhapesquisa-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.mpbak$/;

const dois = (n: number) => String(n).padStart(2, '0');

/** `minhapesquisa-AAAAMMDD-HHMMSS.mpbak`, em UTC. */
export function nomeBackup(agora: Date): string {
  const d = agora;
  return (
    `minhapesquisa-${d.getUTCFullYear()}${dois(d.getUTCMonth() + 1)}${dois(d.getUTCDate())}` +
    `-${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}.mpbak`
  );
}

/** Data do backup pelo nome; null para qualquer arquivo que não seja backup. */
export function dataDoBackup(nome: string): Date | null {
  const m = NOME.exec(nome);
  if (!m) return null;
  const [a, me, di, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const d = new Date(Date.UTC(a, me - 1, di, h, mi, s));
  return nomeBackup(d) === nome ? d : null;
}

/** Backups com mais de `dias` dias, na ordem recebida. A retenção é máxima (DEC-033). */
export function backupsAApagar(nomes: string[], agora: Date, dias = RETENCAO_BACKUP_DIAS): string[] {
  return nomes.filter((n) => {
    const d = dataDoBackup(n);
    return d !== null && agora.getTime() - d.getTime() > dias * DIA;
  });
}

/** O teste de restauração é mensal (DEC-117): vencido sem teste ou depois de 31 dias. */
export function restauracaoVencida(ultimoTeste: Date | null, agora: Date): boolean {
  return ultimoTeste === null || agora.getTime() - ultimoTeste.getTime() > 31 * DIA;
}

// ───────────────────────────── cifra do arquivo ─────────────────────────────

const MAGICO = Buffer.from('MPB1');
const TAG = 16;

function cabecalho(mestraEmbrulhada: Buffer, iv: Buffer): Buffer {
  const tam = Buffer.alloc(2);
  tam.writeUInt16BE(mestraEmbrulhada.length);
  return Buffer.concat([MAGICO, tam, mestraEmbrulhada, iv]);
}

async function lerCabecalho(arquivo: string): Promise<{ embrulhada: Buffer; iv: Buffer; tamanho: number; total: number }> {
  const f = await open(arquivo, 'r');
  try {
    const total = (await f.stat()).size;
    const ini = Buffer.alloc(6);
    await f.read(ini, 0, 6, 0);
    if (total < 6 || !ini.subarray(0, 4).equals(MAGICO)) throw new Error('não é um backup do MinhaPesquisa');
    const n = ini.readUInt16BE(4);
    const tamanho = 6 + n + 12;
    if (total < tamanho + TAG) throw new Error('backup truncado');
    const resto = Buffer.alloc(n + 12);
    await f.read(resto, 0, n + 12, 6);
    return { embrulhada: resto.subarray(0, n), iv: resto.subarray(n), tamanho, total };
  } finally {
    await f.close();
  }
}

/** Cifra `origem` em `destino`, que não pode existir. Em caso de erro, `destino` não fica. */
export async function cifrarBackup(origem: string, destino: string, chaves: { mestra: Buffer; mestraEmbrulhada: Buffer }): Promise<void> {
  const iv = randomBytes(12);
  const cab = cabecalho(chaves.mestraEmbrulhada, iv);
  const c = createCipheriv('aes-256-gcm', derivarChaves(chaves.mestra).backup, iv);
  c.setAAD(cab);
  const saida = createWriteStream(destino, { flags: 'wx', mode: 0o600 });
  // 'wx' falha só na abertura: espera abrir para não apagar um backup que já existia.
  await new Promise<void>((ok, erro) => saida.once('open', () => ok()).once('error', erro));
  try {
    saida.write(cab);
    await pipeline(createReadStream(origem), c, saida, { end: false });
    await new Promise<void>((ok, erro) => saida.end(c.getAuthTag(), () => ok()).once('error', erro));
  } catch (e) {
    saida.destroy();
    await rm(destino, { force: true });
    throw e;
  }
}

/** A mestra embrulhada pela senha de recuperação, para restaurar em outro notebook. */
export async function lerMestraEmbrulhada(arquivo: string): Promise<Buffer> {
  return (await lerCabecalho(arquivo)).embrulhada;
}

/**
 * Decifra para `destino` só se o arquivo inteiro for autêntico: escreve num temporário e o
 * renomeia depois de conferida a etiqueta. Em caso de erro, `destino` não fica.
 */
export async function decifrarBackup(origem: string, destino: string, mestra: Buffer): Promise<void> {
  const { embrulhada, iv, tamanho, total } = await lerCabecalho(origem);
  const tag = Buffer.alloc(TAG);
  const f = await open(origem, 'r');
  try {
    await f.read(tag, 0, TAG, total - TAG);
  } finally {
    await f.close();
  }
  const d = createDecipheriv('aes-256-gcm', derivarChaves(mestra).backup, iv, { authTagLength: TAG });
  d.setAAD(cabecalho(embrulhada, iv));
  d.setAuthTag(tag);
  const temp = `${destino}.parcial`;
  try {
    const conteudo = total - TAG - tamanho;
    const entrada = conteudo > 0 ? createReadStream(origem, { start: tamanho, end: total - TAG - 1 }) : Readable.from([]);
    await pipeline(entrada, d, createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    await rename(temp, destino);
  } catch {
    await rm(temp, { force: true });
    throw new Error('backup ilegível: chave errada ou arquivo alterado');
  }
}

