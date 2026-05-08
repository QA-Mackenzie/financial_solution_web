import {
  buildCreditCardInvoices,
  buildCreditCardPurchaseListItems,
  buildProjectedCreditCardInvoiceOccurrences,
} from '../creditCards/creditCardBilling';
import type {
  CreditCardInvoice,
  CreditCardListItem,
  CreditCardPurchaseListItem,
  ProjectedCreditCardInvoiceOccurrence,
} from '@economy-cash/contracts';
import type {
  InstallmentsSnapshot,
  ProjectedInstallmentCreditCardPurchase,
} from '@economy-cash/contracts';

export interface CombinedCreditCardFinancials {
  cards: CreditCardListItem[];
  purchases: CreditCardPurchaseListItem[];
  invoices: CreditCardInvoice[];
  projectedInvoices: ProjectedCreditCardInvoiceOccurrence[];
  totalInvoiceAmountInCents: number;
}

const mapProjectedInstallmentPurchase = (
  purchase: ProjectedInstallmentCreditCardPurchase,
) => ({
  id: purchase.id,
  creditCardId: purchase.creditCardId,
  description: `${purchase.description} ${purchase.installmentNumber}/${purchase.totalInstallments}`,
  amountInCents: purchase.amountInCents,
  purchaseDate: purchase.purchaseDate,
  createdAt: purchase.createdAt,
  updatedAt: purchase.updatedAt,
  isProjected: true,
});

export const buildCombinedCreditCardFinancials = (
  cards: CreditCardListItem[],
  purchases: CreditCardPurchaseListItem[],
  installmentSnapshot: Pick<
    InstallmentsSnapshot,
    'projectedCreditCardPurchases'
  >,
  currentDate?: string,
): CombinedCreditCardFinancials => {
  const installmentPurchases = buildCreditCardPurchaseListItems(
    cards,
    installmentSnapshot.projectedCreditCardPurchases.map(
      mapProjectedInstallmentPurchase,
    ),
  );
  const combinedPurchases = [...purchases, ...installmentPurchases].sort(
    (left, right) =>
      right.purchaseDate.localeCompare(left.purchaseDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
  const invoices = buildCreditCardInvoices(combinedPurchases, currentDate);
  const projectedInvoices = buildProjectedCreditCardInvoiceOccurrences(
    invoices,
    currentDate,
  );
  const invoiceTotalsById = new Map(
    invoices.map((invoice) => [invoice.id, invoice.totalAmountInCents]),
  );

  return {
    cards: cards.map((card) => ({
      ...card,
      currentInvoice: {
        ...card.currentInvoice,
        totalAmountInCents: invoiceTotalsById.get(card.currentInvoice.id) ?? 0,
      },
    })),
    purchases: combinedPurchases,
    invoices,
    projectedInvoices,
    totalInvoiceAmountInCents: invoices.reduce(
      (sum, invoice) => sum + invoice.totalAmountInCents,
      0,
    ),
  };
};

