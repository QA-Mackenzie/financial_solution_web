import { z } from 'zod';

export const accountTypes = [
  'checking',
  'savings',
  'cash',
  'investment',
  'other',
] as const;

export type AccountType = (typeof accountTypes)[number];

export const accountTypeSchema = z.enum(accountTypes);

export const accountSchema = z.object({
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
  isArchived: z.boolean(),
  name: z.string().min(1),
  openingBalanceInCents: z.number().int(),
  type: accountTypeSchema,
  updatedAt: z.string().datetime(),
});

export const accountListItemSchema = accountSchema.extend({
  currentBalanceInCents: z.number().int(),
});

export const accountsSnapshotSchema = z.object({
  activeAccounts: z.array(accountListItemSchema),
  archivedAccounts: z.array(accountListItemSchema),
  consolidatedBalanceInCents: z.number().int(),
});

export const createAccountInputSchema = z.object({
  name: z.string().min(1, 'Informe um nome para a conta.'),
  openingBalanceInCents: z.number().int(),
  type: accountTypeSchema,
});

export const updateAccountInputSchema = createAccountInputSchema.extend({
  id: z.string().uuid(),
});

export const archiveAccountInputSchema = z.object({
  id: z.string().uuid(),
});

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

export type AccountPayload = z.infer<typeof accountSchema>;
export type AccountListItemPayload = z.infer<typeof accountListItemSchema>;
export type AccountsSnapshotPayload = z.infer<typeof accountsSnapshotSchema>;
export type CreateAccountInputPayload = z.infer<typeof createAccountInputSchema>;
export type UpdateAccountInputPayload = z.infer<typeof updateAccountInputSchema>;
export type ArchiveAccountInput = z.infer<typeof archiveAccountInputSchema>;
