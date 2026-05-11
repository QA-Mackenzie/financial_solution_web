import type { FastifyPluginAsync } from 'fastify';

import {
  createPrivacyRequestInputSchema,
  loginInputSchema,
  passwordResetInputSchema,
  passwordResetRequestInputSchema,
  passwordResetRequestResultSchema,
  privacyRequestSchema,
  privacyRequestsSnapshotSchema,
  registerInputSchema,
  sessionSchema,
} from '@economy-cash/contracts';
import { z } from 'zod';

import { env } from '../config';
import type { AuthService } from '../lib/auth-service';
import { AppError } from '../lib/errors';

const cookieOptions = {
  httpOnly: true,
  maxAge: env.SESSION_TTL_HOURS * 60 * 60,
  sameSite: 'lax' as const,
  path: '/',
  priority: 'high' as const,
  secure: env.NODE_ENV === 'production',
};

const sessionCookieOptions = {
  ...cookieOptions,
  // Em producao no Render, frontend e API ficam em origins diferentes.
  // SameSite=None permite que o navegador reenvie a sessao nas chamadas CORS.
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : cookieOptions.sameSite,
  // Alguns navegadores mais restritivos exigem CHIPS para aceitar o cookie
  // third-party entre os subdominios publicos do Render.
  partitioned: env.NODE_ENV === 'production',
};

function clearSessionCookie(reply: { header: (name: string, value: string) => void; }) {
  reply.header('set-cookie', buildExpiredSessionCookieHeader());
}

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
    ...sessionCookieOptions,
    maxAge,
  };
}

function buildExpiredSessionCookieHeader() {
  const parts = [
    `${env.SESSION_COOKIE_NAME}=`,
    'Max-Age=0',
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    `SameSite=${sessionCookieOptions.sameSite === 'none' ? 'None' : 'Lax'}`,
  ];

  if (sessionCookieOptions.secure) {
    parts.push('Secure');
  }

  if (sessionCookieOptions.partitioned) {
    parts.push('Partitioned');
  }

  parts.push('Priority=High');

  return parts.join('; ');
}

async function requireAuthenticatedUserId(
  authService: AuthService,
  sessionToken: string | undefined,
) {
  const sessionResult = await authService.getSession(sessionToken, false);

  if (!sessionResult) {
    throw new AppError(
      401,
      'AUTH_UNAUTHENTICATED',
      'Sessao invalida ou expirada.',
    );
  }

  return sessionResult.session.user.id;
}

const privacyRequestResponseSchema = z.object({
  request: privacyRequestSchema,
});

const privacyRequestsResponseSchema = z.object({
  snapshot: privacyRequestsSnapshotSchema,
});

export function authRoutes(authService: AuthService): FastifyPluginAsync {
  return async (app) => {
  app.get('/api/v1/session', async (request, reply) => {
    const sessionResult = await authService.getSession(
      request.cookies[env.SESSION_COOKIE_NAME],
      true,
    );

    if (!sessionResult) {
      clearSessionCookie(reply);
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
      clearSessionCookie(reply);
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
    clearSessionCookie(reply);

    return reply.code(204).send();
  });

  app.get('/api/v1/privacy/requests', async (request, reply) => {
    const userId = await requireAuthenticatedUserId(
      authService,
      request.cookies[env.SESSION_COOKIE_NAME],
    );
    const snapshot = await authService.listPrivacyRequests(userId);

    return reply.send(privacyRequestsResponseSchema.parse({ snapshot }));
  });

  app.post('/api/v1/privacy/requests', async (request, reply) => {
    const parsedBody = createPrivacyRequestInputSchema.safeParse(request.body);

    if (!parsedBody.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Dados invalidos.',
        parsedBody.error.flatten(),
      );
    }

    const userId = await requireAuthenticatedUserId(
      authService,
      request.cookies[env.SESSION_COOKIE_NAME],
    );
    const privacyRequest = await authService.createPrivacyRequest(
      userId,
      parsedBody.data,
      getAuthContext(request),
    );

    return reply
      .code(201)
      .send(privacyRequestResponseSchema.parse({ request: privacyRequest }));
  });
  };
}

