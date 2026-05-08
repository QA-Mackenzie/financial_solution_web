import { describe, expect, it } from 'vitest';

import {
  buildFinancialHorizon,
  classifyHorizonBalance,
} from './financialHorizon';
import {
  marginPressureFixture,
  multiAccountConsolidatedFixture,
  positiveTrajectoryFixture,
} from './financialHorizon.fixtures';

describe('classifyHorizonBalance', () => {
  it('classifies balances as healthy, attention or critical', () => {
    expect(classifyHorizonBalance(80000, 50000)).toBe('healthy');
    expect(classifyHorizonBalance(50000, 50000)).toBe('attention');
    expect(classifyHorizonBalance(12000, 50000)).toBe('attention');
    expect(classifyHorizonBalance(-1, 50000)).toBe('critical');
  });
});

describe('buildFinancialHorizon', () => {
  it('builds a 24-month horizon from the current month by default', () => {
    const horizon = buildFinancialHorizon(
      {
        consolidatedBalanceInCents: 0,
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 100000,
            currentBalanceInCents: 100000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        archivedAccounts: [],
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      { currentDate: '2026-04-24' },
    );

    expect(horizon.months).toHaveLength(24);
    expect(horizon.months[0]?.monthStart).toBe('2026-04-01');
    expect(horizon.months[23]?.monthStart).toBe('2028-03-01');
    expect(horizon.months[0]?.riskLevel).toBe('healthy');
  });

  it('preserves a healthy positive trajectory with representative fixture data', () => {
    const horizon = buildFinancialHorizon(
      positiveTrajectoryFixture.accountsSnapshot,
      positiveTrajectoryFixture.transactionsSnapshot,
      positiveTrajectoryFixture.options,
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 125000,
        incomeInCents: 0,
        expenseInCents: 10000,
        closingBalanceInCents: 115000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 115000,
        incomeInCents: 10000,
        expenseInCents: 0,
        closingBalanceInCents: 125000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 125000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 125000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-07',
        monthStart: '2026-07-01',
        openingBalanceInCents: 125000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 125000,
        riskLevel: 'healthy',
      },
    ]);
  });

  it('preserves the regression path for attention and critical months', () => {
    const horizon = buildFinancialHorizon(
      marginPressureFixture.accountsSnapshot,
      marginPressureFixture.transactionsSnapshot,
      marginPressureFixture.options,
    );

    expect(horizon.months.map((month) => month.closingBalanceInCents)).toEqual([
      20000, -5000, -15000,
    ]);
    expect(horizon.months.map((month) => month.riskLevel)).toEqual([
      'attention',
      'critical',
      'critical',
    ]);
  });

  it('keeps the projection consolidated across multiple active accounts only', () => {
    const horizon = buildFinancialHorizon(
      multiAccountConsolidatedFixture.accountsSnapshot,
      multiAccountConsolidatedFixture.transactionsSnapshot,
      multiAccountConsolidatedFixture.options,
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 160000,
        incomeInCents: 5000,
        expenseInCents: 30000,
        closingBalanceInCents: 135000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 135000,
        incomeInCents: 10000,
        expenseInCents: 20000,
        closingBalanceInCents: 125000,
        riskLevel: 'attention',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 125000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 125000,
        riskLevel: 'attention',
      },
    ]);
  });

  it('adds projected contract incomes and expenses without counting archived-account occurrences', () => {
    const horizon = buildFinancialHorizon(
      {
        consolidatedBalanceInCents: 100000,
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 100000,
            currentBalanceInCents: 100000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        archivedAccounts: [
          {
            id: 'old-account',
            name: 'Conta antiga',
            type: 'cash',
            openingBalanceInCents: 20000,
            currentBalanceInCents: 20000,
            isArchived: true,
            archivedAt: '2026-03-01T10:00:00.000Z',
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-03-01T10:00:00.000Z',
          },
        ],
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
        projectedContractOccurrences: [
          {
            id: 'contract-0:2026-04-05',
            contractId: 'contract-0',
            contractName: 'Salario',
            accountId: 'checking',
            accountName: 'Conta principal',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 50000,
            signedAmountInCents: 50000,
            occurrenceDate: '2026-04-05',
          },
          {
            id: 'contract-1:2026-04-10',
            contractId: 'contract-1',
            contractName: 'Internet',
            accountId: 'checking',
            accountName: 'Conta principal',
            category: 'Casa',
            type: 'expense',
            amountInCents: 15990,
            signedAmountInCents: -15990,
            occurrenceDate: '2026-04-10',
          },
          {
            id: 'contract-0:2026-05-05',
            contractId: 'contract-0',
            contractName: 'Salario',
            accountId: 'checking',
            accountName: 'Conta principal',
            category: 'Trabalho',
            type: 'income',
            amountInCents: 50000,
            signedAmountInCents: 50000,
            occurrenceDate: '2026-05-05',
          },
          {
            id: 'contract-1:2026-05-10',
            contractId: 'contract-1',
            contractName: 'Internet',
            accountId: 'checking',
            accountName: 'Conta principal',
            category: 'Casa',
            type: 'expense',
            amountInCents: 15990,
            signedAmountInCents: -15990,
            occurrenceDate: '2026-05-10',
          },
          {
            id: 'contract-2:2026-04-05',
            contractId: 'contract-2',
            contractName: 'Contrato arquivado',
            accountId: 'old-account',
            accountName: 'Conta antiga',
            category: 'Legado',
            type: 'expense',
            amountInCents: 5000,
            signedAmountInCents: -5000,
            occurrenceDate: '2026-04-05',
          },
        ],
      },
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 100000,
        incomeInCents: 50000,
        expenseInCents: 15990,
        closingBalanceInCents: 134010,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 134010,
        incomeInCents: 50000,
        expenseInCents: 15990,
        closingBalanceInCents: 168020,
        riskLevel: 'healthy',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 168020,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 168020,
        riskLevel: 'healthy',
      },
    ]);
  });

  it('projects credit card invoices only on the due month for active payment accounts', () => {
    const horizon = buildFinancialHorizon(
      {
        consolidatedBalanceInCents: 100000,
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 100000,
            currentBalanceInCents: 100000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        archivedAccounts: [
          {
            id: 'old-account',
            name: 'Conta antiga',
            type: 'cash',
            openingBalanceInCents: 20000,
            currentBalanceInCents: 20000,
            isArchived: true,
            archivedAt: '2026-03-01T10:00:00.000Z',
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-03-01T10:00:00.000Z',
          },
        ],
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
        projectedCreditCardInvoiceOccurrences: [
          {
            id: 'card-1:2026-05',
            creditCardId: 'card-1',
            creditCardName: 'Visa',
            paymentAccountId: 'checking',
            paymentAccountName: 'Conta principal',
            invoiceMonth: '2026-05',
            amountInCents: 25000,
            signedAmountInCents: -25000,
            occurrenceDate: '2026-05-08',
          },
          {
            id: 'card-2:2026-05',
            creditCardId: 'card-2',
            creditCardName: 'Legado',
            paymentAccountId: 'old-account',
            paymentAccountName: 'Conta antiga',
            invoiceMonth: '2026-05',
            amountInCents: 99999,
            signedAmountInCents: -99999,
            occurrenceDate: '2026-05-09',
          },
        ],
      },
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 100000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 100000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 100000,
        incomeInCents: 0,
        expenseInCents: 25000,
        closingBalanceInCents: 75000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 75000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 75000,
        riskLevel: 'healthy',
      },
    ]);
  });

  it('adds account installments to the projected expense flow', () => {
    const horizon = buildFinancialHorizon(
      {
        consolidatedBalanceInCents: 100000,
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 100000,
            currentBalanceInCents: 100000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        archivedAccounts: [],
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
        projectedInstallmentOccurrences: [
          {
            id: 'plan-1:1',
            planId: 'plan-1',
            description: 'Notebook',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 10000,
            signedAmountInCents: -10000,
            occurrenceDate: '2026-04-24',
            installmentNumber: 1,
            totalInstallments: 3,
          },
          {
            id: 'plan-1:2',
            planId: 'plan-1',
            description: 'Notebook',
            accountId: 'checking',
            accountName: 'Conta principal',
            amountInCents: 10000,
            signedAmountInCents: -10000,
            occurrenceDate: '2026-05-24',
            installmentNumber: 2,
            totalInstallments: 3,
          },
        ],
      },
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 100000,
        incomeInCents: 0,
        expenseInCents: 10000,
        closingBalanceInCents: 90000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 90000,
        incomeInCents: 0,
        expenseInCents: 10000,
        closingBalanceInCents: 80000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 80000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 80000,
        riskLevel: 'healthy',
      },
    ]);
  });

  it('adds projected variable expenses only for active accounts', () => {
    const horizon = buildFinancialHorizon(
      {
        consolidatedBalanceInCents: 100000,
        activeAccounts: [
          {
            id: 'checking',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 100000,
            currentBalanceInCents: 100000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-01-01T10:00:00.000Z',
          },
        ],
        archivedAccounts: [
          {
            id: 'old-account',
            name: 'Conta antiga',
            type: 'cash',
            openingBalanceInCents: 20000,
            currentBalanceInCents: 20000,
            isArchived: true,
            archivedAt: '2026-03-01T10:00:00.000Z',
            createdAt: '2026-01-01T10:00:00.000Z',
            updatedAt: '2026-03-01T10:00:00.000Z',
          },
        ],
      },
      {
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
        transactions: [],
      },
      {
        currentDate: '2026-04-24',
        totalMonths: 3,
        projectedVariableExpenseOccurrences: [
          {
            id: 'checking:supermercado:2026-05-12',
            accountId: 'checking',
            accountName: 'Conta principal',
            description: 'Supermercado',
            amountInCents: 12000,
            signedAmountInCents: -12000,
            occurrenceDate: '2026-05-12',
            historyMonthCount: 3,
            windowInMonths: 3,
            source: 'movingAverage',
          },
          {
            id: 'old-account:supermercado:2026-05-12',
            accountId: 'old-account',
            accountName: 'Conta antiga',
            description: 'Supermercado legado',
            amountInCents: 5000,
            signedAmountInCents: -5000,
            occurrenceDate: '2026-05-12',
            historyMonthCount: 3,
            windowInMonths: 3,
            source: 'movingAverage',
          },
        ],
      },
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 100000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 100000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 100000,
        incomeInCents: 0,
        expenseInCents: 12000,
        closingBalanceInCents: 88000,
        riskLevel: 'healthy',
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 88000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 88000,
        riskLevel: 'healthy',
      },
    ]);
  });
});
