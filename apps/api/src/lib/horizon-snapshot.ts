import type {
  AccountsSnapshot,
  CreditCardsSnapshot,
  ContractsSnapshot,
  HorizonSettings,
  HorizonSnapshot,
  InstallmentsSnapshot,
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
  creditCardsSnapshot: CreditCardsSnapshot;
  contractsSnapshot: ContractsSnapshot;
  generatedAt: string;
  installmentsSnapshot: InstallmentsSnapshot;
  referenceDate: string;
  settings: HorizonSettings;
  transactionsSnapshot: TransactionsSnapshot;
};

export function buildOfficialHorizonSnapshot({
  accountsSnapshot,
  creditCardsSnapshot,
  contractsSnapshot,
  generatedAt,
  installmentsSnapshot,
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
      projectedCreditCardInvoiceOccurrences: creditCardsSnapshot.projectedInvoices,
      projectedContractOccurrences,
      projectedInstallmentOccurrences:
        installmentsSnapshot.projectedAccountOccurrences,
      totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      safetyMarginInCents: settings.safetyMarginInCents,
      projectedVariableExpenseOccurrences,
    }),
    settings,
  };
}