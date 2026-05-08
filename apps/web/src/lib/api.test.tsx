import { afterEach, describe, expect, it, vi } from 'vitest';

import { authApi } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authApi', () => {
  it('nao envia content-type json no logout sem body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, {
        status: 204,
      }),
    );

    await authApi.logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers((requestInit as RequestInit | undefined)?.headers);

    expect((requestInit as RequestInit | undefined)?.method).toBe('POST');
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('mostra erro claro quando o cadastro cria a conta mas a sessao nao persiste', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            expiresAt: '2026-05-15T12:00:00.000Z',
            issuedAt: '2026-05-08T12:00:00.000Z',
            user: {
              id: '92f49d09-7671-4518-bd08-c566ce68636a',
              name: 'Alexandre Demo',
              email: 'alexandre@example.com',
              emailVerifiedAt: null,
            },
          },
        }, 201),
      )
      .mockResolvedValueOnce(jsonResponse({ session: null }));

    await expect(
      authApi.register({
        consentAccepted: true,
        consentVersion: '2026-05',
        email: 'alexandre@example.com',
        name: 'Alexandre Demo',
        password: 'senha-segura-123',
      }),
    ).rejects.toThrow(
      'Conta criada, mas o navegador nao conseguiu manter sua sessao. Permita cookies entre o app e a API e tente entrar novamente.',
    );
  });
});