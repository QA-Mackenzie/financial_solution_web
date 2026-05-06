import type {
  AccountsSnapshot,
  ContractsSnapshot,
  HorizonSettings,
  HorizonSnapshot,
  TransactionsSnapshot,
} from '@shf/contracts';
import {
  buildFinancialHorizon,
  buildProjectedContractOccurrences,
  buildProjectedVariableExpenseOccurrences,
} from '@shf/domain-core';

export const OFFICIAL_HORIZON_TOTAL_MONTHS = 24;

type BuildOfficialHorizonSnapshotInput = {
  accountsSnapshot: AccountsSnapshot;
  contractsSnapshot: ContractsSnapshot;
  generatedAt: string;
  referenceDate: string;
  settings: HorizonSettings;
  transactionsSnapshot: TransactionsSnapshot;
};

export function buildOfficialHorizonSnapshot({
  accountsSnapshot,
  contractsSnapshot,
  generatedAt,
  referenceDate,
  settings,
  transactionsSnapshot,
}: BuildOfficialHorizonSnapshotInput): HorizonSnapshot {
  const projectedContractOccurrences = buildProjectedContractOccurrences(
    contractsSnapshot,
    {
      currentDate: referenceDate,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
    },
  );
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
      projectedContractOccurrences,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      safetyMarginInCents: settings.safetyMarginInCents,
      projectedVariableExpenseOccurrences,
    }),
    settings,
  };
}