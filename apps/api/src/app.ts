import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

import { env } from './config';
import { AuthService } from './lib/auth-service';
import { createDatabaseClient, type DatabaseClient } from './lib/database';
import {
  AppError,
  getErrorLogMessage,
  serializeError,
  serializeErrorForLog,
} from './lib/errors';
import { FinanceService } from './lib/finance-service';
import {
  getOriginViolation,
  getRequestPath,
  InMemoryRateLimiter,
  insertSecurityAuditLog,
  resolveRateLimitPolicy,
} from './lib/request-security';
import { SessionGuard } from './lib/session-guard';
import { authRoutes } from './routes/auth';
import { financeRoutes } from './routes/finance';
import { healthRoutes } from './routes/health';

type BuildAppOptions = {
  database?: DatabaseClient;
  now?: () => Date;
};

export const REDACTED_LOG_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.origin',
  'req.headers.referer',
  'req.headers["proxy-authorization"]',
  'req.headers["x-api-key"]',
  'req.query.token',
  'req.query.code',
  'req.body.email',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.passwordConfirmation',
  'req.body.token',
  'req.body.previewToken',
  'req.body.sessionToken',
  'req.body.refreshToken',
  'req.body.accessToken',
  'req.body.secret',
  'req.body.apiKey',
  'req.body.clientSecret',
  'req.body.passphrase',
  'res.headers["set-cookie"]',
];

export function buildApp(options: BuildAppOptions = {}) {
  const database = options.database ?? createDatabaseClient();
  const now = options.now ?? (() => new Date());
  const authService = new AuthService(database, {
    now,
  });
  const sessionGuard = new SessionGuard(authService);
  const financeService = new FinanceService(
    database,
    sessionGuard,
    now,
  );
  const rateLimiter = new InMemoryRateLimiter();

  const app = Fastify({
    genReqId(request) {
      const correlationId = request.headers['x-correlation-id'];

      if (typeof correlationId === 'string' && correlationId.trim()) {
        return correlationId.trim();
      }

      return randomUUID();
    },
    trustProxy: env.NODE_ENV === 'production',
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: {
              censor: '[redacted]',
              paths: REDACTED_LOG_PATHS,
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
        error: serializeErrorForLog(error),
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

  app.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      directives: {
        baseUri: ["'none'"],
        defaultSrc: ["'none'"],
        formAction: ["'self'", env.WEB_ORIGIN],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  app.register(cors, {
    allowedHeaders: ['Content-Type', 'Origin', 'X-Correlation-Id'],
    exposedHeaders: [
      'Retry-After',
      'X-Correlation-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
    methods: ['DELETE', 'GET', 'OPTIONS', 'POST', 'PUT'],
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  app.addHook('preHandler', async (request, reply) => {
    const requestPath = getRequestPath(request.url);
    const originViolation = getOriginViolation(request, env.WEB_ORIGIN);

    if (originViolation) {
      await insertSecurityAuditLog(database, now(), 'SECURITY_CSRF_REJECTED', request, {
        method: request.method,
        offendingOrigin: originViolation.offendingOrigin,
        path: originViolation.path,
        reason: originViolation.reason,
      });

      throw new AppError(
        403,
        'SECURITY_CSRF_REJECTED',
        'Origem invalida para esta operacao.',
      );
    }

    const rateLimitPolicy = resolveRateLimitPolicy(request.method, requestPath, {
      authMax: env.AUTH_RATE_LIMIT_MAX,
      authWindowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
      expensiveReadMax: env.EXPENSIVE_READ_RATE_LIMIT_MAX,
      expensiveReadWindowMs: env.EXPENSIVE_READ_RATE_LIMIT_WINDOW_MS,
      passwordRecoveryMax: env.PASSWORD_RECOVERY_RATE_LIMIT_MAX,
      passwordRecoveryWindowMs: env.PASSWORD_RECOVERY_RATE_LIMIT_WINDOW_MS,
    });

    if (!rateLimitPolicy) {
      return;
    }

    const rateLimitResult = rateLimiter.check(
      `${rateLimitPolicy.bucket}:${request.ip}:${requestPath}`,
      rateLimitPolicy,
      now(),
    );

    reply.header('x-rate-limit-limit', String(rateLimitResult.limit));
    reply.header('x-rate-limit-remaining', String(rateLimitResult.remaining));
    reply.header(
      'x-rate-limit-reset',
      String(Math.ceil(rateLimitResult.resetAt / 1000)),
    );

    if (rateLimitResult.allowed) {
      return;
    }

    reply.header('retry-after', String(rateLimitResult.retryAfterSeconds));
    await insertSecurityAuditLog(database, now(), 'SECURITY_RATE_LIMIT_REJECTED', request, {
      limit: rateLimitResult.limit,
      method: request.method,
      path: requestPath,
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      windowMs: rateLimitPolicy.windowMs,
    });

    throw new AppError(
      429,
      'SECURITY_RATE_LIMIT_REJECTED',
      'Muitas requisicoes para este recurso. Tente novamente em instantes.',
      {
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
      },
    );
  });

  app.register(healthRoutes(database));
  app.register(authRoutes(authService));
  app.register(financeRoutes(financeService));

  return app;
}

