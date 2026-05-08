import type {
  Account,
  AccountListItem,
  AccountsSnapshot,
} from '@economy-cash/contracts';

const toAccountListItem = (
  account: Account,
  balanceAdjustmentsInCentsByAccountId: Record<string, number>,
): AccountListItem => ({
  ...account,
  currentBalanceInCents:
    account.openingBalanceInCents +
    (balanceAdjustmentsInCentsByAccountId[account.id] ?? 0),
});

export const buildAccountsSnapshot = (
  accounts: Account[],
  balanceAdjustmentsInCentsByAccountId: Record<string, number> = {},
): AccountsSnapshot => {
  const activeAccounts = accounts
    .filter((account) => !account.isArchived)
    .map((account) =>
      toAccountListItem(account, balanceAdjustmentsInCentsByAccountId),
    );
  const archivedAccounts = accounts
    .filter((account) => account.isArchived)
    .map((account) =>
      toAccountListItem(account, balanceAdjustmentsInCentsByAccountId),
    );

  const consolidatedBalanceInCents = activeAccounts.reduce(
    (sum, account) => sum + account.currentBalanceInCents,
    0,
  );

  return {
    activeAccounts,
    archivedAccounts,
    consolidatedBalanceInCents,
  };
};

