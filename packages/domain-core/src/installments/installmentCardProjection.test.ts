import { describe, expect, it } from 'vitest';

import { buildCombinedCreditCardFinancials } from './installmentCardProjection';

describe('buildCombinedCreditCardFinancials', () => {
  it('merges projected installment purchases into the card invoices and current invoice preview', () => {
    const financials = buildCombinedCreditCardFinancials(
      [
        {
          id: 'card-1',
          name: 'Visa Infinite',
          creditLimitInCents: 500000,
          statementClosingDay: 25,
          dueDay: 8,
          paymentAccountId: 'checking-1',
          paymentAccountName: 'Conta principal',
          currentCycle: {
            invoiceMonth: '2026-06',
            cycleStartDate: '2026-04-26',
            cycleEndDate: '2026-05-25',
            dueDate: '2026-06-08',
          },
          currentInvoice: {
            id: 'card-1:2026-06',
            creditCardId: 'card-1',
            creditCardName: 'Visa Infinite',
            invoiceMonth: '2026-06',
            cycleStartDate: '2026-04-26',
            cycleEndDate: '2026-05-25',
            dueDate: '2026-06-08',
            totalAmountInCents: 0,
          },
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
        },
      ],
      [
        {
          id: 'purchase-1',
          creditCardId: 'card-1',
          creditCardName: 'Visa Infinite',
          paymentAccountId: 'checking-1',
          paymentAccountName: 'Conta principal',
          description: 'Mercado',
          amountInCents: 10000,
          purchaseDate: '2026-04-20',
          invoiceMonth: '2026-05',
          cycleStartDate: '2026-03-26',
          cycleEndDate: '2026-04-25',
          dueDate: '2026-05-08',
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
      ],
      {
        projectedCreditCardPurchases: [
          {
            id: 'plan-1:1',
            planId: 'plan-1',
            creditCardId: 'card-1',
            creditCardName: 'Visa Infinite',
            paymentAccountId: 'checking-1',
            paymentAccountName: 'Conta principal',
            description: 'Notebook',
            amountInCents: 20000,
            purchaseDate: '2026-04-26',
            installmentNumber: 1,
            totalInstallments: 3,
            createdAt: '2026-04-24T10:00:00.000Z',
            updatedAt: '2026-04-24T10:00:00.000Z',
          },
        ],
      },
      '2026-04-26',
    );

    expect(
      financials.purchases.map((purchase) => purchase.description),
    ).toEqual(['Notebook 1/3', 'Mercado']);
    expect(financials.purchases[0]?.isProjected).toBe(true);
    expect(financials.purchases[1]?.isProjected).toBeUndefined();
    expect(financials.invoices.map((invoice) => invoice.id)).toEqual([
      'card-1:2026-05',
      'card-1:2026-06',
    ]);
    expect(financials.projectedInvoices).toEqual([
      expect.objectContaining({
        id: 'card-1:2026-05',
        amountInCents: 10000,
        occurrenceDate: '2026-05-08',
      }),
      expect.objectContaining({
        id: 'card-1:2026-06',
        amountInCents: 20000,
        occurrenceDate: '2026-06-08',
      }),
    ]);
    expect(financials.cards[0]?.currentInvoice.totalAmountInCents).toBe(20000);
    expect(financials.totalInvoiceAmountInCents).toBe(30000);
  });
});
