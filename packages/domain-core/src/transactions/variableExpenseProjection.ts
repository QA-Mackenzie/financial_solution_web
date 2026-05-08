import type { AccountsSnapshot } from '@shf/contracts';
import {
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
  MAX_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
  MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@shf/contracts';
import type {
  ProjectedVariableExpenseOccurrence,
  TransactionsSnapshot,
  VariableExpenseOverride,
} from '@shf/contracts';

export interface BuildProjectedVariableExpenseOccurrencesOptions {
  currentDate?: string;
  overrides?: VariableExpenseOverride[];
  windowInMonths?: number;
  totalMonths?: number;
}

interface VariableExpenseSeries {
  accountId: string;
  accountName: string;
  description: string;
  normalizedDescription: string;
  lastTransactionDate: string;
  monthlyTotals: Map<string, number>;
}

const DEFAULT_TOTAL_MONTHS = 24;

export const normalizeVariableExpenseDescription = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const buildOverrideKey = (
  accountId: string,
  description: string,
  occurrenceDate: string,
) =>
  `${accountId}:${normalizeVariableExpenseDescription(description)}:${occurrenceDate}`;

const getCurrentMonthReference = (currentDate?: string) => {
  const reference = currentDate
    ? new Date(`${currentDate}T00:00:00.000Z`)
    : new Date();

  if (Number.isNaN(reference.valueOf())) {
    throw new Error('A data de referencia da media movel e invalida.');
  }

  return {
    year: reference.getUTCFullYear(),
    monthIndex: reference.getUTCMonth(),
  };
};

const toMonthStart = (year: number, monthIndex: number) =>
  `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-01`;

const toMonthKey = (value: string) => value.slice(0, 7);

const getDaysInMonth = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const toOccurrenceDate = (
  year: number,
  monthIndex: number,
  preferredDay: number,
) => {
  const boundedDay = Math.min(preferredDay, getDaysInMonth(year, monthIndex));

  return `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(
    boundedDay,
  ).padStart(2, '0')}`;
};

const getMedian = (values: number[]) => {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 !== 0) {
    return sortedValues[middleIndex] ?? 0;
  }

  return Math.round(
    ((sortedValues[middleIndex - 1] ?? 0) + (sortedValues[middleIndex] ?? 0)) /
      2,
  );
};

const toHistoricalMonthKeys = (
  currentYear: number,
  currentMonthIndex: number,
  windowInMonths: number,
) => {
  const currentAbsoluteMonth = currentYear * 12 + currentMonthIndex;

  return Array.from({ length: windowInMonths }, (_unused, index) => {
    const absoluteMonth = currentAbsoluteMonth - windowInMonths + index;
    const year = Math.floor(absoluteMonth / 12);
    const monthIndex = absoluteMonth % 12;

    return toMonthStart(year, monthIndex).slice(0, 7);
  });
};

const buildVariableExpenseSeries = (
  accountsSnapshot: AccountsSnapshot,
  transactionsSnapshot: TransactionsSnapshot,
  historicalMonthKeys: string[],
) => {
  const activeAccountIds = new Set(
    accountsSnapshot.activeAccounts.map((account) => account.id),
  );
  const historicalMonths = new Set(historicalMonthKeys);
  const seriesByKey = new Map<string, VariableExpenseSeries>();

  for (const transaction of transactionsSnapshot.transactions) {
    if (transaction.type !== 'expense') {
      continue;
    }

    if (!activeAccountIds.has(transaction.accountId)) {
      continue;
    }

    const monthKey = toMonthKey(transaction.transactionDate);

    if (!historicalMonths.has(monthKey)) {
      continue;
    }

    const normalizedDescription = normalizeVariableExpenseDescription(
      transaction.description,
    );

    if (!normalizedDescription) {
      continue;
    }

    const seriesKey = `${transaction.accountId}:${normalizedDescription}`;
    const currentSeries = seriesByKey.get(seriesKey) ?? {
      accountId: transaction.accountId,
      accountName: transaction.accountName,
      description: transaction.description.trim(),
      normalizedDescription,
      lastTransactionDate: transaction.transactionDate,
      monthlyTotals: new Map<string, number>(),
    };

    currentSeries.monthlyTotals.set(
      monthKey,
      (currentSeries.monthlyTotals.get(monthKey) ?? 0) +
        transaction.amountInCents,
    );

    if (transaction.transactionDate >= currentSeries.lastTransactionDate) {
      currentSeries.description = transaction.description.trim();
      currentSeries.lastTransactionDate = transaction.transactionDate;
      currentSeries.accountName = transaction.accountName;
    }

    seriesByKey.set(seriesKey, currentSeries);
  }

  return [...seriesByKey.values()];
};

const isEligibleSeries = (
  series: VariableExpenseSeries,
  historicalMonthKeys: string[],
) => {
  const observedMonthKeys = historicalMonthKeys.filter((monthKey) =>
    series.monthlyTotals.has(monthKey),
  );
  const mostRecentHistoricalMonth =
    historicalMonthKeys[historicalMonthKeys.length - 1];

  return (
    observedMonthKeys.length >= 2 &&
    Boolean(mostRecentHistoricalMonth) &&
    series.monthlyTotals.has(mostRecentHistoricalMonth)
  );
};

const estimateSeriesAmountInCents = (
  series: VariableExpenseSeries,
  historicalMonthKeys: string[],
) => {
  const observedValues = historicalMonthKeys
    .map((monthKey) => series.monthlyTotals.get(monthKey))
    .filter((value): value is number => typeof value === 'number');

  const median = getMedian(observedValues);
  const outlierCap = median > 0 ? median * 2 : Number.POSITIVE_INFINITY;
  const adjustedValues = observedValues.map((value) =>
    Math.min(value, outlierCap),
  );

  return Math.round(
    adjustedValues.reduce((sum, value) => sum + value, 0) /
      adjustedValues.length,
  );
};

const createOverrideMap = (overrides: VariableExpenseOverride[]) =>
  overrides.reduce<Map<string, VariableExpenseOverride>>((map, override) => {
    if (
      !Number.isInteger(override.amountInCents) ||
      override.amountInCents <= 0 ||
      !override.occurrenceDate ||
      !override.accountId ||
      !normalizeVariableExpenseDescription(override.description)
    ) {
      return map;
    }

    map.set(
      buildOverrideKey(
        override.accountId,
        override.description,
        override.occurrenceDate,
      ),
      override,
    );

    return map;
  }, new Map<string, VariableExpenseOverride>());

export const buildProjectedVariableExpenseOccurrences = (
  accountsSnapshot: AccountsSnapshot,
  transactionsSnapshot: TransactionsSnapshot,
  options: BuildProjectedVariableExpenseOccurrencesOptions = {},
): ProjectedVariableExpenseOccurrence[] => {
  const totalMonths = options.totalMonths ?? DEFAULT_TOTAL_MONTHS;
  const windowInMonths =
    options.windowInMonths ?? DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS;

  if (totalMonths <= 0 || !Number.isInteger(totalMonths)) {
    throw new Error(
      'A projecao de despesas variaveis precisa de um numero inteiro positivo de meses.',
    );
  }

  if (
    !Number.isInteger(windowInMonths) ||
    windowInMonths < MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS ||
    windowInMonths > MAX_VARIABLE_EXPENSE_WINDOW_IN_MONTHS
  ) {
    throw new Error('A janela da media movel precisa estar entre 3 e 6 meses.');
  }

  const { year: currentYear, monthIndex: currentMonthIndex } =
    getCurrentMonthReference(options.currentDate);
  const historicalMonthKeys = toHistoricalMonthKeys(
    currentYear,
    currentMonthIndex,
    windowInMonths,
  );
  const series = buildVariableExpenseSeries(
    accountsSnapshot,
    transactionsSnapshot,
    historicalMonthKeys,
  );
  const overridesByKey = createOverrideMap(options.overrides ?? []);

  return series
    .filter((currentSeries) =>
      isEligibleSeries(currentSeries, historicalMonthKeys),
    )
    .flatMap((currentSeries) => {
      const preferredDay = Number.parseInt(
        currentSeries.lastTransactionDate.slice(8, 10),
        10,
      );
      const amountInCents = estimateSeriesAmountInCents(
        currentSeries,
        historicalMonthKeys,
      );
      const historyMonthCount = historicalMonthKeys.filter((monthKey) =>
        currentSeries.monthlyTotals.has(monthKey),
      ).length;

      return Array.from(
        { length: Math.max(totalMonths - 1, 0) },
        (_unused, index) => {
          const offset = index + 1;
          const absoluteMonthIndex = currentMonthIndex + offset;
          const year = currentYear + Math.floor(absoluteMonthIndex / 12);
          const monthIndex = absoluteMonthIndex % 12;
          const occurrenceDate = toOccurrenceDate(
            year,
            monthIndex,
            preferredDay,
          );
          const override = overridesByKey.get(
            buildOverrideKey(
              currentSeries.accountId,
              currentSeries.description,
              occurrenceDate,
            ),
          );
          const resolvedAmountInCents =
            override?.amountInCents ?? amountInCents;

          return {
            id: `${currentSeries.accountId}:${currentSeries.normalizedDescription}:${occurrenceDate}`,
            accountId: currentSeries.accountId,
            accountName: currentSeries.accountName,
            description: currentSeries.description,
            amountInCents: resolvedAmountInCents,
            signedAmountInCents: -resolvedAmountInCents,
            occurrenceDate,
            historyMonthCount,
            windowInMonths,
            source: override ? 'manualOverride' : 'movingAverage',
          } satisfies ProjectedVariableExpenseOccurrence;
        },
      );
    })
    .sort(
      (left, right) =>
        left.occurrenceDate.localeCompare(right.occurrenceDate) ||
        left.accountName.localeCompare(right.accountName) ||
        left.description.localeCompare(right.description) ||
        left.id.localeCompare(right.id),
    );
};

