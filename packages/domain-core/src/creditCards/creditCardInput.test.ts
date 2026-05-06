import { describe, expect, it } from 'vitest';

import {
  normalizeCreditCardName,
  sanitizeCreditCardInput,
  validateCreditCardInput,
} from './creditCardInput';

describe('creditCardInput', () => {
  it('normalizes and sanitizes valid credit card input', () => {
    const input = sanitizeCreditCardInput({
      name: '  Nubank   Ultravioleta  ',
      creditLimitInCents: 2500000,
      statementClosingDay: 25,
      dueDay: 5,
      paymentAccountId: ' checking-1 ',
    });

    expect(normalizeCreditCardName('  Cartao   principal ')).toBe(
      'Cartao principal',
    );
    expect(input).toEqual({
      name: 'Nubank Ultravioleta',
      creditLimitInCents: 2500000,
      statementClosingDay: 25,
      dueDay: 5,
      paymentAccountId: 'checking-1',
    });
  });

  it('rejects invalid day configuration when closing and due days are equal', () => {
    const issues = validateCreditCardInput({
      name: 'Visa',
      creditLimitInCents: 100000,
      statementClosingDay: 10,
      dueDay: 10,
      paymentAccountId: 'checking-1',
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'dueDay',
          message:
            'O vencimento do cartao deve ser diferente do dia de fechamento.',
        }),
      ]),
    );
  });

  it('rejects blank name, missing payment account and invalid credit limit', () => {
    const issues = validateCreditCardInput({
      name: '   ',
      creditLimitInCents: 0,
      statementClosingDay: 0,
      dueDay: 32,
      paymentAccountId: ' ',
    });

    expect(issues.map((issue) => issue.field)).toEqual([
      'name',
      'creditLimitInCents',
      'statementClosingDay',
      'dueDay',
      'paymentAccountId',
    ]);
  });
});
