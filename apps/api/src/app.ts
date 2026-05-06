import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

import { env } from './config';
import { createDatabaseClient, type DatabaseClient } from './lib/database';
import { getErrorLogMessage, serializeError } from './lib/errors';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';

type BuildAppOptions = {
  database?: DatabaseClient;
};

export function buildApp(options: BuildAppOptions = {}) {
  const database = options.database ?? createDatabaseClient();

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
  app.register(authRoutes);

  return app;
}

