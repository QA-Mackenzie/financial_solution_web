export const accountTypes = [
  'checking',
  'savings',
  'cash',
  'investment',
  'other',
] as const;

export type AccountType = (typeof accountTypes)[number];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceInCents: number;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountListItem extends Account {
  currentBalanceInCents: number;
}

export interface AccountsSnapshot {
  activeAccounts: AccountListItem[];
  archivedAccounts: AccountListItem[];
  consolidatedBalanceInCents: number;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  openingBalanceInCents: number;
}

export interface UpdateAccountInput extends CreateAccountInput {
  id: string;
}
