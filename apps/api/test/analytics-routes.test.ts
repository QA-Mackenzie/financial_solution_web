import type {
  CreditCardListItem,
  FinancialAnalyticsSnapshot,
  FinancialRecordQuerySnapshot,
  SessionPayload,
  TagListItem,
  TagsSnapshot,
} from '@economy-cash/contracts';
import {
  financialAnalyticsSnapshotSchema,
  financialRecordQuerySnapshotSchema,
  tagsSnapshotSchema,
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
  name = 'Conta analytics',
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

async function createTag(
  environment: AuthTestEnvironment,
  cookie: string,
  name: string,
) {
  const response = await environment.app.inject({
    method: 'POST',
    url: '/api/v1/tags',
    headers: {
      cookie,
    },
    payload: {
      name,
    },
  });

  expect(response.statusCode).toBe(201);

  return (response.json() as { tag: TagListItem }).tag;
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('analytics routes', () => {
  it('gerencia tags e entrega consulta filtrada com analytics combinando conta e cartao', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.analytics@example.com',
      'Alice Analytics',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.analytics@example.com',
      'Bob Analytics',
    );
    const accountId = await createAccount(
      authEnvironment!,
      alice.cookie,
      'Conta leitura Alice',
    );
    const mercadoTag = await createTag(authEnvironment!, alice.cookie, 'Mercado');
    const familiaTag = await createTag(authEnvironment!, alice.cookie, 'Familia');
    const livreTag = await createTag(authEnvironment!, alice.cookie, 'Livre');

    const crossUserUpdateResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/tags/${mercadoTag.id}`,
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        name: 'Tentativa indevida',
      },
    });

    expect(crossUserUpdateResponse.statusCode).toBe(404);
    expect(crossUserUpdateResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_TAG_NOT_FOUND',
      },
    });

    const renamedTagResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/tags/${livreTag.id}`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        name: 'Reserva livre',
      },
    });

    expect(renamedTagResponse.statusCode).toBe(200);

    const createTransactionResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/transactions',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId,
        amountInCents: 12000,
        category: 'Alimentacao',
        description: 'Supermercado do mes',
        tagIds: [mercadoTag.id],
        transactionDate: '2026-05-10',
        type: 'expense',
      },
    });

    expect(createTransactionResponse.statusCode).toBe(201);

    const createCreditCardResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-cards',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        name: 'Cartao familia',
        creditLimitInCents: 200000,
        dueDay: 10,
        paymentAccountId: accountId,
        statementClosingDay: 28,
      },
    });

    expect(createCreditCardResponse.statusCode).toBe(201);

    const creditCard = (createCreditCardResponse.json() as {
      creditCard: CreditCardListItem;
    }).creditCard;

    const createPurchaseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-card-purchases',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        amountInCents: 15000,
        category: 'Lazer',
        creditCardId: creditCard.id,
        description: 'Cinema com familia',
        purchaseDate: '2026-06-03',
        tagIds: [familiaTag.id],
      },
    });

    expect(createPurchaseResponse.statusCode).toBe(201);

    const tagsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/tags',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(tagsResponse.statusCode).toBe(200);

    const tagsSnapshot = tagsSnapshotSchema.parse(
      (tagsResponse.json() as { snapshot: TagsSnapshot }).snapshot,
    );

    expect(tagsSnapshot.tags).toEqual([
      expect.objectContaining({ name: 'Familia', usageCount: 1 }),
      expect.objectContaining({ name: 'Mercado', usageCount: 1 }),
      expect.objectContaining({ name: 'Reserva livre', usageCount: 0 }),
    ]);

    const recordsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: `/api/v1/records?accountId=${accountId}&fromDate=2026-05-01&toDate=2026-06-30&type=expense`,
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(recordsResponse.statusCode).toBe(200);

    const recordsSnapshot = financialRecordQuerySnapshotSchema.parse(
      (recordsResponse.json() as { snapshot: FinancialRecordQuerySnapshot })
        .snapshot,
    );

    expect(recordsSnapshot.recordCount).toBe(2);
    expect(recordsSnapshot.totalIncomeInCents).toBe(0);
    expect(recordsSnapshot.totalExpenseInCents).toBe(27000);
    expect(recordsSnapshot.records).toEqual([
      expect.objectContaining({
        description: 'Cinema com familia',
        entityKind: 'creditCard',
        recordKind: 'creditCardPurchase',
        tags: [{ id: familiaTag.id, name: 'Familia' }],
      }),
      expect.objectContaining({
        description: 'Supermercado do mes',
        entityKind: 'account',
        recordKind: 'manualTransaction',
        tags: [{ id: mercadoTag.id, name: 'Mercado' }],
      }),
    ]);

    const filteredByTagResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: `/api/v1/records?tagId=${mercadoTag.id}`,
      headers: {
        cookie: alice.cookie,
      },
    });

    const filteredByTagSnapshot = financialRecordQuerySnapshotSchema.parse(
      (filteredByTagResponse.json() as { snapshot: FinancialRecordQuerySnapshot })
        .snapshot,
    );

    expect(filteredByTagSnapshot.records).toHaveLength(1);
    expect(filteredByTagSnapshot.records[0]).toMatchObject({
      description: 'Supermercado do mes',
    });

    const analyticsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/analytics?fromDate=2026-05-01&toDate=2026-06-30&type=expense',
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(analyticsResponse.statusCode).toBe(200);

    const analyticsSnapshot = financialAnalyticsSnapshotSchema.parse(
      (analyticsResponse.json() as { snapshot: FinancialAnalyticsSnapshot })
        .snapshot,
    );

    expect(analyticsSnapshot.recordCount).toBe(2);
    expect(analyticsSnapshot.totalExpenseInCents).toBe(27000);
    expect(analyticsSnapshot.totalIncomeInCents).toBe(0);
    expect(analyticsSnapshot.byCategory).toEqual([
      {
        category: 'Lazer',
        count: 1,
        expenseInCents: 15000,
        incomeInCents: 0,
        netAmountInCents: -15000,
      },
      {
        category: 'Alimentacao',
        count: 1,
        expenseInCents: 12000,
        incomeInCents: 0,
        netAmountInCents: -12000,
      },
    ]);
    expect(analyticsSnapshot.byEntity).toEqual([
      {
        count: 1,
        entityId: creditCard.id,
        entityKind: 'creditCard',
        entityName: 'Cartao familia',
        expenseInCents: 15000,
        incomeInCents: 0,
        netAmountInCents: -15000,
      },
      {
        count: 1,
        entityId: accountId,
        entityKind: 'account',
        entityName: 'Conta leitura Alice',
        expenseInCents: 12000,
        incomeInCents: 0,
        netAmountInCents: -12000,
      },
    ]);
    expect(analyticsSnapshot.byTag).toEqual([
      {
        count: 1,
        expenseInCents: 15000,
        incomeInCents: 0,
        netAmountInCents: -15000,
        tagId: familiaTag.id,
        tagName: 'Familia',
      },
      {
        count: 1,
        expenseInCents: 12000,
        incomeInCents: 0,
        netAmountInCents: -12000,
        tagId: mercadoTag.id,
        tagName: 'Mercado',
      },
    ]);

    const deleteInUseTagResponse = await authEnvironment!.app.inject({
      method: 'DELETE',
      url: `/api/v1/tags/${mercadoTag.id}`,
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(deleteInUseTagResponse.statusCode).toBe(409);
    expect(deleteInUseTagResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_TAG_IN_USE',
      },
    });

    const deleteUnusedTagResponse = await authEnvironment!.app.inject({
      method: 'DELETE',
      url: `/api/v1/tags/${livreTag.id}`,
      headers: {
        cookie: alice.cookie,
      },
    });

    expect(deleteUnusedTagResponse.statusCode).toBe(200);
    expect(deleteUnusedTagResponse.json()).toMatchObject({
      tag: {
        id: livreTag.id,
        name: 'Reserva livre',
      },
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
      'TAG_CREATED',
      'TAG_CREATED',
      'TAG_CREATED',
      'TAG_UPDATED',
      'TRANSACTION_CREATED',
      'CREDIT_CARD_CREATED',
      'CREDIT_CARD_PURCHASE_CREATED',
      'TAG_DELETED',
    ]);
  });
});