import type {
  ManualTransaction,
  TransactionListItem,
  TransactionsSnapshot,
} from '@economy-cash/contracts';

export const getSignedAmountInCents = (
  transaction: Pick<ManualTransaction, 'type' | 'amountInCents'>,
) =>
  transaction.type === 'income'
    ? transaction.amountInCents
    : -transaction.amountInCents;

export const buildTransactionsSnapshot = (
  transactions: TransactionListItem[],
): TransactionsSnapshot => {
  const totalIncomeInCents = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amountInCents, 0);

  const totalExpenseInCents = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountInCents, 0);

  return {
    transactions,
    totalIncomeInCents,
    totalExpenseInCents,
  };
};

