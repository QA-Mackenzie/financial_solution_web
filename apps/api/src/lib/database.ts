import { Pool } from 'pg';

import { env } from '../config';

export type DatabaseHealth = {
  database: string | null;
  latencyMs: number;
  seededUsers: number | null;
  status: 'down' | 'up';
};

export interface DatabaseClient {
  checkHealth(): Promise<DatabaseHealth>;
  close(): Promise<void>;
}

class PgDatabaseClient implements DatabaseClient {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 5,
    });
  }

  async checkHealth(): Promise<DatabaseHealth> {
    const startedAt = Date.now();

    try {
      const databaseResult = await this.pool.query<{ database_name: string }>(
        'select current_database() as database_name',
      );
      const seedResult = await this.pool.query<{ seeded_users: string }>(
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

export function createDatabaseClient(connectionString = env.DATABASE_URL): DatabaseClient {
  return new PgDatabaseClient(connectionString);
}
