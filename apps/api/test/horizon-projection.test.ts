import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@economy-cash/contracts';
import {
  buildFinancialHorizon,
  buildProjectedCreditCardInvoiceOccurrences,
  buildProjectedContractOccurrences,
  marginPressureFixture,
  multiAccountConsolidatedFixture,
  positiveTrajectoryFixture,
} from '@economy-cash/domain-core';
import { describe, expect, it } from 'vitest';

import { buildOfficialHorizonSnapshot } from '../src/lib/horizon-snapshot';

const emptyContractsSnapshot = {
  activeContracts: [],
  inactiveContracts: [],
  totalActiveIncomeInCents: 0,
  totalActiveExpenseInCents: 0,
  netActiveAmountInCents: 0,
};

const emptyCreditCardsSnapshot = {
  cards: [],
  purchases: [],
  invoices: [],
  projectedInvoices: [],
  totalCreditLimitInCents: 0,
  totalInvoiceAmountInCents: 0,
};

const emptyInstallmentsSnapshot = {
  plans: [],
  occurrences: [],
  operations: [],
  projectedAccountOccurrences: [],
  projectedCreditCardPurchases: [],
  totalRemainingAmountInCents: 0,
};

describe('buildOfficialHorizonSnapshot', () => {
  it('preserva a trajetoria positiva da fixture oficial do dominio', () => {
    const settings = {
      safetyMarginInCents:
        positiveTrajectoryFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: positiveTrajectoryFixture.accountsSnapshot,
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      referenceDate: positiveTrajectoryFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: positiveTrajectoryFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      positiveTrajectoryFixture.accountsSnapshot,
      positiveTrajectoryFixture.transactionsSnapshot,
      {
        ...positiveTrajectoryFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('preserva a regressao matematica de pressao de margem', () => {
    const settings = {
      safetyMarginInCents:
        marginPressureFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: marginPressureFixture.accountsSnapshot,
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      referenceDate: marginPressureFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: marginPressureFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      marginPressureFixture.accountsSnapshot,
      marginPressureFixture.transactionsSnapshot,
      {
        ...marginPressureFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('mantem a consolidacao multi-conta da fixture oficial do dominio', () => {
    const settings = {
      safetyMarginInCents:
        multiAccountConsolidatedFixture.options.safetyMarginInCents ??
        DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: multiAccountConsolidatedFixture.accountsSnapshot,
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-04-24T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      referenceDate:
        multiAccountConsolidatedFixture.options.currentDate ?? '2026-04-24',
      settings,
      transactionsSnapshot: multiAccountConsolidatedFixture.transactionsSnapshot,
    });

    const expected = buildFinancialHorizon(
      multiAccountConsolidatedFixture.accountsSnapshot,
      multiAccountConsolidatedFixture.transactionsSnapshot,
      {
        ...multiAccountConsolidatedFixture.options,
        safetyMarginInCents: settings.safetyMarginInCents,
      },
    );

    expect(snapshot.horizon.months).toHaveLength(24);
    expect(snapshot.horizon.months.slice(0, expected.months.length)).toEqual(
      expected.months,
    );
  });

  it('integra contratos recorrentes com reajuste e encerramento ao horizonte oficial', () => {
    const contractsSnapshot = {
      activeContracts: [
        {
          id: 'contract-1',
          accountId: 'checking',
          accountName: 'Conta principal',
          name: 'Aluguel',
          category: 'Moradia',
          type: 'expense' as const,
          amountInCents: 120000,
          dueDay: 10,
          startDate: '2026-05-01',
          endDate: '2026-07-20',
          adjustments: [
            {
              id: 'adjustment-1',
              contractId: 'contract-1',
              amountInCents: 135000,
              effectiveStartDate: '2026-06-01',
              createdAt: '2026-05-15T00:00:00.000Z',
            },
          ],
          status: 'active' as const,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-15T00:00:00.000Z',
        },
      ],
      inactiveContracts: [],
      totalActiveIncomeInCents: 0,
      totalActiveExpenseInCents: 120000,
      netActiveAmountInCents: -120000,
    };
    const settings = {
      safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot,
      generatedAt: '2026-05-20T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      referenceDate: '2026-05-20',
      settings,
      transactionsSnapshot: {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
    });

    const expected = buildFinancialHorizon(
      {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-05-20',
        totalMonths: 24,
        safetyMarginInCents: settings.safetyMarginInCents,
        projectedContractOccurrences: buildProjectedContractOccurrences(
          contractsSnapshot,
          {
            currentDate: '2026-05-20',
            totalMonths: 24,
          },
        ),
      },
    );

    expect(snapshot.horizon.months.slice(0, 4)).toEqual(
      expected.months.slice(0, 4),
    );
    expect(snapshot.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual(
      [120000, 135000, 135000, 0],
    );
  });

  it('integra faturas projetadas de cartao apenas no vencimento correto', () => {
    const creditCardsSnapshot = {
      cards: [
        {
          id: 'card-1',
          name: 'Visa principal',
          creditLimitInCents: 300000,
          statementClosingDay: 25,
          dueDay: 8,
          paymentAccountId: 'checking',
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
            creditCardName: 'Visa principal',
            invoiceMonth: '2026-06',
            cycleStartDate: '2026-04-26',
            cycleEndDate: '2026-05-25',
            dueDate: '2026-06-08',
            totalAmountInCents: 50000,
          },
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
      purchases: [
        {
          id: 'purchase-1',
          creditCardId: 'card-1',
          creditCardName: 'Visa principal',
          paymentAccountId: 'checking',
          paymentAccountName: 'Conta principal',
          description: 'Notebook',
          amountInCents: 50000,
          purchaseDate: '2026-05-02',
          invoiceMonth: '2026-06',
          cycleStartDate: '2026-04-26',
          cycleEndDate: '2026-05-25',
          dueDate: '2026-06-08',
          createdAt: '2026-05-02T12:00:00.000Z',
          updatedAt: '2026-05-02T12:00:00.000Z',
        },
      ],
      invoices: [
        {
          id: 'card-1:2026-06',
          creditCardId: 'card-1',
          creditCardName: 'Visa principal',
          paymentAccountId: 'checking',
          paymentAccountName: 'Conta principal',
          invoiceMonth: '2026-06',
          cycleStartDate: '2026-04-26',
          cycleEndDate: '2026-05-25',
          dueDate: '2026-06-08',
          totalAmountInCents: 50000,
          purchaseCount: 1,
          status: 'open' as const,
          purchases: [
            {
              id: 'purchase-1',
              creditCardId: 'card-1',
              creditCardName: 'Visa principal',
              paymentAccountId: 'checking',
              paymentAccountName: 'Conta principal',
              description: 'Notebook',
              amountInCents: 50000,
              purchaseDate: '2026-05-02',
              invoiceMonth: '2026-06',
              cycleStartDate: '2026-04-26',
              cycleEndDate: '2026-05-25',
              dueDate: '2026-06-08',
              createdAt: '2026-05-02T12:00:00.000Z',
              updatedAt: '2026-05-02T12:00:00.000Z',
            },
          ],
        },
      ],
      projectedInvoices: buildProjectedCreditCardInvoiceOccurrences(
        [
          {
            id: 'card-1:2026-06',
            creditCardId: 'card-1',
            creditCardName: 'Visa principal',
            paymentAccountId: 'checking',
            paymentAccountName: 'Conta principal',
            invoiceMonth: '2026-06',
            cycleStartDate: '2026-04-26',
            cycleEndDate: '2026-05-25',
            dueDate: '2026-06-08',
            totalAmountInCents: 50000,
            purchaseCount: 1,
            status: 'open' as const,
            purchases: [
              {
                id: 'purchase-1',
                creditCardId: 'card-1',
                creditCardName: 'Visa principal',
                paymentAccountId: 'checking',
                paymentAccountName: 'Conta principal',
                description: 'Notebook',
                amountInCents: 50000,
                purchaseDate: '2026-05-02',
                invoiceMonth: '2026-06',
                cycleStartDate: '2026-04-26',
                cycleEndDate: '2026-05-25',
                dueDate: '2026-06-08',
                createdAt: '2026-05-02T12:00:00.000Z',
                updatedAt: '2026-05-02T12:00:00.000Z',
              },
            ],
          },
        ],
        '2026-05-06',
      ),
      totalCreditLimitInCents: 300000,
      totalInvoiceAmountInCents: 50000,
    };
    const settings = {
      safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      creditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-05-06T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      referenceDate: '2026-05-06',
      settings,
      transactionsSnapshot: {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
    });

    const expected = buildFinancialHorizon(
      {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-05-06',
        totalMonths: 24,
        safetyMarginInCents: settings.safetyMarginInCents,
        projectedCreditCardInvoiceOccurrences:
          buildProjectedCreditCardInvoiceOccurrences(
            creditCardsSnapshot.invoices,
            '2026-05-06',
          ),
      },
    );

    expect(snapshot.horizon.months.slice(0, 3)).toEqual(expected.months.slice(0, 3));
    expect(snapshot.horizon.months.slice(0, 3).map((month) => month.expenseInCents)).toEqual(
      [0, 50000, 0],
    );
  });

  it('integra parcelas projetadas em conta ao horizonte oficial', () => {
    const settings = {
      safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-05-01T12:00:00.000Z',
      installmentsSnapshot: {
        ...emptyInstallmentsSnapshot,
        projectedAccountOccurrences: [
          {
            id: 'plan-1:1',
            planId: '11111111-1111-4111-8111-111111111111',
            description: 'Notebook parcelado',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 30000,
            signedAmountInCents: -30000,
            occurrenceDate: '2026-05-05',
            installmentNumber: 1,
            totalInstallments: 4,
          },
          {
            id: 'plan-1:2',
            planId: '11111111-1111-4111-8111-111111111111',
            description: 'Notebook parcelado',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 30000,
            signedAmountInCents: -30000,
            occurrenceDate: '2026-05-05',
            installmentNumber: 2,
            totalInstallments: 4,
          },
          {
            id: 'plan-1:3',
            planId: '11111111-1111-4111-8111-111111111111',
            description: 'Notebook parcelado',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 30000,
            signedAmountInCents: -30000,
            occurrenceDate: '2026-05-05',
            installmentNumber: 3,
            totalInstallments: 4,
          },
          {
            id: 'plan-1:4',
            planId: '11111111-1111-4111-8111-111111111111',
            description: 'Notebook parcelado',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 30000,
            signedAmountInCents: -30000,
            occurrenceDate: '2026-08-10',
            installmentNumber: 4,
            totalInstallments: 4,
          },
        ],
        totalRemainingAmountInCents: 120000,
      },
      referenceDate: '2026-05-01',
      settings,
      transactionsSnapshot: {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
    });

    expect(snapshot.horizon.months.slice(0, 4).map((month) => month.expenseInCents)).toEqual([
      90000,
      0,
      0,
      30000,
    ]);
  });

  it('aplica override manual de despesa variavel e reserva de provisao no horizonte oficial', () => {
    const settings = {
      safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
      variableExpenseWindowInMonths: DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
    };

    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot: {
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 164000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 164000,
      },
      creditCardsSnapshot: emptyCreditCardsSnapshot,
      contractsSnapshot: emptyContractsSnapshot,
      generatedAt: '2026-05-01T12:00:00.000Z',
      installmentsSnapshot: emptyInstallmentsSnapshot,
      provisionsSnapshot: {
        activeProvisions: [
          {
            id: 'prov-1',
            accountId: 'checking',
            accountName: 'Conta principal',
            description: 'Seguro anual',
            category: 'Casa',
            targetAmountInCents: 90000,
            startDate: '2026-05-05',
            targetDate: '2026-08-10',
            status: 'active',
            redeemedAt: null,
            createdAt: '2026-05-01T00:00:00.000Z',
            updatedAt: '2026-05-01T00:00:00.000Z',
          },
        ],
        redeemedProvisions: [],
        totalActiveTargetAmountInCents: 90000,
      },
      referenceDate: '2026-05-01',
      settings,
      transactionsSnapshot: {
        totalIncomeInCents: 0,
        totalExpenseInCents: 36000,
        transactions: [
          {
            id: 'tx-1',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 10000,
            signedAmountInCents: -10000,
            category: 'Mercado',
            description: 'Supermercado',
            transactionDate: '2026-02-10',
            type: 'expense',
            createdAt: '2026-02-10T12:00:00.000Z',
            updatedAt: '2026-02-10T12:00:00.000Z',
          },
          {
            id: 'tx-2',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 12000,
            signedAmountInCents: -12000,
            category: 'Mercado',
            description: 'Supermercado',
            transactionDate: '2026-03-10',
            type: 'expense',
            createdAt: '2026-03-10T12:00:00.000Z',
            updatedAt: '2026-03-10T12:00:00.000Z',
          },
          {
            id: 'tx-3',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 14000,
            signedAmountInCents: -14000,
            category: 'Mercado',
            description: 'Supermercado',
            transactionDate: '2026-04-10',
            type: 'expense',
            createdAt: '2026-04-10T12:00:00.000Z',
            updatedAt: '2026-04-10T12:00:00.000Z',
          },
        ],
      },
      variableExpenseOverrides: [
        {
          accountId: 'checking',
          description: 'Supermercado',
          occurrenceDate: '2026-06-10',
          amountInCents: 18500,
        },
      ],
    });

    expect(snapshot.horizon.months[0]).toMatchObject({
      monthStart: '2026-05-01',
      cashOpeningBalanceInCents: 164000,
      cashClosingBalanceInCents: 164000,
      openingBalanceInCents: 164000,
      closingBalanceInCents: 134000,
      provisionAllocationInCents: 30000,
      provisionReservedBalanceInCents: 30000,
    });
    expect(snapshot.horizon.months[1]).toMatchObject({
      monthStart: '2026-06-01',
      expenseInCents: 18500,
      cashClosingBalanceInCents: 145500,
      closingBalanceInCents: 85500,
      provisionAllocationInCents: 30000,
      provisionReservedBalanceInCents: 60000,
    });
    expect(snapshot.horizon.months[2]).toMatchObject({
      monthStart: '2026-07-01',
      expenseInCents: 12000,
      provisionAllocationInCents: 30000,
      provisionReservedBalanceInCents: 90000,
    });
  });
});