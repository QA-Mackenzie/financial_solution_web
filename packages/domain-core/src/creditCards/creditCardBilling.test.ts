import { describe, expect, it } from 'vitest';

import {
  buildCreditCardInvoices,
  buildCreditCardPurchaseListItems,
  buildCurrentCreditCardCycle,
  buildCurrentCreditCardInvoicePreview,
  buildProjectedCreditCardInvoiceOccurrences,
} from './creditCardBilling';

describe('buildCurrentCreditCardCycle', () => {
  it('keeps due date in the same month when due day is after statement closing', () => {
    const cycle = buildCurrentCreditCardCycle(
      {
        statementClosingDay: 5,
        dueDay: 12,
      },
      '2026-04-03',
    );

    expect(cycle).toEqual({
      invoiceMonth: '2026-04',
      cycleStartDate: '2026-03-06',
      cycleEndDate: '2026-04-05',
      dueDate: '2026-04-12',
    });
  });

  it('moves due date to the next month when due day comes before statement closing', () => {
    const cycle = buildCurrentCreditCardCycle(
      {
        statementClosingDay: 25,
        dueDay: 8,
      },
      '2026-04-26',
    );

    expect(cycle).toEqual({
      invoiceMonth: '2026-06',
      cycleStartDate: '2026-04-26',
      cycleEndDate: '2026-05-25',
      dueDate: '2026-06-08',
    });
  });

  it('clips month-end closing dates and builds the current invoice preview', () => {
    const preview = buildCurrentCreditCardInvoicePreview(
      {
        id: 'card-1',
        name: 'Cartao principal',
        statementClosingDay: 31,
        dueDay: 5,
      },
      '2026-02-10',
    );

    expect(preview).toEqual({
      id: 'card-1:2026-03',
      creditCardId: 'card-1',
      creditCardName: 'Cartao principal',
      invoiceMonth: '2026-03',
      cycleStartDate: '2026-02-01',
      cycleEndDate: '2026-02-28',
      dueDate: '2026-03-05',
      totalAmountInCents: 0,
    });
  });

  it('classifies purchases by invoice cycle and aggregates invoices around the statement closing date', () => {
    const purchases = buildCreditCardPurchaseListItems(
      [
        {
          id: 'card-1',
          name: 'Visa principal',
          statementClosingDay: 25,
          dueDay: 8,
          paymentAccountId: 'checking-1',
          paymentAccountName: 'Conta principal',
        },
      ],
      [
        {
          id: 'purchase-1',
          creditCardId: 'card-1',
          description: 'Mercado',
          amountInCents: 10000,
          purchaseDate: '2026-04-20',
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-20T10:00:00.000Z',
        },
        {
          id: 'purchase-2',
          creditCardId: 'card-1',
          description: 'Farmacia',
          amountInCents: 5000,
          purchaseDate: '2026-04-24',
          createdAt: '2026-04-24T10:00:00.000Z',
          updatedAt: '2026-04-24T10:00:00.000Z',
        },
        {
          id: 'purchase-3',
          creditCardId: 'card-1',
          description: 'Passagem',
          amountInCents: 25000,
          purchaseDate: '2026-04-26',
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
        },
      ],
    );
    const invoices = buildCreditCardInvoices(purchases, '2026-04-26');

    expect(purchases.map((purchase) => purchase.invoiceMonth)).toEqual([
      '2026-06',
      '2026-05',
      '2026-05',
    ]);
    expect(invoices).toEqual([
      expect.objectContaining({
        id: 'card-1:2026-05',
        totalAmountInCents: 15000,
        purchaseCount: 2,
        dueDate: '2026-05-08',
        status: 'upcoming',
      }),
      expect.objectContaining({
        id: 'card-1:2026-06',
        totalAmountInCents: 25000,
        purchaseCount: 1,
        dueDate: '2026-06-08',
        status: 'open',
      }),
    ]);
  });

  it('projects one negative occurrence per invoice on the due date', () => {
    const invoices = buildCreditCardInvoices(
      buildCreditCardPurchaseListItems(
        [
          {
            id: 'card-1',
            name: 'Visa principal',
            statementClosingDay: 25,
            dueDay: 8,
            paymentAccountId: 'checking-1',
            paymentAccountName: 'Conta principal',
          },
        ],
        [
          {
            id: 'purchase-1',
            creditCardId: 'card-1',
            description: 'Mercado',
            amountInCents: 10000,
            purchaseDate: '2026-04-20',
            createdAt: '2026-04-20T10:00:00.000Z',
            updatedAt: '2026-04-20T10:00:00.000Z',
          },
          {
            id: 'purchase-2',
            creditCardId: 'card-1',
            description: 'Passagem',
            amountInCents: 25000,
            purchaseDate: '2026-04-26',
            createdAt: '2026-04-26T10:00:00.000Z',
            updatedAt: '2026-04-26T10:00:00.000Z',
          },
        ],
      ),
      '2026-04-26',
    );

    expect(
      buildProjectedCreditCardInvoiceOccurrences(invoices, '2026-04-26'),
    ).toEqual([
      {
        id: 'card-1:2026-05',
        creditCardId: 'card-1',
        creditCardName: 'Visa principal',
        paymentAccountId: 'checking-1',
        paymentAccountName: 'Conta principal',
        invoiceMonth: '2026-05',
        amountInCents: 10000,
        signedAmountInCents: -10000,
        occurrenceDate: '2026-05-08',
      },
      {
        id: 'card-1:2026-06',
        creditCardId: 'card-1',
        creditCardName: 'Visa principal',
        paymentAccountId: 'checking-1',
        paymentAccountName: 'Conta principal',
        invoiceMonth: '2026-06',
        amountInCents: 25000,
        signedAmountInCents: -25000,
        occurrenceDate: '2026-06-08',
      },
    ]);
  });
});
