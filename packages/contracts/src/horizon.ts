export const DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS = 50000;
export const MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS = 3;
export const MAX_VARIABLE_EXPENSE_WINDOW_IN_MONTHS = 6;
export const DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS =
  MIN_VARIABLE_EXPENSE_WINDOW_IN_MONTHS;

export type HorizonRiskLevel = 'healthy' | 'attention' | 'critical';

export interface HorizonSettings {
  safetyMarginInCents: number;
  variableExpenseWindowInMonths: number;
}

export interface UpdateHorizonSettingsInput {
  safetyMarginInCents: number;
  variableExpenseWindowInMonths: number;
}
