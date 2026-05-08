import { describe, expect, it } from 'vitest';

import type { AccountsSnapshot } from '@economy-cash/contracts';
import type { TransactionsSnapshot } from '@economy-cash/contracts';
import { buildProjectedVariableExpenseOccurrences } from './variableExpenseProjection';

const accountsSnapshot: AccountsSnapshot = {
  consolidatedBalanceInCents: 100000,
  activeAccounts: [
    {
      id: 'checking',
      name: 'Conta principal',
      type: 'checking',
      openingBalanceInCents: 100000,
      currentBalanceInCents: 100000,
      isArchived: false,
      archivedAt: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    },
  ],
  archivedAccounts: [],
};

const createExpense = (
  id: string,
  transactionDate: string,
  amountInCents: number,
  description: string,
) => ({
  id,
  accountId: 'checking',
  accountName: 'Conta principal',
  type: 'expense' as const,
  description,
  amountInCents,
  signedAmountInCents: -amountInCents,
  transactionDate,
  createdAt: `${transactionDate}T10:00:00.000Z`,
  updatedAt: `${transactionDate}T10:00:00.000Z`,
});

const createTransactionsSnapshot = (
  transactions: TransactionsSnapshot['transactions'],
): TransactionsSnapshot => ({
  transactions,
  totalIncomeInCents: 0,
  totalExpenseInCents: transactions.reduce(
    (sum, transaction) => sum + transaction.amountInCents,
    0,
  ),
});

describe('buildProjectedVariableExpenseOccurrences', () => {
  it('projects future expenses from the configured moving-average window', () => {
    const occurrences = buildProjectedVariableExpenseOccurrences(
      accountsSnapshot,
      createTransactionsSnapshot([
        createExpense('market-1', '2026-01-12', 10000, 'Supermercado'),
        createExpense('market-2', '2026-02-12', 12000, 'Supermercado'),
        createExpense('market-3', '2026-03-12', 14000, 'Supermercado'),
      ]),
      {
        currentDate: '2026-04-26',
        windowInMonths: 3,
        totalMonths: 4,
      },
    );

    expect(occurrences).toEqual([
      {
        id: 'checking:supermercado:2026-05-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 12000,
        signedAmountInCents: -12000,
        occurrenceDate: '2026-05-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
      {
        id: 'checking:supermercado:2026-06-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 12000,
        signedAmountInCents: -12000,
        occurrenceDate: '2026-06-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
      {
        id: 'checking:supermercado:2026-07-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 12000,
        signedAmountInCents: -12000,
        occurrenceDate: '2026-07-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
    ]);
  });

  it('applies a manual override only to the selected future month', () => {
    const occurrences = buildProjectedVariableExpenseOccurrences(
      accountsSnapshot,
      createTransactionsSnapshot([
        createExpense('market-1', '2026-01-12', 10000, 'Supermercado'),
        createExpense('market-2', '2026-02-12', 12000, 'Supermercado'),
        createExpense('market-3', '2026-03-12', 14000, 'Supermercado'),
      ]),
      {
        currentDate: '2026-04-26',
        windowInMonths: 3,
        totalMonths: 4,
        overrides: [
          {
            accountId: 'checking',
            description: '  supermercado ',
            occurrenceDate: '2026-05-12',
            amountInCents: 18500,
          },
        ],
      },
    );

    expect(occurrences).toEqual([
      {
        id: 'checking:supermercado:2026-05-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 18500,
        signedAmountInCents: -18500,
        occurrenceDate: '2026-05-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'manualOverride',
      },
      {
        id: 'checking:supermercado:2026-06-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 12000,
        signedAmountInCents: -12000,
        occurrenceDate: '2026-06-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
      {
        id: 'checking:supermercado:2026-07-12',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Supermercado',
        amountInCents: 12000,
        signedAmountInCents: -12000,
        occurrenceDate: '2026-07-12',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
    ]);
  });

  it('ignores short series and averages only valid months when there is a gap', () => {
    const occurrences = buildProjectedVariableExpenseOccurrences(
      accountsSnapshot,
      createTransactionsSnapshot([
        createExpense('energy-1', '2026-01-05', 10000, 'Energia'),
        createExpense('energy-2', '2026-03-05', 20000, 'Energia'),
        createExpense('coffee-1', '2026-03-20', 5000, 'Cafe'),
      ]),
      {
        currentDate: '2026-04-26',
        windowInMonths: 3,
        totalMonths: 2,
      },
    );

    expect(occurrences).toEqual([
      {
        id: 'checking:energia:2026-05-05',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Energia',
        amountInCents: 15000,
        signedAmountInCents: -15000,
        occurrenceDate: '2026-05-05',
        historyMonthCount: 2,
        windowInMonths: 3,
        source: 'movingAverage',
      },
    ]);
  });

  it('caps simple outliers before calculating the moving average', () => {
    const occurrences = buildProjectedVariableExpenseOccurrences(
      accountsSnapshot,
      createTransactionsSnapshot([
        createExpense('fuel-1', '2026-01-08', 10000, 'Combustivel'),
        createExpense('fuel-2', '2026-02-08', 11000, 'Combustivel'),
        createExpense('fuel-3', '2026-03-08', 50000, 'Combustivel'),
      ]),
      {
        currentDate: '2026-04-26',
        windowInMonths: 3,
        totalMonths: 2,
      },
    );

    expect(occurrences).toEqual([
      {
        id: 'checking:combustivel:2026-05-08',
        accountId: 'checking',
        accountName: 'Conta principal',
        description: 'Combustivel',
        amountInCents: 14333,
        signedAmountInCents: -14333,
        occurrenceDate: '2026-05-08',
        historyMonthCount: 3,
        windowInMonths: 3,
        source: 'movingAverage',
      },
    ]);
  });
});

