import { makeLoginInputFixture, makeRegisterInputFixture } from '@shf/test-fixtures';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app';
import { authStore } from '../src/lib/auth-store';
import type { DatabaseClient } from '../src/lib/database';

afterEach(() => {
  authStore.reset();
});

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
  };
}

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
    const app = buildApp({ database: makeDatabaseStub() });

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    expect(registerResponse.statusCode).toBe(201);

    const setCookieHeader = registerResponse.headers['set-cookie'];
    expect(setCookieHeader).toBeTruthy();

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/session',
      headers: {
        cookie: Array.isArray(setCookieHeader)
          ? setCookieHeader[0]
          : setCookieHeader,
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
    const app = buildApp({ database: makeDatabaseStub() });

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    const loginResponse = await app.inject({
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
    const app = buildApp({ database: makeDatabaseStub() });

    const response = await app.inject({
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
});
