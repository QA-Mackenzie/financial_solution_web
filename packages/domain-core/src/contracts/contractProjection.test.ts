import { describe, expect, it } from 'vitest';

import {
  buildProjectedContractOccurrences,
  getProjectedTotalsByMonth,
} from './contractProjection';

describe('buildProjectedContractOccurrences', () => {
  it('projects active monthly contracts across the requested horizon', () => {
    const occurrences = buildProjectedContractOccurrences(
      {
        activeContracts: [
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
            amountInCents: 350000,
            dueDay: 5,
            startDate: '2026-04-01',
            endDate: null,
            status: 'active',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        inactiveContracts: [],
        totalActiveIncomeInCents: 350000,
        totalActiveExpenseInCents: 15990,
        netActiveAmountInCents: 334010,
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
      },
    );

    expect(occurrences.map((occurrence) => occurrence.occurrenceDate)).toEqual([
      '2026-04-05',
      '2026-04-10',
      '2026-05-05',
      '2026-05-10',
      '2026-06-05',
      '2026-06-10',
    ]);
    expect(
      occurrences.map((occurrence) => occurrence.signedAmountInCents),
    ).toEqual([350000, -15990, 350000, -15990, 350000, -15990]);
  });

  it('skips the starting month when the contract starts after the due day and clips long months', () => {
    const occurrences = buildProjectedContractOccurrences(
      {
        activeContracts: [
          {
            id: 'contract-1',
            accountId: 'account-1',
            accountName: 'Conta principal',
            name: 'Academia',
            category: 'Saude',
            type: 'expense',
            amountInCents: 9900,
            dueDay: 31,
            startDate: '2026-04-30',
            endDate: null,
            status: 'active',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
          {
            id: 'contract-2',
            accountId: 'account-1',
            accountName: 'Conta principal',
            name: 'Streaming',
            category: 'Lazer',
            type: 'expense',
            amountInCents: 3990,
            dueDay: 10,
            startDate: '2026-04-15',
            endDate: null,
            status: 'active',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        inactiveContracts: [],
        totalActiveIncomeInCents: 0,
        totalActiveExpenseInCents: 13890,
        netActiveAmountInCents: -13890,
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
      },
    );

    expect(occurrences.map((occurrence) => occurrence.id)).toEqual([
      'contract-1:2026-04-30',
      'contract-2:2026-05-10',
      'contract-1:2026-05-31',
      'contract-2:2026-06-10',
      'contract-1:2026-06-30',
    ]);
  });

  it('ignores inactive contracts and groups projected expenses by month', () => {
    const occurrences = buildProjectedContractOccurrences(
      {
        activeContracts: [
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
        ],
        inactiveContracts: [
          {
            id: 'contract-2',
            accountId: 'account-1',
            accountName: 'Conta principal',
            name: 'Curso antigo',
            category: 'Educacao',
            type: 'income',
            amountInCents: 5000,
            dueDay: 5,
            startDate: '2026-01-01',
            endDate: null,
            status: 'inactive',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        totalActiveIncomeInCents: 0,
        totalActiveExpenseInCents: 15990,
        netActiveAmountInCents: -15990,
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 2,
      },
    );

    expect(occurrences).toHaveLength(2);
    expect(getProjectedTotalsByMonth(occurrences)).toEqual({
      '2026-04': {
        incomeInCents: 0,
        expenseInCents: 15990,
      },
      '2026-05': {
        incomeInCents: 0,
        expenseInCents: 15990,
      },
    });
  });

  it('applies scheduled adjustments only from the effective date forward and keeps past months unchanged', () => {
    const occurrences = buildProjectedContractOccurrences(
      {
        activeContracts: [
          {
            id: 'contract-1',
            accountId: 'account-1',
            accountName: 'Conta principal',
            name: 'Aluguel',
            category: 'Casa',
            type: 'expense',
            amountInCents: 150000,
            dueDay: 10,
            startDate: '2026-04-01',
            endDate: null,
            adjustments: [
              {
                id: 'adjustment-1',
                contractId: 'contract-1',
                amountInCents: 170000,
                effectiveStartDate: '2026-06-01',
                createdAt: '2026-05-15T00:00:00.000Z',
              },
            ],
            status: 'active',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-05-15T00:00:00.000Z',
          },
        ],
        inactiveContracts: [],
        totalActiveIncomeInCents: 0,
        totalActiveExpenseInCents: 150000,
        netActiveAmountInCents: -150000,
      },
      {
        currentDate: '2026-05-20',
        totalMonths: 3,
      },
    );

    expect(occurrences.map((occurrence) => occurrence.amountInCents)).toEqual([
      150000, 170000, 170000,
    ]);
    expect(occurrences.map((occurrence) => occurrence.occurrenceDate)).toEqual([
      '2026-05-10',
      '2026-06-10',
      '2026-07-10',
    ]);
  });

  it('removes only occurrences after the contract end date', () => {
    const occurrences = buildProjectedContractOccurrences(
      {
        activeContracts: [
          {
            id: 'contract-1',
            accountId: 'account-1',
            accountName: 'Conta principal',
            name: 'Academia',
            category: 'Saude',
            type: 'expense',
            amountInCents: 9900,
            dueDay: 20,
            startDate: '2026-04-01',
            endDate: '2026-06-25',
            status: 'active',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-06-01T00:00:00.000Z',
          },
        ],
        inactiveContracts: [],
        totalActiveIncomeInCents: 0,
        totalActiveExpenseInCents: 9900,
        netActiveAmountInCents: -9900,
      },
      {
        currentDate: '2026-05-01',
        totalMonths: 4,
      },
    );

    expect(occurrences.map((occurrence) => occurrence.occurrenceDate)).toEqual([
      '2026-05-20',
      '2026-06-20',
    ]);
  });
});
