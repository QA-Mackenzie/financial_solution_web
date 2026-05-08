import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { DatabaseExecutor } from './database';

const SCHEMA_FILE_NAMES = [
  '001-bootstrap-schema.sql',
  '003-auth-schema.sql',
  '004-finance-schema.sql',
] as const;

function resolveSqlDirectory() {
  const candidateDirectories = [
    path.resolve(process.cwd(), 'infra/postgres/init'),
    path.resolve(__dirname, '../../../infra/postgres/init'),
    path.resolve(__dirname, '../../../../infra/postgres/init'),
  ];

  const sqlDirectory = candidateDirectories.find((directory) =>
    existsSync(path.join(directory, SCHEMA_FILE_NAMES[0])),
  );

  if (!sqlDirectory) {
    throw new Error('Nao foi possivel localizar o diretorio infra/postgres/init.');
  }

  return sqlDirectory;
}

export async function ensureDatabaseSchema(database: DatabaseExecutor) {
  const sqlDirectory = resolveSqlDirectory();

  for (const fileName of SCHEMA_FILE_NAMES) {
    const filePath = path.join(sqlDirectory, fileName);
    const sql = readFileSync(filePath, 'utf8');

    await database.query(sql);
  }
}