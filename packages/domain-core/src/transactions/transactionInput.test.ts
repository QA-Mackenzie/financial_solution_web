import { describe, expect, it } from 'vitest';

import {
  sanitizeTransactionInput,
  validateTransactionInput,
} from './transactionInput';

describe('validateTransactionInput', () => {
  it('rejects invalid transaction payloads', () => {
    expect(
      validateTransactionInput({
        accountId: ' ',
        type: 'transfer',
        description: '   ',
        category: 'Categoria repetida demais '.repeat(8),
        tagIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        amountInCents: 0,
        transactionDate: '24/04/2026',
      }),
    ).toEqual([
      {
        field: 'accountId',
        message: 'Selecione uma conta para o lancamento.',
      },
      {
        field: 'type',
        message: 'Selecione um tipo de lancamento valido.',
      },
      {
        field: 'description',
        message: 'Informe uma descricao para o lancamento.',
      },
      {
        field: 'category',
        message: 'A categoria do lancamento deve ter no maximo 80 caracteres.',
      },
      {
        field: 'tagIds',
        message: 'Selecione no maximo 8 tags para o mesmo item financeiro.',
      },
      {
        field: 'amountInCents',
        message: 'O valor do lancamento deve ser maior que zero.',
      },
      {
        field: 'transactionDate',
        message: 'Informe uma data valida no formato AAAA-MM-DD.',
      },
    ]);
  });

  it('rejects fractional cent values', () => {
    expect(
      validateTransactionInput({
        accountId: 'account-1',
        type: 'income',
        description: 'Salario',
        amountInCents: 100.5,
        transactionDate: '2026-04-24',
      }),
    ).toContainEqual({
      field: 'amountInCents',
      message: 'O valor do lancamento deve ser informado em centavos inteiros.',
    });
  });
});

describe('sanitizeTransactionInput', () => {
  it('normalizes description and trims identifiers', () => {
    expect(
      sanitizeTransactionInput({
        accountId: ' account-1 ',
        type: 'expense',
        description: '  Conta   de   luz  ',
        category: '  Casa  ',
        tagIds: [' tag-2 ', 'tag-1', 'tag-2'],
        amountInCents: 18990,
        transactionDate: ' 2026-04-24 ',
      }),
    ).toEqual({
      accountId: 'account-1',
      type: 'expense',
      description: 'Conta de luz',
      category: 'Casa',
      tagIds: ['tag-1', 'tag-2'],
      amountInCents: 18990,
      transactionDate: '2026-04-24',
    });
  });
});
