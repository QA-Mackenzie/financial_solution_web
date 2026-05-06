import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { newDb } from 'pg-mem';

import { buildApp } from '../../src/app';
import {
  createDatabaseClientFromPool,
  type DatabaseClient,
} from '../../src/lib/database';

export type AuthTestEnvironment = {
  app: FastifyInstance;
  database: DatabaseClient;
  advanceTime: (milliseconds: number) => void;
  cleanup: () => Promise<void>;
};

export async function createAuthTestEnvironment(): Promise<AuthTestEnvironment> {
  let currentTime = new Date('2026-05-01T12:00:00.000Z');
  const database = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = database.adapters.createPg();
  const pool = new pgAdapter.Pool();
  const sqlFilePath = path.resolve(
    __dirname,
    '../../../../infra/postgres/init/003-auth-schema.sql',
  );

  await pool.query(readFileSync(sqlFilePath, 'utf8'));

  const databaseClient = createDatabaseClientFromPool(pool);
  const app = buildApp({
    database: databaseClient,
    now: () => new Date(currentTime),
  });

  return {
    app,
    advanceTime(milliseconds) {
      currentTime = new Date(currentTime.getTime() + milliseconds);
    },
    cleanup: async () => {
      await app.close();
    },
    database: databaseClient,
  };
}