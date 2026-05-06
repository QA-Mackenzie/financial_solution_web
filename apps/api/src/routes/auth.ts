import type { FastifyPluginAsync } from 'fastify';

import {
  loginInputSchema,
  registerInputSchema,
  sessionSchema,
} from '@shf/contracts';

import { env } from '../config';
import { authStore } from '../lib/auth-store';
import { AppError } from '../lib/errors';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: env.NODE_ENV === 'production',
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/v1/session', async (request, reply) => {
    const session = authStore.getSession(
      request.cookies[env.SESSION_COOKIE_NAME],
    );

    if (!session) {
      return reply.code(200).send({ session: null });
    }

    return reply.send({ session: sessionSchema.parse(session) });
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

    const { sessionId, session } = authStore.register(parsedBody.data);

    reply.setCookie(env.SESSION_COOKIE_NAME, sessionId, cookieOptions);

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

    const { sessionId, session } = authStore.login(parsedBody.data);

    reply.setCookie(env.SESSION_COOKIE_NAME, sessionId, cookieOptions);

    return reply.send({ session });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    authStore.logout(request.cookies[env.SESSION_COOKIE_NAME]);
    reply.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);

    return reply.code(204).send();
  });
};

