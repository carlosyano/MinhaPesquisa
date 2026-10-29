// Migrações SQL versionadas do MinhaPesquisa (PLANO §5.6). Os arquivos em ../migracoes são a
// fonte; este módulo só os aplica em ordem e registra o que já foi aplicado.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';

const DIR = fileURLToPath(new URL('../migracoes/', import.meta.url));

function arquivos(): string[] {
  return readdirSync(DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && !f.endsWith('.down.sql') && !f.startsWith('0000_'))
    .sort();
}

/** Cria os papéis do banco (DEC-046, DEC-090). Exige superusuário; idempotente. */
export async function criarPapeis(superusuario: pg.ClientBase): Promise<void> {
  await superusuario.query(readFileSync(DIR + '0000_papeis.sql', 'utf8'));
}

/** Aplica as migrações pendentes como mp_owner, cada uma na própria transação. */
export async function aplicarMigracoes(cliente: pg.ClientBase): Promise<string[]> {
  await cliente.query('SET ROLE mp_owner');
  try {
    await cliente.query(
      'CREATE TABLE IF NOT EXISTS schema_migracoes (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())',
    );
    const feitas = new Set((await cliente.query<{ nome: string }>('SELECT nome FROM schema_migracoes')).rows.map((r) => r.nome));
    const aplicadas: string[] = [];
    for (const nome of arquivos()) {
      if (feitas.has(nome)) continue;
      await cliente.query('BEGIN');
      try {
        await cliente.query(readFileSync(DIR + nome, 'utf8'));
        await cliente.query('INSERT INTO schema_migracoes (nome) VALUES ($1)', [nome]);
        await cliente.query('COMMIT');
      } catch (e) {
        await cliente.query('ROLLBACK');
        throw e;
      }
      aplicadas.push(nome);
    }
    return aplicadas;
  } finally {
    await cliente.query('RESET ROLE');
  }
}

/** Reverte a última migração aplicada usando o arquivo .down.sql correspondente. */
export async function reverterUltima(cliente: pg.ClientBase): Promise<string | null> {
  await cliente.query('SET ROLE mp_owner');
  try {
    const r = await cliente.query<{ nome: string }>('SELECT nome FROM schema_migracoes ORDER BY nome DESC LIMIT 1');
    const nome = r.rows[0]?.nome;
    if (!nome) return null;
    await cliente.query('BEGIN');
    try {
      await cliente.query(readFileSync(DIR + nome.replace(/\.sql$/, '.down.sql'), 'utf8'));
      await cliente.query('DELETE FROM schema_migracoes WHERE nome = $1', [nome]);
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    }
    return nome;
  } finally {
    await cliente.query('RESET ROLE');
  }
}
