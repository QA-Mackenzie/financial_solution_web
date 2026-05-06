import { describe, expect, it } from 'vitest';

import {
  sanitizeCreditCardPurchaseInput,
  validateCreditCardPurchaseInput,
} from './creditCardPurchaseInput';

describe('validateCreditCardPurchaseInput', () => {
  it('rejects invalid purchase payloads', () => {
    expect(
      validateCreditCardPurchaseInput({
        creditCardId: ' ',
        description: '   ',
        category: 'Categoria repetida demais '.repeat(8),
        tagIds: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
        amountInCents: 0,
        purchaseDate: '24/04/2026',
      }),
    ).toEqual([
      {
        field: 'creditCardId',
        message: 'Selecione um cartao para registrar a compra.',
      },
      {
        field: 'description',
        message: 'Informe uma descricao para a compra no cartao.',
      },
      {
        field: 'category',
        message: 'A categoria da compra deve ter no maximo 80 caracteres.',
      },
      {
        field: 'tagIds',
        message: 'Selecione no maximo 8 tags para o mesmo item financeiro.',
      },
      {
        field: 'amountInCents',
        message: 'O valor da compra deve ser maior que zero.',
      },
      {
        field: 'purchaseDate',
        message: 'Informe uma data valida no formato AAAA-MM-DD.',
      },
    ]);
  });

  it('rejects fractional cent values', () => {
    expect(
      validateCreditCardPurchaseInput({
        creditCardId: 'card-1',
        description: 'Supermercado',
        amountInCents: 100.5,
        purchaseDate: '2026-04-24',
      }),
    ).toContainEqual({
      field: 'amountInCents',
      message: 'O valor da compra deve ser informado em centavos inteiros.',
    });
  });
});

describe('sanitizeCreditCardPurchaseInput', () => {
  it('normalizes description and trims identifiers', () => {
    expect(
      sanitizeCreditCardPurchaseInput({
        creditCardId: ' card-1 ',
        description: '  Loja   online  ',
        category: '  Lazer ',
        tagIds: [' tag-2 ', 'tag-1', 'tag-2'],
        amountInCents: 25990,
        purchaseDate: ' 2026-04-24 ',
      }),
    ).toEqual({
      creditCardId: 'card-1',
      description: 'Loja online',
      category: 'Lazer',
      tagIds: ['tag-1', 'tag-2'],
      amountInCents: 25990,
      purchaseDate: '2026-04-24',
    });
  });
});
