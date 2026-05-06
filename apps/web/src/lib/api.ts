import type { LoginInput, RegisterInput, SessionPayload } from '@shf/contracts';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type ApiErrorPayload = {
  message?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T | ApiErrorPayload;

  if (!response.ok) {
    const errorPayload = data as ApiErrorPayload;

    throw new Error(
      errorPayload.message ?? 'Nao foi possivel concluir a operacao.',
    );
  }

  return data as T;
}

export const authApi = {
  async getSession(): Promise<SessionPayload | null> {
    const payload = await request<{ session: SessionPayload | null }>('/api/v1/session');
    return payload.session;
  },
  async login(input: LoginInput): Promise<SessionPayload> {
    const payload = await request<{ session: SessionPayload }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return payload.session;
  },
  async register(input: RegisterInput): Promise<SessionPayload> {
    const payload = await request<{ session: SessionPayload }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return payload.session;
  },
  logout(): Promise<void> {
    return request('/api/v1/auth/logout', {
      method: 'POST',
    });
  },
};
