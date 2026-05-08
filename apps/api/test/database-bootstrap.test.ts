import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';

import { ensureDatabaseSchema } from '../src/lib/database-bootstrap';
import { createDatabaseClientFromPool } from '../src/lib/database';

describe('database bootstrap', () => {
  it('aplica o schema base sem depender de pre-deploy e suporta reexecucao', async () => {
    const database = newDb({
      autoCreateForeignKeyIndices: true,
      noAstCoverageCheck: true,
    });
    const pgAdapter = database.adapters.createPg();
    const pool = new pgAdapter.Pool();
    const client = createDatabaseClientFromPool(pool);

    try {
      await ensureDatabaseSchema(client);
      await ensureDatabaseSchema(client);

      const bootstrapTable = await client.query<{ total: string }>(
        'select count(*)::text as total from bootstrap.seed_users',
      );
      const authTable = await client.query<{ total: string }>(
        'select count(*)::text as total from auth.users',
      );
      const financeTable = await client.query<{ total: string }>(
        'select count(*)::text as total from finance.accounts',
      );

      expect(bootstrapTable.rows[0]?.total).toBe('0');
      expect(authTable.rows[0]?.total).toBe('0');
      expect(financeTable.rows[0]?.total).toBe('0');
    } finally {
      await client.close();
    }
  });
});