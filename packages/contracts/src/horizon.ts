import { z } from 'zod';

export const DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS = 50000;
export const MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS = 3;
export const MAX_VARIABLE_EXPENSE_WINDOW_IN_MONTHS = 6;
export const DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS =
  MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS;

export const horizonRiskLevels = ['healthy', 'attention', 'critical'] as const;

export type HorizonRiskLevel = 'healthy' | 'attention' | 'critical';

export const horizonRiskLevelSchema = z.enum(horizonRiskLevels);

export const horizonSettingsSchema = z.object({
  safetyMarginInCents: z.number().int().min(0),
  variableExpenseWindowInMonths: z
    .number()
    .int()
    .min(MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS)
    .max(MAX_VARIABLE_EXPENSE_WINDOW_IN_MONTHS),
});

export const financialHorizonMonthSchema = z.object({
  id: z.string().min(1),
  monthStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openingBalanceInCents: z.number().int(),
  incomeInCents: z.number().int(),
  expenseInCents: z.number().int(),
  closingBalanceInCents: z.number().int(),
  cashOpeningBalanceInCents: z.number().int().optional(),
  cashClosingBalanceInCents: z.number().int().optional(),
  provisionAllocationInCents: z.number().int().optional(),
  provisionReleaseInCents: z.number().int().optional(),
  provisionReservedBalanceInCents: z.number().int().optional(),
  riskLevel: horizonRiskLevelSchema,
});

export const financialHorizonSchema = z.object({
  months: z.array(financialHorizonMonthSchema),
});

export const horizonSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  horizon: financialHorizonSchema,
  settings: horizonSettingsSchema,
});

export const updateHorizonSettingsInputSchema = horizonSettingsSchema;

export interface HorizonSettings {
  safetyMarginInCents: number;
  variableExpenseWindowInMonths: number;
}

export interface FinancialHorizonMonth {
  id: string;
  monthStart: string;
  openingBalanceInCents: number;
  incomeInCents: number;
  expenseInCents: number;
  closingBalanceInCents: number;
  cashOpeningBalanceInCents?: number;
  cashClosingBalanceInCents?: number;
  provisionAllocationInCents?: number;
  provisionReleaseInCents?: number;
  provisionReservedBalanceInCents?: number;
  riskLevel: HorizonRiskLevel;
}

export interface FinancialHorizon {
  months: FinancialHorizonMonth[];
}

export interface HorizonSnapshot {
  generatedAt: string;
  horizon: FinancialHorizon;
  settings: HorizonSettings;
}

export interface UpdateHorizonSettingsInput {
  safetyMarginInCents: number;
  variableExpenseWindowInMonths: number;
}

export type HorizonSettingsPayload = z.infer<typeof horizonSettingsSchema>;
export type FinancialHorizonMonthPayload = z.infer<
  typeof financialHorizonMonthSchema
>;
export type FinancialHorizonPayload = z.infer<typeof financialHorizonSchema>;
export type HorizonSnapshotPayload = z.infer<typeof horizonSnapshotSchema>;
export type UpdateHorizonSettingsInputPayload = z.infer<
  typeof updateHorizonSettingsInputSchema
>;
