import type { FastifyPluginAsync } from 'fastify';

import {
  anticipateInstallmentPlanInputSchema,
  archiveAccountInputSchema,
  createInstallmentPlanInputSchema,
  createCreditCardInputSchema,
  createCreditCardPurchaseInputSchema,
  createAccountInputSchema,
  createContractAdjustmentInputSchema,
  createContractInputSchema,
  createTransactionInputSchema,
  accountsSnapshotSchema,
  accountListItemSchema,
  creditCardListItemSchema,
  creditCardPurchaseListItemSchema,
  creditCardsSnapshotSchema,
  contractAdjustmentSchema,
  contractSchema,
  contractsSnapshotSchema,
  endContractInputSchema,
  horizonSettingsSchema,
  horizonSnapshotSchema,
  installmentOperationSchema,
  installmentPlanListItemSchema,
  installmentsSnapshotSchema,
  manualTransactionSchema,
  transactionsSnapshotSchema,
  updateInstallmentAnticipationInputSchema,
  updateInstallmentPlanInputSchema,
  updateCreditCardInputSchema,
  updateCreditCardPurchaseInputSchema,
  updateContractInputSchema,
  updateHorizonSettingsInputSchema,
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

const contractsSnapshotResponseSchema = z.object({
  snapshot: contractsSnapshotSchema,
});

const creditCardsSnapshotResponseSchema = z.object({
  snapshot: creditCardsSnapshotSchema,
});

const installmentsSnapshotResponseSchema = z.object({
  snapshot: installmentsSnapshotSchema,
});

const creditCardResponseSchema = z.object({
  creditCard: creditCardListItemSchema,
});

const installmentPlanResponseSchema = z.object({
  plan: installmentPlanListItemSchema,
});

const installmentOperationResponseSchema = z.object({
  operation: installmentOperationSchema,
});

const creditCardPurchaseResponseSchema = z.object({
  purchase: creditCardPurchaseListItemSchema,
});

const contractResponseSchema = z.object({
  contract: contractSchema,
});

const contractAdjustmentResponseSchema = z.object({
  adjustment: contractAdjustmentSchema,
});

const horizonSnapshotResponseSchema = z.object({
  snapshot: horizonSnapshotSchema,
});

const horizonSettingsResponseSchema = z.object({
  settings: horizonSettingsSchema,
});

const createContractAdjustmentBodySchema =
  createContractAdjustmentInputSchema.omit({ contractId: true });

const endContractBodySchema = endContractInputSchema.omit({ contractId: true });

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

    app.get('/api/v1/contracts', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const snapshot = await financeService.getContractsSnapshot(
        authorizedSession.userId,
      );

      return reply.send(contractsSnapshotResponseSchema.parse({ snapshot }));
    });

    app.get('/api/v1/credit-cards', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const snapshot = await financeService.getCreditCardsSnapshot(
        authorizedSession.userId,
      );

      return reply.send(creditCardsSnapshotResponseSchema.parse({ snapshot }));
    });

    app.get('/api/v1/installments', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const snapshot = await financeService.getInstallmentsSnapshot(
        authorizedSession.userId,
      );

      return reply.send(installmentsSnapshotResponseSchema.parse({ snapshot }));
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

    app.post('/api/v1/contracts', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createContractInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const contract = await financeService.createContract(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(contractResponseSchema.parse({ contract }));
    });

    app.post('/api/v1/credit-cards', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createCreditCardInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const creditCard = await financeService.createCreditCard(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(
        creditCardResponseSchema.parse({ creditCard }),
      );
    });

    app.post('/api/v1/credit-card-purchases', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createCreditCardPurchaseInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const purchase = await financeService.createCreditCardPurchase(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(
        creditCardPurchaseResponseSchema.parse({ purchase }),
      );
    });

    app.post('/api/v1/installments', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = createInstallmentPlanInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const plan = await financeService.createInstallmentPlan(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(installmentPlanResponseSchema.parse({ plan }));
    });

    app.post('/api/v1/installment-operations', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = anticipateInstallmentPlanInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const operation = await financeService.anticipateInstallmentPlan(
        authorizedSession.userId,
        parsedBody.data,
        getRequestContext(request),
      );

      return reply.code(201).send(
        installmentOperationResponseSchema.parse({ operation }),
      );
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

    app.put('/api/v1/contracts/:id', async (request, reply) => {
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

      const parsedBody = createContractInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const contract = await financeService.updateContract(
        authorizedSession.userId,
        updateContractInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(contractResponseSchema.parse({ contract }));
    });

    app.put('/api/v1/credit-cards/:id', async (request, reply) => {
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

      const parsedBody = createCreditCardInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const creditCard = await financeService.updateCreditCard(
        authorizedSession.userId,
        updateCreditCardInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(creditCardResponseSchema.parse({ creditCard }));
    });

    app.put('/api/v1/installments/:id', async (request, reply) => {
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

      const parsedBody = createInstallmentPlanInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const plan = await financeService.updateInstallmentPlan(
        authorizedSession.userId,
        updateInstallmentPlanInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(installmentPlanResponseSchema.parse({ plan }));
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

    app.post('/api/v1/contracts/:id/adjustments', async (request, reply) => {
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

      const parsedBody = createContractAdjustmentBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const adjustment = await financeService.createContractAdjustment(
        authorizedSession.userId,
        createContractAdjustmentInputSchema.parse({
          ...parsedBody.data,
          contractId: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.code(201).send(
        contractAdjustmentResponseSchema.parse({ adjustment }),
      );
    });

    app.post('/api/v1/contracts/:id/end', async (request, reply) => {
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

      const parsedBody = endContractBodySchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const contract = await financeService.endContract(
        authorizedSession.userId,
        endContractInputSchema.parse({
          ...parsedBody.data,
          contractId: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(contractResponseSchema.parse({ contract }));
    });

    app.put('/api/v1/credit-card-purchases/:id', async (request, reply) => {
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

      const parsedBody = createCreditCardPurchaseInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const purchase = await financeService.updateCreditCardPurchase(
        authorizedSession.userId,
        updateCreditCardPurchaseInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(creditCardPurchaseResponseSchema.parse({ purchase }));
    });

    app.put('/api/v1/installment-operations/:id', async (request, reply) => {
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

      const parsedBody = anticipateInstallmentPlanInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const operation = await financeService.updateInstallmentAnticipation(
        authorizedSession.userId,
        updateInstallmentAnticipationInputSchema.parse({
          ...parsedBody.data,
          id: parsedParams.data.id,
        }),
        getRequestContext(request),
      );

      return reply.send(
        installmentOperationResponseSchema.parse({ operation }),
      );
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

    app.get('/api/v1/horizon', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const result = await financeService.getHorizonSnapshot(
        authorizedSession.userId,
      );

      reply.header('server-timing', `horizon;dur=${result.durationInMs}`);
      reply.header('x-horizon-cache', result.cacheStatus);
      reply.header('x-horizon-generated-at', result.snapshot.generatedAt);

      return reply.send(horizonSnapshotResponseSchema.parse({
        snapshot: result.snapshot,
      }));
    });

    app.put('/api/v1/horizon/settings', async (request, reply) => {
      const authorizedSession = await financeService.requireAuthorizedSession(
        request.cookies[env.SESSION_COOKIE_NAME],
      );
      const parsedBody = updateHorizonSettingsInputSchema.safeParse(request.body);

      if (!parsedBody.success) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Dados invalidos.',
          parsedBody.error.flatten(),
        );
      }

      const settings = await financeService.updateHorizonSettings(
        authorizedSession.userId,
        parsedBody.data,
      );

      return reply.send(horizonSettingsResponseSchema.parse({ settings }));
    });
  };
}