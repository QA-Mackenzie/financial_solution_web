import type {
  CreditCardListItem,
  CreditCardPurchaseListItem,
  CreditCardsSnapshot,
  HorizonSnapshot,
  SessionPayload,
} from '@shf/contracts';
import {
  creditCardsSnapshotSchema,
  horizonSnapshotSchema,
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

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('credit card routes', () => {
  it('executa o fluxo HTTP de cartoes e projeta faturas apenas no vencimento', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'cartoes.fluxo@example.com',
      'Cartoes Fluxo',
    );
    const accountId = await createAccount(
      authEnvironment!,
      authenticatedUser.cookie,
      'Conta pagadora',
    );

    const createCreditCardResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-cards',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        name: 'Visa Platinum',
        creditLimitInCents: 300000,
        statementClosingDay: 25,
        dueDay: 8,
        paymentAccountId: accountId,
      },
    });

    expect(createCreditCardResponse.statusCode).toBe(201);

    const createdCreditCard = (createCreditCardResponse.json() as {
      creditCard: CreditCardListItem;
    }).creditCard;

    expect(createdCreditCard.currentInvoice.totalAmountInCents).toBe(0);
    expect(createdCreditCard.paymentAccountName).toBe('Conta pagadora');

    const updateCreditCardResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/credit-cards/${createdCreditCard.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        name: 'Visa Platinum Black',
        creditLimitInCents: 450000,
        statementClosingDay: 25,
        dueDay: 8,
        paymentAccountId: accountId,
      },
    });

    expect(updateCreditCardResponse.statusCode).toBe(200);

    const createFirstPurchaseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-card-purchases',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        creditCardId: createdCreditCard.id,
        description: 'Notebook trabalho',
        category: 'Tecnologia',
        amountInCents: 50000,
        purchaseDate: '2026-05-20',
      },
    });

    expect(createFirstPurchaseResponse.statusCode).toBe(201);

    const firstPurchase = (createFirstPurchaseResponse.json() as {
      purchase: CreditCardPurchaseListItem;
    }).purchase;

    expect(firstPurchase.invoiceMonth).toBe('2026-06');
    expect(firstPurchase.dueDate).toBe('2026-06-08');

    const updateFirstPurchaseResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/credit-card-purchases/${firstPurchase.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        creditCardId: createdCreditCard.id,
        description: 'Notebook trabalho ajustado',
        category: 'Tecnologia',
        amountInCents: 60000,
        purchaseDate: '2026-05-20',
      },
    });

    expect(updateFirstPurchaseResponse.statusCode).toBe(200);

    const createSecondPurchaseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-card-purchases',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        creditCardId: createdCreditCard.id,
        description: 'Passagem',
        category: 'Viagem',
        amountInCents: 25000,
        purchaseDate: '2026-05-26',
      },
    });

    expect(createSecondPurchaseResponse.statusCode).toBe(201);

    const secondPurchase = (createSecondPurchaseResponse.json() as {
      purchase: CreditCardPurchaseListItem;
    }).purchase;

    expect(secondPurchase.invoiceMonth).toBe('2026-07');
    expect(secondPurchase.dueDate).toBe('2026-07-08');

    const creditCardsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/credit-cards',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(creditCardsResponse.statusCode).toBe(200);

    const creditCardsSnapshot = creditCardsSnapshotSchema.parse(
      (creditCardsResponse.json() as { snapshot: CreditCardsSnapshot }).snapshot,
    );

    expect(creditCardsSnapshot.cards).toHaveLength(1);
    expect(creditCardsSnapshot.cards[0]).toMatchObject({
      creditLimitInCents: 450000,
      name: 'Visa Platinum Black',
      paymentAccountName: 'Conta pagadora',
    });
    expect(creditCardsSnapshot.purchases).toHaveLength(2);
    expect(creditCardsSnapshot.invoices).toEqual([
      expect.objectContaining({
        dueDate: '2026-06-08',
        invoiceMonth: '2026-06',
        totalAmountInCents: 60000,
      }),
      expect.objectContaining({
        dueDate: '2026-07-08',
        invoiceMonth: '2026-07',
        totalAmountInCents: 25000,
      }),
    ]);
    expect(
      creditCardsSnapshot.projectedInvoices.map((invoice) => invoice.occurrenceDate),
    ).toEqual(['2026-06-08', '2026-07-08']);

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

    expect(horizonSnapshot.horizon.months.slice(0, 3).map((month) => month.expenseInCents)).toEqual([
      0,
      60000,
      25000,
    ]);
  });

  it('bloqueia acesso cruzado e registra auditoria de cartoes e compras', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.cartoes@example.com',
      'Alice Cartoes',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.cartoes@example.com',
      'Bob Cartoes',
    );
    const aliceAccountId = await createAccount(
      authEnvironment!,
      alice.cookie,
      'Conta Alice',
    );

    const createCreditCardResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-cards',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        name: 'Mastercard Alice',
        creditLimitInCents: 200000,
        statementClosingDay: 18,
        dueDay: 28,
        paymentAccountId: aliceAccountId,
      },
    });

    expect(createCreditCardResponse.statusCode).toBe(201);

    const aliceCard = (createCreditCardResponse.json() as {
      creditCard: CreditCardListItem;
    }).creditCard;

    const crossUserPurchaseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-card-purchases',
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        creditCardId: aliceCard.id,
        description: 'Tentativa indevida',
        amountInCents: 1000,
        purchaseDate: '2026-05-10',
      },
    });

    expect(crossUserPurchaseResponse.statusCode).toBe(404);
    expect(crossUserPurchaseResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_CREDIT_CARD_NOT_FOUND',
      },
    });

    const updateCreditCardResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/credit-cards/${aliceCard.id}`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        name: 'Mastercard Alice Black',
        creditLimitInCents: 250000,
        statementClosingDay: 18,
        dueDay: 28,
        paymentAccountId: aliceAccountId,
      },
    });

    expect(updateCreditCardResponse.statusCode).toBe(200);

    const createPurchaseResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/credit-card-purchases',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        creditCardId: aliceCard.id,
        description: 'Mercado',
        amountInCents: 8000,
        purchaseDate: '2026-05-10',
      },
    });

    expect(createPurchaseResponse.statusCode).toBe(201);

    const createdPurchase = (createPurchaseResponse.json() as {
      purchase: CreditCardPurchaseListItem;
    }).purchase;

    const updatePurchaseResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/credit-card-purchases/${createdPurchase.id}`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        creditCardId: aliceCard.id,
        description: 'Mercado ajustado',
        amountInCents: 9000,
        purchaseDate: '2026-05-10',
      },
    });

    expect(updatePurchaseResponse.statusCode).toBe(200);

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
      'CREDIT_CARD_UPDATED',
      'CREDIT_CARD_PURCHASE_CREATED',
      'CREDIT_CARD_PURCHASE_UPDATED',
    ]);
  });
});
