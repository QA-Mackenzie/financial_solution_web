import type {
  HorizonSnapshot,
  ProvisionsPlanningSnapshot,
  ProvisionListItem,
  SessionPayload,
  VariableExpenseSnapshot,
} from '@economy-cash/contracts';
import {
  horizonSnapshotSchema,
  provisionsPlanningSnapshotSchema,
  variableExpenseSnapshotSchema,
} from '@economy-cash/contracts';
import { makeRegisterInputFixture } from '@economy-cash/test-fixtures';
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
  name = 'Conta provisoes',
) {
  const response = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/accounts',
    headers: {
      cookie,
    },
    payload: {
      name,
      openingBalanceInCents: 200000,
      type: 'checking',
    },
  });

  expect(response.statusCode).toBe(201);

  return (response.json() as { account: { id: string } }).account.id;
}

async function createTransaction(
  environment: AuthTestEnvironment,
  cookie: string,
  payload: {
    accountId: string;
    amountInCents: number;
    category: string;
    description: string;
    transactionDate: string;
    type: 'expense' | 'income';
  },
) {
  const response = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/transactions',
    headers: {
      cookie,
    },
    payload,
  });

  expect(response.statusCode).toBe(201);
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('provision routes', () => {
  it('gerencia provisoes e overrides variaveis por usuario com reflexo no horizonte', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.provisoes@example.com',
      'Alice Provisoes',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.provisoes@example.com',
      'Bob Provisoes',
    );
    const accountId = await createAccount(
      authEnvironment!,
      alice.cookie,
      'Conta caixa Alice',
    );

    await createTransaction(authEnvironment!, alice.cookie, {
      accountId,
      amountInCents: 10000,
      category: 'Mercado',
      description: 'Supermercado',
      transactionDate: '2026-02-10',
      type: 'expense',
    });
    await createTransaction(authEnvironment!, alice.cookie, {
      accountId,
      amountInCents: 12000,
      category: 'Mercado',
      description: 'Supermercado',
      transactionDate: '2026-03-10',
      type: 'expense',
    });
    await createTransaction(authEnvironment!, alice.cookie, {
      accountId,
      amountInCents: 14000,
      category: 'Mercado',
      description: 'Supermercado',
      transactionDate: '2026-04-10',
      type: 'expense',
    });

    const crossUserProvisionResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/provisions',
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        accountId,
        description: 'Tentativa indevida',
        category: 'Casa',
        targetAmountInCents: 90000,
        startDate: '2026-05-05',
        targetDate: '2026-08-10',
      },
    });

    expect(crossUserProvisionResponse.statusCode).toBe(404);
    expect(crossUserProvisionResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_ACCOUNT_NOT_FOUND',
      },
    });

    const createProvisionResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/provisions',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId,
        description: 'Seguro anual',
        category: 'Casa',
        targetAmountInCents: 90000,
        startDate: '2026-05-05',
        targetDate: '2026-08-10',
      },
    });

    expect(createProvisionResponse.statusCode).toBe(201);

    const createdProvision = (createProvisionResponse.json() as {
      provision: ProvisionListItem;
    }).provision;

    const updateProvisionResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/provisions/${createdProvision.id}`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId,
        description: 'Seguro anual familiar',
        category: 'Casa',
        targetAmountInCents: 90000,
        startDate: '2026-05-05',
        targetDate: '2026-08-10',
      },
    });

    expect(updateProvisionResponse.statusCode).toBe(200);

    const crossUserOverrideResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: '/api/v1/variable-expense-overrides',
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        accountId,
        description: 'Supermercado',
        occurrenceDate: '2026-06-10',
        amountInCents: 18500,
      },
    });

    expect(crossUserOverrideResponse.statusCode).toBe(404);
    expect(crossUserOverrideResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_ACCOUNT_NOT_FOUND',
      },
    });

    const upsertOverrideResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: '/api/v1/variable-expense-overrides',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId,
        description: 'Supermercado',
        occurrenceDate: '2026-06-10',
        amountInCents: 18500,
      },
    });

    expect(upsertOverrideResponse.statusCode).toBe(200);

    const provisionsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/provisions',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(provisionsResponse.statusCode).toBe(200);

    const provisionsSnapshot = provisionsPlanningSnapshotSchema.parse(
      (provisionsResponse.json() as { snapshot: ProvisionsPlanningSnapshot })
        .snapshot,
    );

    expect(provisionsSnapshot.activeProvisions).toHaveLength(1);
    expect(provisionsSnapshot.activeProvisions[0]).toMatchObject({
      description: 'Seguro anual familiar',
      targetAmountInCents: 90000,
    });
    expect(
      provisionsSnapshot.projectedOccurrences.map((occurrence) => ({
        amountInCents: occurrence.amountInCents,
        kind: occurrence.kind,
        occurrenceDate: occurrence.occurrenceDate,
      })),
    ).toEqual([
      {
        amountInCents: 30000,
        kind: 'allocation',
        occurrenceDate: '2026-05-01',
      },
      {
        amountInCents: 30000,
        kind: 'allocation',
        occurrenceDate: '2026-06-01',
      },
      {
        amountInCents: 30000,
        kind: 'allocation',
        occurrenceDate: '2026-07-01',
      },
      {
        amountInCents: 90000,
        kind: 'release',
        occurrenceDate: '2026-08-01',
      },
    ]);

    const variableExpenseResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/variable-expense-overrides',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(variableExpenseResponse.statusCode).toBe(200);

    const variableExpenseSnapshot = variableExpenseSnapshotSchema.parse(
      (variableExpenseResponse.json() as { snapshot: VariableExpenseSnapshot })
        .snapshot,
    );

    expect(variableExpenseSnapshot.overrides).toHaveLength(1);
    expect(variableExpenseSnapshot.overrides[0]).toMatchObject({
      accountId,
      amountInCents: 18500,
      description: 'Supermercado',
      occurrenceDate: '2026-06-10',
    });
    expect(variableExpenseSnapshot.projectedOccurrences[0]).toMatchObject({
      amountInCents: 18500,
      occurrenceDate: '2026-06-10',
      source: 'manualOverride',
    });
    expect(variableExpenseSnapshot.projectedOccurrences[1]).toMatchObject({
      amountInCents: 12000,
      occurrenceDate: '2026-07-10',
      source: 'movingAverage',
    });

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

    expect(horizonSnapshot.horizon.months[0]).toMatchObject({
      monthStart: '2026-05-01',
      cashClosingBalanceInCents: 164000,
      closingBalanceInCents: 134000,
      provisionAllocationInCents: 30000,
      provisionReservedBalanceInCents: 30000,
    });
    expect(horizonSnapshot.horizon.months[1]).toMatchObject({
      monthStart: '2026-06-01',
      expenseInCents: 18500,
      cashClosingBalanceInCents: 145500,
      closingBalanceInCents: 85500,
      provisionReservedBalanceInCents: 60000,
    });

    const redeemProvisionResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/provisions/${createdProvision.id}/redeem`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        redeemedAt: '2026-07-15',
      },
    });

    expect(redeemProvisionResponse.statusCode).toBe(200);

    const redeemedProvisionsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/provisions',
      headers: {
        cookie: alice.cookie,
      },
    });

    const redeemedSnapshot = provisionsPlanningSnapshotSchema.parse(
      (redeemedProvisionsResponse.json() as {
        snapshot: ProvisionsPlanningSnapshot;
      }).snapshot,
    );

    expect(redeemedSnapshot.activeProvisions).toHaveLength(0);
    expect(redeemedSnapshot.redeemedProvisions).toHaveLength(1);
    expect(redeemedSnapshot.redeemedProvisions[0]).toMatchObject({
      description: 'Seguro anual familiar',
      redeemedAt: '2026-07-15',
    });
    expect(redeemedSnapshot.projectedOccurrences).toEqual([]);

    const deleteOverrideResponse = await authEnvironment!.app.inject({
      method: 'DELETE',
      url: '/api/v1/variable-expense-overrides',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId,
        description: 'Supermercado',
        occurrenceDate: '2026-06-10',
      },
    });

    expect(deleteOverrideResponse.statusCode).toBe(200);

    const variableExpenseWithoutOverrideResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/variable-expense-overrides',
      headers: {
        cookie: alice.cookie,
      },
    });

    const variableExpenseWithoutOverride = variableExpenseSnapshotSchema.parse(
      (variableExpenseWithoutOverrideResponse.json() as {
        snapshot: VariableExpenseSnapshot;
      }).snapshot,
    );

    expect(variableExpenseWithoutOverride.overrides).toEqual([]);
    expect(variableExpenseWithoutOverride.projectedOccurrences[0]).toMatchObject({
      amountInCents: 12000,
      occurrenceDate: '2026-06-10',
      source: 'movingAverage',
    });

    const auditResult = await authEnvironment!.database.query<{ action: string }>(
      `select action
         from audit.financial_events
        where user_id = $1
        order by occurred_at asc`,
      [alice.session.user.id],
    );

    expect(auditResult.rows.map((row) => row.action)).toEqual([
      'ACCOUNT_CREATED',
      'TRANSACTION_CREATED',
      'TRANSACTION_CREATED',
      'TRANSACTION_CREATED',
      'PROVISION_CREATED',
      'PROVISION_UPDATED',
      'VARIABLE_EXPENSE_OVERRIDE_CREATED',
      'PROVISION_REDEEMED',
      'VARIABLE_EXPENSE_OVERRIDE_REMOVED',
    ]);
  });
});