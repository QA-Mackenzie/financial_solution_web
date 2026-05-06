import { buildApp } from './app';
import { env } from './config';

async function start() {
  const app = buildApp();

  try {
    await app.listen({
      host: '0.0.0.0',
      port: env.API_PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
