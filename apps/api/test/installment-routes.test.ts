import type {
  CreditCardListItem,
  CreditCardsSnapshot,
  HorizonSnapshot,
  InstallmentOperation,
  InstallmentPlanListItem,
  InstallmentsSnapshot,
  SessionPayload,
} from '@shf/contracts';
import {
  creditCardsSnapshotSchema,
  horizonSnapshotSchema,
  installmentsSnapshotSchema,
} from '@shf/contracts';
import { makeRegisterInputFixture } from '@shf/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createAuthTestEnvironment,
  type AuthTestEnvironment,
} from './helpers/create-auth-test-environment';

let authEnvironment: AuthTestEnvironment | null = null;

function extractSessionCookie(setCookieHeader: string): string {
  return setCookieHeader.split(';', 1)[0] ?? '';
}

async function registerAndAuthenticate(
  environment: AuthTestEnvironment,
  email: string,
  name: string,
): Promise<{ cookie: string; session: SessionPayload }> {
  const response = await environment.app.inject({
    method: 'POST',
    payload: makeRegisterInputFixture({ email, name }),
    url: '/api/v1/auth/register',
  });

  expect(response.statusCode).toBe(201);

  return {
    cookie: extractSessionCookie(response.headers['set-cookie'] as string),
    session: (response.json() as { session: SessionPayload }).session,
  };
}

async function createAccount(
  environment: AuthTestEnvironment,
  cookie: string,
  name = 'Conta principal',
) {
  const response = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/accounts',
    headers: {
      cookie,
    },
    payload: {
      name,
      openingBalanceInCents: 300000,
      type: 'checking',
    },
  });

  expect(response.statusCode).toBe(201);

  return (response.json() as { account: { id: string } }).account.id;
}

async function createCreditCard(
  environment: AuthTestEnvironment,
  cookie: string,
  paymentAccountId: string,
) {
  const response = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/credit-cards',
    headers: {
      cookie,
    },
    payload: {
      name: 'Visa Parcelado',
      creditLimitInCents: 400000,
      statementClosingDay: 25,
      dueDay: 8,
      paymentAccountId,
    },
  });

  expect(response.statusCode).toBe(201);

  return (response.json() as { creditCard: CreditCardListItem }).creditCard;
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('installment routes', () => {
  it('executa o fluxo HTTP de parcelamentos em conta e recalcula o horizonte com antecipacao parcial', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'parcelas.conta@example.com',
      'Parcelas Conta',
    );
    const accountId = await createAccount(
      authEnvironment!,
      authenticatedUser.cookie,
      'Conta operacional',
    );

    const createPlanResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/installments',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        sourceType: 'account',
        accountId,
        description: 'Notebook parcelado',
        totalAmountInCents: 120000,
        installmentCount: 4,
        firstOccurrenceDate: '2026-05-10',
      },
    });

    expect(createPlanResponse.statusCode).toBe(201);

    const createdPlan = (createPlanResponse.json() as {
      plan: InstallmentPlanListItem;
    }).plan;

    const updatePlanResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/installments/${createdPlan.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        sourceType: 'account',
        accountId,
        description: 'Notebook parcelado ajustado',
        totalAmountInCents: 120000,
        installmentCount: 4,
        firstOccurrenceDate: '2026-05-10',
      },
    });

    expect(updatePlanResponse.statusCode).toBe(200);

    const createOperationResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/installment-operations',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        planId: createdPlan.id,
        operationDate: '2026-06-05',
        affectedInstallmentCount: 2,
      },
    });

    expect(createOperationResponse.statusCode).toBe(201);

    const createdOperation = (createOperationResponse.json() as {
      operation: InstallmentOperation;
    }).operation;

    expect(createdOperation).toMatchObject({
      affectedAmountInCents: 60000,
      affectedInstallmentCount: 2,
      operationDate: '2026-06-05',
      planId: createdPlan.id,
      type: 'anticipation',
    });

    const updateOperationResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/installment-operations/${createdOperation.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        planId: createdPlan.id,
        operationDate: '2026-05-05',
        affectedInstallmentCount: 3,
      },
    });

    expect(updateOperationResponse.statusCode).toBe(200);

    const updatedOperation = (updateOperationResponse.json() as {
      operation: InstallmentOperation;
    }).operation;

    expect(updatedOperation).toMatchObject({
      affectedAmountInCents: 90000,
      affectedInstallmentCount: 3,
      operationDate: '2026-05-05',
      planId: createdPlan.id,
      type: 'anticipation',
    });

    const installmentsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/installments',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(installmentsResponse.statusCode).toBe(200);

    const installmentsSnapshot = installmentsSnapshotSchema.parse(
      (installmentsResponse.json() as { snapshot: InstallmentsSnapshot }).snapshot,
    );

    expect(installmentsSnapshot.plans).toHaveLength(1);
    expect(installmentsSnapshot.plans[0]).toMatchObject({
      description: 'Notebook parcelado ajustado',
      sourceType: 'account',
      totalAmountInCents: 120000,
    });
    expect(installmentsSnapshot.operations).toEqual([
      expect.objectContaining({
        affectedAmountInCents: 90000,
        affectedInstallmentCount: 3,
        id: createdOperation.id,
        operationDate: '2026-05-05',
      }),
    ]);
    expect(
      installmentsSnapshot.projectedAccountOccurrences.map((occurrence) => ({
        amountInCents: occurrence.amountInCents,
        installmentNumber: occurrence.installmentNumber,
        occurrenceDate: occurrence.occurrenceDate,
      })),
    ).toEqual([
      {
        amountInCents: 30000,
        installmentNumber: 1,
        occurrenceDate: '2026-05-05',
      },
      {
        amountInCents: 30000,
        installmentNumber: 2,
        occurrenceDate: '2026-05-05',
      },
      {
        amountInCents: 30000,
        installmentNumber: 3,
        occurrenceDate: '2026-05-05',
      },
      {
        amountInCents: 30000,
        installmentNumber: 4,
        occurrenceDate: '2026-08-10',
      },
    ]);
    expect(installmentsSnapshot.totalRemainingAmountInCents).toBe(120000);

    const horizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(horizonResponse.statusCode).toBe(200);

    const horizonSnapshot = horizonSnapshotSchema.parse(
      (horizonResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(horizonSnapshot.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual([
      90000,
      0,
      0,
      30000,
    ]);

    const auditResult = await authEnvironment!.database.query<{ action: string }>(
      `select action
         from audit.financial_events
        where user_id = $1
        order by occurred_at asc`,
      [authenticatedUser.session.user.id],
    );

    expect(auditResult.rows.map((row) => row.action)).toEqual([
      'ACCOUNT_CREATED',
      'INSTALLMENT_PLAN_CREATED',
      'INSTALLMENT_PLAN_UPDATED',
      'INSTALLMENT_ANTICIPATED',
      'INSTALLMENT_ANTICIPATION_UPDATED',
    ]);
  });

  it('integra parcelamento vinculado a cartao ao modulo de faturas e bloqueia acesso cruzado', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.parcelado@example.com',
      'Alice Parcelada',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.parcelado@example.com',
      'Bob Parcelado',
    );
    const aliceAccountId = await createAccount(
      authEnvironment!,
      alice.cookie,
      'Conta pagadora Alice',
    );
    const aliceCard = await createCreditCard(
      authEnvironment!,
      alice.cookie,
      aliceAccountId,
    );

    const crossUserPlanResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/installments',
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        sourceType: 'creditCard',
        creditCardId: aliceCard.id,
        description: 'Tentativa indevida',
        totalAmountInCents: 90000,
        installmentCount: 3,
        firstOccurrenceDate: '2026-05-20',
      },
    });

    expect(crossUserPlanResponse.statusCode).toBe(404);
    expect(crossUserPlanResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_CREDIT_CARD_NOT_FOUND',
      },
    });

    const createPlanResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/installments',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        sourceType: 'creditCard',
        creditCardId: aliceCard.id,
        description: 'Curso parcelado',
        totalAmountInCents: 90000,
        installmentCount: 3,
        firstOccurrenceDate: '2026-05-20',
      },
    });

    expect(createPlanResponse.statusCode).toBe(201);

    const createdPlan = (createPlanResponse.json() as {
      plan: InstallmentPlanListItem;
    }).plan;

    const createOperationResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/installment-operations',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        planId: createdPlan.id,
        operationDate: '2026-05-01',
        affectedInstallmentCount: 2,
      },
    });

    expect(createOperationResponse.statusCode).toBe(201);

    const createdOperation = (createOperationResponse.json() as {
      operation: InstallmentOperation;
    }).operation;

    expect(createdOperation).toMatchObject({
      affectedAmountInCents: 60000,
      affectedInstallmentCount: 2,
      operationDate: '2026-05-01',
      planId: createdPlan.id,
    });

    const installmentsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/installments',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(installmentsResponse.statusCode).toBe(200);

    const installmentsSnapshot = installmentsSnapshotSchema.parse(
      (installmentsResponse.json() as { snapshot: InstallmentsSnapshot }).snapshot,
    );

    expect(
      installmentsSnapshot.projectedCreditCardPurchases.map((purchase) => ({
        amountInCents: purchase.amountInCents,
        installmentNumber: purchase.installmentNumber,
        purchaseDate: purchase.purchaseDate,
      })),
    ).toEqual([
      {
        amountInCents: 30000,
        installmentNumber: 1,
        purchaseDate: '2026-05-01',
      },
      {
        amountInCents: 30000,
        installmentNumber: 2,
        purchaseDate: '2026-05-01',
      },
      {
        amountInCents: 30000,
        installmentNumber: 3,
        purchaseDate: '2026-07-20',
      },
    ]);

    const creditCardsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/credit-cards',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(creditCardsResponse.statusCode).toBe(200);

    const creditCardsSnapshot = creditCardsSnapshotSchema.parse(
      (creditCardsResponse.json() as { snapshot: CreditCardsSnapshot }).snapshot,
    );

    expect(
      creditCardsSnapshot.purchases.map((purchase) => ({
        amountInCents: purchase.amountInCents,
        dueDate: purchase.dueDate,
        invoiceMonth: purchase.invoiceMonth,
        isProjected: purchase.isProjected,
      })),
    ).toEqual([
      {
        amountInCents: 30000,
        dueDate: '2026-08-08',
        invoiceMonth: '2026-08',
        isProjected: true,
      },
      {
        amountInCents: 30000,
        dueDate: '2026-06-08',
        invoiceMonth: '2026-06',
        isProjected: true,
      },
      {
        amountInCents: 30000,
        dueDate: '2026-06-08',
        invoiceMonth: '2026-06',
        isProjected: true,
      },
    ]);
    expect(creditCardsSnapshot.invoices).toEqual([
      expect.objectContaining({
        dueDate: '2026-06-08',
        invoiceMonth: '2026-06',
        purchaseCount: 2,
        totalAmountInCents: 60000,
      }),
      expect.objectContaining({
        dueDate: '2026-08-08',
        invoiceMonth: '2026-08',
        purchaseCount: 1,
        totalAmountInCents: 30000,
      }),
    ]);
    expect(
      creditCardsSnapshot.projectedInvoices.map((invoice) => invoice.occurrenceDate),
    ).toEqual(['2026-06-08', '2026-08-08']);

    const horizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(horizonResponse.statusCode).toBe(200);

    const horizonSnapshot = horizonSnapshotSchema.parse(
      (horizonResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(horizonSnapshot.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual([
      0,
      60000,
      0,
      30000,
    ]);

    const auditResult = await authEnvironment!.database.query<{ action: string }>(
      `select action
         from audit.financial_events
        where user_id = $1
        order by occurred_at asc`,
      [alice.session.user.id],
    );

    expect(auditResult.rows.map((row) => row.action)).toEqual([
      'ACCOUNT_CREATED',
      'CREDIT_CARD_CREATED',
      'INSTALLMENT_PLAN_CREATED',
      'INSTALLMENT_ANTICIPATED',
    ]);
  });
});