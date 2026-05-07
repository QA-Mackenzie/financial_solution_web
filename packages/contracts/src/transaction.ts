import { z } from 'zod';

export const transactionTypes = ['income', 'expense'] as const;

export type TransactionType = (typeof transactionTypes)[number];

export const transactionTypeSchema = z.enum(transactionTypes);

export const manualTransactionSchema = z.object({
  accountId: z.string().uuid(),
  amountInCents: z.number().int().positive(),
  category: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  description: z.string().min(1),
  id: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: transactionTypeSchema,
  updatedAt: z.string().datetime(),
});

export const transactionListItemSchema = manualTransactionSchema.extend({
  accountName: z.string().min(1),
  signedAmountInCents: z.number().int(),
});

export const transactionsSnapshotSchema = z.object({
  totalExpenseInCents: z.number().int(),
  totalIncomeInCents: z.number().int(),
  transactions: z.array(transactionListItemSchema),
});

export const createTransactionInputSchema = z.object({
  accountId: z.string().uuid('Selecione uma conta valida.'),
  amountInCents: z.number().int().positive('Informe um valor maior que zero.'),
  category: z.string().optional(),
  description: z.string().min(1, 'Informe uma descricao para o lancamento.'),
  tagIds: z.array(z.string().uuid()).optional(),
  transactionDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data valida no formato AAAA-MM-DD.',
  ),
  type: transactionTypeSchema,
});

export const updateTransactionInputSchema = createTransactionInputSchema.extend({
  id: z.string().uuid(),
});

export const deleteTransactionInputSchema = z.object({
  id: z.string().uuid(),
});

export const variableExpenseOverrideSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().min(1).max(120),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountInCents: z.number().int().positive(),
});

export const variableExpenseOverrideListItemSchema =
  variableExpenseOverrideSchema.extend({
    id: z.string().uuid(),
    accountName: z.string().min(1).max(120),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  });

export const removeVariableExpenseOverrideInputSchema = z.object({
  accountId: z.string().uuid('Selecione uma conta valida.'),
  description: z.string().min(1, 'Informe a descricao da despesa variavel.'),
  occurrenceDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data valida no formato AAAA-MM-DD.',
  ),
});

export const projectedVariableExpenseSources = [
  'movingAverage',
  'manualOverride',
] as const;

export const projectedVariableExpenseSourceSchema = z.enum(
  projectedVariableExpenseSources,
);

export const projectedVariableExpenseOccurrenceSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().uuid(),
  accountName: z.string().min(1).max(120),
  description: z.string().min(1).max(120),
  amountInCents: z.number().int().positive(),
  signedAmountInCents: z.number().int(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  historyMonthCount: z.number().int().min(1),
  windowInMonths: z.number().int().min(3).max(6),
  source: projectedVariableExpenseSourceSchema,
});

export const variableExpenseSnapshotSchema = z.object({
  overrides: z.array(variableExpenseOverrideListItemSchema),
  projectedOccurrences: z.array(projectedVariableExpenseOccurrenceSchema),
});

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

export type ProjectedVariableExpenseSource =
  (typeof projectedVariableExpenseSources)[number];

export interface VariableExpenseOverride {
  accountId: string;
  description: string;
  occurrenceDate: string;
  amountInCents: number;
}

export interface VariableExpenseOverrideListItem
  extends VariableExpenseOverride {
  id: string;
  accountName: string;
  createdAt: string;
  updatedAt: string;
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

export interface VariableExpenseSnapshot {
  overrides: VariableExpenseOverrideListItem[];
  projectedOccurrences: ProjectedVariableExpenseOccurrence[];
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

export type ManualTransactionPayload = z.infer<typeof manualTransactionSchema>;
export type TransactionListItemPayload = z.infer<typeof transactionListItemSchema>;
export type TransactionsSnapshotPayload = z.infer<typeof transactionsSnapshotSchema>;
export type CreateTransactionInputPayload = z.infer<
  typeof createTransactionInputSchema
>;
export type UpdateTransactionInputPayload = z.infer<
  typeof updateTransactionInputSchema
>;
export type DeleteTransactionInput = z.infer<typeof deleteTransactionInputSchema>;
export type VariableExpenseOverridePayload = z.infer<
  typeof variableExpenseOverrideSchema
>;
export type VariableExpenseOverrideListItemPayload = z.infer<
  typeof variableExpenseOverrideListItemSchema
>;
export type RemoveVariableExpenseOverrideInputPayload = z.infer<
  typeof removeVariableExpenseOverrideInputSchema
>;
export type ProjectedVariableExpenseOccurrencePayload = z.infer<
  typeof projectedVariableExpenseOccurrenceSchema
>;
export type VariableExpenseSnapshotPayload = z.infer<
  typeof variableExpenseSnapshotSchema
>;
