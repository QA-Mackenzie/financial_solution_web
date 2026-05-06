export const supportedFinancialModules = [
  'accounts',
  'transactions',
  'horizon',
  'contracts',
  'credit-cards',
  'installments',
  'provisions',
] as const;

export type SupportedFinancialModule = (typeof supportedFinancialModules)[number];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
