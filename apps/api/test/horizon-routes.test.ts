import type {
  HorizonSettings,
  HorizonSnapshot,
  SessionPayload,
} from '@economy-cash/contracts';
import { horizonSettingsSchema, horizonSnapshotSchema } from '@economy-cash/contracts';
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

async function seedBaseFinancialHistory(
  environment: AuthTestEnvironment,
  cookie: string,
) {
  const createAccountResponse = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/accounts',
    headers: {
      cookie,
    },
    payload: {
      name: 'Conta Horizonte',
      openingBalanceInCents: 200000,
      type: 'checking',
    },
  });

  expect(createAccountResponse.statusCode).toBe(201);

  const accountId = (createAccountResponse.json() as { account: { id: string } }).account
    .id;

  const transactions = [
    {
      amountInCents: 40000,
      description: 'Supermercado',
      transactionDate: '2026-01-10',
      type: 'expense',
    },
    {
      amountInCents: 10000,
      description: 'Supermercado',
      transactionDate: '2026-02-10',
      type: 'expense',
    },
    {
      amountInCents: 20000,
      description: 'Supermercado',
      transactionDate: '2026-03-10',
      type: 'expense',
    },
    {
      amountInCents: 30000,
      description: 'Supermercado',
      transactionDate: '2026-04-10',
      type: 'expense',
    },
    {
      amountInCents: 50000,
      description: 'Recebimento de maio',
      transactionDate: '2026-05-05',
      type: 'income',
    },
  ] as const;

  for (const transaction of transactions) {
    const createTransactionResponse = await environment.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie,
      },
      payload: {
        accountId,
        amountInCents: transaction.amountInCents,
        description: transaction.description,
        transactionDate: transaction.transactionDate,
        type: transaction.type,
      },
    });

    expect(createTransactionResponse.statusCode).toBe(201);
  }

  return { accountId };
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('horizon routes', () => {
  it('entrega o horizonte oficial com contrato valido e headers de cache/performance', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'horizon.cache@example.com',
      'Horizonte Cache',
    );

    await seedBaseFinancialHistory(authEnvironment!, authenticatedUser.cookie);

    const firstResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(firstResponse.statusCode).toBe(200);
    expect(firstResponse.headers['x-horizon-cache']).toBe('miss');
    expect(firstResponse.headers['server-timing']).toContain('horizon;dur=');

    const firstSnapshot = horizonSnapshotSchema.parse(
      (firstResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(firstSnapshot.settings).toEqual({
      safetyMarginInCents: 50000,
      variableExpenseWindowInMonths: 3,
    });
    expect(firstSnapshot.horizon.months).toHaveLength(24);
    expect(firstSnapshot.horizon.months[0]).toMatchObject({
      monthStart: '2026-05-01',
      openingBalanceInCents: 100000,
      incomeInCents: 50000,
      expenseInCents: 0,
    });
    expect(firstSnapshot.horizon.months[1]).toMatchObject({
      monthStart: '2026-06-01',
      expenseInCents: 20000,
    });

    const secondResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.headers['x-horizon-cache']).toBe('hit');
    expect(secondResponse.headers['x-horizon-generated-at']).toBe(
      firstResponse.headers['x-horizon-generated-at'],
    );
  });

  it('atualiza horizon settings, invalida o cache e altera a projecao futura', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'horizon.settings@example.com',
      'Horizonte Settings',
    );

    await seedBaseFinancialHistory(authEnvironment!, authenticatedUser.cookie);

    const initialResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    const initialSnapshot = horizonSnapshotSchema.parse(
      (initialResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(initialSnapshot.horizon.months[1]).toMatchObject({
      expenseInCents: 20000,
      riskLevel: 'healthy',
    });

    const updateSettingsResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: '/api/v1/horizon/settings',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        safetyMarginInCents: 140000,
        variableExpenseWindowInMonths: 4,
      },
    });

    expect(updateSettingsResponse.statusCode).toBe(200);

    const updatedSettings = horizonSettingsSchema.parse(
      (updateSettingsResponse.json() as { settings: HorizonSettings }).settings,
    );

    expect(updatedSettings).toEqual({
      safetyMarginInCents: 140000,
      variableExpenseWindowInMonths: 4,
    });

    const updatedResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(updatedResponse.statusCode).toBe(200);
    expect(updatedResponse.headers['x-horizon-cache']).toBe('miss');

    const updatedSnapshot = horizonSnapshotSchema.parse(
      (updatedResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(updatedSnapshot.settings).toEqual(updatedSettings);
    expect(updatedSnapshot.horizon.months[1]).toMatchObject({
      expenseInCents: 25000,
      riskLevel: 'attention',
    });
  });
});