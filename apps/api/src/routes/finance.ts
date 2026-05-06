import type { FastifyPluginAsync } from 'fastify';

import {
  archiveAccountInputSchema,
  createAccountInputSchema,
  createTransactionInputSchema,
  accountsSnapshotSchema,
  accountListItemSchema,
  manualTransactionSchema,
  transactionsSnapshotSchema,
  updateAccountInputSchema,
  updateTransactionInputSchema,
} from '@shf/contracts';
import { z } from 'zod';

import { env } from '../config';
import type { FinanceService } from '../lib/finance-service';
import { AppError } from '../lib/errors';

const accountsSnapshotResponseSchema = z.object({
  snapshot: accountsSnapshotSchema,
});

const accountResponseSchema = z.object({
  account: accountListItemSchema.or(createAccountInputSchema.extend({
    id: z.string().uuid(),
    isArchived: z.boolean(),
    archivedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })),
});

const transactionResponseSchema = z.object({
  transaction: manualTransactionSchema,
});

const transactionsSnapshotResponseSchema = z.object({
  snapshot: transactionsSnapshotSchema,
});

const idParamSchema = z.object({
  id: z.string().uuid('Identificador invalido.'),
});

function getRequestContext(request: {
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

export function financeRoutes(financeService: FinanceService): FastifyPluginAsync {
  return async (app) => {
    app.get('/api/v1/accounts', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const snapshot = await financeService.getAccountsSnapshot(
        authorizedSession.userId,
      );

      return reply.send(accountsSnapshotResponseSchema.parse({ snapshot }));
    });

    app.post('/api/v1/accounts', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createAccountInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const account = await financeService.createAccount(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(accountResponseSchema.parse({ account }));
    });

    app.put('/api/v1/accounts/:id', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedParams = idParamSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedParams.error.flatten(),
        );
      }

      const parsedBody = createAccountInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const account = await financeService.updateAccount(
        authorizedSession.userId,
        updateAccountInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(accountResponseSchema.parse({ account }));
    });

    app.post('/api/v1/accounts/:id/archive', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedParams = idParamSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedParams.error.flatten(),
        );
      }

      const account = await financeService.archiveAccount(
        authorizedSession.userId,
        archiveAccountInputSchema.parse(parsedParams.data),
        getRequestContext(request),
      );

      return reply.send(accountResponseSchema.parse({ account }));
    });

    app.get('/api/v1/transactions', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const snapshot = await financeService.listTransactions(
        authorizedSession.userId,
      );

      return reply.send(transactionsSnapshotResponseSchema.parse({ snapshot }));
    });

    app.post('/api/v1/transactions', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createTransactionInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const transaction = await financeService.createTransaction(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(transactionResponseSchema.parse({ transaction }));
    });

    app.put('/api/v1/transactions/:id', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedParams = idParamSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedParams.error.flatten(),
        );
      }

      const parsedBody = createTransactionInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const transaction = await financeService.updateTransaction(
        authorizedSession.userId,
        updateTransactionInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(transactionResponseSchema.parse({ transaction }));
    });

    app.delete('/api/v1/transactions/:id', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedParams = idParamSchema.safeParse(request.params);

      if (!parsedParams.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedParams.error.flatten(),
        );
      }

      await financeService.deleteTransaction(
        authorizedSession.userId,
        parsedParams.data.id,
        getRequestContext(request),
      );

      return reply.code(204).send();
    });
  };
}