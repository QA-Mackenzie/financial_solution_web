import type { SessionPayload } from '@shf/contracts';
import { makeRegisterInputFixture } from '@shf/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FinancialDataAccess } from '../src/lib/finance-repositories';
import { SessionGuard } from '../src/lib/session-guard';

import {
  createAuthTestEnvironment,
  type AuthTestEnvironment,
} from './helpers/create-auth-test-environment';

let authEnvironment: AuthTestEnvironment | null = null;

type RegisteredUser = {
  session: SessionPayload;
  sessionToken: string;
};

function extractSessionToken(setCookieHeader: string): string {
  const cookieHeader = setCookieHeader.split(';', 1)[0] ?? '';
  const [cookieName, sessionToken] = cookieHeader.split('=', 2);

  if (!cookieName || !sessionToken) {
    throw new Error('Nao foi possivel extrair o token de sessao do cookie.');
  }

  return sessionToken;
}

async function registerUser(
  environment: AuthTestEnvironment,
  overrides: Parameters<typeof makeRegisterInputFixture>[0],
): Promise<RegisteredUser> {
  const response = await environment.app.inject({
    method: 'POST',
    payload: makeRegisterInputFixture(overrides),
    url: '/api/v1/auth/register',
  });

  expect(response.statusCode).toBe(201);

  return {
    session: (response.json() as { session: SessionPayload }).session,
    sessionToken: extractSessionToken(response.headers['set-cookie'] as string),
  };
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('financial repositories', () => {
  it('isola configuracoes e contas por user_id', async () => {
    const repositories = new FinancialDataAccess(authEnvironment!.database);
    const sessionGuard = new SessionGuard(authEnvironment!.authService);
    const alice = await registerUser(authEnvironment!, {
      email: 'alice@example.com',
      name: 'Alice Demo',
    });
    const bob = await registerUser(authEnvironment!, {
      email: 'bob@example.com',
      name: 'Bob Demo',
    });
    const aliceSession = await sessionGuard.requireUserSession(alice.sessionToken);
    const bobSession = await sessionGuard.requireUserSession(bob.sessionToken);

    const aliceSettings = await repositories.userSettings.upsert(aliceSession.userId, {
      currencyCode: 'BRL',
      horizonSettings: {
        safetyMarginInCents: 50000,
        variableExpenseWindowInMonths: 3,
      },
      locale: 'pt-BR',
    });
    const aliceAccount = await repositories.accounts.create(aliceSession.userId, {
      name: 'Conta Principal',
      openingBalanceInCents: 150000,
      type: 'checking',
    });
    const bobAccount = await repositories.accounts.create(bobSession.userId, {
      name: 'Reserva',
      openingBalanceInCents: 250000,
      type: 'savings',
    });

    expect(aliceSettings.userId).toBe(aliceSession.userId);
    expect(await repositories.userSettings.getByUserId(bobSession.userId)).toBeNull();

    const aliceAccounts = await repositories.accounts.listByUserId(aliceSession.userId);
    const bobAccounts = await repositories.accounts.listByUserId(bobSession.userId);

    expect(aliceAccounts).toHaveLength(1);
    expect(aliceAccounts[0]).toMatchObject({
      currentBalanceInCents: 150000,
      id: aliceAccount.id,
      name: 'Conta Principal',
    });
    expect(bobAccounts).toHaveLength(1);
    expect(bobAccounts[0]).toMatchObject({
      currentBalanceInCents: 250000,
      id: bobAccount.id,
      name: 'Reserva',
    });
    expect(
      await repositories.accounts.findById(bobSession.userId, aliceAccount.id),
    ).toBeNull();
  });

  it('bloqueia lancamentos cruzados e nao vaza transacoes entre usuarios', async () => {
    const repositories = new FinancialDataAccess(authEnvironment!.database);
    const sessionGuard = new SessionGuard(authEnvironment!.authService);
    const alice = await registerUser(authEnvironment!, {
      email: 'alice.transactions@example.com',
      name: 'Alice Financeira',
    });
    const bob = await registerUser(authEnvironment!, {
      email: 'bob.transactions@example.com',
      name: 'Bob Financeiro',
    });
    const aliceSession = await sessionGuard.requireUserSession(alice.sessionToken);
    const bobSession = await sessionGuard.requireUserSession(bob.sessionToken);
    const aliceAccount = await repositories.accounts.create(aliceSession.userId, {
      name: 'Carteira',
      openingBalanceInCents: 5000,
      type: 'cash',
    });
    const aliceTag = await repositories.tags.create(aliceSession.userId, {
      name: 'Mercado',
    });

    await expect(
      repositories.manualTransactions.create(bobSession.userId, {
        accountId: aliceAccount.id,
        amountInCents: 3000,
        category: 'Alimentacao',
        description: 'Compra indevida',
        tagIds: [aliceTag.id],
        transactionDate: '2026-05-04',
        type: 'expense',
      }),
    ).rejects.toMatchObject({
      code: 'FINANCE_ACCOUNT_NOT_FOUND',
    });

    const aliceTransaction = await repositories.manualTransactions.create(
      aliceSession.userId,
      {
        accountId: aliceAccount.id,
        amountInCents: 3000,
        category: 'Alimentacao',
        description: 'Supermercado semanal',
        tagIds: [aliceTag.id, aliceTag.id],
        transactionDate: '2026-05-04',
        type: 'expense',
      },
    );

    const aliceTransactions = await repositories.manualTransactions.listByUserId(
      aliceSession.userId,
    );

    expect(aliceTransaction.tagIds).toEqual([aliceTag.id]);
    expect(aliceTransactions).toHaveLength(1);
    expect(aliceTransactions[0]).toMatchObject({
      accountId: aliceAccount.id,
      accountName: 'Carteira',
      id: aliceTransaction.id,
      signedAmountInCents: -3000,
      tagIds: [aliceTag.id],
    });
    expect(
      await repositories.manualTransactions.findById(
        bobSession.userId,
        aliceTransaction.id,
      ),
    ).toBeNull();
  });

  it('mantem tags e staging de importacao isolados por usuario', async () => {
    const repositories = new FinancialDataAccess(authEnvironment!.database);
    const sessionGuard = new SessionGuard(authEnvironment!.authService);
    const alice = await registerUser(authEnvironment!, {
      email: 'alice.import@example.com',
      name: 'Alice Importadora',
    });
    const bob = await registerUser(authEnvironment!, {
      email: 'bob.import@example.com',
      name: 'Bob Importador',
    });
    const aliceSession = await sessionGuard.requireUserSession(alice.sessionToken);
    const bobSession = await sessionGuard.requireUserSession(bob.sessionToken);

    await repositories.tags.create(aliceSession.userId, {
      name: 'Mercado',
    });
    await repositories.tags.create(bobSession.userId, {
      name: 'Mercado',
    });

    const aliceBatch = await repositories.legacyImport.createBatch(
      aliceSession.userId,
      {
        sourceChecksum: 'sqlite-demo-checksum',
        sourcePath: 'C:/temp/shf-desktop.sqlite',
        summary: {
          detectedTables: ['accounts', 'transactions'],
        },
      },
    );

    const stagedRows = await repositories.legacyImport.stageRows(
      aliceSession.userId,
      aliceBatch.id,
      [
        {
          payload: {
            balance: 120000,
            id: 'legacy-account-1',
            name: 'Conta legado',
          },
          sourceRowId: '1',
          sourceTable: 'accounts',
        },
      ],
    );

    const aliceTags = await repositories.tags.listByUserId(aliceSession.userId);
    const bobTags = await repositories.tags.listByUserId(bobSession.userId);

    expect(aliceTags).toHaveLength(1);
    expect(bobTags).toHaveLength(1);
    expect(aliceTags[0].name).toBe('Mercado');
    expect(bobTags[0].name).toBe('Mercado');
    expect(stagedRows).toHaveLength(1);
    expect(stagedRows[0]).toMatchObject({
      batchId: aliceBatch.id,
      payload: {
        balance: 120000,
        id: 'legacy-account-1',
      },
      sourceRowId: '1',
      sourceTable: 'accounts',
    });
    await expect(
      repositories.legacyImport.listRows(bobSession.userId, aliceBatch.id),
    ).rejects.toMatchObject({
      code: 'LEGACY_IMPORT_BATCH_NOT_FOUND',
    });
  });
});