import type {
  ContractListItem,
  ContractsSnapshot,
} from '@economy-cash/contracts';

export interface BuildContractsSnapshotOptions {
  currentDate?: string;
}

const toReferenceDate = (currentDate?: string) => {
  const reference = currentDate
    ? new Date(`${currentDate}T00:00:00.000Z`)
    : new Date();

  if (Number.isNaN(reference.valueOf())) {
    throw new Error(
      'A data de referencia do snapshot de contratos e invalida.',
    );
  }

  return reference.toISOString().slice(0, 10);
};

export const buildContractsSnapshot = (
  contracts: ContractListItem[],
  options: BuildContractsSnapshotOptions = {},
): ContractsSnapshot => {
  const referenceDate = toReferenceDate(options.currentDate);
  const activeContracts = contracts.filter(
    (contract) =>
      contract.status === 'active' &&
      (!contract.endDate || contract.endDate >= referenceDate),
  );
  const inactiveContracts = contracts.filter(
    (contract) =>
      contract.status !== 'active' ||
      (contract.endDate !== undefined &&
        contract.endDate !== null &&
        contract.endDate < referenceDate),
  );
  const totalActiveIncomeInCents = activeContracts
    .filter((contract) => contract.type === 'income')
    .reduce((sum, contract) => sum + contract.amountInCents, 0);
  const totalActiveExpenseInCents = activeContracts
    .filter((contract) => contract.type === 'expense')
    .reduce((sum, contract) => sum + contract.amountInCents, 0);

  return {
    activeContracts,
    inactiveContracts,
    totalActiveIncomeInCents,
    totalActiveExpenseInCents,
    netActiveAmountInCents:
      totalActiveIncomeInCents - totalActiveExpenseInCents,
  };
};

