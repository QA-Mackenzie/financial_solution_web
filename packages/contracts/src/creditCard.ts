export interface CreditCard {
  id: string;
  name: string;
  creditLimitInCents: number;
  statementClosingDay: number;
  dueDay: number;
  paymentAccountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardStatementCycle {
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
}

export interface CreditCardInvoicePreview {
  id: string;
  creditCardId: string;
  creditCardName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  totalAmountInCents: number;
}

export interface CreditCardPurchase {
  id: string;
  creditCardId: string;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardPurchaseListItem extends CreditCardPurchase {
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  isProjected?: boolean;
}

export type CreditCardInvoiceStatus = 'open' | 'upcoming' | 'overdue';

export interface CreditCardInvoice {
  id: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  totalAmountInCents: number;
  purchaseCount: number;
  status: CreditCardInvoiceStatus;
  purchases: CreditCardPurchaseListItem[];
}

export interface CreditCardListItem extends CreditCard {
  paymentAccountName: string;
  currentCycle: CreditCardStatementCycle;
  currentInvoice: CreditCardInvoicePreview;
}

export interface CreditCardsSnapshot {
  cards: CreditCardListItem[];
  purchases: CreditCardPurchaseListItem[];
  invoices: CreditCardInvoice[];
  projectedInvoices: ProjectedCreditCardInvoiceOccurrence[];
  totalCreditLimitInCents: number;
  totalInvoiceAmountInCents: number;
}

export interface CreateCreditCardInput {
  name: string;
  creditLimitInCents: number;
  statementClosingDay: number;
  dueDay: number;
  paymentAccountId: string;
}

export interface UpdateCreditCardInput extends CreateCreditCardInput {
  id: string;
}

export interface CreateCreditCardPurchaseInput {
  creditCardId: string;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  purchaseDate: string;
}

export interface UpdateCreditCardPurchaseInput extends CreateCreditCardPurchaseInput {
  id: string;
}

export interface ProjectedCreditCardInvoiceOccurrence {
  id: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
}
