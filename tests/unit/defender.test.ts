// Microsoft Defender no upload (DEC-115): varredura pela linha de comando (MpCmdRun) de um
// arquivo temporário, com a regra de falha da DEC-102 (tempo esgotado ou resposta inesperada é
// falha, nunca "limpo"). O MpCmdRun real só existe no Windows; aqui um executor sintético faz o
// papel dele.

import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AntimalwareDefender, resultadoDefender, type ExecutorDefender } from '../../apps/api/src/infra/antimalware.js';

describe('leitura do resultado do MpCmdRun (DEC-115, DEC-102)', () => {
  // @trace DEC-115, DEC-102, CA-029
  it.each([
    [{ codigo: 0, tempoEsgotado: false, arquivoExiste: true }, 'limpo'],
    [{ codigo: 2, tempoEsgotado: false, arquivoExiste: true }, 'risco'],
    // A proteção em tempo real apagou o arquivo antes ou durante a varredura.
    [{ codigo: 0, tempoEsgotado: false, arquivoExiste: false }, 'risco'],
    [{ codigo: 2, tempoEsgotado: false, arquivoExiste: false }, 'risco'],
    [{ codigo: 1, tempoEsgotado: false, arquivoExiste: true }, 'falha'],
    [{ codigo: -2147024894, tempoEsgotado: false, arquivoExiste: true }, 'falha'],
    [{ codigo: null, tempoEsgotado: false, arquivoExiste: true }, 'falha'],
    [{ codigo: null, tempoEsgotado: true, arquivoExiste: true }, 'falha'],
    [{ codigo: 0, tempoEsgotado: true, arquivoExiste: true }, 'falha'],
    [{ codigo: 2, tempoEsgotado: true, arquivoExiste: false }, 'falha'],
  ] as const)('%j → %s', (execucao, esperado) => {
    expect(resultadoDefender(execucao)).toBe(esperado);
  });
});

describe('varredura pelo Defender (DEC-115)', () => {
  let pasta: string;
  let chamadas: { executavel: string; args: string[]; timeoutMs: number; conteudo: Buffer | null }[];

  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), 'mp-defender-'));
    chamadas = [];
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  /** Executor que registra a chamada, lê o arquivo enviado e devolve o código pedido. */
  function executor(codigo: number | null, extra?: { apagar?: boolean; tempoEsgotado?: boolean }): ExecutorDefender {
    return async (executavel, args, timeoutMs) => {
      const arquivo = args[args.indexOf('-File') + 1];
      chamadas.push({ executavel, args, timeoutMs, conteudo: existsSync(arquivo) ? await readFile(arquivo) : null });
      if (extra?.apagar) await rm(arquivo, { force: true });
      return { codigo, tempoEsgotado: extra?.tempoEsgotado ?? false };
    };
  }

  const bytes = Buffer.from('arquivo sintético enviado');

  // @trace DEC-115, CA-029
  it('varre um arquivo temporário com os bytes enviados, sem remediação, e o apaga depois', async () => {
    const d = new AntimalwareDefender({ pastaTemp: pasta, executar: executor(0) });
    expect(await d.limpo(bytes)).toBe(true);

    expect(chamadas).toHaveLength(1);
    const { executavel, args, timeoutMs, conteudo } = chamadas[0];
    expect(executavel).toMatch(/MpCmdRun\.exe$/i);
    expect(args.slice(0, 3)).toEqual(['-Scan', '-ScanType', '3']);
    expect(args).toContain('-DisableRemediation');
    const arquivo = args[args.indexOf('-File') + 1];
    expect(resolve(arquivo).startsWith(resolve(pasta))).toBe(true);
    expect(conteudo?.equals(bytes)).toBe(true);
    expect(timeoutMs).toBe(30_000);
    expect(await readdir(pasta)).toEqual([]);
  });

  // @trace DEC-115, CA-029
  it('ameaça encontrada → não limpo, e o temporário não fica', async () => {
    const d = new AntimalwareDefender({ pastaTemp: pasta, executar: executor(2) });
    expect(await d.limpo(bytes)).toBe(false);
    expect(await readdir(pasta)).toEqual([]);
  });

  // @trace DEC-115, CA-029
  it('arquivo removido pela proteção em tempo real → não limpo', async () => {
    const d = new AntimalwareDefender({ pastaTemp: pasta, executar: executor(0, { apagar: true }) });
    expect(await d.limpo(bytes)).toBe(false);
    expect(await readdir(pasta)).toEqual([]);
  });

  // @trace DEC-115, DEC-102, CA-029, ERR-020
  it.each([
    ['código inesperado', executor(1)],
    ['tempo esgotado', executor(null, { tempoEsgotado: true })],
    [
      'executor que falha',
      (async () => {
        throw new Error('MpCmdRun ausente');
      }) as ExecutorDefender,
    ],
  ])('%s → erro (nunca "limpo"), e o temporário não fica', async (_caso, executar) => {
    const d = new AntimalwareDefender({ pastaTemp: pasta, executar });
    await expect(d.limpo(bytes)).rejects.toThrow();
    expect(await readdir(pasta)).toEqual([]);
  });

  // @trace DEC-115, RN-029
  it('o nome do temporário é aleatório e muda a cada varredura', async () => {
    const d = new AntimalwareDefender({ pastaTemp: pasta, executar: executor(0) });
    await d.limpo(bytes);
    await d.limpo(bytes);
    const [a, b] = chamadas.map((c) => c.args[c.args.indexOf('-File') + 1]);
    expect(a).not.toBe(b);
  });
});
