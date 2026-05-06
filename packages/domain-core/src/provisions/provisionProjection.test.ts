import { describe, expect, it } from 'vitest';

import { buildFinancialHorizon } from '../horizon/financialHorizon';
import {
  buildProjectedProvisionOccurrences,
  buildProvisionAdjustedHorizon,
} from './provisionProjection';

describe('buildProjectedProvisionOccurrences', () => {
  it('splits a provision across the months before the rescue month and releases it on rescue', () => {
    const occurrences = buildProjectedProvisionOccurrences(
      {
        activeProvisions: [
          {
            id: 'prov-1',
            accountId: 'account-1',
            accountName: 'Conta principal',
            description: 'Seguro anual',
            category: 'Casa',
            targetAmountInCents: 100003,
            startDate: '2026-04-15',
            targetDate: '2026-08-20',
            status: 'active',
            redeemedAt: null,
            createdAt: '2026-04-15T00:00:00.000Z',
            updatedAt: '2026-04-15T00:00:00.000Z',
          },
        ],
        redeemedProvisions: [],
        totalActiveTargetAmountInCents: 100003,
      },
      {
        currentDate: '2026-04-20',
        totalMonths: 6,
      },
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        occurrenceDate: '2026-04-01',
        kind: 'allocation',
        amountInCents: 25001,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-05-01',
        kind: 'allocation',
        amountInCents: 25001,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-06-01',
        kind: 'allocation',
        amountInCents: 25001,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-07-01',
        kind: 'allocation',
        amountInCents: 25000,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-08-01',
        kind: 'release',
        amountInCents: 100003,
      }),
    ]);
  });

  it('shortens the reserve window when the provision is redeemed early', () => {
    const occurrences = buildProjectedProvisionOccurrences(
      {
        activeProvisions: [
          {
            id: 'prov-1',
            accountId: 'account-1',
            accountName: 'Conta principal',
            description: 'Seguro anual',
            category: 'Casa',
            targetAmountInCents: 90000,
            startDate: '2026-04-15',
            targetDate: '2026-08-20',
            status: 'active',
            redeemedAt: '2026-06-10',
            createdAt: '2026-04-15T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
        ],
        redeemedProvisions: [],
        totalActiveTargetAmountInCents: 90000,
      },
      {
        currentDate: '2026-04-20',
        totalMonths: 6,
      },
    );

    expect(occurrences).toEqual([
      expect.objectContaining({
        occurrenceDate: '2026-04-01',
        kind: 'allocation',
        amountInCents: 45000,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-05-01',
        kind: 'allocation',
        amountInCents: 45000,
      }),
      expect.objectContaining({
        occurrenceDate: '2026-06-01',
        kind: 'release',
        amountInCents: 90000,
      }),
    ]);
  });
});

describe('buildProvisionAdjustedHorizon', () => {
  it('reduces the available horizon without inflating real expenses', () => {
    const baseHorizon = buildFinancialHorizon(
      {
        activeAccounts: [
          {
            id: 'account-1',
            name: 'Conta principal',
            type: 'checking',
            openingBalanceInCents: 200000,
            currentBalanceInCents: 200000,
            isArchived: false,
            archivedAt: null,
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
        archivedAccounts: [],
        consolidatedBalanceInCents: 200000,
      },
      {
        transactions: [],
        totalIncomeInCents: 0,
        totalExpenseInCents: 0,
      },
      {
        currentDate: '2026-04-20',
        totalMonths: 4,
        safetyMarginInCents: 50000,
      },
    );
    const horizon = buildProvisionAdjustedHorizon(
      baseHorizon,
      buildProjectedProvisionOccurrences(
        {
          activeProvisions: [
            {
              id: 'prov-1',
              accountId: 'account-1',
              accountName: 'Conta principal',
              description: 'IPVA',
              category: 'Veiculo',
              targetAmountInCents: 120000,
              startDate: '2026-04-10',
              targetDate: '2026-07-05',
              status: 'active',
              redeemedAt: null,
              createdAt: '2026-04-10T00:00:00.000Z',
              updatedAt: '2026-04-10T00:00:00.000Z',
            },
          ],
          redeemedProvisions: [],
          totalActiveTargetAmountInCents: 120000,
        },
        {
          currentDate: '2026-04-20',
          totalMonths: 4,
        },
      ),
      50000,
    );

    expect(horizon.months).toEqual([
      {
        id: '2026-04',
        monthStart: '2026-04-01',
        openingBalanceInCents: 200000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 160000,
        riskLevel: 'healthy',
        cashOpeningBalanceInCents: 200000,
        cashClosingBalanceInCents: 200000,
        provisionAllocationInCents: 40000,
        provisionReleaseInCents: 0,
        provisionReservedBalanceInCents: 40000,
      },
      {
        id: '2026-05',
        monthStart: '2026-05-01',
        openingBalanceInCents: 160000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 120000,
        riskLevel: 'healthy',
        cashOpeningBalanceInCents: 200000,
        cashClosingBalanceInCents: 200000,
        provisionAllocationInCents: 40000,
        provisionReleaseInCents: 0,
        provisionReservedBalanceInCents: 80000,
      },
      {
        id: '2026-06',
        monthStart: '2026-06-01',
        openingBalanceInCents: 120000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 80000,
        riskLevel: 'healthy',
        cashOpeningBalanceInCents: 200000,
        cashClosingBalanceInCents: 200000,
        provisionAllocationInCents: 40000,
        provisionReleaseInCents: 0,
        provisionReservedBalanceInCents: 120000,
      },
      {
        id: '2026-07',
        monthStart: '2026-07-01',
        openingBalanceInCents: 80000,
        incomeInCents: 0,
        expenseInCents: 0,
        closingBalanceInCents: 200000,
        riskLevel: 'healthy',
        cashOpeningBalanceInCents: 200000,
        cashClosingBalanceInCents: 200000,
        provisionAllocationInCents: 0,
        provisionReleaseInCents: 120000,
        provisionReservedBalanceInCents: 0,
      },
    ]);
  });
});
