import type { FastifyPluginAsync } from 'fastify';

import {
  loginInputSchema,
  passwordResetInputSchema,
  passwordResetRequestInputSchema,
  passwordResetRequestResultSchema,
  registerInputSchema,
  sessionSchema,
} from '@shf/contracts';

import { env } from '../config';
import type { AuthService } from '../lib/auth-service';
import { AppError } from '../lib/errors';

const cookieOptions = {
  httpOnly: true,
  maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  sameSite: 'lax' as const,
  path: '/',
  secure: env.NODE_ENV === 'production',
};

function getAuthContext(request: {
  id: string;
  ip: string;
  headers: Record<string, string | string[] | undefined>;
}) {
  return {
    ipAddress: request.ip ?? null,
    requestId: request.id,
    userAgent:
      typeof request.headers['user-agent'] === 'string'
        ? request.headers['user-agent']
        : null,
  };
}

function buildSessionCookieOptions(maxAge: number) {
  return {
    ...cookieOptions,
    maxAge,
  };
}

export function authRoutes(authService: AuthService): FastifyPluginAsync {
  return async (app) => {
  app.get('/api/v1/session', async (request, reply) => {
    const sessionResult = await authService.getSession(
      request.cookies[env.SESSION_COOKIE_NAME],
      true,
    );

    if (!sessionResult) {
      reply.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
      return reply.code(200).send({ session: null });
    }

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionResult.sessionToken,
      buildSessionCookieOptions(authService.getSessionCookieMaxAgeSeconds()),
    );

    return reply.send({ session: sessionSchema.parse(sessionResult.session) });
  });

  app.post('/api/v1/auth/register', async (request, reply) => {
    const parsedBody = registerInputSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Dados invalidos.',
        parsedBody.error.flatten(),
      );
    }

    const { session, sessionToken } = await authService.register(
      parsedBody.data,
      getAuthContext(request),
    );

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionToken,
      buildSessionCookieOptions(authService.getSessionCookieMaxAgeSeconds()),
    );

    return reply.code(201).send({ session });
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsedBody = loginInputSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Dados invalidos.',
        parsedBody.error.flatten(),
      );
    }

    const { session, sessionToken } = await authService.login(
      parsedBody.data,
      getAuthContext(request),
    );

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionToken,
      buildSessionCookieOptions(authService.getSessionCookieMaxAgeSeconds()),
    );

    return reply.send({ session });
  });

  app.post('/api/v1/auth/refresh', async (request, reply) => {
    const sessionResult = await authService.getSession(
      request.cookies[env.SESSION_COOKIE_NAME],
      true,
    );

    if (!sessionResult) {
      reply.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
      return reply.code(200).send({ session: null });
    }

    reply.setCookie(
      env.SESSION_COOKIE_NAME,
      sessionResult.sessionToken,
      buildSessionCookieOptions(authService.getSessionCookieMaxAgeSeconds()),
    );

    return reply.send({ session: sessionSchema.parse(sessionResult.session) });
  });

  app.post('/api/v1/auth/password-recovery', async (request, reply) => {
    const parsedBody = passwordResetRequestInputSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Dados invalidos.',
        parsedBody.error.flatten(),
      );
    }

    const result = await authService.requestPasswordReset(
      parsedBody.data,
      getAuthContext(request),
    );

    return reply.send(passwordResetRequestResultSchema.parse(result));
  });

  app.post('/api/v1/auth/password-reset', async (request, reply) => {
    const parsedBody = passwordResetInputSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Dados invalidos.',
        parsedBody.error.flatten(),
      );
    }

    await authService.resetPassword(parsedBody.data, getAuthContext(request));

    return reply.code(204).send();
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await authService.logout(
      request.cookies[env.SESSION_COOKIE_NAME],
      getAuthContext(request),
    );
    reply.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);

    return reply.code(204).send();
  });
  };
}

