import { describe, expect, it } from 'vitest';

import {
  buildTransactionsSnapshot,
  getSignedAmountInCents,
} from './transactionSnapshot';

describe('getSignedAmountInCents', () => {
  it('converts expenses to negative values and incomes to positive values', () => {
    expect(
      getSignedAmountInCents({
        type: 'income',
        amountInCents: 120000,
      }),
    ).toBe(120000);

    expect(
      getSignedAmountInCents({
        type: 'expense',
        amountInCents: 4590,
      }),
    ).toBe(-4590);
  });
});

describe('buildTransactionsSnapshot', () => {
  it('sums total incomes and expenses independently', () => {
    const snapshot = buildTransactionsSnapshot([
      {
        id: '1',
        accountId: 'account-1',
        accountName: 'Conta principal',
        type: 'income',
        description: 'Salario',
        amountInCents: 500000,
        signedAmountInCents: 500000,
        transactionDate: '2026-04-24',
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
      {
        id: '2',
        accountId: 'account-1',
        accountName: 'Conta principal',
        type: 'expense',
        description: 'Aluguel',
        amountInCents: 180000,
        signedAmountInCents: -180000,
        transactionDate: '2026-04-25',
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:00:00.000Z',
      },
    ]);

    expect(snapshot.totalIncomeInCents).toBe(500000);
    expect(snapshot.totalExpenseInCents).toBe(180000);
    expect(snapshot.transactions).toHaveLength(2);
  });
});
