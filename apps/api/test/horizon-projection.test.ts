import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@shf/contracts';
import {
  buildFinancialHorizon,
  marginPressureFixture,
  multiAccountConsolidatedFixture,
  positiveTrajectoryFixture,
} from '@shf/domain-core';
import { describe, expect, it } from 'vitest';

import { buildOfficialHorizonSnapshot } from '../src/lib/horizon-snapshot';

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
});