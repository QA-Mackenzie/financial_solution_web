import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  AccountsSnapshot,
  CreditCard,
  CreditCardPurchase,
  ContractsSnapshot,
  HorizonSnapshot,
  InstallmentOperation,
  InstallmentPlanListItem,
  SessionPayload,
  TransactionsSnapshot,
} from '@shf/contracts';
import {
  buildCombinedCreditCardFinancials,
  buildCreditCardInvoices,
  buildCreditCardPurchaseListItems,
  buildCurrentCreditCardCycle,
  buildCurrentCreditCardInvoicePreview,
  buildFinancialHorizon,
  buildInstallmentOccurrenceListItems,
  buildProjectedCreditCardInvoiceOccurrences,
  buildProjectedInstallmentCreditCardPurchases,
  buildProjectedInstallmentOccurrences,
} from '@shf/domain-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { queryClient } from './lib/query-client';

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
  const horizonSnapshot: HorizonSnapshot = {
    generatedAt: '2026-05-06T12:00:00.000Z',
    settings: {
      safetyMarginInCents: 50000,
      variableExpenseWindowInMonths: 3,
    },
    horizon: {
      months: Array.from({ length: 24 }, (_unused, index) => ({
        id: `2026-${String(index + 5).padStart(2, '0')}`,
        monthStart: `2026-${String(((index + 4) % 12) + 1).padStart(2, '0')}-01`,
        openingBalanceInCents: 0,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 0,
        riskLevel: 'critical' as const,
      })),
    },
  };
  const contractsSnapshot: ContractsSnapshot = {
    activeContracts: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        accountId: '11111111-1111-4111-8111-111111111111',
        accountName: 'Conta Principal Web',
        name: 'Aluguel residencial',
        category: 'Moradia',
        type: 'expense',
        amountInCents: 125000,
        dueDay: 10,
        startDate: '2026-05-01',
        endDate: null,
        status: 'active',
        adjustments: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            contractId: '44444444-4444-4444-8444-444444444444',
            amountInCents: 135000,
            effectiveStartDate: '2026-06-01',
            createdAt: '2026-05-12T12:00:00.000Z',
          },
        ],
        createdAt: '2026-05-01T12:00:00.000Z',
        updatedAt: '2026-05-12T12:00:00.000Z',
      },
    ],
    inactiveContracts: [],
    totalActiveIncomeInCents: 0,
    totalActiveExpenseInCents: 125000,
    netActiveAmountInCents: -125000,
  };

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const urlValue = input instanceof Request ? input.url : String(input);
    const pathname = new URL(urlValue).pathname;

    if (pathname === '/api/v1/session') {
      return mockJsonResponse({ session });
    }

    if (pathname === '/api/v1/horizon') {
      return mockJsonResponse({ snapshot: horizonSnapshot });
    }

    if (pathname === '/api/v1/contracts') {
      return mockJsonResponse({ snapshot: contractsSnapshot });
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
    contracts: [] as Array<{
      id: string;
      accountId: string;
      name: string;
      category: string;
      type: 'income' | 'expense';
      amountInCents: number;
      dueDay: number;
      startDate: string;
      endDate: string | null;
      status: 'active' | 'inactive';
      adjustments: Array<{
        id: string;
        contractId: string;
        amountInCents: number;
        effectiveStartDate: string;
        createdAt: string;
      }>;
      createdAt: string;
      updatedAt: string;
    }>,
    settings: {
      safetyMarginInCents: 50000,
      variableExpenseWindowInMonths: 3,
    },
  };

  function classifyRisk(closingBalanceInCents: number, safetyMarginInCents: number) {
    if (closingBalanceInCents < 0) {
      return 'critical' as const;
    }

    if (closingBalanceInCents <= safetyMarginInCents) {
      return 'attention' as const;
    }

    return 'healthy' as const;
  }

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

  function buildContractsSnapshot(): ContractsSnapshot {
    const currentDate = '2026-05-06';
    const contractItems = state.contracts.map((contract) => ({
      ...contract,
      accountName:
        state.accounts.find((account) => account.id === contract.accountId)?.name ?? '',
    }));
    const activeContracts = contractItems.filter(
      (contract) =>
        contract.status === 'active' &&
        (!contract.endDate || contract.endDate >= currentDate),
    );
    const inactiveContracts = contractItems.filter(
      (contract) =>
        contract.status !== 'active' ||
        (contract.endDate !== null && contract.endDate < currentDate),
    );

    return {
      activeContracts,
      inactiveContracts,
      totalActiveIncomeInCents: activeContracts
        .filter((contract) => contract.type === 'income')
        .reduce((sum, contract) => sum + contract.amountInCents, 0),
      totalActiveExpenseInCents: activeContracts
        .filter((contract) => contract.type === 'expense')
        .reduce((sum, contract) => sum + contract.amountInCents, 0),
      netActiveAmountInCents: activeContracts.reduce(
        (sum, contract) =>
          sum + (contract.type === 'income' ? contract.amountInCents : -contract.amountInCents),
        0,
      ),
    };
  }

  function buildContractTotalsByMonth(totalMonths: number) {
    const totals = new Map<string, { incomeInCents: number; expenseInCents: number }>();
    const referenceDate = '2026-05-06';

    for (let index = 0; index < totalMonths; index += 1) {
      const absoluteMonthIndex = 4 + index;
      const year = 2026 + Math.floor(absoluteMonthIndex / 12);
      const monthIndex = absoluteMonthIndex % 12;
      const monthKey = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}`;
      const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

      for (const contract of state.contracts) {
        if (contract.status !== 'active') {
          continue;
        }

        const occurrenceDate = `${monthKey}-${String(Math.min(contract.dueDay, lastDayOfMonth)).padStart(2, '0')}`;

        if (occurrenceDate < contract.startDate || occurrenceDate < referenceDate) {
          continue;
        }

        if (contract.endDate && occurrenceDate > contract.endDate) {
          continue;
        }

        const applicableAdjustment = contract.adjustments
          .filter((adjustment) => adjustment.effectiveStartDate <= occurrenceDate)
          .sort((left, right) =>
            left.effectiveStartDate.localeCompare(right.effectiveStartDate),
          )
          .at(-1);
        const amountInCents = applicableAdjustment?.amountInCents ?? contract.amountInCents;
        const currentTotals = totals.get(monthKey) ?? {
          incomeInCents: 0,
          expenseInCents: 0,
        };

        if (contract.type === 'income') {
          currentTotals.incomeInCents += amountInCents;
        } else {
          currentTotals.expenseInCents += amountInCents;
        }

        totals.set(monthKey, currentTotals);
      }
    }

    return totals;
  }

  function buildHorizonSnapshot(): HorizonSnapshot {
    const accountsSnapshot = buildAccountsSnapshot();
    const transactionsSnapshot = buildTransactionsSnapshot();
    const contractTotalsByMonth = buildContractTotalsByMonth(24);
    const openingBalanceInCents = accountsSnapshot.activeAccounts.reduce(
      (sum, account) => sum + account.openingBalanceInCents,
      0,
    );
    let rollingOpeningBalanceInCents = openingBalanceInCents;
    const months = Array.from({ length: 24 }, (_unused, index) => {
      const absoluteMonthIndex = 4 + index;
      const year = 2026 + Math.floor(absoluteMonthIndex / 12);
      const monthIndex = absoluteMonthIndex % 12;
      const monthStart = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-01`;
      const monthKey = monthStart.slice(0, 7);
      const transactionIncomeInCents = transactionsSnapshot.transactions
        .filter(
          (transaction) =>
            transaction.type === 'income' && transaction.transactionDate.startsWith(monthKey),
        )
        .reduce((sum, transaction) => sum + transaction.amountInCents, 0);
      const transactionExpenseInCents = transactionsSnapshot.transactions
        .filter(
          (transaction) =>
            transaction.type === 'expense' && transaction.transactionDate.startsWith(monthKey),
        )
        .reduce((sum, transaction) => sum + transaction.amountInCents, 0);
      const projectedContractTotals = contractTotalsByMonth.get(monthKey) ?? {
        incomeInCents: 0,
        expenseInCents: 0,
      };
      const income = transactionIncomeInCents + projectedContractTotals.incomeInCents;
      const expense = transactionExpenseInCents + projectedContractTotals.expenseInCents;
      const closing = rollingOpeningBalanceInCents + income - expense;
      const opening = rollingOpeningBalanceInCents;

      rollingOpeningBalanceInCents = closing;

      return {
        id: monthStart.slice(0, 7),
        monthStart,
        openingBalanceInCents: opening,
        incomeInCents: income,
        expenseInCents: expense,
        closingBalanceInCents: closing,
        riskLevel: classifyRisk(closing, state.settings.safetyMarginInCents),
      };
    });

    return {
      generatedAt: '2026-05-06T13:00:00.000Z',
      settings: state.settings,
      horizon: {
        months,
      },
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

    if (pathname === '/api/v1/contracts' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildContractsSnapshot() });
    }

    if (pathname === '/api/v1/contracts' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        accountId: string;
        name: string;
        category: string;
        type: 'income' | 'expense';
        amountInCents: number;
        dueDay: number;
        startDate: string;
        status: 'active' | 'inactive';
      };
      const contract = {
        id:
          state.contracts.length === 0
            ? '44444444-4444-4444-8444-444444444444'
            : '77777777-7777-4777-8777-777777777777',
        accountId: payload.accountId,
        name: payload.name,
        category: payload.category,
        type: payload.type,
        amountInCents: payload.amountInCents,
        dueDay: payload.dueDay,
        startDate: payload.startDate,
        endDate: null,
        status: payload.status,
        adjustments: [],
        createdAt: '2026-05-06T13:00:00.000Z',
        updatedAt: '2026-05-06T13:00:00.000Z',
      };

      state.contracts = [...state.contracts, contract];

      return mockJsonResponse({ contract });
    }

    const updateContractMatch = pathname.match(/^\/api\/v1\/contracts\/([^/]+)$/);

    if (updateContractMatch && method === 'PUT') {
      const contractId = updateContractMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        accountId: string;
        name: string;
        category: string;
        type: 'income' | 'expense';
        amountInCents: number;
        dueDay: number;
        startDate: string;
        status: 'active' | 'inactive';
      };
      let updatedContract = null as (typeof state.contracts)[number] | null;

      state.contracts = state.contracts.map((contract) => {
        if (contract.id !== contractId) {
          return contract;
        }

        updatedContract = {
          ...contract,
          ...payload,
          updatedAt: '2026-05-06T13:10:00.000Z',
        };

        return updatedContract;
      });

      return mockJsonResponse({ contract: updatedContract });
    }

    const adjustmentContractMatch = pathname.match(
      /^\/api\/v1\/contracts\/([^/]+)\/adjustments$/,
    );

    if (adjustmentContractMatch && method === 'POST') {
      const contractId = adjustmentContractMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        amountInCents: number;
        effectiveStartDate: string;
      };
      const adjustment = {
        id:
          state.contracts.some((contract) => contract.adjustments.length > 0)
            ? '88888888-8888-4888-8888-888888888888'
            : '55555555-5555-4555-8555-555555555555',
        contractId,
        amountInCents: payload.amountInCents,
        effectiveStartDate: payload.effectiveStartDate,
        createdAt: '2026-05-06T13:20:00.000Z',
      };

      state.contracts = state.contracts.map((contract) =>
        contract.id === contractId
          ? {
              ...contract,
              adjustments: [...contract.adjustments, adjustment],
              updatedAt: '2026-05-06T13:20:00.000Z',
            }
          : contract,
      );

      return mockJsonResponse({ adjustment });
    }

    const endContractMatch = pathname.match(/^\/api\/v1\/contracts\/([^/]+)\/end$/);

    if (endContractMatch && method === 'POST') {
      const contractId = endContractMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        endDate: string;
      };
      let endedContract = null as (typeof state.contracts)[number] | null;

      state.contracts = state.contracts.map((contract) => {
        if (contract.id !== contractId) {
          return contract;
        }

        endedContract = {
          ...contract,
          endDate: payload.endDate,
          updatedAt: '2026-05-06T13:30:00.000Z',
        };

        return endedContract;
      });

      return mockJsonResponse({ contract: endedContract });
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

    if (pathname === '/api/v1/horizon' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildHorizonSnapshot() });
    }

    if (pathname === '/api/v1/horizon/settings' && method === 'PUT') {
      const payload = JSON.parse(String(init?.body)) as {
        safetyMarginInCents: number;
        variableExpenseWindowInMonths: number;
      };

      state.settings = payload;

      return mockJsonResponse({ settings: payload });
    }

    return mockJsonResponse({});
  });
}

function mockCreditCardShellFlow() {
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
  const referenceDate = '2026-05-06';
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
    creditCards: [] as CreditCard[],
    purchases: [] as CreditCardPurchase[],
    settings: {
      safetyMarginInCents: 50000,
      variableExpenseWindowInMonths: 3,
    },
  };
  const emptyContractsSnapshot: ContractsSnapshot = {
    activeContracts: [],
    inactiveContracts: [],
    totalActiveIncomeInCents: 0,
    totalActiveExpenseInCents: 0,
    netActiveAmountInCents: 0,
  };

  function buildAccountsSnapshot(): AccountsSnapshot {
    const activeAccounts = state.accounts
      .filter((account) => !account.isArchived)
      .map((account) => ({
        ...account,
        currentBalanceInCents: account.openingBalanceInCents,
      }));

    return {
      activeAccounts,
      archivedAccounts: [],
      consolidatedBalanceInCents: activeAccounts.reduce(
        (sum, account) => sum + account.currentBalanceInCents,
        0,
      ),
    };
  }

  function buildCreditCardsSnapshot() {
    const billingCards = state.creditCards.map((card) => {
      const paymentAccountName =
        state.accounts.find((account) => account.id === card.paymentAccountId)?.name ?? '';

      return {
        dueDay: card.dueDay,
        id: card.id,
        name: card.name,
        paymentAccountId: card.paymentAccountId,
        paymentAccountName,
        statementClosingDay: card.statementClosingDay,
      };
    });
    const purchases = buildCreditCardPurchaseListItems(billingCards, state.purchases);
    const invoices = buildCreditCardInvoices(purchases, referenceDate);
    const cards = state.creditCards.map((card) => {
      const paymentAccountName =
        state.accounts.find((account) => account.id === card.paymentAccountId)?.name ?? '';
      const currentCycle = buildCurrentCreditCardCycle(card, referenceDate);
      const currentInvoicePreview = buildCurrentCreditCardInvoicePreview(
        {
          dueDay: card.dueDay,
          id: card.id,
          name: card.name,
          statementClosingDay: card.statementClosingDay,
        },
        referenceDate,
      );
      const matchingInvoice = invoices.find(
        (invoice) => invoice.id === `${card.id}:${currentCycle.invoiceMonth}`,
      );

      return {
        ...card,
        currentCycle,
        currentInvoice: {
          ...currentInvoicePreview,
          totalAmountInCents: matchingInvoice?.totalAmountInCents ?? 0,
        },
        paymentAccountName,
      };
    });

    return {
      cards,
      invoices,
      projectedInvoices: buildProjectedCreditCardInvoiceOccurrences(
        invoices,
        referenceDate,
      ),
      purchases,
      totalCreditLimitInCents: cards.reduce(
        (sum, card) => sum + card.creditLimitInCents,
        0,
      ),
      totalInvoiceAmountInCents: invoices.reduce(
        (sum, invoice) => sum + invoice.totalAmountInCents,
        0,
      ),
    };
  }

  function buildHorizonSnapshot(): HorizonSnapshot {
    const accountsSnapshot = buildAccountsSnapshot();
    const creditCardsSnapshot = buildCreditCardsSnapshot();

    return {
      generatedAt: '2026-05-06T13:00:00.000Z',
      settings: state.settings,
      horizon: buildFinancialHorizon(
        accountsSnapshot,
        {
          totalExpenseInCents: 0,
          totalIncomeInCents: 0,
          transactions: [],
        },
        {
          currentDate: referenceDate,
          projectedCreditCardInvoiceOccurrences:
            buildProjectedCreditCardInvoiceOccurrences(
              creditCardsSnapshot.invoices,
              referenceDate,
            ),
          safetyMarginInCents: state.settings.safetyMarginInCents,
          totalMonths: 24,
        },
      ),
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

    if (pathname === '/api/v1/credit-cards' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildCreditCardsSnapshot() });
    }

    if (pathname === '/api/v1/credit-cards' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        name: string;
        creditLimitInCents: number;
        statementClosingDay: number;
        dueDay: number;
        paymentAccountId: string;
      };
      const creditCard: CreditCard = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: payload.name,
        creditLimitInCents: payload.creditLimitInCents,
        statementClosingDay: payload.statementClosingDay,
        dueDay: payload.dueDay,
        paymentAccountId: payload.paymentAccountId,
        createdAt: '2026-05-06T12:10:00.000Z',
        updatedAt: '2026-05-06T12:10:00.000Z',
      };

      state.creditCards = [...state.creditCards, creditCard];

      return mockJsonResponse({
        creditCard: buildCreditCardsSnapshot().cards.find((card) => card.id === creditCard.id),
      });
    }

    const updateCreditCardMatch = pathname.match(/^\/api\/v1\/credit-cards\/([^/]+)$/);

    if (updateCreditCardMatch && method === 'PUT') {
      const creditCardId = updateCreditCardMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        name: string;
        creditLimitInCents: number;
        statementClosingDay: number;
        dueDay: number;
        paymentAccountId: string;
      };

      state.creditCards = state.creditCards.map((card) =>
        card.id === creditCardId
          ? {
              ...card,
              ...payload,
              updatedAt: '2026-05-06T12:20:00.000Z',
            }
          : card,
      );

      return mockJsonResponse({
        creditCard: buildCreditCardsSnapshot().cards.find((card) => card.id === creditCardId),
      });
    }

    if (pathname === '/api/v1/credit-card-purchases' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        creditCardId: string;
        description: string;
        category?: string;
        amountInCents: number;
        purchaseDate: string;
      };
      const purchase: CreditCardPurchase = {
        id:
          state.purchases.length === 0
            ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
            : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        creditCardId: payload.creditCardId,
        description: payload.description,
        category: payload.category,
        amountInCents: payload.amountInCents,
        purchaseDate: payload.purchaseDate,
        createdAt: '2026-05-06T12:30:00.000Z',
        updatedAt: '2026-05-06T12:30:00.000Z',
      };

      state.purchases = [...state.purchases, purchase];

      return mockJsonResponse({
        purchase: buildCreditCardsSnapshot().purchases.find(
          (item) => item.id === purchase.id,
        ),
      });
    }

    const updatePurchaseMatch = pathname.match(/^\/api\/v1\/credit-card-purchases\/([^/]+)$/);

    if (updatePurchaseMatch && method === 'PUT') {
      const purchaseId = updatePurchaseMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        creditCardId: string;
        description: string;
        category?: string;
        amountInCents: number;
        purchaseDate: string;
      };

      state.purchases = state.purchases.map((purchase) =>
        purchase.id === purchaseId
          ? {
              ...purchase,
              ...payload,
              updatedAt: '2026-05-06T12:40:00.000Z',
            }
          : purchase,
      );

      return mockJsonResponse({
        purchase: buildCreditCardsSnapshot().purchases.find(
          (item) => item.id === purchaseId,
        ),
      });
    }

    if (pathname === '/api/v1/contracts' && method === 'GET') {
      return mockJsonResponse({ snapshot: emptyContractsSnapshot });
    }

    if (pathname === '/api/v1/horizon' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildHorizonSnapshot() });
    }

    return mockJsonResponse({});
  });
}

function mockInstallmentShellFlow() {
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
  const referenceDate = '2026-05-06';
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
    creditCards: [] as CreditCard[],
    installmentOperations: [] as InstallmentOperation[],
    installmentPlans: [] as InstallmentPlanListItem[],
    purchases: [] as CreditCardPurchase[],
    settings: {
      safetyMarginInCents: 50000,
      variableExpenseWindowInMonths: 3,
    },
  };
  const emptyContractsSnapshot: ContractsSnapshot = {
    activeContracts: [],
    inactiveContracts: [],
    totalActiveIncomeInCents: 0,
    totalActiveExpenseInCents: 0,
    netActiveAmountInCents: 0,
  };

  function buildAccountsSnapshot(): AccountsSnapshot {
    const activeAccounts = state.accounts
      .filter((account) => !account.isArchived)
      .map((account) => ({
        ...account,
        currentBalanceInCents: account.openingBalanceInCents,
      }));

    return {
      activeAccounts,
      archivedAccounts: [],
      consolidatedBalanceInCents: activeAccounts.reduce(
        (sum, account) => sum + account.currentBalanceInCents,
        0,
      ),
    };
  }

  function buildInstallmentsSnapshot() {
    const plans = state.installmentPlans.slice();
    const operations = state.installmentOperations.slice();
    const occurrences = buildInstallmentOccurrenceListItems(plans, operations);
    const projectedAccountOccurrences = buildProjectedInstallmentOccurrences(
      occurrences,
      referenceDate,
    );
    const projectedCreditCardPurchases =
      buildProjectedInstallmentCreditCardPurchases(occurrences, referenceDate);

    return {
      plans,
      occurrences,
      operations,
      projectedAccountOccurrences,
      projectedCreditCardPurchases,
      totalRemainingAmountInCents:
        projectedAccountOccurrences.reduce(
          (sum, occurrence) => sum + occurrence.amountInCents,
          0,
        ) +
        projectedCreditCardPurchases.reduce(
          (sum, purchase) => sum + purchase.amountInCents,
          0,
        ),
    };
  }

  function buildCreditCardsSnapshot() {
    const billingCards = state.creditCards.map((card) => {
      const paymentAccountName =
        state.accounts.find((account) => account.id === card.paymentAccountId)?.name ?? '';

      return {
        dueDay: card.dueDay,
        id: card.id,
        name: card.name,
        paymentAccountId: card.paymentAccountId,
        paymentAccountName,
        statementClosingDay: card.statementClosingDay,
      };
    });
    const persistedPurchases = buildCreditCardPurchaseListItems(
      billingCards,
      state.purchases,
    );
    const persistedInvoices = buildCreditCardInvoices(persistedPurchases, referenceDate);
    const cards = state.creditCards.map((card) => {
      const paymentAccountName =
        state.accounts.find((account) => account.id === card.paymentAccountId)?.name ?? '';
      const currentCycle = buildCurrentCreditCardCycle(card, referenceDate);
      const currentInvoicePreview = buildCurrentCreditCardInvoicePreview(
        {
          dueDay: card.dueDay,
          id: card.id,
          name: card.name,
          statementClosingDay: card.statementClosingDay,
        },
        referenceDate,
      );
      const matchingInvoice = persistedInvoices.find(
        (invoice) => invoice.id === `${card.id}:${currentCycle.invoiceMonth}`,
      );

      return {
        ...card,
        currentCycle,
        currentInvoice: {
          ...currentInvoicePreview,
          totalAmountInCents: matchingInvoice?.totalAmountInCents ?? 0,
        },
        paymentAccountName,
      };
    });
    const combined = buildCombinedCreditCardFinancials(
      cards,
      persistedPurchases,
      buildInstallmentsSnapshot(),
      referenceDate,
    );

    return {
      ...combined,
      totalCreditLimitInCents: cards.reduce(
        (sum, card) => sum + card.creditLimitInCents,
        0,
      ),
    };
  }

  function buildHorizonSnapshot(): HorizonSnapshot {
    const accountsSnapshot = buildAccountsSnapshot();
    const installmentsSnapshot = buildInstallmentsSnapshot();
    const creditCardsSnapshot = buildCreditCardsSnapshot();

    return {
      generatedAt: '2026-05-06T13:00:00.000Z',
      settings: state.settings,
      horizon: buildFinancialHorizon(
        accountsSnapshot,
        {
          totalExpenseInCents: 0,
          totalIncomeInCents: 0,
          transactions: [],
        },
        {
          currentDate: referenceDate,
          projectedCreditCardInvoiceOccurrences:
            creditCardsSnapshot.projectedInvoices,
          projectedInstallmentOccurrences:
            installmentsSnapshot.projectedAccountOccurrences,
          safetyMarginInCents: state.settings.safetyMarginInCents,
          totalMonths: 24,
        },
      ),
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

    if (pathname === '/api/v1/credit-cards' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildCreditCardsSnapshot() });
    }

    if (pathname === '/api/v1/credit-cards' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        name: string;
        creditLimitInCents: number;
        statementClosingDay: number;
        dueDay: number;
        paymentAccountId: string;
      };
      const creditCard: CreditCard = {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: payload.name,
        creditLimitInCents: payload.creditLimitInCents,
        statementClosingDay: payload.statementClosingDay,
        dueDay: payload.dueDay,
        paymentAccountId: payload.paymentAccountId,
        createdAt: '2026-05-06T12:10:00.000Z',
        updatedAt: '2026-05-06T12:10:00.000Z',
      };

      state.creditCards = [...state.creditCards, creditCard];

      return mockJsonResponse({
        creditCard: buildCreditCardsSnapshot().cards.find((card) => card.id === creditCard.id),
      });
    }

    if (pathname === '/api/v1/installments' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildInstallmentsSnapshot() });
    }

    if (pathname === '/api/v1/installments' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        sourceType: 'account' | 'creditCard';
        accountId?: string;
        creditCardId?: string;
        description: string;
        totalAmountInCents: number;
        installmentCount: number;
        firstOccurrenceDate: string;
      };
      const planId =
        state.installmentPlans.length === 0
          ? 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
          : 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
      const linkedAccount = payload.accountId
        ? state.accounts.find((account) => account.id === payload.accountId)
        : undefined;
      const linkedCard = payload.creditCardId
        ? state.creditCards.find((card) => card.id === payload.creditCardId)
        : undefined;
      const paymentAccount = linkedCard
        ? state.accounts.find((account) => account.id === linkedCard.paymentAccountId)
        : undefined;
      const plan: InstallmentPlanListItem = {
        id: planId,
        sourceType: payload.sourceType,
        accountId: payload.sourceType === 'account' ? payload.accountId ?? null : null,
        creditCardId:
          payload.sourceType === 'creditCard' ? payload.creditCardId ?? null : null,
        description: payload.description,
        totalAmountInCents: payload.totalAmountInCents,
        installmentCount: payload.installmentCount,
        firstOccurrenceDate: payload.firstOccurrenceDate,
        accountName: linkedAccount?.name ?? null,
        creditCardName: linkedCard?.name ?? null,
        paymentAccountId: linkedCard?.paymentAccountId ?? null,
        paymentAccountName: paymentAccount?.name ?? null,
        createdAt:
          state.installmentPlans.length === 0
            ? '2026-05-06T12:20:00.000Z'
            : '2026-05-06T12:40:00.000Z',
        updatedAt:
          state.installmentPlans.length === 0
            ? '2026-05-06T12:20:00.000Z'
            : '2026-05-06T12:40:00.000Z',
      };

      state.installmentPlans = [...state.installmentPlans, plan];

      return mockJsonResponse({ plan });
    }

    const updateInstallmentMatch = pathname.match(/^\/api\/v1\/installments\/([^/]+)$/);

    if (updateInstallmentMatch && method === 'PUT') {
      const planId = updateInstallmentMatch[1] ?? '';
      const payload = JSON.parse(String(init?.body)) as {
        sourceType: 'account' | 'creditCard';
        accountId?: string;
        creditCardId?: string;
        description: string;
        totalAmountInCents: number;
        installmentCount: number;
        firstOccurrenceDate: string;
      };
      const linkedAccount = payload.accountId
        ? state.accounts.find((account) => account.id === payload.accountId)
        : undefined;
      const linkedCard = payload.creditCardId
        ? state.creditCards.find((card) => card.id === payload.creditCardId)
        : undefined;
      const paymentAccount = linkedCard
        ? state.accounts.find((account) => account.id === linkedCard.paymentAccountId)
        : undefined;

      state.installmentPlans = state.installmentPlans.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              sourceType: payload.sourceType,
              accountId:
                payload.sourceType === 'account' ? payload.accountId ?? null : null,
              creditCardId:
                payload.sourceType === 'creditCard'
                  ? payload.creditCardId ?? null
                  : null,
              description: payload.description,
              totalAmountInCents: payload.totalAmountInCents,
              installmentCount: payload.installmentCount,
              firstOccurrenceDate: payload.firstOccurrenceDate,
              accountName: linkedAccount?.name ?? null,
              creditCardName: linkedCard?.name ?? null,
              paymentAccountId: linkedCard?.paymentAccountId ?? null,
              paymentAccountName: paymentAccount?.name ?? null,
              updatedAt: '2026-05-06T12:30:00.000Z',
            }
          : plan,
      );

      return mockJsonResponse({
        plan: state.installmentPlans.find((plan) => plan.id === planId),
      });
    }

    if (pathname === '/api/v1/installment-operations' && method === 'POST') {
      const payload = JSON.parse(String(init?.body)) as {
        planId: string;
        operationDate: string;
        affectedInstallmentCount: number;
      };
      const eligibleOccurrences = buildInstallmentOccurrenceListItems(
        state.installmentPlans,
        state.installmentOperations,
      )
        .filter(
          (occurrence) =>
            occurrence.planId === payload.planId &&
            occurrence.occurrenceDate > payload.operationDate,
        )
        .sort(
          (left, right) =>
            left.occurrenceDate.localeCompare(right.occurrenceDate) ||
            left.installmentNumber - right.installmentNumber ||
            left.id.localeCompare(right.id),
        )
        .slice(0, payload.affectedInstallmentCount);
      const operation: InstallmentOperation = {
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        planId: payload.planId,
        type: 'anticipation',
        operationDate: payload.operationDate,
        affectedInstallmentCount: payload.affectedInstallmentCount,
        affectedAmountInCents: eligibleOccurrences.reduce(
          (sum, occurrence) => sum + occurrence.amountInCents,
          0,
        ),
        createdAt:
          state.installmentOperations.length === 0
            ? '2026-05-06T12:35:00.000Z'
            : '2026-05-06T12:55:00.000Z',
      };

      state.installmentOperations = [...state.installmentOperations, operation];

      return mockJsonResponse({ operation });
    }

    if (pathname === '/api/v1/contracts' && method === 'GET') {
      return mockJsonResponse({ snapshot: emptyContractsSnapshot });
    }

    if (pathname === '/api/v1/horizon' && method === 'GET') {
      return mockJsonResponse({ snapshot: buildHorizonSnapshot() });
    }

    return mockJsonResponse({});
  });
}

describe('App', () => {
  afterEach(() => {
    queryClient.clear();
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
          name: 'Horizonte oficial de 24 meses no backend.',
        }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Margem de seguranca em centavos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recorrencias ativas' })).toBeInTheDocument();
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
        .getByRole('heading', { name: 'Fechamento do mes atual' })
        .closest('article');
      const riscoCard = screen
        .getByRole('heading', { name: 'Principal risco do horizonte' })
        .closest('article');

      expect(saldoCard).not.toBeNull();
      expect(riscoCard).not.toBeNull();

      expect(within(saldoCard as HTMLElement).getByText(/2\.500,00/)).toBeInTheDocument();
      expect(
        within(riscoCard as HTMLElement).getByText(/500,00/),
      ).toBeInTheDocument();
    });
  });

  it('gerencia contratos recorrentes pela shell web', async () => {
    window.history.pushState({}, '', '/app/contas');

    mockInteractiveFinanceFlow();

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Contas e saldo atual' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Conta principal'), {
      target: { value: 'Conta Contratos Web' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '300000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(screen.getByText('Conta Contratos Web')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Contratos' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Contratos recorrentes' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: aluguel'), {
      target: { value: 'Academia premium' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex.: moradia'), {
      target: { value: 'Saude' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '9900' },
    });
    fireEvent.change(screen.getByLabelText('Dia de vencimento'), {
      target: { value: '20' },
    });
    fireEvent.change(screen.getByLabelText('Inicio da recorrencia'), {
      target: { value: '2026-05-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar contrato' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Novo reajuste' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Novo reajuste' }));
    fireEvent.change(screen.getByLabelText('Novo valor em centavos'), {
      target: { value: '13500' },
    });
    fireEvent.change(screen.getByLabelText('Inicio do reajuste'), {
      target: { value: '2026-06-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar reajuste' }));

    await waitFor(() => {
      expect(screen.getByText('Efetivo em 01/06/2026')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Preparar encerramento' }));
    fireEvent.change(screen.getByLabelText('Data final'), {
      target: { value: '2026-05-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar contrato' }));

    await waitFor(() => {
      expect(screen.getByText('Nenhum contrato ativo cadastrado ainda.')).toBeInTheDocument();
    });

    const inactiveContractsCard = screen
      .getByRole('heading', { name: 'Contratos inativos' })
      .closest('article');

    expect(inactiveContractsCard).not.toBeNull();
    expect(
      within(inactiveContractsCard as HTMLElement).getByText('Academia premium'),
    ).toBeInTheDocument();
  });

  it('gerencia cartoes e projeta a fatura no mes de vencimento pela shell web', async () => {
    window.history.pushState({}, '', '/app/contas');

    mockCreditCardShellFlow();

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Contas e saldo atual' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Conta principal'), {
      target: { value: 'Conta Cartao Web' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(screen.getByText('Conta Cartao Web')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Cartoes' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Cartoes de credito e ciclo de fatura',
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: Visa Platinum'), {
      target: { value: 'Visa Corporativo' },
    });
    fireEvent.change(screen.getByLabelText('Limite em centavos'), {
      target: { value: '300000' },
    });
    fireEvent.change(screen.getByLabelText('Fechamento'), {
      target: { value: '25' },
    });
    fireEvent.change(screen.getByLabelText('Vencimento'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartao' }));

    const cardsSection = screen
      .getByRole('heading', { name: 'Visao atual de limite, ciclo e fatura' })
      .closest('article');

    expect(cardsSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(cardsSection as HTMLElement).getByText('Visa Corporativo'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar cartao' }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: Visa Platinum'), {
      target: { value: 'Visa Corporativo Black' },
    });
    fireEvent.change(screen.getByLabelText('Limite em centavos'), {
      target: { value: '450000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar cartao' }));

    await waitFor(() => {
      expect(
        within(cardsSection as HTMLElement).getByText('Visa Corporativo Black'),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: notebook'), {
      target: { value: 'Notebook trabalho' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex.: tecnologia'), {
      target: { value: 'Tecnologia' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '50000' },
    });
    fireEvent.change(screen.getByLabelText('Data da compra'), {
      target: { value: '2026-05-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar compra' }));

    const purchasesSection = screen
      .getByRole('heading', { name: 'Compras no credito' })
      .closest('article');

    expect(purchasesSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(purchasesSection as HTMLElement).getByText('Notebook trabalho'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar compra' }));
    fireEvent.change(screen.getByPlaceholderText('Ex.: notebook'), {
      target: { value: 'Notebook trabalho ajustado' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '60000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar compra' }));

    await waitFor(() => {
      expect(
        within(purchasesSection as HTMLElement).getByText(
          'Notebook trabalho ajustado',
        ),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: notebook'), {
      target: { value: 'Passagem executiva' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex.: tecnologia'), {
      target: { value: 'Viagem' },
    });
    fireEvent.change(screen.getByLabelText('Valor em centavos'), {
      target: { value: '25000' },
    });
    fireEvent.change(screen.getByLabelText('Data da compra'), {
      target: { value: '2026-05-26' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar compra' }));

    const projectedInvoicesSection = screen
      .getByRole('heading', { name: 'Proximos vencimentos' })
      .closest('article');

    expect(projectedInvoicesSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(purchasesSection as HTMLElement).getByText('Passagem executiva'),
      ).toBeInTheDocument();
      expect(
        within(projectedInvoicesSection as HTMLElement).getByText(/08\/06\/2026/),
      ).toBeInTheDocument();
      expect(
        within(projectedInvoicesSection as HTMLElement).getByText(/08\/07\/2026/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Visao geral' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Horizonte oficial de 24 meses no backend.',
        }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('2026-05-01')).toBeInTheDocument();
      expect(screen.getByText('2026-06-01')).toBeInTheDocument();
      expect(screen.getByText('2026-07-01')).toBeInTheDocument();
    });

    const mayCard = screen.getByText('2026-05-01').closest('.horizon-list-card');
    const juneCard = screen.getByText('2026-06-01').closest('.horizon-list-card');
    const julyCard = screen.getByText('2026-07-01').closest('.horizon-list-card');

    expect(mayCard).not.toBeNull();
    expect(juneCard).not.toBeNull();
    expect(julyCard).not.toBeNull();

    const mayExpense = within(mayCard as HTMLElement).getByText('Saidas').closest('div');
    const juneExpense = within(juneCard as HTMLElement).getByText('Saidas').closest('div');
    const julyExpense = within(julyCard as HTMLElement).getByText('Saidas').closest('div');

    expect(mayExpense).not.toBeNull();
    expect(juneExpense).not.toBeNull();
    expect(julyExpense).not.toBeNull();

    expect(within(mayExpense as HTMLElement).getByText(/R\$\s*0,00/)).toBeInTheDocument();
    expect(within(juneExpense as HTMLElement).getByText(/R\$\s*600,00/)).toBeInTheDocument();
    expect(within(julyExpense as HTMLElement).getByText(/R\$\s*250,00/)).toBeInTheDocument();
  });

  it('gerencia parcelamentos e projeta compras parceladas pela shell web', async () => {
    window.history.pushState({}, '', '/app/contas');

    mockInstallmentShellFlow();

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Contas e saldo atual' }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Conta principal'), {
      target: { value: 'Conta Parcelamentos Web' },
    });
    fireEvent.change(screen.getByPlaceholderText('0'), {
      target: { value: '500000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(screen.getByText('Conta Parcelamentos Web')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Cartoes' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Cartoes de credito e ciclo de fatura',
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Ex.: Visa Platinum'), {
      target: { value: 'Visa Parcelado Web' },
    });
    fireEvent.change(screen.getByLabelText('Limite em centavos'), {
      target: { value: '400000' },
    });
    fireEvent.change(screen.getByLabelText('Fechamento'), {
      target: { value: '25' },
    });
    fireEvent.change(screen.getByLabelText('Vencimento'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar cartao' }));

    const cardsSection = screen
      .getByRole('heading', { name: 'Visao atual de limite, ciclo e fatura' })
      .closest('article');

    expect(cardsSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(cardsSection as HTMLElement).getByText('Visa Parcelado Web'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Parcelamentos' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Parcelamentos, cronograma e antecipacoes',
        }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Descricao do parcelamento'), {
      target: { value: 'Notebook parcelado' },
    });
    fireEvent.change(screen.getByLabelText('Valor total em centavos'), {
      target: { value: '120000' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Primeira ocorrencia'), {
      target: { value: '2026-05-10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar parcelamento' }));

    await waitFor(() => {
      const plansSection = screen
        .getByRole('heading', { name: 'Parcelamentos cadastrados' })
        .closest('article');

      expect(plansSection).not.toBeNull();
      expect(
        within(plansSection as HTMLElement).getByText('Notebook parcelado'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Editar parcelamento' }));
    fireEvent.change(screen.getByLabelText('Descricao do parcelamento'), {
      target: { value: 'Notebook parcelado ajustado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar parcelamento' }));

    await waitFor(() => {
      const plansSection = screen
        .getByRole('heading', { name: 'Parcelamentos cadastrados' })
        .closest('article');

      expect(plansSection).not.toBeNull();
      expect(
        within(plansSection as HTMLElement).getByText('Notebook parcelado ajustado'),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Data da antecipacao'), {
      target: { value: '2026-05-05' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas afetadas'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Antecipar parcelas' }));

    await waitFor(() => {
      expect(screen.getByText('3 parcelas afetadas')).toBeInTheDocument();
      expect(screen.getAllByText('Antecipada para 05/05/2026').length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText('Origem do parcelamento'), {
      target: { value: 'creditCard' },
    });
    fireEvent.change(screen.getByLabelText('Descricao do parcelamento'), {
      target: { value: 'Curso parcelado' },
    });
    fireEvent.change(screen.getByLabelText('Valor total em centavos'), {
      target: { value: '90000' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Primeira ocorrencia'), {
      target: { value: '2026-05-20' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Criar parcelamento' }));

    await waitFor(() => {
      const plansSection = screen
        .getByRole('heading', { name: 'Parcelamentos cadastrados' })
        .closest('article');

      expect(plansSection).not.toBeNull();
      expect(
        within(plansSection as HTMLElement).getByText('Curso parcelado'),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Data da antecipacao'), {
      target: { value: '2026-05-01' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas afetadas'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Antecipar parcelas' }));

    await waitFor(() => {
      expect(screen.getByText('Compra projetada 1/3')).toBeInTheDocument();
      expect(screen.getByText('Compra projetada 2/3')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Cartoes' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Compras no credito' }),
      ).toBeInTheDocument();
    });

    const purchasesSection = screen
      .getByRole('heading', { name: 'Compras no credito' })
      .closest('article');
    const projectedInvoicesSection = screen
      .getByRole('heading', { name: 'Proximos vencimentos' })
      .closest('article');

    expect(purchasesSection).not.toBeNull();
    expect(projectedInvoicesSection).not.toBeNull();

    await waitFor(() => {
      expect(
        within(purchasesSection as HTMLElement).getByText('Curso parcelado 1/3'),
      ).toBeInTheDocument();
      expect(
        within(purchasesSection as HTMLElement).getByText('Curso parcelado 2/3'),
      ).toBeInTheDocument();
      expect(
        within(purchasesSection as HTMLElement).getAllByText('Gerada por parcelamento')
          .length,
      ).toBeGreaterThan(0);
      expect(
        within(projectedInvoicesSection as HTMLElement).getByText(/08\/06\/2026/),
      ).toBeInTheDocument();
      expect(
        within(projectedInvoicesSection as HTMLElement).getByText(/08\/08\/2026/),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('link', { name: 'Visao geral' }));

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          name: 'Horizonte oficial de 24 meses no backend.',
        }),
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('2026-05-01')).toBeInTheDocument();
      expect(screen.getByText('2026-06-01')).toBeInTheDocument();
      expect(screen.getByText('2026-07-01')).toBeInTheDocument();
      expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    });

    const mayCard = screen.getByText('2026-05-01').closest('.horizon-list-card');
    const juneCard = screen.getByText('2026-06-01').closest('.horizon-list-card');
    const julyCard = screen.getByText('2026-07-01').closest('.horizon-list-card');
    const augustCard = screen.getByText('2026-08-01').closest('.horizon-list-card');

    expect(mayCard).not.toBeNull();
    expect(juneCard).not.toBeNull();
    expect(julyCard).not.toBeNull();
    expect(augustCard).not.toBeNull();

    const mayExpense = within(mayCard as HTMLElement).getByText('Saidas').closest('div');
    const juneExpense = within(juneCard as HTMLElement).getByText('Saidas').closest('div');
    const julyExpense = within(julyCard as HTMLElement).getByText('Saidas').closest('div');
    const augustExpense = within(augustCard as HTMLElement).getByText('Saidas').closest('div');

    expect(mayExpense).not.toBeNull();
    expect(juneExpense).not.toBeNull();
    expect(julyExpense).not.toBeNull();
    expect(augustExpense).not.toBeNull();

    expect(within(mayExpense as HTMLElement).getByText(/R\$\s*900,00/)).toBeInTheDocument();
    expect(within(juneExpense as HTMLElement).getByText(/R\$\s*600,00/)).toBeInTheDocument();
    expect(within(julyExpense as HTMLElement).getByText(/R\$\s*0,00/)).toBeInTheDocument();
    expect(within(augustExpense as HTMLElement).getByText(/R\$\s*600,00/)).toBeInTheDocument();
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