import type { FinancialRecordListItem } from '@economy-cash/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildFinancialAnalyticsSnapshot,
  buildFinancialRecordQuerySnapshot,
} from './analyticsSnapshot';

const records: FinancialRecordListItem[] = [
  {
    accountId: '11111111-1111-4111-8111-111111111111',
    accountName: 'Conta principal',
    amountInCents: 250000,
    category: 'Trabalho',
    createdAt: '2026-05-05T12:00:00.000Z',
    description: 'Salario',
    entityId: '11111111-1111-4111-8111-111111111111',
    entityKind: 'account',
    entityName: 'Conta principal',
    id: 'record-1',
    occurrenceDate: '2026-05-05',
    recordKind: 'manualTransaction',
    signedAmountInCents: 250000,
    tags: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Salario' }],
    type: 'income',
    updatedAt: '2026-05-05T12:00:00.000Z',
  },
  {
    accountId: '11111111-1111-4111-8111-111111111111',
    accountName: 'Conta principal',
    amountInCents: 12500,
    category: 'Alimentacao',
    createdAt: '2026-05-08T12:00:00.000Z',
    description: 'Supermercado',
    entityId: '11111111-1111-4111-8111-111111111111',
    entityKind: 'account',
    entityName: 'Conta principal',
    id: 'record-2',
    occurrenceDate: '2026-05-08',
    recordKind: 'manualTransaction',
    signedAmountInCents: -12500,
    tags: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Casa' }],
    type: 'expense',
    updatedAt: '2026-05-08T12:00:00.000Z',
  },
  {
    accountId: '11111111-1111-4111-8111-111111111111',
    accountName: 'Conta principal',
    amountInCents: 32000,
    category: 'Saude',
    createdAt: '2026-06-02T12:00:00.000Z',
    description: 'Farmacia',
    entityId: '22222222-2222-4222-8222-222222222222',
    entityKind: 'creditCard',
    entityName: 'Cartao familia',
    id: 'record-3',
    occurrenceDate: '2026-06-02',
    recordKind: 'creditCardPurchase',
    signedAmountInCents: -32000,
    tags: [
      { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Casa' },
      { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Familia' },
    ],
    type: 'expense',
    updatedAt: '2026-06-02T12:00:00.000Z',
  },
];

describe('buildFinancialRecordQuerySnapshot', () => {
  it('filtra por periodo, categoria, tag e tipo', () => {
    const snapshot = buildFinancialRecordQuerySnapshot(records, {
      category: '  Saude ',
      fromDate: '2026-06-01',
      tagId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      type: 'expense',
    });

    expect(snapshot.recordCount).toBe(1);
    expect(snapshot.totalIncomeInCents).toBe(0);
    expect(snapshot.totalExpenseInCents).toBe(32000);
    expect(snapshot.appliedFilters.category).toBe('Saude');
    expect(snapshot.records[0]).toMatchObject({
      description: 'Farmacia',
      entityKind: 'creditCard',
      recordKind: 'creditCardPurchase',
    });
  });
});

describe('buildFinancialAnalyticsSnapshot', () => {
  it('agrega totais por categoria, tag, entidade e mes', () => {
    const snapshot = buildFinancialAnalyticsSnapshot(records);

    expect(snapshot.totalIncomeInCents).toBe(250000);
    expect(snapshot.totalExpenseInCents).toBe(44500);
    expect(snapshot.netAmountInCents).toBe(205500);
    expect(snapshot.recordCount).toBe(3);
    expect(snapshot.byCategory).toEqual([
      {
        category: 'Trabalho',
        count: 1,
        expenseInCents: 0,
        incomeInCents: 250000,
        netAmountInCents: 250000,
      },
      {
        category: 'Saude',
        count: 1,
        expenseInCents: 32000,
        incomeInCents: 0,
        netAmountInCents: -32000,
      },
      {
        category: 'Alimentacao',
        count: 1,
        expenseInCents: 12500,
        incomeInCents: 0,
        netAmountInCents: -12500,
      },
    ]);
    expect(snapshot.byTag).toEqual([
      {
        count: 1,
        expenseInCents: 0,
        incomeInCents: 250000,
        netAmountInCents: 250000,
        tagId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        tagName: 'Salario',
      },
      {
        count: 2,
        expenseInCents: 44500,
        incomeInCents: 0,
        netAmountInCents: -44500,
        tagId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        tagName: 'Casa',
      },
      {
        count: 1,
        expenseInCents: 32000,
        incomeInCents: 0,
        netAmountInCents: -32000,
        tagId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        tagName: 'Familia',
      },
    ]);
    expect(snapshot.byEntity).toEqual([
      {
        count: 2,
        entityId: '11111111-1111-4111-8111-111111111111',
        entityKind: 'account',
        entityName: 'Conta principal',
        expenseInCents: 12500,
        incomeInCents: 250000,
        netAmountInCents: 237500,
      },
      {
        count: 1,
        entityId: '22222222-2222-4222-8222-222222222222',
        entityKind: 'creditCard',
        entityName: 'Cartao familia',
        expenseInCents: 32000,
        incomeInCents: 0,
        netAmountInCents: -32000,
      },
    ]);
    expect(snapshot.byMonth).toEqual([
      {
        count: 2,
        expenseInCents: 12500,
        incomeInCents: 250000,
        monthStart: '2026-05-01',
        netAmountInCents: 237500,
      },
      {
        count: 1,
        expenseInCents: 32000,
        incomeInCents: 0,
        monthStart: '2026-06-01',
        netAmountInCents: -32000,
      },
    ]);
  });
});