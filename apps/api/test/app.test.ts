import {
  makeLoginInputFixture,
  makeRegisterInputFixture,
} from '@shf/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import type { DatabaseClient, DatabaseExecutor } from '../src/lib/database';

import {
  createAuthTestEnvironment,
  type AuthTestEnvironment,
} from './helpers/create-auth-test-environment';

let authEnvironment: AuthTestEnvironment | null = null;

function makeDatabaseStub(): DatabaseClient {
  return {
    async checkHealth() {
      return {
        database: 'shf_web',
        latencyMs: 4,
        seededUsers: 1,
        status: 'up',
      };
    },
    async close() {
      return;
    },
    async query() {
      throw new Error('Nao esperado neste teste.');
    },
    async runInTransaction<T>(
      callback: (database: DatabaseExecutor) => Promise<T>,
    ): Promise<T> {
      return callback({
        query: async () => {
          throw new Error('Nao esperado neste teste.');
        },
      });
    },
  };
}

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('api bootstrap', () => {
  it('retorna health check', async () => {
    const app = buildApp({ database: makeDatabaseStub() });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-correlation-id': 'health-check-001',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      checks: {
        database: {
          database: 'shf_web',
          seededUsers: 1,
          status: 'up',
        },
      },
      service: 'shf-web-api',
      status: 'ok',
    });
    expect(response.headers['x-correlation-id']).toBe('health-check-001');
  });

  it('cria sessao apos cadastro e expoe a sessao atual', async () => {
    const registerResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    expect(registerResponse.statusCode).toBe(201);

    const sessionResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: {
        cookie: registerResponse.headers['set-cookie'] as string,
      },
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toMatchObject({
      session: {
        user: {
          email: 'alexandre@example.com',
        },
      },
    });
  });

  it('autentica um usuario previamente cadastrado', async () => {
    await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    const loginResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: makeLoginInputFixture(),
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toMatchObject({
      session: {
        user: {
          name: 'Alexandre Demo',
        },
      },
    });
  });

  it('serializa erros com code e correlation id', async () => {
    const response = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'x-correlation-id': 'auth-error-123',
      },
      payload: makeLoginInputFixture({
        email: 'naoexiste@example.com',
      }),
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['x-correlation-id']).toBe('auth-error-123');
    expect(response.json()).toMatchObject({
      error: {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Credenciais invalidas.',
        requestId: 'auth-error-123',
      },
    });
  });

  it('expira a sessao e retorna null no bootstrap autenticado', async () => {
    const registerResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    authEnvironment!.advanceTime(169 * 60 * 60 * 1000);

    const sessionResponse = await authEnvironment!.app.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: {
        cookie: registerResponse.headers['set-cookie'] as string,
      },
    });

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.json()).toEqual({ session: null });
  });

  it('gera token de reset, redefine a senha e invalida a senha antiga', async () => {
    await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    const recoveryResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-recovery',
      payload: {
        email: 'alexandre@example.com',
      },
    });

    const recoveryPayload = recoveryResponse.json() as {
      previewToken?: string | null;
    };

    expect(recoveryResponse.statusCode).toBe(200);
    expect(recoveryPayload.previewToken).toBeTruthy();

    const resetResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset',
      payload: {
        password: 'nova-senha-123',
        token: recoveryPayload.previewToken,
      },
    });

    expect(resetResponse.statusCode).toBe(204);

    const oldLoginResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: makeLoginInputFixture(),
    });

    expect(oldLoginResponse.statusCode).toBe(401);

    const newLoginResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        email: 'alexandre@example.com',
        password: 'nova-senha-123',
      },
    });

    expect(newLoginResponse.statusCode).toBe(200);
  });
});
