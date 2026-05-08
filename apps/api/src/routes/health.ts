import type { FastifyPluginAsync } from 'fastify';

import type { DatabaseClient } from '../lib/database';

export function healthRoutes(database: DatabaseClient): FastifyPluginAsync {
  return async (app) => {
    app.get('/health', async () => {
      const databaseHealth = await database.checkHealth();

      return {
        checks: {
          database: databaseHealth,
        },
        service: 'economy-cash-api',
        status: databaseHealth.status === 'up' ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
      };
    });
  };
}

