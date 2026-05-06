export const transactionTypes = ['income', 'expense'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export interface ManualTransaction {
  id: string;
  accountId: string;
  type: TransactionType;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListItem extends ManualTransaction {
  accountName: string;
  signedAmountInCents: number;
}

export type ProjectedVariableExpenseSource = 'movingAverage' | 'manualOverride';

export interface VariableExpenseOverride {
  accountId: string;
  description: string;
  occurrenceDate: string;
  amountInCents: number;
}

export interface RemoveVariableExpenseOverrideInput {
  accountId: string;
  description: string;
  occurrenceDate: string;
}

export interface ProjectedVariableExpenseOccurrence {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
  historyMonthCount: number;
  windowInMonths: number;
  source: ProjectedVariableExpenseSource;
}

export interface TransactionsSnapshot {
  transactions: TransactionListItem[];
  totalIncomeInCents: number;
  totalExpenseInCents: number;
}

export interface CreateTransactionInput {
  accountId: string;
  type: TransactionType;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  transactionDate: string;
}

export interface UpdateTransactionInput extends CreateTransactionInput {
  id: string;
}
