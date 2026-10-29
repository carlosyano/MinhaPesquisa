// Confere respostas de erro contra o catálogo fechado (REQ §8.2, registros/catalogo_erros.csv):
// status HTTP, Problem Details (RFC 9457), mensagem exata em pt-BR e correlação (Bloco P P.6).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { Resposta } from './cliente.js';

interface Erro {
  http_status: number;
  mensagem: string;
}

function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') {
      linha.push(campo);
      campo = '';
    } else if (c === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) linhas.push([...linha, campo]);
  return linhas;
}

const caminho = fileURLToPath(new URL('../../registros/catalogo_erros.csv', import.meta.url));
const [cab, ...dados] = lerCsv(readFileSync(caminho, 'utf8'));
const col = (n: string) => cab.indexOf(n);

export const CATALOGO: ReadonlyMap<string, Erro> = new Map(
  dados
    .filter((l) => l[col('status')] === 'ativo')
    .map((l) => [l[col('err_id')], { http_status: Number(l[col('http_status')]), mensagem: l[col('mensagem_ao_usuario')] }]),
);

export function esperarErro(res: Resposta, errId: string): void {
  const erro = CATALOGO.get(errId);
  if (!erro) throw new Error(`${errId} não está ativo no catálogo`);
  expect(res.status, `status de ${errId}; corpo: ${res.texto}`).toBe(erro.http_status);
  expect(res.headers.get('content-type') ?? '').toMatch(/^application\/problem\+json/);
  expect(res.corpo).toMatchObject({ status: erro.http_status, errorCode: errId, detail: erro.mensagem });
  expect(typeof res.corpo.type).toBe('string');
  expect(typeof res.corpo.title).toBe('string');
  expect(res.corpo.correlationId).toBeTruthy();
  expect(res.corpo.correlationId).toBe(res.headers.get('x-correlation-id'));
  expect(res.texto).not.toMatch(/\bat .+:\d+:\d+|stack|Error:/);
}

/** Corpo sem os campos que mudam a cada requisição, para comparar respostas que devem ser idênticas. */
export function semCorrelacao(res: Resposta): unknown {
  const { correlationId: _c, instance: _i, ...resto } = res.corpo ?? {};
  return { status: res.status, corpo: resto };
}
