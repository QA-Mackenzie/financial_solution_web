import { describe, expect, it } from 'vitest';

import {
  sanitizeInstallmentAnticipationInput,
  sanitizeInstallmentPlanInput,
  validateInstallmentAnticipationInput,
  validateInstallmentPlanInput,
} from './installmentInput';

describe('validateInstallmentPlanInput', () => {
  it('rejects invalid installment plan payloads', () => {
    expect(
      validateInstallmentPlanInput({
        sourceType: 'wallet',
        accountId: ' ',
        description: ' ',
        totalAmountInCents: 1,
        installmentCount: 1,
        firstOccurrenceDate: '24/04/2026',
      }),
    ).toEqual([
      {
        field: 'sourceType',
        message: 'Selecione uma origem valida para o parcelamento.',
      },
      {
        field: 'description',
        message: 'Informe uma descricao para o parcelamento.',
      },
      {
        field: 'installmentCount',
        message: 'A quantidade de parcelas deve ficar entre 2 e 60.',
      },
      {
        field: 'firstOccurrenceDate',
        message: 'Informe uma data inicial valida no formato AAAA-MM-DD.',
      },
    ]);
  });

  it('requires the matching source identifier', () => {
    expect(
      validateInstallmentPlanInput({
        sourceType: 'account',
        description: 'Notebook',
        totalAmountInCents: 120000,
        installmentCount: 12,
        firstOccurrenceDate: '2026-04-24',
      }),
    ).toContainEqual({
      field: 'accountId',
      message: 'Selecione uma conta para o parcelamento.',
    });

    expect(
      validateInstallmentPlanInput({
        sourceType: 'creditCard',
        description: 'Notebook',
        totalAmountInCents: 120000,
        installmentCount: 12,
        firstOccurrenceDate: '2026-04-24',
      }),
    ).toContainEqual({
      field: 'creditCardId',
      message: 'Selecione um cartao para o parcelamento.',
    });
  });
});

describe('sanitizeInstallmentPlanInput', () => {
  it('normalizes description and trims identifiers', () => {
    expect(
      sanitizeInstallmentPlanInput({
        sourceType: 'creditCard',
        creditCardId: ' card-1 ',
        description: '  Notebook   gamer  ',
        totalAmountInCents: 120000,
        installmentCount: 12,
        firstOccurrenceDate: ' 2026-04-24 ',
      }),
    ).toEqual({
      sourceType: 'creditCard',
      creditCardId: 'card-1',
      description: 'Notebook gamer',
      totalAmountInCents: 120000,
      installmentCount: 12,
      firstOccurrenceDate: '2026-04-24',
    });
  });
});

describe('installment anticipation validation', () => {
  it('rejects invalid anticipation payloads', () => {
    expect(
      validateInstallmentAnticipationInput({
        planId: ' ',
        operationDate: '26/04/2026',
        affectedInstallmentCount: 0,
      }),
    ).toEqual([
      {
        field: 'planId',
        message: 'Selecione um parcelamento para antecipar.',
      },
      {
        field: 'operationDate',
        message:
          'Informe uma data valida para a antecipacao no formato AAAA-MM-DD.',
      },
      {
        field: 'affectedInstallmentCount',
        message: 'A quantidade de parcelas antecipadas deve ficar entre 1 e 60.',
      },
    ]);
  });

  it('trims anticipation input values', () => {
    expect(
      sanitizeInstallmentAnticipationInput({
        planId: ' plan-1 ',
        operationDate: ' 2026-05-10 ',
        affectedInstallmentCount: 2,
      }),
    ).toEqual({
      planId: 'plan-1',
      operationDate: '2026-05-10',
      affectedInstallmentCount: 2,
    });
  });
});
