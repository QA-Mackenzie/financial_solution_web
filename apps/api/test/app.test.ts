import {
  makeLoginInputFixture,
  makeRegisterInputFixture,
} from '@economy-cash/test-fixtures';
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
        database: 'economy_cash',
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
  it('retorna health check publico minimizado com headers de seguranca', async () => {
    const app = buildApp({ database: makeDatabaseStub() });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-correlation-id': 'health-check-001',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-correlation-id']).toBe('health-check-001');
  });

  it('retorna readiness detalhado para uso operacional', async () => {
    const app = buildApp({ database: makeDatabaseStub() });

    const response = await app.inject({
      method: 'GET',
      url: '/readyz',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      checks: {
        database: {
          database: 'economy_cash',
          seededUsers: 1,
          status: 'up',
        },
      },
      service: 'economy-cash-api',
      status: 'ok',
    });
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

  it('ignora cookie de sessao invalido no logout e limpa o cookie', async () => {
    const response = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: 'economy_cash_session=valor-invalido',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toContain('economy_cash_session=;');
  });

  it('encerra logout sem cookie e ainda devolve expiracao do cookie', async () => {
    const response = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toContain('economy_cash_session=;');
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
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

  it('bloqueia mutacoes vindas de origem cruzada e audita a tentativa', async () => {
    const response = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        origin: 'https://evil.example.com',
      },
      payload: makeRegisterInputFixture(),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: 'SECURITY_CSRF_REJECTED',
        message: 'Origem invalida para esta operacao.',
      },
    });

    const auditResult = await authEnvironment!.database.query<{ event_type: string }>(
      `select event_type
         from auth.audit_logs
        where event_type = 'SECURITY_CSRF_REJECTED'`,
    );

    expect(auditResult.rowCount).toBe(1);
  });

  it('aplica rate limiting nas rotas de autenticacao mais sensiveis', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await authEnvironment!.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: makeLoginInputFixture({
          email: 'naoexiste@example.com',
        }),
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers['x-rate-limit-limit']).toBe('10');
    }

    const limitedResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: makeLoginInputFixture({
        email: 'naoexiste@example.com',
      }),
    });

    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.headers['retry-after']).toBeTruthy();
    expect(limitedResponse.json()).toMatchObject({
      error: {
        code: 'SECURITY_RATE_LIMIT_REJECTED',
      },
    });
  });

  it('revoga sessoes que ultrapassam o prazo absoluto', async () => {
    const registerResponse = await authEnvironment!.app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: makeRegisterInputFixture(),
    });

    authEnvironment!.advanceTime(721 * 60 * 60 * 1000);

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
});
