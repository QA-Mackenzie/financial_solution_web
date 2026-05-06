import { createDatabaseClient } from '../lib/database';

async function main() {
  const database = createDatabaseClient();
  const health = await database.checkHealth();

  console.log(JSON.stringify(health, null, 2));

  await database.close();

  if (health.status !== 'up') {
    process.exit(1);
  }
}

void main();
