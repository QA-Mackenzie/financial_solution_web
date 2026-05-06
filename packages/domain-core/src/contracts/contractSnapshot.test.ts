import { describe, expect, it } from 'vitest';

import { buildContractsSnapshot } from './contractSnapshot';

describe('buildContractsSnapshot', () => {
  it('separates active and inactive contracts and totals active income, expense and net amounts', () => {
    const snapshot = buildContractsSnapshot([
      {
        id: 'contract-1',
        accountId: 'account-1',
        accountName: 'Conta principal',
        name: 'Internet fibra',
        category: 'Casa',
        type: 'expense',
        amountInCents: 15990,
        dueDay: 10,
        startDate: '2026-04-01',
        endDate: null,
        status: 'active',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'contract-2',
        accountId: 'account-1',
        accountName: 'Conta principal',
        name: 'Salario fixo',
        category: 'Trabalho',
        type: 'income',
        amountInCents: 450000,
        dueDay: 5,
        startDate: '2026-04-01',
        endDate: null,
        status: 'active',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      {
        id: 'contract-3',
        accountId: 'account-1',
        accountName: 'Conta principal',
        name: 'Curso antigo',
        category: 'Educacao',
        type: 'expense',
        amountInCents: 9000,
        dueDay: 5,
        startDate: '2026-01-01',
        endDate: null,
        status: 'inactive',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]);

    expect(snapshot.activeContracts).toHaveLength(2);
    expect(snapshot.inactiveContracts).toHaveLength(1);
    expect(snapshot.totalActiveIncomeInCents).toBe(450000);
    expect(snapshot.totalActiveExpenseInCents).toBe(15990);
    expect(snapshot.netActiveAmountInCents).toBe(434010);
  });

  it('treats contracts with a past end date as inactive from the reference date forward', () => {
    const snapshot = buildContractsSnapshot(
      [
        {
          id: 'contract-1',
          accountId: 'account-1',
          accountName: 'Conta principal',
          name: 'Internet fibra',
          category: 'Casa',
          type: 'expense',
          amountInCents: 15990,
          dueDay: 10,
          startDate: '2026-04-01',
          endDate: '2026-05-15',
          status: 'active',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      {
        currentDate: '2026-05-16',
      },
    );

    expect(snapshot.activeContracts).toHaveLength(0);
    expect(snapshot.inactiveContracts).toHaveLength(1);
    expect(snapshot.totalActiveExpenseInCents).toBe(0);
  });
});
