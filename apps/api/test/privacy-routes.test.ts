import { makeRegisterInputFixture } from '@economy-cash/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createAuthTestEnvironment,
  type AuthTestEnvironment,
} from './helpers/create-auth-test-environment';

let authEnvironment: AuthTestEnvironment | null = null;

async function registerAndGetCookie() {
  const response = await authEnvironment!.app.inject({
    method: 'POST',
    payload: makeRegisterInputFixture(),
    url: '/api/v1/auth/register',
  });

  expect(response.statusCode).toBe(201);

  return response.headers['set-cookie'] as string;
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('privacy routes', () => {
  it('cria e lista solicitacoes de privacidade do usuario autenticado', async () => {
    const sessionCookie = await registerAndGetCookie();

    const createResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/privacy/requests',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        justification: 'Quero abrir um atendimento formal para anonimizar meus dados.',
        requestType: 'anonymization',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      request: {
        requestType: 'anonymization',
        status: 'pending',
      },
    });

    const listResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/privacy/requests',
      headers: {
        cookie: sessionCookie,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toMatchObject({
      snapshot: {
        requests: [
          {
            requestType: 'anonymization',
            status: 'pending',
          },
        ],
      },
    });

    const auditResult = await authEnvironment!.database.query<{ event_type: string }>(
      `select event_type
         from auth.audit_logs
        where event_type = 'PRIVACY_REQUEST_CREATED'`,
    );

    expect(auditResult.rowCount).toBe(1);
  });

  it('bloqueia uma segunda solicitacao pendente do mesmo tipo', async () => {
    const sessionCookie = await registerAndGetCookie();

    await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/privacy/requests',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        justification: 'Primeira solicitacao de exclusao para atendimento manual.',
        requestType: 'erasure',
      },
    });

    const duplicateResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/privacy/requests',
      headers: {
        cookie: sessionCookie,
      },
      payload: {
        justification: 'Segunda solicitacao de exclusao para o mesmo fluxo aberto.',
        requestType: 'erasure',
      },
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({
      error: {
        code: 'PRIVACY_REQUEST_ALREADY_OPEN',
      },
    });
  });

  it('exige sessao valida para consultar o fluxo LGPD', async () => {
    const response = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/privacy/requests',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: {
        code: 'AUTH_UNAUTHENTICATED',
      },
    });
  });
});