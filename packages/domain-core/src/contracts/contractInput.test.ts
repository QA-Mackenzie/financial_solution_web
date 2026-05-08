import { describe, expect, it } from 'vitest';

import { sanitizeContractInput, validateContractInput } from './contractInput';

describe('validateContractInput', () => {
  it('rejects invalid contract payloads', () => {
    expect(
      validateContractInput({
        accountId: ' ',
        name: '   ',
        category: '   ',
        type: 'transfer',
        amountInCents: 0,
        dueDay: 32,
        startDate: '24/04/2026',
        status: 'paused',
      }),
    ).toEqual([
      {
        field: 'accountId',
        message: 'Selecione uma conta para o contrato.',
      },
      {
        field: 'name',
        message: 'Informe um nome para o contrato.',
      },
      {
        field: 'category',
        message: 'Informe uma categoria para o contrato.',
      },
      {
        field: 'type',
        message: 'Selecione um tipo valido para o contrato.',
      },
      {
        field: 'amountInCents',
        message: 'O valor do contrato deve ser maior que zero.',
      },
      {
        field: 'dueDay',
        message: 'O dia de vencimento do contrato deve estar entre 1 e 31.',
      },
      {
        field: 'startDate',
        message: 'Informe uma data inicial valida no formato AAAA-MM-DD.',
      },
      {
        field: 'status',
        message: 'Selecione um status valido para o contrato.',
      },
    ]);
  });

  it('rejects fractional cent values', () => {
    expect(
      validateContractInput({
        accountId: 'account-1',
        name: 'Internet fibra',
        category: 'Casa',
        type: 'expense',
        amountInCents: 14999.5,
        dueDay: 12,
        startDate: '2026-04-24',
        status: 'active',
      }),
    ).toContainEqual({
      field: 'amountInCents',
      message: 'O valor do contrato deve ser informado em centavos inteiros.',
    });
  });
});

describe('sanitizeContractInput', () => {
  it('normalizes whitespace and trims identifiers', () => {
    expect(
      sanitizeContractInput({
        accountId: ' account-1 ',
        name: '  Internet   Fibra  ',
        category: '  Casa   e   streaming  ',
        type: 'expense',
        amountInCents: 18990,
        dueDay: 10,
        startDate: ' 2026-04-24 ',
        status: 'active',
      }),
    ).toEqual({
      accountId: 'account-1',
      name: 'Internet Fibra',
      category: 'Casa e streaming',
      type: 'expense',
      amountInCents: 18990,
      dueDay: 10,
      startDate: '2026-04-24',
      status: 'active',
    });
  });
});
