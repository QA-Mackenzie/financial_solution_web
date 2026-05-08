import { describe, expect, it } from 'vitest';

import {
  buildInstallmentOccurrenceListItems,
  buildProjectedInstallmentCreditCardPurchases,
  buildProjectedInstallmentOccurrences,
  distributeInstallmentAmounts,
} from './installmentSchedule';
import type {
  InstallmentOperation,
  InstallmentPlanListItem,
} from '@shf/contracts';

const basePlan: InstallmentPlanListItem = {
  id: 'plan-1',
  sourceType: 'account',
  accountId: 'account-1',
  creditCardId: null,
  accountName: 'Conta principal',
  creditCardName: null,
  paymentAccountId: null,
  paymentAccountName: null,
  description: 'Notebook',
  totalAmountInCents: 10000,
  installmentCount: 3,
  firstOccurrenceDate: '2026-04-24',
  createdAt: '2026-04-24T10:00:00.000Z',
  updatedAt: '2026-04-24T10:00:00.000Z',
};

describe('distributeInstallmentAmounts', () => {
  it('distributes cents exactly across installments', () => {
    expect(distributeInstallmentAmounts(10000, 3)).toEqual([3334, 3333, 3333]);
  });

  it('rejects invalid installment counts', () => {
    expect(() => distributeInstallmentAmounts(10000, 0)).toThrowError(
      'A quantidade de parcelas precisa ser um inteiro positivo.',
    );
  });
});

describe('buildInstallmentOccurrenceListItems', () => {
  it('builds a monthly schedule preserving day clipping and traceability', () => {
    const occurrences = buildInstallmentOccurrenceListItems(
      [
        {
          ...basePlan,
          firstOccurrenceDate: '2026-01-31',
        },
      ],
      [],
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        id: 'plan-1:1',
        installmentNumber: 1,
        amountInCents: 3334,
        originalOccurrenceDate: '2026-01-31',
        occurrenceDate: '2026-01-31',
      }),
      expect.objectContaining({
        id: 'plan-1:2',
        installmentNumber: 2,
        amountInCents: 3333,
        originalOccurrenceDate: '2026-02-28',
        occurrenceDate: '2026-02-28',
      }),
      expect.objectContaining({
        id: 'plan-1:3',
        installmentNumber: 3,
        amountInCents: 3333,
        originalOccurrenceDate: '2026-03-31',
        occurrenceDate: '2026-03-31',
      }),
    ]);
  });

  it('anticipates only the configured number of future installments', () => {
    const operations: InstallmentOperation[] = [
      {
        id: 'operation-1',
        planId: 'plan-1',
        type: 'anticipation',
        operationDate: '2026-05-10',
        affectedInstallmentCount: 2,
        affectedAmountInCents: 6000,
        createdAt: '2026-05-10T12:00:00.000Z',
      },
    ];

    const occurrences = buildInstallmentOccurrenceListItems(
      [
        {
          ...basePlan,
          totalAmountInCents: 12000,
          installmentCount: 4,
        },
      ],
      operations,
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        id: 'plan-1:1',
        originalOccurrenceDate: '2026-04-24',
        occurrenceDate: '2026-04-24',
        anticipatedOperationId: null,
      }),
      expect.objectContaining({
        id: 'plan-1:2',
        originalOccurrenceDate: '2026-05-24',
        occurrenceDate: '2026-05-10',
        anticipatedOperationId: 'operation-1',
      }),
      expect.objectContaining({
        id: 'plan-1:3',
        originalOccurrenceDate: '2026-06-24',
        occurrenceDate: '2026-05-10',
        anticipatedOperationId: 'operation-1',
      }),
      expect.objectContaining({
        id: 'plan-1:4',
        originalOccurrenceDate: '2026-07-24',
        occurrenceDate: '2026-07-24',
        anticipatedOperationId: null,
      }),
    ]);
  });

  it('applies multiple anticipation operations in chronological order', () => {
    const operations: InstallmentOperation[] = [
      {
        id: 'operation-1',
        planId: 'plan-1',
        type: 'anticipation',
        operationDate: '2026-05-10',
        affectedInstallmentCount: 1,
        affectedAmountInCents: 2500,
        createdAt: '2026-05-10T12:00:00.000Z',
      },
      {
        id: 'operation-2',
        planId: 'plan-1',
        type: 'anticipation',
        operationDate: '2026-06-05',
        affectedInstallmentCount: 2,
        affectedAmountInCents: 5000,
        createdAt: '2026-06-05T12:00:00.000Z',
      },
    ];

    const occurrences = buildInstallmentOccurrenceListItems(
      [
        {
          ...basePlan,
          totalAmountInCents: 10000,
          installmentCount: 4,
        },
      ],
      operations,
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        id: 'plan-1:1',
        occurrenceDate: '2026-04-24',
        anticipatedOperationId: null,
      }),
      expect.objectContaining({
        id: 'plan-1:2',
        occurrenceDate: '2026-05-10',
        anticipatedOperationId: 'operation-1',
      }),
      expect.objectContaining({
        id: 'plan-1:3',
        occurrenceDate: '2026-06-05',
        anticipatedOperationId: 'operation-2',
      }),
      expect.objectContaining({
        id: 'plan-1:4',
        occurrenceDate: '2026-06-05',
        anticipatedOperationId: 'operation-2',
      }),
    ]);
  });
});

describe('installment projections', () => {
  it('projects account installments into the horizon from the current month', () => {
    const occurrences = buildInstallmentOccurrenceListItems([basePlan], []);

    expect(
      buildProjectedInstallmentOccurrences(occurrences, '2026-04-26'),
    ).toEqual([
      {
        id: 'plan-1:1',
        planId: 'plan-1',
        description: 'Notebook',
        accountId: 'account-1',
        accountName: 'Conta principal',
        amountInCents: 3334,
        signedAmountInCents: -3334,
        occurrenceDate: '2026-04-24',
        installmentNumber: 1,
        totalInstallments: 3,
      },
      {
        id: 'plan-1:2',
        planId: 'plan-1',
        description: 'Notebook',
        accountId: 'account-1',
        accountName: 'Conta principal',
        amountInCents: 3333,
        signedAmountInCents: -3333,
        occurrenceDate: '2026-05-24',
        installmentNumber: 2,
        totalInstallments: 3,
      },
      {
        id: 'plan-1:3',
        planId: 'plan-1',
        description: 'Notebook',
        accountId: 'account-1',
        accountName: 'Conta principal',
        amountInCents: 3333,
        signedAmountInCents: -3333,
        occurrenceDate: '2026-06-24',
        installmentNumber: 3,
        totalInstallments: 3,
      },
    ]);
  });

  it('projects credit card installments as monthly purchases for future invoices', () => {
    const occurrences = buildInstallmentOccurrenceListItems(
      [
        {
          ...basePlan,
          sourceType: 'creditCard',
          accountId: null,
          creditCardId: 'card-1',
          accountName: null,
          creditCardName: 'Visa principal',
          paymentAccountId: 'checking-1',
          paymentAccountName: 'Conta principal',
        },
      ],
      [],
    );

    expect(
      buildProjectedInstallmentCreditCardPurchases(occurrences, '2026-04-26'),
    ).toEqual([
      {
        id: 'plan-1:1',
        planId: 'plan-1',
        creditCardId: 'card-1',
        creditCardName: 'Visa principal',
        paymentAccountId: 'checking-1',
        paymentAccountName: 'Conta principal',
        description: 'Notebook',
        amountInCents: 3334,
        purchaseDate: '2026-04-24',
        installmentNumber: 1,
        totalInstallments: 3,
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
      {
        id: 'plan-1:2',
        planId: 'plan-1',
        creditCardId: 'card-1',
        creditCardName: 'Visa principal',
        paymentAccountId: 'checking-1',
        paymentAccountName: 'Conta principal',
        description: 'Notebook',
        amountInCents: 3333,
        purchaseDate: '2026-05-24',
        installmentNumber: 2,
        totalInstallments: 3,
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
      {
        id: 'plan-1:3',
        planId: 'plan-1',
        creditCardId: 'card-1',
        creditCardName: 'Visa principal',
        paymentAccountId: 'checking-1',
        paymentAccountName: 'Conta principal',
        description: 'Notebook',
        amountInCents: 3333,
        purchaseDate: '2026-06-24',
        installmentNumber: 3,
        totalInstallments: 3,
        createdAt: '2026-04-24T10:00:00.000Z',
        updatedAt: '2026-04-24T10:00:00.000Z',
      },
    ]);
  });
});

