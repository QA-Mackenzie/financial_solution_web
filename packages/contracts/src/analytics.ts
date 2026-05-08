import { z } from 'zod';

import { transactionTypeSchema } from './transaction';

export const financialRecordKinds = [
  'manualTransaction',
  'creditCardPurchase',
] as const;

export const financialRecordKindSchema = z.enum(financialRecordKinds);

export const financialEntityKinds = ['account', 'creditCard'] as const;

export const financialEntityKindSchema = z.enum(financialEntityKinds);

export const financialRecordTagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
});

export const financialRecordListItemSchema = z.object({
  id: z.string().min(1),
  recordKind: financialRecordKindSchema,
  entityKind: financialEntityKindSchema,
  entityId: z.string().uuid(),
  entityName: z.string().min(1).max(120),
  accountId: z.string().uuid(),
  accountName: z.string().min(1).max(120),
  type: transactionTypeSchema,
  description: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  tags: z.array(financialRecordTagSchema),
  amountInCents: z.number().int().positive(),
  signedAmountInCents: z.number().int(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const financialRecordFilterSchema = z.object({
  accountId: z.string().uuid().optional(),
  category: z.string().min(1).max(80).optional(),
  entityId: z.string().uuid().optional(),
  entityKind: financialEntityKindSchema.optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recordKind: financialRecordKindSchema.optional(),
  tagId: z.string().uuid().optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: transactionTypeSchema.optional(),
});

export const financialRecordQuerySnapshotSchema = z.object({
  appliedFilters: financialRecordFilterSchema,
  recordCount: z.number().int().nonnegative(),
  totalExpenseInCents: z.number().int(),
  totalIncomeInCents: z.number().int(),
  records: z.array(financialRecordListItemSchema),
});

export const financialAnalyticsCategoryBreakdownSchema = z.object({
  category: z.string().min(1).max(80),
  count: z.number().int().nonnegative(),
  expenseInCents: z.number().int().nonnegative(),
  incomeInCents: z.number().int().nonnegative(),
  netAmountInCents: z.number().int(),
});

export const financialAnalyticsTagBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  expenseInCents: z.number().int().nonnegative(),
  incomeInCents: z.number().int().nonnegative(),
  netAmountInCents: z.number().int(),
  tagId: z.string().uuid(),
  tagName: z.string().min(1).max(40),
});

export const financialAnalyticsEntityBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  entityId: z.string().uuid(),
  entityKind: financialEntityKindSchema,
  entityName: z.string().min(1).max(120),
  expenseInCents: z.number().int().nonnegative(),
  incomeInCents: z.number().int().nonnegative(),
  netAmountInCents: z.number().int(),
});

export const financialAnalyticsMonthBreakdownSchema = z.object({
  count: z.number().int().nonnegative(),
  expenseInCents: z.number().int().nonnegative(),
  incomeInCents: z.number().int().nonnegative(),
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  netAmountInCents: z.number().int(),
});

export const financialAnalyticsSnapshotSchema = z.object({
  appliedFilters: financialRecordFilterSchema,
  byCategory: z.array(financialAnalyticsCategoryBreakdownSchema),
  byEntity: z.array(financialAnalyticsEntityBreakdownSchema),
  byMonth: z.array(financialAnalyticsMonthBreakdownSchema),
  byTag: z.array(financialAnalyticsTagBreakdownSchema),
  netAmountInCents: z.number().int(),
  recordCount: z.number().int().nonnegative(),
  totalExpenseInCents: z.number().int().nonnegative(),
  totalIncomeInCents: z.number().int().nonnegative(),
});

export type FinancialRecordKind = (typeof financialRecordKinds)[number];

export type FinancialEntityKind = (typeof financialEntityKinds)[number];

export interface FinancialRecordTag {
  id: string;
  name: string;
}

export interface FinancialRecordListItem {
  id: string;
  recordKind: FinancialRecordKind;
  entityKind: FinancialEntityKind;
  entityId: string;
  entityName: string;
  accountId: string;
  accountName: string;
  type: 'income' | 'expense';
  description: string;
  category: string;
  tags: FinancialRecordTag[];
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialRecordFilter {
  accountId?: string;
  category?: string;
  entityId?: string;
  entityKind?: FinancialEntityKind;
  fromDate?: string;
  recordKind?: FinancialRecordKind;
  tagId?: string;
  toDate?: string;
  type?: 'income' | 'expense';
}

export interface FinancialRecordQuerySnapshot {
  appliedFilters: FinancialRecordFilter;
  recordCount: number;
  totalExpenseInCents: number;
  totalIncomeInCents: number;
  records: FinancialRecordListItem[];
}

export interface FinancialAnalyticsCategoryBreakdownItem {
  category: string;
  count: number;
  expenseInCents: number;
  incomeInCents: number;
  netAmountInCents: number;
}

export interface FinancialAnalyticsTagBreakdownItem {
  count: number;
  expenseInCents: number;
  incomeInCents: number;
  netAmountInCents: number;
  tagId: string;
  tagName: string;
}

export interface FinancialAnalyticsEntityBreakdownItem {
  count: number;
  entityId: string;
  entityKind: FinancialEntityKind;
  entityName: string;
  expenseInCents: number;
  incomeInCents: number;
  netAmountInCents: number;
}

export interface FinancialAnalyticsMonthBreakdownItem {
  count: number;
  expenseInCents: number;
  incomeInCents: number;
  monthStart: string;
  netAmountInCents: number;
}

export interface FinancialAnalyticsSnapshot {
  appliedFilters: FinancialRecordFilter;
  byCategory: FinancialAnalyticsCategoryBreakdownItem[];
  byEntity: FinancialAnalyticsEntityBreakdownItem[];
  byMonth: FinancialAnalyticsMonthBreakdownItem[];
  byTag: FinancialAnalyticsTagBreakdownItem[];
  netAmountInCents: number;
  recordCount: number;
  totalExpenseInCents: number;
  totalIncomeInCents: number;
}

export type FinancialRecordTagPayload = z.infer<typeof financialRecordTagSchema>;
export type FinancialRecordListItemPayload = z.infer<
  typeof financialRecordListItemSchema
>;
export type FinancialRecordFilterPayload = z.infer<
  typeof financialRecordFilterSchema
>;
export type FinancialRecordQuerySnapshotPayload = z.infer<
  typeof financialRecordQuerySnapshotSchema
>;
export type FinancialAnalyticsCategoryBreakdownPayload = z.infer<
  typeof financialAnalyticsCategoryBreakdownSchema
>;
export type FinancialAnalyticsTagBreakdownPayload = z.infer<
  typeof financialAnalyticsTagBreakdownSchema
>;
export type FinancialAnalyticsEntityBreakdownPayload = z.infer<
  typeof financialAnalyticsEntityBreakdownSchema
>;
export type FinancialAnalyticsMonthBreakdownPayload = z.infer<
  typeof financialAnalyticsMonthBreakdownSchema
>;
export type FinancialAnalyticsSnapshotPayload = z.infer<
  typeof financialAnalyticsSnapshotSchema
>;