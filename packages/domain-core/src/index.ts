export const supportedFinancialModules = [
  'accounts',
  'transactions',
  'horizon',
  'contracts',
  'credit-cards',
  'installments',
  'provisions',
  'tags',
] as const;

export type SupportedFinancialModule = (typeof supportedFinancialModules)[number];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export * from './accounts/accountInput';
export * from './accounts/accountSnapshot';
export * from './contracts/contractInput';
export * from './contracts/contractProjection';
export * from './contracts/contractSnapshot';
export * from './creditCards/creditCardBilling';
export * from './creditCards/creditCardInput';
export * from './creditCards/creditCardPurchaseInput';
export * from './horizon/financialHorizon';
export * from './installments/installmentCardProjection';
export * from './installments/installmentInput';
export * from './installments/installmentSchedule';
export * from './provisions/provisionInput';
export * from './provisions/provisionProjection';
export * from './shared/roundCurrency';
export * from './tags/tagInput';
export * from './transactions/transactionInput';
export * from './transactions/transactionSnapshot';
export * from './transactions/variableExpenseProjection';
