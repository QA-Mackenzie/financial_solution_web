export const installmentSourceTypes = ['account', 'creditCard'] as const;

export type InstallmentSourceType = (typeof installmentSourceTypes)[number];

export const installmentOperationTypes = ['anticipation'] as const;

export type InstallmentOperationType =
  (typeof installmentOperationTypes)[number];

export interface InstallmentPlan {
  id: string;
  sourceType: InstallmentSourceType;
  accountId: string | null;
  creditCardId: string | null;
  description: string;
  totalAmountInCents: number;
  installmentCount: number;
  firstOccurrenceDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPlanListItem extends InstallmentPlan {
  accountName: string | null;
  creditCardName: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
}

export interface InstallmentOccurrence {
  id: string;
  planId: string;
  sourceType: InstallmentSourceType;
  accountId: string | null;
  creditCardId: string | null;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  amountInCents: number;
  originalOccurrenceDate: string;
  occurrenceDate: string;
  anticipatedOperationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentOccurrenceListItem extends InstallmentOccurrence {
  accountName: string | null;
  creditCardName: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
}

export interface InstallmentOperation {
  id: string;
  planId: string;
  type: InstallmentOperationType;
  operationDate: string;
  affectedInstallmentCount: number;
  affectedAmountInCents: number;
  createdAt: string;
}

export interface ProjectedInstallmentOccurrence {
  id: string;
  planId: string;
  description: string;
  accountId: string;
  accountName: string;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
  installmentNumber: number;
  totalInstallments: number;
}

export interface ProjectedInstallmentCreditCardPurchase {
  id: string;
  planId: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  description: string;
  amountInCents: number;
  purchaseDate: string;
  installmentNumber: number;
  totalInstallments: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentsSnapshot {
  plans: InstallmentPlanListItem[];
  occurrences: InstallmentOccurrenceListItem[];
  operations: InstallmentOperation[];
  projectedAccountOccurrences: ProjectedInstallmentOccurrence[];
  projectedCreditCardPurchases: ProjectedInstallmentCreditCardPurchase[];
  totalRemainingAmountInCents: number;
}

export interface CreateInstallmentPlanInput {
  sourceType: InstallmentSourceType;
  accountId?: string;
  creditCardId?: string;
  description: string;
  totalAmountInCents: number;
  installmentCount: number;
  firstOccurrenceDate: string;
}

export interface UpdateInstallmentPlanInput extends CreateInstallmentPlanInput {
  id: string;
}

export interface AnticipateInstallmentPlanInput {
  planId: string;
  operationDate: string;
}

export interface UpdateInstallmentAnticipationInput extends AnticipateInstallmentPlanInput {
  id: string;
}
