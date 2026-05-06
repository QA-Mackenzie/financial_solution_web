import type {
  Contract,
  ContractAdjustment,
  ContractsSnapshot,
  HorizonSnapshot,
  SessionPayload,
} from '@shf/contracts';
import { contractsSnapshotSchema, horizonSnapshotSchema } from '@shf/contracts';
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
  name = 'Conta Contratos',
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

describe('contract routes', () => {
  it('executa o fluxo HTTP de contratos recorrentes e projeta apenas efeitos futuros no horizonte', async () => {
    const authenticatedUser = await registerAndAuthenticate(
      authEnvironment!,
      'contratos.fluxo@example.com',
      'Contratos Fluxo',
    );
    const accountId = await createAccount(
      authEnvironment!,
      authenticatedUser.cookie,
    );

    const createContractResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/contracts',
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        accountId,
        name: 'Aluguel',
        category: 'Moradia',
        type: 'expense',
        amountInCents: 120000,
        dueDay: 10,
        startDate: '2026-05-01',
        status: 'active',
      },
    });

    expect(createContractResponse.statusCode).toBe(201);

    const createdContract = (createContractResponse.json() as {
      contract: Contract;
    }).contract;

    const updateContractResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/contracts/${createdContract.id}`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        accountId,
        name: 'Aluguel residencial',
        category: 'Moradia',
        type: 'expense',
        amountInCents: 125000,
        dueDay: 10,
        startDate: '2026-05-01',
        status: 'active',
      },
    });

    expect(updateContractResponse.statusCode).toBe(200);

    const contractsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/contracts',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(contractsResponse.statusCode).toBe(200);

    const contractsSnapshot = contractsSnapshotSchema.parse(
      (contractsResponse.json() as { snapshot: ContractsSnapshot }).snapshot,
    );

    expect(contractsSnapshot.activeContracts).toEqual([
      expect.objectContaining({
        accountId,
        accountName: 'Conta Contratos',
        amountInCents: 125000,
        id: createdContract.id,
        name: 'Aluguel residencial',
      }),
    ]);

    const initialHorizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(initialHorizonResponse.statusCode).toBe(200);
    expect(initialHorizonResponse.headers['x-horizon-cache']).toBe('miss');

    const initialHorizon = horizonSnapshotSchema.parse(
      (initialHorizonResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(initialHorizon.horizon.months[0]).toMatchObject({
      expenseInCents: 125000,
      monthStart: '2026-05-01',
    });
    expect(initialHorizon.horizon.months[1]).toMatchObject({
      expenseInCents: 125000,
      monthStart: '2026-06-01',
    });

    const cachedHorizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(cachedHorizonResponse.statusCode).toBe(200);
    expect(cachedHorizonResponse.headers['x-horizon-cache']).toBe('hit');

    const createAdjustmentResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/contracts/${createdContract.id}/adjustments`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        amountInCents: 135000,
        effectiveStartDate: '2026-06-01',
      },
    });

    expect(createAdjustmentResponse.statusCode).toBe(201);

    const createdAdjustment = (createAdjustmentResponse.json() as {
      adjustment: ContractAdjustment;
    }).adjustment;

    expect(createdAdjustment).toMatchObject({
      amountInCents: 135000,
      contractId: createdContract.id,
      effectiveStartDate: '2026-06-01',
    });

    const adjustedContractsResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/contracts',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    const adjustedContractsSnapshot = contractsSnapshotSchema.parse(
      (adjustedContractsResponse.json() as { snapshot: ContractsSnapshot }).snapshot,
    );

    expect(adjustedContractsSnapshot.activeContracts[0]?.adjustments).toEqual([
      expect.objectContaining({
        amountInCents: 135000,
        contractId: createdContract.id,
      }),
    ]);

    const adjustedHorizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(adjustedHorizonResponse.statusCode).toBe(200);
    expect(adjustedHorizonResponse.headers['x-horizon-cache']).toBe('miss');

    const adjustedHorizon = horizonSnapshotSchema.parse(
      (adjustedHorizonResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(adjustedHorizon.horizon.months.slice(0, 3).map((month) => month.expenseInCents)).toEqual(
      [125000, 135000, 135000],
    );

    const endContractResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/contracts/${createdContract.id}/end`,
      headers: {
        cookie: authenticatedUser.cookie,
      },
      payload: {
        endDate: '2026-06-20',
      },
    });

    expect(endContractResponse.statusCode).toBe(200);

    const endedContract = (endContractResponse.json() as {
      contract: Contract;
    }).contract;

    expect(endedContract.endDate).toBe('2026-06-20');

    const endedHorizonResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/horizon',
      headers: {
        cookie: authenticatedUser.cookie,
      },
    });

    expect(endedHorizonResponse.statusCode).toBe(200);
    expect(endedHorizonResponse.headers['x-horizon-cache']).toBe('miss');

    const endedHorizon = horizonSnapshotSchema.parse(
      (endedHorizonResponse.json() as { snapshot: HorizonSnapshot }).snapshot,
    );

    expect(endedHorizon.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual(
      [125000, 135000, 0, 0],
    );
  });

  it('bloqueia acesso cruzado a contratos e registra auditoria das mutacoes', async () => {
    const alice = await registerAndAuthenticate(
      authEnvironment!,
      'alice.contratos@example.com',
      'Alice Contratos',
    );
    const bob = await registerAndAuthenticate(
      authEnvironment!,
      'bob.contratos@example.com',
      'Bob Contratos',
    );

    const aliceAccountId = await createAccount(
      authEnvironment!,
      alice.cookie,
      'Conta Alice',
    );

    const createContractResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/contracts',
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId: aliceAccountId,
        name: 'Plano empresarial',
        category: 'Operacao',
        type: 'expense',
        amountInCents: 45000,
        dueDay: 15,
        startDate: '2026-05-01',
        status: 'active',
      },
    });

    expect(createContractResponse.statusCode).toBe(201);

    const aliceContract = (createContractResponse.json() as {
      contract: Contract;
    }).contract;

    const crossUserResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/contracts/${aliceContract.id}/adjustments`,
      headers: {
        cookie: bob.cookie,
      },
      payload: {
        amountInCents: 47000,
        effectiveStartDate: '2026-06-01',
      },
    });

    expect(crossUserResponse.statusCode).toBe(404);
    expect(crossUserResponse.json()).toMatchObject({
      error: {
        code: 'FINANCE_CONTRACT_NOT_FOUND',
      },
    });

    const updateContractResponse = await authEnvironment!.app.inject({
      method: 'PUT',
      url: `/api/v1/contracts/${aliceContract.id}`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        accountId: aliceAccountId,
        name: 'Plano empresarial anual',
        category: 'Operacao',
        type: 'expense',
        amountInCents: 47000,
        dueDay: 15,
        startDate: '2026-05-01',
        status: 'active',
      },
    });

    expect(updateContractResponse.statusCode).toBe(200);

    const adjustContractResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/contracts/${aliceContract.id}/adjustments`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        amountInCents: 49000,
        effectiveStartDate: '2026-06-01',
      },
    });

    expect(adjustContractResponse.statusCode).toBe(201);

    const endContractResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: `/api/v1/contracts/${aliceContract.id}/end`,
      headers: {
        cookie: alice.cookie,
      },
      payload: {
        endDate: '2026-07-15',
      },
    });

    expect(endContractResponse.statusCode).toBe(200);

    const auditResult = await authEnvironment!.database.query<{ action: string }>(
      `select action
         from audit.financial_events
        where user_id = $1
        order by occurred_at asc`,
      [alice.session.user.id],
    );

    expect(auditResult.rows.map((row) => row.action)).toEqual([
      'ACCOUNT_CREATED',
      'CONTRACT_CREATED',
      'CONTRACT_UPDATED',
      'CONTRACT_ADJUSTED',
      'CONTRACT_ENDED',
    ]);
  });
});