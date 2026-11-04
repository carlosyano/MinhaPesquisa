// Backup diário cifrado (DEC-117, DEC-114, DEC-033): nome com a data, retenção máxima de 90
// dias, aviso de teste de restauração vencido e cifra do arquivo com a chave derivada da mestra.
// O cabeçalho leva a mestra cifrada com a senha de recuperação, para restaurar em outro notebook.

import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { desembrulharComSenha, embrulharComSenha } from '../../apps/api/src/infra/chaves.js';
import {
  backupsAApagar,
  cifrarBackup,
  dataDoBackup,
  decifrarBackup,
  lerMestraEmbrulhada,
  nomeBackup,
  RETENCAO_BACKUP_DIAS,
  restauracaoVencida,
} from '../../apps/api/src/scripts/backup.js';

const DIA = 24 * 60 * 60 * 1000;
const agora = new Date('2026-11-04T03:00:00Z');

describe('nome e data do backup (DEC-117)', () => {
  // @trace DEC-117
  it('o nome traz a data e a hora em UTC e volta à mesma data', () => {
    const nome = nomeBackup(new Date('2026-11-04T03:05:09.876Z'));
    expect(nome).toBe('minhapesquisa-20261104-030509.mpbak');
    expect(dataDoBackup(nome)).toEqual(new Date('2026-11-04T03:05:09Z'));
  });

  // @trace DEC-117
  it.each([
    'minhapesquisa-20261104-030509.tar',
    'outro-20261104-030509.mpbak',
    'minhapesquisa-20261304-030509.mpbak',
    'minhapesquisa-2026114-030509.mpbak',
    'minhapesquisa-20261104-030509.mpbak.parcial',
    'leia-me.txt',
  ])('%s não é backup', (nome) => {
    expect(dataDoBackup(nome)).toBeNull();
  });
});

describe('retenção máxima de 90 dias (DEC-033, DEC-117)', () => {
  const de = (dias: number, ms = 0) => nomeBackup(new Date(agora.getTime() - dias * DIA - ms));

  // @trace DEC-033, DEC-117, RNF-008
  it('apaga só os backups com mais de 90 dias e ignora outros arquivos', () => {
    expect(RETENCAO_BACKUP_DIAS).toBe(90);
    const nomes = [de(0), de(1), de(89), de(90), de(90, 1000), de(91), de(400), 'leia-me.txt'];
    expect(backupsAApagar(nomes, agora)).toEqual([de(90, 1000), de(91), de(400)]);
  });

  // @trace DEC-033
  it('a retenção máxima vale mesmo que todos os backups estejam vencidos', () => {
    const nomes = [de(120), de(100)];
    expect(backupsAApagar(nomes, agora)).toEqual(nomes);
  });

  // @trace DEC-117
  it('lista vazia não apaga nada', () => {
    expect(backupsAApagar([], agora)).toEqual([]);
  });
});

describe('teste mensal de restauração (DEC-117)', () => {
  // @trace DEC-117, RNF-008
  it.each([
    [null, true],
    [new Date(agora.getTime() - 1 * DIA), false],
    [new Date(agora.getTime() - 31 * DIA), false],
    [new Date(agora.getTime() - 31 * DIA - 1), true],
    [new Date(agora.getTime() - 60 * DIA), true],
  ])('último teste em %s → vencido = %s', (ultimo, esperado) => {
    expect(restauracaoVencida(ultimo, agora)).toBe(esperado);
  });
});

describe('cifra do arquivo de backup (DEC-117, DEC-114)', () => {
  const SENHA_RECUPERACAO = 'Recuperacao7Sintetica';
  const mestra = Buffer.alloc(32, 0x33);
  const MARCA = 'conteudo-sintetico-que-nao-pode-aparecer-cifrado';
  let dir: string;
  let origem: string;
  let conteudo: Buffer;
  let chaves: { mestra: Buffer; mestraEmbrulhada: Buffer };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mp-backup-'));
    origem = join(dir, 'pacote.tar');
    conteudo = Buffer.concat([Buffer.from(MARCA), randomBytes(512 * 1024), Buffer.from(MARCA)]);
    await writeFile(origem, conteudo);
    chaves = { mestra, mestraEmbrulhada: await embrulharComSenha(mestra, SENHA_RECUPERACAO) };
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // @trace DEC-117, DEC-114, RNF-002
  it('ida e volta com a mestra, sem o conteúdo nem a mestra em claro no arquivo', async () => {
    const cifrado = join(dir, 'b.mpbak');
    await cifrarBackup(origem, cifrado, chaves);
    const bytes = await readFile(cifrado);
    expect(bytes.includes(Buffer.from(MARCA))).toBe(false);
    expect(bytes.includes(mestra)).toBe(false);

    const volta = join(dir, 'volta.tar');
    await decifrarBackup(cifrado, volta, mestra);
    expect((await readFile(volta)).equals(conteudo)).toBe(true);
  });

  // @trace DEC-114, DEC-117
  it('o cabeçalho traz a mestra cifrada, que abre com a senha de recuperação', async () => {
    const cifrado = join(dir, 'b.mpbak');
    await cifrarBackup(origem, cifrado, chaves);
    const embrulhada = await lerMestraEmbrulhada(cifrado);
    expect((await desembrulharComSenha(embrulhada, SENHA_RECUPERACAO)).equals(mestra)).toBe(true);
  });

  // @trace DEC-117
  it('não sobrescreve um backup existente', async () => {
    const cifrado = join(dir, 'b.mpbak');
    await writeFile(cifrado, 'backup anterior');
    await expect(cifrarBackup(origem, cifrado, chaves)).rejects.toThrow();
    expect((await readFile(cifrado)).toString()).toBe('backup anterior');
  });

  // @trace DEC-117, DEC-114
  it('mestra errada, byte alterado ou arquivo truncado: recusa e não deixa saída', async () => {
    const cifrado = join(dir, 'b.mpbak');
    await cifrarBackup(origem, cifrado, chaves);
    const bytes = await readFile(cifrado);
    const volta = join(dir, 'volta.tar');

    await expect(decifrarBackup(cifrado, volta, Buffer.alloc(32, 0x34))).rejects.toThrow();
    expect(existsSync(volta)).toBe(false);

    const alterado = Buffer.from(bytes);
    alterado[bytes.length - 1024] ^= 0x01;
    await writeFile(join(dir, 'alterado.mpbak'), alterado);
    await expect(decifrarBackup(join(dir, 'alterado.mpbak'), volta, mestra)).rejects.toThrow();
    expect(existsSync(volta)).toBe(false);

    await writeFile(join(dir, 'truncado.mpbak'), bytes.subarray(0, bytes.length - 8));
    await expect(decifrarBackup(join(dir, 'truncado.mpbak'), volta, mestra)).rejects.toThrow();
    expect(existsSync(volta)).toBe(false);
  });

  // @trace DEC-117
  it('arquivo que não é backup é recusado', async () => {
    const falso = join(dir, 'falso.mpbak');
    await writeFile(falso, randomBytes(4096));
    await expect(lerMestraEmbrulhada(falso)).rejects.toThrow();
    await expect(decifrarBackup(falso, join(dir, 'volta.tar'), mestra)).rejects.toThrow();
    expect(existsSync(join(dir, 'volta.tar'))).toBe(false);
  });
});
