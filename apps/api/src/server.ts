import { buildApp } from './app';
import { env } from './config';
import { ensureDatabaseSchema } from './lib/database-bootstrap';
import { createDatabaseClient } from './lib/database';
import { getErrorLogMessage, serializeErrorForLog } from './lib/errors';

async function start() {
  const database = createDatabaseClient();
  const app = buildApp({ database });

  try {
    await ensureDatabaseSchema(database);
    await app.listen({
      host: '0.0.0.0',
      port: env.API_PORT,
    });
  } catch (error) {
    app.log.error({ error: serializeErrorForLog(error) }, getErrorLogMessage(error));
    await app.close();
    process.exit(1);
  }
}

void start();
