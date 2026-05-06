import type {
  AccountsSnapshot,
  HorizonSettings,
  HorizonSnapshot,
  TransactionsSnapshot,
} from '@shf/contracts';
import {
  buildFinancialHorizon,
  buildProjectedVariableExpenseOccurrences,
} from '@shf/domain-core';

export const OFFICIAL_HORIZON_TOTAL_MONTHS = 24;

type BuildOfficialHorizonSnapshotInput = {
  accountsSnapshot: AccountsSnapshot;
  generatedAt: string;
  referenceDate: string;
  settings: HorizonSettings;
  transactionsSnapshot: TransactionsSnapshot;
};

export function buildOfficialHorizonSnapshot({
  accountsSnapshot,
  generatedAt,
  referenceDate,
  settings,
  transactionsSnapshot,
}: BuildOfficialHorizonSnapshotInput): HorizonSnapshot {
  const projectedVariableExpenseOccurrences =
    buildProjectedVariableExpenseOccurrences(accountsSnapshot, transactionsSnapshot, {
      currentDate: referenceDate,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      windowInMonths: settings.variableExpenseWindowInMonths,
    });

  return {
    generatedAt,
    horizon: buildFinancialHorizon(accountsSnapshot, transactionsSnapshot, {
      currentDate: referenceDate,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      safetyMarginInCents: settings.safetyMarginInCents,
      projectedVariableExpenseOccurrences,
    }),
    settings,
  };
}