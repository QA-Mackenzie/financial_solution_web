import { describe, expect, it } from 'vitest';

import { sanitizeAccountInput, validateAccountInput } from './accountInput';

describe('validateAccountInput', () => {
  it('rejects empty names after trimming', () => {
    expect(
      validateAccountInput({
        name: '   ',
        type: 'checking',
        openingBalanceInCents: 100,
      }),
    ).toEqual([
      {
        field: 'name',
        message: 'Informe um nome para a conta.',
      },
    ]);
  });

  it('rejects invalid types and fractional cent values', () => {
    expect(
      validateAccountInput({
        name: 'Carteira',
        type: 'crypto',
        openingBalanceInCents: 10.5,
      }),
    ).toEqual([
      {
        field: 'type',
        message: 'Selecione um tipo de conta valido.',
      },
      {
        field: 'openingBalanceInCents',
        message: 'O saldo inicial deve ser informado em centavos inteiros.',
      },
    ]);
  });
});

describe('sanitizeAccountInput', () => {
  it('normalizes extra whitespace in the account name', () => {
    expect(
      sanitizeAccountInput({
        name: '  Conta   Principal  ',
        type: 'checking',
        openingBalanceInCents: 250000,
      }),
    ).toEqual({
      name: 'Conta Principal',
      type: 'checking',
      openingBalanceInCents: 250000,
    });
  });
});
