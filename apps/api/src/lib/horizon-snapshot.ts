import type {
  AccountsSnapshot,
  CreditCardsSnapshot,
  ContractsSnapshot,
  HorizonSettings,
  HorizonSnapshot,
  InstallmentsSnapshot,
  ProvisionsSnapshot,
  TransactionsSnapshot,
  VariableExpenseOverride,
} from '@economy-cash/contracts';
import {
  buildFinancialHorizon,
  buildProjectedProvisionOccurrences,
  buildProjectedContractOccurrences,
  buildProvisionAdjustedHorizon,
  buildProjectedVariableExpenseOccurrences,
} from '@economy-cash/domain-core';

export const OFFICIAL_HORIZON_TOTAL_MONTHS = 24;

type BuildOfficialHorizonSnapshotInput = {
  accountsSnapshot: AccountsSnapshot;
  creditCardsSnapshot: CreditCardsSnapshot;
  contractsSnapshot: ContractsSnapshot;
  generatedAt: string;
  installmentsSnapshot: InstallmentsSnapshot;
  provisionsSnapshot?: ProvisionsSnapshot;
  referenceDate: string;
  settings: HorizonSettings;
  transactionsSnapshot: TransactionsSnapshot;
  variableExpenseOverrides?: VariableExpenseOverride[];
};

export function buildOfficialHorizonSnapshot({
  accountsSnapshot,
  creditCardsSnapshot,
  contractsSnapshot,
  generatedAt,
  installmentsSnapshot,
  provisionsSnapshot = {
    activeProvisions: [],
    redeemedProvisions: [],
    totalActiveTargetAmountInCents: 0,
  },
  referenceDate,
  settings,
  transactionsSnapshot,
  variableExpenseOverrides = [],
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
      overrides: variableExpenseOverrides,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      windowInMonths: settings.variableExpenseWindowInMonths,
    });
  const projectedProvisionOccurrences = buildProjectedProvisionOccurrences(
    provisionsSnapshot,
    {
      currentDate: referenceDate,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
    },
  );
  const baseHorizon = buildFinancialHorizon(accountsSnapshot, transactionsSnapshot, {
    currentDate: referenceDate,
    projectedCreditCardInvoiceOccurrences: creditCardsSnapshot.projectedInvoices,
    projectedContractOccurrences,
    projectedInstallmentOccurrences:
      installmentsSnapshot.projectedAccountOccurrences,
    totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
    safetyMarginInCents: settings.safetyMarginInCents,
    projectedVariableExpenseOccurrences,
  });

  return {
    generatedAt,
    horizon:
      projectedProvisionOccurrences.length > 0
        ? buildProvisionAdjustedHorizon(
            baseHorizon,
            projectedProvisionOccurrences,
            settings.safetyMarginInCents,
          )
        : baseHorizon,
    settings,
  };
}