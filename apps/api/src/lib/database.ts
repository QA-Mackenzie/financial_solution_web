import type { QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { env } from '../config';

export type DatabaseHealth = {
  database: string | null;
  latencyMs: number;
  seededAuthUsers?: number | null;
  seededFinanceAccounts?: number | null;
  stagedImportBatches?: number | null;
  seededUsers: number | null;
  status: 'down' | 'up';
};

export interface DatabaseExecutor {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>>;
}

export interface DatabaseClient extends DatabaseExecutor {
  checkHealth(): Promise<DatabaseHealth>;
  close(): Promise<void>;
  runInTransaction<T>(
    callback: (database: DatabaseExecutor) => Promise<T>,
  ): Promise<T>;
}

type PoolLike = Pick<Pool, 'connect' | 'end' | 'query'>;

class PgDatabaseClient implements DatabaseClient {
  constructor(private readonly pool: PoolLike) {}

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values as unknown[] | undefined);
  }

  async runInTransaction<T>(
    callback: (database: DatabaseExecutor) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');

      const result = await callback({
        query: <TRow extends QueryResultRow = QueryResultRow>(
          text: string,
          values?: readonly unknown[],
        ) => client.query<TRow>(text, values as unknown[] | undefined),
      });

      await client.query('commit');

      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async checkHealth(): Promise<DatabaseHealth> {
    const startedAt = Date.now();

    try {
      const databaseResult = await this.query<{ database_name: string }>(
        'select current_database() as database_name',
      );
      const seedResult = await this.query<{ seeded_users: string }>(
        'select count(*)::text as seeded_users from bootstrap.seed_users',
      );
      const authSeedResult = await this.query<{ seeded_auth_users: string }>(
        'select count(*)::text as seeded_auth_users from auth.users',
      );
      const financeSeedResult = await this.query<{ seeded_finance_accounts: string }>(
        'select count(*)::text as seeded_finance_accounts from finance.accounts',
      );
      const importSeedResult = await this.query<{ staged_import_batches: string }>(
        'select count(*)::text as staged_import_batches from legacy_import.sqlite_import_batches',
      );

      return {
        database: databaseResult.rows[0]?.database_name ?? null,
        latencyMs: Date.now() - startedAt,
        seededAuthUsers: Number(authSeedResult.rows[0]?.seeded_auth_users ?? 0),
        seededFinanceAccounts: Number(
          financeSeedResult.rows[0]?.seeded_finance_accounts ?? 0,
        ),
        stagedImportBatches: Number(
          importSeedResult.rows[0]?.staged_import_batches ?? 0,
        ),
        seededUsers: Number(seedResult.rows[0]?.seeded_users ?? 0),
        status: 'up',
      };
    } catch {
      return {
        database: null,
        latencyMs: Date.now() - startedAt,
        seededAuthUsers: null,
        seededFinanceAccounts: null,
        stagedImportBatches: null,
        seededUsers: null,
        status: 'down',
      };
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabaseClient(
  connectionString = env.DATABASE_URL,
): DatabaseClient {
  return new PgDatabaseClient(new Pool({ connectionString, max: 5 }));
}

export function createDatabaseClientFromPool(pool: PoolLike): DatabaseClient {
  return new PgDatabaseClient(pool);
}
