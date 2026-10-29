// Acesso ao banco com isolamento por tenant (DEC-040, DEC-046).
// - Toda leitura/escrita de dados do tenant roda dentro de `noTenant`, que abre a transação
//   e faz SET LOCAL app.tenant_id; sem isso as policies não devolvem nada (falha fechada).
// - `semTenant` só chama as funções SECURITY DEFINER auth_* (login, tokens, sessão).
// - `manutencao` usa mp_manutencao (BYPASSRLS) e é restrito a jobs e outbox.

import { sql, type SQL } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export type Executor = Pick<NodePgDatabase, 'execute'>;
export { sql };

export async function linhas<T>(ex: Executor, consulta: SQL): Promise<T[]> {
  const r = await ex.execute(consulta);
  return r.rows as T[];
}

export async function linha<T>(ex: Executor, consulta: SQL): Promise<T | undefined> {
  return (await linhas<T>(ex, consulta))[0];
}

export class Banco {
  private readonly poolApp: pg.Pool;
  private readonly poolManutencao: pg.Pool;
  private readonly app: NodePgDatabase;
  private readonly manut: NodePgDatabase;

  constructor(urlApp: string, urlManutencao: string) {
    this.poolApp = new pg.Pool({ connectionString: urlApp, max: 10 });
    this.poolManutencao = new pg.Pool({ connectionString: urlManutencao, max: 2 });
    this.app = drizzle(this.poolApp);
    this.manut = drizzle(this.poolManutencao);
  }

  async noTenant<T>(tenantId: string, fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.app.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  async semTenant<T>(fn: (ex: Executor) => Promise<T>): Promise<T> {
    return fn(this.app);
  }

  async manutencao<T>(fn: (tx: Executor) => Promise<T>): Promise<T> {
    return this.manut.transaction(fn);
  }

  async fechar(): Promise<void> {
    await Promise.all([this.poolApp.end(), this.poolManutencao.end()]);
  }
}
