import type {
  CreateCreditCardPurchaseInput,
  UpdateCreditCardPurchaseInput,
} from '@economy-cash/contracts';
import { sanitizeCategoryLabel } from '@economy-cash/contracts';
import { sanitizeTagIds, validateTagIds } from '../tags/tagInput';

type ValidatedCreditCardPurchaseInput =
  | CreateCreditCardPurchaseInput
  | UpdateCreditCardPurchaseInput;

export interface CreditCardPurchaseValidationIssue {
  field:
    | 'creditCardId'
    | 'description'
    | 'category'
    | 'tagIds'
    | 'amountInCents'
    | 'purchaseDate';
  message: string;
}

export const normalizeCreditCardPurchaseDescription = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

const isValidDateString = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
};

export const validateCreditCardPurchaseInput = (input: {
  creditCardId: string;
  description: string;
  category?: string;
  tagIds?: readonly string[];
  amountInCents: number;
  purchaseDate: string;
}): CreditCardPurchaseValidationIssue[] => {
  const issues: CreditCardPurchaseValidationIssue[] = [];
  const normalizedDescription = normalizeCreditCardPurchaseDescription(
    input.description,
  );
  const normalizedCategory = sanitizeCategoryLabel(input.category);

  if (!input.creditCardId.trim()) {
    issues.push({
      field: 'creditCardId',
      message: 'Selecione um cartao para registrar a compra.',
    });
  }

  if (!normalizedDescription) {
    issues.push({
      field: 'description',
      message: 'Informe uma descricao para a compra no cartao.',
    });
  }

  if (normalizedDescription.length > 120) {
    issues.push({
      field: 'description',
      message: 'A descricao da compra deve ter no maximo 120 caracteres.',
    });
  }

  if (normalizedCategory.length > 80) {
    issues.push({
      field: 'category',
      message: 'A categoria da compra deve ter no maximo 80 caracteres.',
    });
  }

  for (const message of validateTagIds(input.tagIds)) {
    issues.push({
      field: 'tagIds',
      message,
    });
  }

  if (
    !Number.isFinite(input.amountInCents) ||
    !Number.isInteger(input.amountInCents)
  ) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor da compra deve ser informado em centavos inteiros.',
    });
  }

  if (input.amountInCents <= 0) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor da compra deve ser maior que zero.',
    });
  }

  if (!isValidDateString(input.purchaseDate.trim())) {
    issues.push({
      field: 'purchaseDate',
      message: 'Informe uma data valida no formato AAAA-MM-DD.',
    });
  }

  return issues;
};

export const sanitizeCreditCardPurchaseInput = <
  T extends ValidatedCreditCardPurchaseInput,
>(
  input: T,
): T => ({
  ...input,
  creditCardId: input.creditCardId.trim(),
  description: normalizeCreditCardPurchaseDescription(input.description),
  category: sanitizeCategoryLabel(input.category),
  tagIds: sanitizeTagIds(input.tagIds),
  purchaseDate: input.purchaseDate.trim(),
});

