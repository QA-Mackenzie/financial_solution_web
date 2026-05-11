import type { FastifyPluginAsync } from 'fastify';

import type { DatabaseClient } from '../lib/database';

export function healthRoutes(database: DatabaseClient): FastifyPluginAsync {
  return async (app) => {
    app.get('/health', async (request, reply) => {
      const databaseHealth = await database.checkHealth();
      const status = databaseHealth.status === 'up' ? 'ok' : 'degraded';

      return reply.code(status === 'ok' ? 200 : 503).send({
        status,
      });
    });

    app.get('/livez', async () => {
      return {
        status: 'ok',
      };
    });

    app.get('/readyz', async (request, reply) => {
      const databaseHealth = await database.checkHealth();
      const status = databaseHealth.status === 'up' ? 'ok' : 'degraded';

      return reply.code(status === 'ok' ? 200 : 503).send({
        checks: {
          database: databaseHealth,
        },
        service: 'economy-cash-api',
        status,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
      });
    });
  };
}

