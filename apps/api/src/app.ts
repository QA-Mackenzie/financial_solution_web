import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

import { env } from './config';
import { AuthService } from './lib/auth-service';
import { createDatabaseClient, type DatabaseClient } from './lib/database';
import { getErrorLogMessage, serializeError } from './lib/errors';
import { FinanceService } from './lib/finance-service';
import { SessionGuard } from './lib/session-guard';
import { authRoutes } from './routes/auth';
import { financeRoutes } from './routes/finance';
import { healthRoutes } from './routes/health';

type BuildAppOptions = {
  database?: DatabaseClient;
  now?: () => Date;
};

export function buildApp(options: BuildAppOptions = {}) {
  const database = options.database ?? createDatabaseClient();
  const authService = new AuthService(database, {
    now: options.now,
  });
  const sessionGuard = new SessionGuard(authService);
  const financeService = new FinanceService(
    database,
    sessionGuard,
    options.now,
  );

  const app = Fastify({
    genReqId(request) {
      const correlationId = request.headers['x-correlation-id'];

      if (typeof correlationId === 'string' && correlationId.trim()) {
        return correlationId.trim();
      }

      return randomUUID();
    },
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: {
              censor: '[redacted]',
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.body.password',
                'res.headers["set-cookie"]',
              ],
            },
          },
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-correlation-id', request.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const serializedError = serializeError(error, request.id);

    request.log.error(
      {
        code: serializedError.body.code,
        err: error,
        requestId: request.id,
      },
      getErrorLogMessage(error),
    );

    reply.status(serializedError.statusCode).send({
      error: serializedError.body,
    });
  });

  app.addHook('onClose', async () => {
    await database.close();
  });

  app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  app.register(healthRoutes(database));
  app.register(authRoutes(authService));
  app.register(financeRoutes(financeService));

  return app;
}

