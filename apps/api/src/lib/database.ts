import type { QueryResult, QueryResultRow } from 'pg';
import { Pool } from 'pg';

import { env } from '../config';

export type DatabaseHealth = {
  database: string | null;
  latencyMs: number;
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

      return {
        database: databaseResult.rows[0]?.database_name ?? null,
        latencyMs: Date.now() - startedAt,
        seededUsers: Number(seedResult.rows[0]?.seeded_users ?? 0),
        status: 'up',
      };
    } catch {
      return {
        database: null,
        latencyMs: Date.now() - startedAt,
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
