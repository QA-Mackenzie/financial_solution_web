import {
  buildFinancialHorizon,
  classifyHorizonBalance,
  type FinancialHorizon,
  type FinancialHorizonMonth,
} from '../horizon/financialHorizon';
import type {
  ProjectedProvisionOccurrence,
  ProvisionListItem,
  ProvisionsSnapshot,
} from '@economy-cash/contracts';

export interface BuildProjectedProvisionOccurrencesOptions {
  currentDate?: string;
  totalMonths?: number;
}

export interface ProvisionAdjustedFinancialHorizonMonth extends FinancialHorizonMonth {
  cashOpeningBalanceInCents: number;
  cashClosingBalanceInCents: number;
  provisionAllocationInCents: number;
  provisionReleaseInCents: number;
  provisionReservedBalanceInCents: number;
}

export interface ProvisionAdjustedFinancialHorizon {
  months: ProvisionAdjustedFinancialHorizonMonth[];
}

const DEFAULT_TOTAL_MONTHS = 24;

const toMonthStart = (value: string) => `${value.slice(0, 7)}-01`;

const addMonths = (monthStart: string, delta: number) => {
  const [year, month] = monthStart.slice(0, 7).split('-').map(Number);
  const absoluteMonth = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(absoluteMonth / 12);
  const nextMonth = (absoluteMonth % 12) + 1;

  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
};

const getMonthDistance = (startMonth: string, endMonth: string) => {
  const [startYear, startValue] = startMonth.slice(0, 7).split('-').map(Number);
  const [endYear, endValue] = endMonth.slice(0, 7).split('-').map(Number);

  return (endYear - startYear) * 12 + (endValue - startValue);
};

const splitAmountAcrossMonths = (
  totalAmountInCents: number,
  monthCount: number,
) => {
  const baseAmountInCents = Math.floor(totalAmountInCents / monthCount);
  const remainderInCents = totalAmountInCents % monthCount;

  return Array.from(
    { length: monthCount },
    (_unused, index) => baseAmountInCents + (index < remainderInCents ? 1 : 0),
  );
};

const buildProvisionOccurrences = (
  provision: ProvisionListItem,
  options: BuildProjectedProvisionOccurrencesOptions,
) => {
  const releaseMonth = toMonthStart(
    provision.redeemedAt ?? provision.targetDate,
  );
  const startMonth = toMonthStart(provision.startDate);
  const currentMonth = toMonthStart(
    options.currentDate ?? new Date().toISOString().slice(0, 10),
  );
  const allocationStartMonth =
    startMonth < currentMonth ? startMonth : startMonth;
  const allocationMonthCount = Math.max(
    1,
    getMonthDistance(allocationStartMonth, releaseMonth) || 1,
  );
  const allocationAmounts = splitAmountAcrossMonths(
    provision.targetAmountInCents,
    allocationMonthCount,
  );
  const occurrences: ProjectedProvisionOccurrence[] = allocationAmounts.map(
    (amountInCents, index) => {
      const occurrenceDate = addMonths(allocationStartMonth, index);

      return {
        id: `${provision.id}:allocation:${occurrenceDate}`,
        provisionId: provision.id,
        accountId: provision.accountId,
        accountName: provision.accountName,
        description: provision.description,
        category: provision.category,
        amountInCents,
        occurrenceDate,
        kind: 'allocation',
      };
    },
  );

  occurrences.push({
    id: `${provision.id}:release:${releaseMonth}`,
    provisionId: provision.id,
    accountId: provision.accountId,
    accountName: provision.accountName,
    description: provision.description,
    category: provision.category,
    amountInCents: provision.targetAmountInCents,
    occurrenceDate: releaseMonth,
    kind: 'release',
  });

  return occurrences;
};

export const buildProjectedProvisionOccurrences = (
  provisionsSnapshot: ProvisionsSnapshot,
  options: BuildProjectedProvisionOccurrencesOptions = {},
): ProjectedProvisionOccurrence[] => {
  const totalMonths = options.totalMonths ?? DEFAULT_TOTAL_MONTHS;

  if (totalMonths <= 0 || !Number.isInteger(totalMonths)) {
    throw new Error(
      'A projecao de provisoes precisa de um numero inteiro positivo de meses.',
    );
  }

  const currentMonth = toMonthStart(
    options.currentDate ?? new Date().toISOString().slice(0, 10),
  );
  const horizonEndMonth = addMonths(currentMonth, totalMonths - 1);

  return provisionsSnapshot.activeProvisions
    .flatMap((provision) => buildProvisionOccurrences(provision, options))
    .filter((occurrence) => occurrence.occurrenceDate <= horizonEndMonth)
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.kind.localeCompare(right.kind) ||
        left.description.localeCompare(right.description) ||
        left.id.localeCompare(right.id),
    );
};

export const buildProvisionAdjustedHorizon = (
  horizon: FinancialHorizon,
  projectedProvisionOccurrences: ProjectedProvisionOccurrence[],
  safetyMarginInCents: number,
): ProvisionAdjustedFinancialHorizon => {
  if (horizon.months.length === 0) {
    return { months: [] };
  }

  const firstMonthStart = horizon.months[0].monthStart;
  const movementsByMonth = projectedProvisionOccurrences.reduce<
    Record<string, { allocationInCents: number; releaseInCents: number }>
  >((result, occurrence) => {
    const currentMonth = result[occurrence.occurrenceDate] ?? {
      allocationInCents: 0,
      releaseInCents: 0,
    };

    if (occurrence.kind === 'allocation') {
      currentMonth.allocationInCents += occurrence.amountInCents;
    } else {
      currentMonth.releaseInCents += occurrence.amountInCents;
    }

    result[occurrence.occurrenceDate] = currentMonth;

    return result;
  }, {});

  let runningReservedBalanceInCents = projectedProvisionOccurrences.reduce(
    (total, occurrence) => {
      if (occurrence.occurrenceDate >= firstMonthStart) {
        return total;
      }

      return occurrence.kind === 'allocation'
        ? total + occurrence.amountInCents
        : total - occurrence.amountInCents;
    },
    0,
  );

  return {
    months: horizon.months.map((month) => {
      const currentMovement = movementsByMonth[month.monthStart] ?? {
        allocationInCents: 0,
        releaseInCents: 0,
      };
      const availableOpeningBalanceInCents =
        month.openingBalanceInCents - runningReservedBalanceInCents;

      runningReservedBalanceInCents = Math.max(
        0,
        runningReservedBalanceInCents +
          currentMovement.allocationInCents -
          currentMovement.releaseInCents,
      );

      const availableClosingBalanceInCents =
        month.closingBalanceInCents - runningReservedBalanceInCents;

      return {
        ...month,
        openingBalanceInCents: availableOpeningBalanceInCents,
        closingBalanceInCents: availableClosingBalanceInCents,
        cashOpeningBalanceInCents: month.openingBalanceInCents,
        cashClosingBalanceInCents: month.closingBalanceInCents,
        provisionAllocationInCents: currentMovement.allocationInCents,
        provisionReleaseInCents: currentMovement.releaseInCents,
        provisionReservedBalanceInCents: runningReservedBalanceInCents,
        riskLevel: classifyHorizonBalance(
          availableClosingBalanceInCents,
          safetyMarginInCents,
        ),
      } satisfies ProvisionAdjustedFinancialHorizonMonth;
    }),
  };
};

export const buildProvisionAdjustedHorizonFromSnapshots = (
  horizonBuilderInput: Parameters<typeof buildFinancialHorizon>,
  provisionsSnapshot: ProvisionsSnapshot,
  safetyMarginInCents: number,
  options: BuildProjectedProvisionOccurrencesOptions = {},
) => {
  const baseHorizon = buildFinancialHorizon(
    horizonBuilderInput[0],
    horizonBuilderInput[1],
    horizonBuilderInput[2],
  );

  return buildProvisionAdjustedHorizon(
    baseHorizon,
    buildProjectedProvisionOccurrences(provisionsSnapshot, options),
    safetyMarginInCents,
  );
};

