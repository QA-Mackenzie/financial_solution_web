import type {
  ContractAdjustment,
  ContractsSnapshot,
  ProjectedContractOccurrence,
} from '@shf/contracts';

export interface BuildProjectedContractOccurrencesOptions {
  currentDate?: string;
  totalMonths?: number;
}

const DEFAULT_TOTAL_MONTHS = 24;

const getCurrentMonthReference = (currentDate?: string) => {
  const reference = currentDate
    ? new Date(`${currentDate}T00:00:00.000Z`)
    : new Date();

  if (Number.isNaN(reference.valueOf())) {
    throw new Error('A data de referencia das recorrencias e invalida.');
  }

  return {
    year: reference.getUTCFullYear(),
    monthIndex: reference.getUTCMonth(),
  };
};

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const toOccurrenceDate = (year: number, monthIndex: number, dueDay: number) => {
  const boundedDay = Math.min(dueDay, getDaysInMonth(year, monthIndex));

  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(
    boundedDay,
  ).padStart(2, '0')}`;
};

const getApplicableAdjustment = (
  adjustments: ContractAdjustment[],
  occurrenceDate: string,
) =>
  adjustments
    .slice()
    .sort(
      (left, right) =>
        left.effectiveStartDate.localeCompare(right.effectiveStartDate) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .reduce<ContractAdjustment | null>((currentAdjustment, adjustment) => {
      if (adjustment.effectiveStartDate > occurrenceDate) {
        return currentAdjustment;
      }

      return adjustment;
    }, null);

export const buildProjectedContractOccurrences = (
  contractsSnapshot: ContractsSnapshot,
  options: BuildProjectedContractOccurrencesOptions = {},
): ProjectedContractOccurrence[] => {
  const totalMonths = options.totalMonths ?? DEFAULT_TOTAL_MONTHS;

  if (totalMonths <= 0 || !Number.isInteger(totalMonths)) {
    throw new Error(
      'A projecao de contratos precisa de um numero inteiro positivo de meses.',
    );
  }

  const { year: startYear, monthIndex: startMonthIndex } =
    getCurrentMonthReference(options.currentDate);

  return contractsSnapshot.activeContracts
    .flatMap((contract) =>
      Array.from({ length: totalMonths }, (_unused, offset) => {
        const absoluteMonthIndex = startMonthIndex + offset;
        const year = startYear + Math.floor(absoluteMonthIndex / 12);
        const monthIndex = absoluteMonthIndex % 12;
        const occurrenceDate = toOccurrenceDate(
          year,
          monthIndex,
          contract.dueDay,
        );

        if (occurrenceDate < contract.startDate) {
          return null;
        }

        if (contract.endDate && occurrenceDate > contract.endDate) {
          return null;
        }

        const applicableAdjustment = getApplicableAdjustment(
          contract.adjustments ?? [],
          occurrenceDate,
        );
        const amountInCents =
          applicableAdjustment?.amountInCents ?? contract.amountInCents;

        return {
          id: `${contract.id}:${occurrenceDate}`,
          contractId: contract.id,
          contractName: contract.name,
          accountId: contract.accountId,
          accountName: contract.accountName,
          category: contract.category,
          type: contract.type,
          amountInCents,
          signedAmountInCents:
            contract.type === 'income' ? amountInCents : -amountInCents,
          occurrenceDate,
        } satisfies ProjectedContractOccurrence;
      }),
    )
    .filter(
      (occurrence): occurrence is ProjectedContractOccurrence =>
        occurrence !== null,
    )
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.contractName.localeCompare(right.contractName) ||
        left.contractId.localeCompare(right.contractId),
    );
};

export const getProjectedTotalsByMonth = (
  occurrences: ProjectedContractOccurrence[],
) =>
  occurrences.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, occurrence) => {
    const monthKey = occurrence.occurrenceDate.slice(0, 7);
    const currentMonth = monthsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };

    if (occurrence.type === 'income') {
      currentMonth.incomeInCents += occurrence.amountInCents;
    } else {
      currentMonth.expenseInCents += occurrence.amountInCents;
    }

    monthsByKey[monthKey] = currentMonth;

    return monthsByKey;
  }, {});

