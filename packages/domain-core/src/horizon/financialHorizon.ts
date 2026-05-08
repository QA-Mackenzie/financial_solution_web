import type { AccountsSnapshot } from '@economy-cash/contracts';
import type { ProjectedContractOccurrence } from '@economy-cash/contracts';
import type { ProjectedCreditCardInvoiceOccurrence } from '@economy-cash/contracts';
import type { ProjectedInstallmentOccurrence } from '@economy-cash/contracts';
import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  type HorizonRiskLevel,
} from '@economy-cash/contracts';
import type {
  ProjectedVariableExpenseOccurrence,
  TransactionListItem,
  TransactionsSnapshot,
} from '@economy-cash/contracts';

export interface FinancialHorizonMonth {
  id: string;
  monthStart: string;
  openingBalanceInCents: number;
  incomeInCents: number;
  expenseInCents: number;
  closingBalanceInCents: number;
  riskLevel: HorizonRiskLevel;
}

export interface FinancialHorizon {
  months: FinancialHorizonMonth[];
}

export interface BuildFinancialHorizonOptions {
  currentDate?: string;
  totalMonths?: number;
  safetyMarginInCents?: number;
  projectedContractOccurrences?: ProjectedContractOccurrence[];
  projectedCreditCardInvoiceOccurrences?: ProjectedCreditCardInvoiceOccurrence[];
  projectedInstallmentOccurrences?: ProjectedInstallmentOccurrence[];
  projectedVariableExpenseOccurrences?: ProjectedVariableExpenseOccurrence[];
}

const DEFAULT_TOTAL_MONTHS = 24;

const toMonthKey = (value: string) => value.slice(0, 7);

const toMonthStart = (year: number, monthIndex: number) =>
  `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-01`;

const getCurrentMonthReference = (currentDate?: string) => {
  const reference = currentDate
    ? new Date(`${currentDate}T00:00:00.000Z`)
    : new Date();

  if (Number.isNaN(reference.valueOf())) {
    throw new Error('A data de referencia do horizonte e invalida.');
  }

  return {
    year: reference.getUTCFullYear(),
    monthIndex: reference.getUTCMonth(),
  };
};

const listRelevantTransactions = (
  transactions: TransactionListItem[],
  activeAccountIds: Set<string>,
) =>
  transactions.filter((transaction) =>
    activeAccountIds.has(transaction.accountId),
  );

const listRelevantProjectedOccurrences = (
  occurrences: ProjectedContractOccurrence[],
  activeAccountIds: Set<string>,
) =>
  occurrences.filter((occurrence) =>
    activeAccountIds.has(occurrence.accountId),
  );

const listRelevantProjectedCreditCardInvoices = (
  occurrences: ProjectedCreditCardInvoiceOccurrence[],
  activeAccountIds: Set<string>,
) =>
  occurrences.filter((occurrence) =>
    activeAccountIds.has(occurrence.paymentAccountId),
  );

const listRelevantProjectedInstallments = (
  occurrences: ProjectedInstallmentOccurrence[],
  activeAccountIds: Set<string>,
) =>
  occurrences.filter((occurrence) =>
    activeAccountIds.has(occurrence.accountId),
  );

const listRelevantProjectedVariableExpenses = (
  occurrences: ProjectedVariableExpenseOccurrence[],
  activeAccountIds: Set<string>,
) =>
  occurrences.filter((occurrence) =>
    activeAccountIds.has(occurrence.accountId),
  );

const createMonthlyTotalsMap = (transactions: TransactionListItem[]) =>
  transactions.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, transaction) => {
    const monthKey = toMonthKey(transaction.transactionDate);
    const currentMonth = monthsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };

    if (transaction.type === 'income') {
      currentMonth.incomeInCents += transaction.amountInCents;
    } else {
      currentMonth.expenseInCents += transaction.amountInCents;
    }

    monthsByKey[monthKey] = currentMonth;

    return monthsByKey;
  }, {});

const createProjectedMonthlyTotalsMap = (
  occurrences: ProjectedContractOccurrence[],
) =>
  occurrences.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, occurrence) => {
    const monthKey = toMonthKey(occurrence.occurrenceDate);
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

const createProjectedCreditCardMonthlyTotalsMap = (
  occurrences: ProjectedCreditCardInvoiceOccurrence[],
) =>
  occurrences.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, occurrence) => {
    const monthKey = toMonthKey(occurrence.occurrenceDate);
    const currentMonth = monthsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };

    currentMonth.expenseInCents += occurrence.amountInCents;
    monthsByKey[monthKey] = currentMonth;

    return monthsByKey;
  }, {});

const createProjectedInstallmentMonthlyTotalsMap = (
  occurrences: ProjectedInstallmentOccurrence[],
) =>
  occurrences.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, occurrence) => {
    const monthKey = toMonthKey(occurrence.occurrenceDate);
    const currentMonth = monthsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };

    currentMonth.expenseInCents += occurrence.amountInCents;
    monthsByKey[monthKey] = currentMonth;

    return monthsByKey;
  }, {});

const createProjectedVariableExpenseMonthlyTotalsMap = (
  occurrences: ProjectedVariableExpenseOccurrence[],
) =>
  occurrences.reduce<
    Record<string, { incomeInCents: number; expenseInCents: number }>
  >((monthsByKey, occurrence) => {
    const monthKey = toMonthKey(occurrence.occurrenceDate);
    const currentMonth = monthsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };

    currentMonth.expenseInCents += occurrence.amountInCents;
    monthsByKey[monthKey] = currentMonth;

    return monthsByKey;
  }, {});

const calculateOpeningBalanceInCents = (
  accountsSnapshot: AccountsSnapshot,
  transactions: TransactionListItem[],
  currentMonthKey: string,
) => {
  const openingBalancesInCents = accountsSnapshot.activeAccounts.reduce(
    (sum, account) => sum + account.openingBalanceInCents,
    0,
  );
  const priorTransactionsInCents = transactions.reduce((sum, transaction) => {
    if (toMonthKey(transaction.transactionDate) >= currentMonthKey) {
      return sum;
    }

    return sum + transaction.signedAmountInCents;
  }, 0);

  return openingBalancesInCents + priorTransactionsInCents;
};

export const classifyHorizonBalance = (
  closingBalanceInCents: number,
  safetyMarginInCents: number,
): HorizonRiskLevel => {
  if (closingBalanceInCents < 0) {
    return 'critical';
  }

  if (closingBalanceInCents <= safetyMarginInCents) {
    return 'attention';
  }

  return 'healthy';
};

export const buildFinancialHorizon = (
  accountsSnapshot: AccountsSnapshot,
  transactionsSnapshot: TransactionsSnapshot,
  options: BuildFinancialHorizonOptions = {},
): FinancialHorizon => {
  const totalMonths = options.totalMonths ?? DEFAULT_TOTAL_MONTHS;
  const safetyMarginInCents =
    options.safetyMarginInCents ?? DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS;

  if (totalMonths <= 0 || !Number.isInteger(totalMonths)) {
    throw new Error(
      'O horizonte precisa de um numero inteiro positivo de meses.',
    );
  }

  if (
    safetyMarginInCents < 0 ||
    !Number.isInteger(safetyMarginInCents) ||
    !Number.isFinite(safetyMarginInCents)
  ) {
    throw new Error('A margem de seguranca do horizonte precisa ser valida.');
  }

  const { year: startYear, monthIndex: startMonthIndex } =
    getCurrentMonthReference(options.currentDate);
  const activeAccountIds = new Set(
    accountsSnapshot.activeAccounts.map((account) => account.id),
  );
  const relevantTransactions = listRelevantTransactions(
    transactionsSnapshot.transactions,
    activeAccountIds,
  );
  const relevantProjectedOccurrences = listRelevantProjectedOccurrences(
    options.projectedContractOccurrences ?? [],
    activeAccountIds,
  );
  const relevantProjectedCreditCardInvoices =
    listRelevantProjectedCreditCardInvoices(
      options.projectedCreditCardInvoiceOccurrences ?? [],
      activeAccountIds,
    );
  const relevantProjectedInstallments = listRelevantProjectedInstallments(
    options.projectedInstallmentOccurrences ?? [],
    activeAccountIds,
  );
  const relevantProjectedVariableExpenses =
    listRelevantProjectedVariableExpenses(
      options.projectedVariableExpenseOccurrences ?? [],
      activeAccountIds,
    );
  const currentMonthKey = toMonthStart(startYear, startMonthIndex).slice(0, 7);
  const monthlyTotalsByKey = createMonthlyTotalsMap(relevantTransactions);
  const projectedTotalsByMonthKey = createProjectedMonthlyTotalsMap(
    relevantProjectedOccurrences,
  );
  const projectedCreditCardTotalsByMonthKey =
    createProjectedCreditCardMonthlyTotalsMap(
      relevantProjectedCreditCardInvoices,
    );
  const projectedInstallmentTotalsByMonthKey =
    createProjectedInstallmentMonthlyTotalsMap(relevantProjectedInstallments);
  const projectedVariableExpenseTotalsByMonthKey =
    createProjectedVariableExpenseMonthlyTotalsMap(
      relevantProjectedVariableExpenses,
    );

  let runningOpeningBalanceInCents = calculateOpeningBalanceInCents(
    accountsSnapshot,
    relevantTransactions,
    currentMonthKey,
  );

  const months = Array.from({ length: totalMonths }, (_unused, offset) => {
    const absoluteMonthIndex = startMonthIndex + offset;
    const year = startYear + Math.floor(absoluteMonthIndex / 12);
    const monthIndex = absoluteMonthIndex % 12;
    const monthStart = toMonthStart(year, monthIndex);
    const monthKey = monthStart.slice(0, 7);
    const monthlyTotals = monthlyTotalsByKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };
    const projectedTotals = projectedTotalsByMonthKey[monthKey] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };
    const projectedCreditCardTotals = projectedCreditCardTotalsByMonthKey[
      monthKey
    ] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };
    const projectedInstallmentTotals = projectedInstallmentTotalsByMonthKey[
      monthKey
    ] ?? {
      incomeInCents: 0,
      expenseInCents: 0,
    };
    const projectedVariableExpenseTotals =
      projectedVariableExpenseTotalsByMonthKey[monthKey] ?? {
        incomeInCents: 0,
        expenseInCents: 0,
      };
    const incomeInCents =
      monthlyTotals.incomeInCents +
      projectedTotals.incomeInCents +
      projectedCreditCardTotals.incomeInCents +
      projectedInstallmentTotals.incomeInCents;
    const expenseInCents =
      monthlyTotals.expenseInCents +
      projectedTotals.expenseInCents +
      projectedCreditCardTotals.expenseInCents +
      projectedInstallmentTotals.expenseInCents +
      projectedVariableExpenseTotals.expenseInCents;
    const closingBalanceInCents =
      runningOpeningBalanceInCents + incomeInCents - expenseInCents;
    const month = {
      id: monthKey,
      monthStart,
      openingBalanceInCents: runningOpeningBalanceInCents,
      incomeInCents,
      expenseInCents,
      closingBalanceInCents,
      riskLevel: classifyHorizonBalance(
        closingBalanceInCents,
        safetyMarginInCents,
      ),
    };

    runningOpeningBalanceInCents = closingBalanceInCents;

    return month;
  });

  return { months };
};

