import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AccountsSnapshot, SessionPayload, TransactionsSnapshot } from '@shf/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

function mockJsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function mockAuthenticatedShellResponses() {
  const session: SessionPayload = {
    user: {
      id: '92f49d09-7671-4518-bd08-c566ce68636a',
      name: 'Alexandre Demo',
      email: 'alexandre@example.com',
      emailVerifiedAt: null,
    },
    expiresAt: '2026-01-08T12:00:00.000Z',
    issuedAt: '2026-01-01T12:00:00.000Z',
  };
  const accountsSnapshot: AccountsSnapshot = {
    activeAccounts: [],
    archivedAccounts: [],
    consolidatedBalanceInCents: 0,
  };
  const transactionsSnapshot: TransactionsSnapshot = {
    totalExpenseInCents: 0,
    totalIncomeInCents: 0,
    transactions: [],
  };

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const urlValue = input instanceof Request ? input.url : String(input);
    const pathname = new URL(urlValue).pathname;

    if (pathname === '/api/v1/session') {
      return mockJsonResponse({ session });
    }

    if (pathname === '/api/v1/accounts') {
      return mockJsonResponse({ snapshot: accountsSnapshot });
    }

    if (pathname === '/api/v1/transactions') {
      return mockJsonResponse({ snapshot: transactionsSnapshot });
    }

    return mockJsonResponse({});
  });
}

function mockInteractiveFinanceFlow() {
  const session: SessionPayload = {
    user: {
      id: '92f49d09-7671-4518-bd08-c566ce68636a',
      name: 'Alexandre Demo',
      email: 'alexandre@example.com',
      emailVerifiedAt: null,
    },
    expiresAt: '2026-01-08T12:00:00.000Z',
    issuedAt: '2026-01-01T12:00:00.000Z',
  };
  const state = {
    accounts: [] as Array<{
      id: string;
      name: string;
      type: 'checking' | 'savings' | 'cash' | 'investment' | 'other';
      openingBalanceInCents: number;
      isArchived: boolean;
      archivedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>,
    transactions: [] as Array<{
      id: string;
      accountId: string;
      type: 'income' | 'expense';
      description: string;
      category?: string;
      amountInCents: number;
      transactionDate: string;
      createdAt: string;
      updatedAt: string;
    }>,
  };

  function buildAccountsSnapshot(): AccountsSnapshot {
    const activeAccounts = state.accounts
      .filter((account) => !account.isArchived)
      .map((account) => {
        const accountBalance = state.transactions
          .filter((transaction) => transaction.accountId === account.id)
          .reduce(
            (sum, transaction) =>
              sum +
              (transaction.type === 'income'
                ? transaction.amountInCents
                : -transaction.amountInCents),
            account.openingBalanceInCents,
          );

        return {
          ...account,
          currentBalanceInCents: accountBalance,
        };
      });

    return {
      activeAccounts,
      archivedAccounts: [],
      consolidatedBalanceInCents: activeAccounts.reduce(
        (sum, account) => sum + account.currentBalanceInCents,
        0,
      ),
    };
  }

  function buildTransactionsSnapshot(): TransactionsSnapshot {
    const transactions = state.transactions
      .slice()
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
      .map((transaction) => ({
        ...transaction,
        accountName:
          state.accounts.find((account) => account.id === transaction.accountId)?.name ??
          '',
        signedAmountInCents:
          transaction.type === 'income'
            ? transaction.amountInCents
            : -transaction.amountInCents,
        tagIds: undefined,
      }));

    return {
      totalExpenseInCents: transactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((sum, transaction) => sum + transaction.amountInCents, 0),
      totalIncomeInCents: transactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((sum, transaction) => sum + transaction.amountInCents, 0),
      transactions,
    };
  }

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const urlValue = input instanceof Request ? input.url : String(input);
    const pathname = new URL(urlValue).pathname;
    const method = (init?.method ?? 'GET').toUpperCase();

    if (pathname === '/api/v1/session') {
      return mockJsonResponse({ session });
    }

    if (pathname === '/api/v1/accounts' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildAccountsSnapshot() });
    }

    if (pathname === '/api/v1/accounts' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        name: string;
        openingBalanceInCents: number;
        type: 'checking' | 'savings' | 'cash' | 'investment' | 'other';
      };
      const account = {
        id: '11111111-1111-4111-8111-111111111111',
        name: payload.name,
        type: payload.type,
        openingBalanceInCents: payload.openingBalanceInCents,
        isArchived: false,
        archivedAt: null,
        createdAt: '2026-05-06T12:00:00.000Z',
        updatedAt: '2026-05-06T12:00:00.000Z',
      };

      state.accounts = [account];

      return mockJsonResponse({ account });
    }

    if (pathname === '/api/v1/transactions' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildTransactionsSnapshot() });
    }

    if (pathname === '/api/v1/transactions' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        accountId: string;
        amountInCents: number;
        category?: string;
        description: string;
        transactionDate: string;
        type: 'income' | 'expense';
      };
      const transaction = {
        id:
          payload.type === 'income'
            ? '22222222-2222-4222-8222-222222222222'
            : '33333333-3333-4333-8333-333333333333',
        accountId: payload.accountId,
        amountInCents: payload.amountInCents,
        category: payload.category,
        createdAt: '2026-05-06T12:30:00.000Z',
        description: payload.description,
        transactionDate: payload.transactionDate,
        type: payload.type,
        updatedAt: '2026-05-06T12:30:00.000Z',
      };

      state.transactions = [...state.transactions, transaction];

      return mockJsonResponse({ transaction });
    }

    return mockJsonResponse({});
  });
}

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    window.history.pushState({}, '', '/login');
  });

  it('mostra a tela de login para visitantes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Entre na plataforma' }),
      ).toBeInTheDocument();
    });
  });

  it('renderiza o dashboard quando existe sessao', async () => {
    window.history.pushState({}, '', '/app');

    mockAuthenticatedShellResponses();

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Saldo atual, contas e lancamentos manuais prontos.',
        }),
      ).toBeInTheDocument();
    });
  });

  it('executa o fluxo financeiro principal na shell web', async () => {
    window.history.pushState({}, '', '/app/contas');

    mockInteractiveFinanceFlow();

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Contas e saldo atual' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Conta principal'), {
      target: { value: 'Conta Principal Web' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '100000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(screen.getByText('Conta Principal Web')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Lancamentos' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Lancamentos manuais' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: salario'), {
      target: { value: 'Recebimento salarial' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex.: trabalho'), {
      target: { value: 'Trabalho' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '200000' },
    });
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2026-05-05' },
    });
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'income' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar lancamento' }));

    await waitFor(() => {
      expect(screen.getByText('Recebimento salarial')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Descricao'), {
      target: { value: 'Pagamento do aluguel' },
    });
    fireEvent.change(screen.getByLabelText('Categoria'), {
      target: { value: 'Casa' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '50000' },
    });
    fireEvent.change(screen.getByLabelText('Tipo'), {
      target: { value: 'expense' },
    });
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2026-05-06' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar lancamento' }));

    await waitFor(() => {
      expect(screen.getByText('Pagamento do aluguel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Visao geral' }));

    await waitFor(() => {
      const saldoCard = screen
        .getByRole('heading', { name: 'Saldo consolidado' })
        .closest('article');
      const movimentacaoCard = screen
        .getByRole('heading', { name: 'Movimentacao atual' })
        .closest('article');

      expect(saldoCard).not.toBeNull();
      expect(movimentacaoCard).not.toBeNull();

      expect(within(saldoCard as HTMLElement).getByText(/2\.500,00/)).toBeInTheDocument();
      expect(
        within(movimentacaoCard as HTMLElement).getByText(/2\.000,00/),
      ).toBeInTheDocument();
      expect(
        within(movimentacaoCard as HTMLElement).getByText(/500,00/),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de cadastro com o consentimento obrigatorio', async () => {
    window.history.pushState({}, '', '/cadastro');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', {
          name: /li e aceito a politica de privacidade/i,
        }),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de recuperacao de senha para visitantes', async () => {
    window.history.pushState({}, '', '/esqueci-senha');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Recupere seu acesso' }),
      ).toBeInTheDocument();
    });
  });

  it('mostra a tela de redefinicao de senha para visitantes', async () => {
    window.history.pushState({}, '', '/redefinir-senha?token=preview-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockJsonResponse({ session: null }),
    );

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Defina uma nova senha' }),
      ).toBeInTheDocument();
    });
  });
});