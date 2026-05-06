import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@shf/contracts';
import {
  buildFinancialHorizon,
  buildProjectedContractOccurrences,
  marginPressureFixture,
  multiAccountConsolidatedFixture,
  positiveTrajectoryFixture,
} from '@shf/domain-core';
import { describe, expect, it } from 'vitest';

import { buildOfficialHorizonSnapshot } from '../src/lib/horizon-snapshot';

const emptyContractsSnapshot = {
  activeContracts: [],
  inactiveContracts: [],
  totalActiveIncomeInCents: 0,
  totalActiveExpenseInCents: 0,
  netActiveAmountInCents: 0,
};

describe('buildOfficialHorizonSnapshot', () => {
  it('preserva a trajetoria positiva da fixture oficial do dominio', () => {
    const settings = {
      safetyMarginInCents:
        positiveTrajectoryFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: positiveTrajectoryFixture.accountsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      referenceDate: positiveTrajectoryFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: positiveTrajectoryFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      positiveTrajectoryFixture.accountsSnapshot,
      positiveTrajectoryFixture.transactionsSnapshot,
      {
        ...positiveTrajectoryFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('preserva a regressao matematica de pressao de margem', () => {
    const settings = {
      safetyMarginInCents:
        marginPressureFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: marginPressureFixture.accountsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      referenceDate: marginPressureFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: marginPressureFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      marginPressureFixture.accountsSnapshot,
      marginPressureFixture.transactionsSnapshot,
      {
        ...marginPressureFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('mantem a consolidacao multi-conta da fixture oficial do dominio', () => {
    const settings = {
      safetyMarginInCents:
        multiAccountConsolidatedFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: multiAccountConsolidatedFixture.accountsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      referenceDate:
        multiAccountConsolidatedFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: multiAccountConsolidatedFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      multiAccountConsolidatedFixture.accountsSnapshot,
      multiAccountConsolidatedFixture.transactionsSnapshot,
      {
        ...multiAccountConsolidatedFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('integra contratos recorrentes com reajuste e encerramento ao horizonte oficial', () => {
    const contractsSnapshot = {
      activeContracts: [
        {
          id: 'contract-1',
          accountId: 'checking',
          accountName: 'Conta principal',
          name: 'Aluguel',
          category: 'Moradia',
          type: 'expense' as const,
          amountInCents: 120000,
          dueDay: 10,
          startDate: '2026-05-01',
          endDate: '2026-07-20',
          adjustments: [
            {
              id: 'adjustment-1',
              contractId: 'contract-1',
              amountInCents: 135000,
              effectiveStartDate: '2026-06-01',
              createdAt: '2026-05-15T00:00:00.000Z',
            },
          ],
          status: 'active' as const,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-15T00:00:00.000Z',
        },
      ],
      inactiveContracts: [],
      totalActiveIncomeInCents: 0,
      totalActiveExpenseInCents: 120000,
      netActiveAmountInCents: -120000,
    };
    const settings = {
      safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      contractsSnapshot,
      generatedAt: '2026-05-20T12:00:00.000Z',
      referenceDate: '2026-05-20',
      settings,
      transactionsSnapshot: {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
    });

    const expected = buildFinancialHorizon(
      {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-05-20',
        totalMonths: 24,
        safetyMarginInCents: settings.safetyMarginInCents,
        projectedContractOccurrences: buildProjectedContractOccurrences(
          contractsSnapshot,
          {
            currentDate: '2026-05-20',
            totalMonths: 24,
          },
        ),
      },
    );

    expect(snapshot.horizon.months.slice(0, 4)).toEqual(
      expected.months.slice(0, 4),
    );
    expect(snapshot.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual(
      [120000, 135000, 135000, 0],
    );
  });
});