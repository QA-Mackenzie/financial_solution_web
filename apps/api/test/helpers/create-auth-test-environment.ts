import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { newDb } from 'pg-mem';

import { buildApp } from '../../src/app';
import { AuthService } from '../../src/lib/auth-service';
import {
  createDatabaseClientFromPool,
  type DatabaseClient,
} from '../../src/lib/database';

export type AuthTestEnvironment = {
  app: FastifyInstance;
  authService: AuthService;
  database: DatabaseClient;
  advanceTime: (milliseconds: number) => void;
  cleanup: () => Promise<void>;
};

export async function createAuthTestEnvironment(): Promise<AuthTestEnvironment> {
  let currentTime = new Date('2026-05-01T12:00:00.000Z');
  const database = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = database.adapters.createPg();
  const pool = new pgAdapter.Pool();
  const sqlFilePaths = [
    '../../../../infra/postgres/init/003-auth-schema.sql',
    '../../../../infra/postgres/init/004-finance-schema.sql',
  ].map((relativePath) => path.resolve(__dirname, relativePath));

  for (const sqlFilePath of sqlFilePaths) {
    await pool.query(readFileSync(sqlFilePath, 'utf8'));
  }

  const databaseClient = createDatabaseClientFromPool(pool);
  const now = () => new Date(currentTime);
  const authService = new AuthService(databaseClient, { now });
  const app = buildApp({
    database: databaseClient,
    now,
  });

  return {
    app,
    authService,
    advanceTime(milliseconds) {
      currentTime = new Date(currentTime.getTime() + milliseconds);
    },
    cleanup: async () => {
      await app.close();
    },
    database: databaseClient,
  };
}