import type {
  Account,
  AccountsSnapshot,
  CreateAccountInput,
  CreateTransactionInput,
  HorizonSnapshot,
  LoginInput,
  ManualTransaction,
  PasswordResetInput,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  RegisterInput,
  SessionPayload,
  TransactionsSnapshot,
  UpdateAccountInput,
  UpdateHorizonSettingsInput,
  UpdateTransactionInput,
} from '@shf/contracts';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
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
      errorPayload.error?.message ??
        errorPayload.message ??
        'Nao foi possivel concluir a operacao.',
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
  requestPasswordRecovery(
    input: PasswordResetRequestInput,
  ): Promise<PasswordResetRequestResult> {
    return request('/api/v1/auth/password-recovery', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  resetPassword(input: PasswordResetInput): Promise<void> {
    return request('/api/v1/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export const financeApi = {
  async getAccountsSnapshot(): Promise<AccountsSnapshot> {
    const payload = await request<{ snapshot: AccountsSnapshot }>('/api/v1/accounts');
    return payload.snapshot;
  },
  async createAccount(input: CreateAccountInput): Promise<Account> {
    const payload = await request<{ account: Account }>('/api/v1/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return payload.account;
  },
  async updateAccount(input: UpdateAccountInput): Promise<Account> {
    const payload = await request<{ account: Account }>(
      `/api/v1/accounts/${input.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: input.name,
          openingBalanceInCents: input.openingBalanceInCents,
          type: input.type,
        }),
      },
    );

    return payload.account;
  },
  archiveAccount(id: string): Promise<Account> {
    return request<{ account: Account }>(`/api/v1/accounts/${id}/archive`, {
      method: 'POST',
    }).then((payload) => payload.account);
  },
  async getTransactionsSnapshot(): Promise<TransactionsSnapshot> {
    const payload = await request<{ snapshot: TransactionsSnapshot }>(
      '/api/v1/transactions',
    );

    return payload.snapshot;
  },
  async getHorizonSnapshot(): Promise<HorizonSnapshot> {
    const payload = await request<{ snapshot: HorizonSnapshot }>('/api/v1/horizon');

    return payload.snapshot;
  },
  async updateHorizonSettings(
    input: UpdateHorizonSettingsInput,
  ): Promise<UpdateHorizonSettingsInput> {
    const payload = await request<{ settings: UpdateHorizonSettingsInput }>(
      '/api/v1/horizon/settings',
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );

    return payload.settings;
  },
  async createTransaction(input: CreateTransactionInput): Promise<ManualTransaction> {
    const payload = await request<{ transaction: ManualTransaction }>(
      '/api/v1/transactions',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );

    return payload.transaction;
  },
  async updateTransaction(
    input: UpdateTransactionInput,
  ): Promise<ManualTransaction> {
    const payload = await request<{ transaction: ManualTransaction }>(
      `/api/v1/transactions/${input.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          accountId: input.accountId,
          amountInCents: input.amountInCents,
          category: input.category,
          description: input.description,
          tagIds: input.tagIds,
          transactionDate: input.transactionDate,
          type: input.type,
        }),
      },
    );

    return payload.transaction;
  },
  deleteTransaction(id: string): Promise<void> {
    return request(`/api/v1/transactions/${id}`, {
      method: 'DELETE',
    });
  },
};
