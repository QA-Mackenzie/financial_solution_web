import type {
  AccountsSnapshot,
  ManualTransaction,
  SessionPayload,
  TransactionsSnapshot,
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

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('financial routes', () => {
  it('executa o fluxo financeiro ponta a ponta via HTTP', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'fluxo.financeiro@example.com',
      'Fluxo Financeiro',
    );

    const createAccountResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        name: 'Conta Operacional',
        openingBalanceInCents: 100000,
        type: 'checking',
      },
    });

    expect(createAccountResponse.statusCode).toBe(201);

    const createdAccount = createAccountResponse.json() as {
      account: { id: string; name: string };
    };

    const updateAccountResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/accounts/${createdAccount.account.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        name: 'Conta Principal Web',
        openingBalanceInCents: 100000,
        type: 'checking',
      },
    });

    expect(updateAccountResponse.statusCode).toBe(200);

    const createIncomeResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        accountId: createdAccount.account.id,
        amountInCents: 200000,
        category: 'Trabalho',
        description: 'Recebimento salarial',
        transactionDate: '2026-05-05',
        type: 'income',
      },
    });

    expect(createIncomeResponse.statusCode).toBe(201);

    const createExpenseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        accountId: createdAccount.account.id,
        amountInCents: 75000,
        category: 'Casa',
        description: 'Pagamento do aluguel',
        transactionDate: '2026-05-06',
        type: 'expense',
      },
    });

    expect(createExpenseResponse.statusCode).toBe(201);

    const createdExpense = createExpenseResponse.json() as {
      transaction: ManualTransaction;
    };

    const updateExpenseResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/transactions/${createdExpense.transaction.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        accountId: createdAccount.account.id,
        amountInCents: 50000,
        category: 'Casa',
        description: 'Pagamento do aluguel ajustado',
        transactionDate: '2026-05-06',
        type: 'expense',
      },
    });

    expect(updateExpenseResponse.statusCode).toBe(200);

    const transactionsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/transactions',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(transactionsResponse.statusCode).toBe(200);

    const transactionsSnapshot = transactionsResponse.json() as {
      snapshot: TransactionsSnapshot;
    };

    expect(transactionsSnapshot.snapshot.totalIncomeInCents).toBe(200000);
    expect(transactionsSnapshot.snapshot.totalExpenseInCents).toBe(50000);
    expect(transactionsSnapshot.snapshot.transactions).toHaveLength(2);

    const accountsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/accounts',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(accountsResponse.statusCode).toBe(200);

    const accountsSnapshot = accountsResponse.json() as {
      snapshot: AccountsSnapshot;
    };

    expect(accountsSnapshot.snapshot.consolidatedBalanceInCents).toBe(250000);
    expect(accountsSnapshot.snapshot.activeAccounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currentBalanceInCents: 250000,
          id: createdAccount.account.id,
          name: 'Conta Principal Web',
        }),
      ]),
    );
  });

  it('bloqueia acesso cruzado e registra auditoria de alteracoes financeiras', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.rotas@example.com',
      'Alice Rotas',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.rotas@example.com',
      'Bob Rotas',
    );

    const createAccountResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/accounts',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        name: 'Conta da Alice',
        openingBalanceInCents: 50000,
        type: 'cash',
      },
    });

    const createdAccount = createAccountResponse.json() as {
      account: { id: string };
    };

    const crossUserResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        accountId: createdAccount.account.id,
        amountInCents: 1000,
        category: 'Outros',
        description: 'Tentativa indevida',
        transactionDate: '2026-05-06',
        type: 'expense',
      },
    });

    expect(crossUserResponse.statusCode).toBe(404);
    expect(crossUserResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_ACCOUNT_NOT_FOUND',
      },
    });

    const createTransactionResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId: createdAccount.account.id,
        amountInCents: 2500,
        category: 'Alimentacao',
        description: 'Compra semanal',
        transactionDate: '2026-05-06',
        type: 'expense',
      },
    });

    expect(createTransactionResponse.statusCode).toBe(201);

    const createdTransaction = createTransactionResponse.json() as {
      transaction: ManualTransaction;
    };

    const deleteTransactionResponse = await authEnvironment!.app.inject({
      method: 'DELETE',
      url: `/api/v1/transactions/${createdTransaction.transaction.id}`,
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(deleteTransactionResponse.statusCode).toBe(204);

    const archiveAccountResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/accounts/${createdAccount.account.id}/archive`,
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(archiveAccountResponse.statusCode).toBe(200);

    const auditResult = await authEnvironment!.database.query<{
      action: string;
    }>(
      `select action
         from audit.financial_events
        where user_id = $1
        order by occurred_at asc`,
      [alice.session.user.id],
    );

    expect(auditResult.rows.map((row) => row.action)).toEqual([
      'ACCOUNT_CREATED',
      'TRANSACTION_CREATED',
      'TRANSACTION_DELETED',
      'ACCOUNT_ARCHIVED',
    ]);
  });
});