import {
  transactionTypes,
  type CreateTransactionInput,
  type TransactionType,
  type UpdateTransactionInput,
} from '@shf/contracts';
import { sanitizeCategoryLabel } from '@shf/contracts';
import { sanitizeTagIds, validateTagIds } from '../tags/tagInput';

type ValidatedTransactionInput =
  | CreateTransactionInput
  | UpdateTransactionInput;

export interface TransactionValidationIssue {
  field:
    | 'accountId'
    | 'type'
    | 'description'
    | 'category'
    | 'tagIds'
    | 'amountInCents'
    | 'transactionDate';
  message: string;
}

export const normalizeTransactionDescription = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const isTransactionType = (value: string): value is TransactionType =>
  transactionTypes.includes(value as TransactionType);

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

export const validateTransactionInput = (input: {
  accountId: string;
  type: string;
  description: string;
  category?: string;
  tagIds?: readonly string[];
  amountInCents: number;
  transactionDate: string;
}): TransactionValidationIssue[] => {
  const issues: TransactionValidationIssue[] = [];
  const normalizedDescription = normalizeTransactionDescription(
    input.description,
  );
  const normalizedCategory = sanitizeCategoryLabel(input.category);

  if (!input.accountId.trim()) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para o lancamento.',
    });
  }

  if (!isTransactionType(input.type)) {
    issues.push({
      field: 'type',
      message: 'Selecione um tipo de lancamento valido.',
    });
  }

  if (!normalizedDescription) {
    issues.push({
      field: 'description',
      message: 'Informe uma descricao para o lancamento.',
    });
  }

  if (normalizedDescription.length > 120) {
    issues.push({
      field: 'description',
      message: 'A descricao do lancamento deve ter no maximo 120 caracteres.',
    });
  }

  if (normalizedCategory.length > 80) {
    issues.push({
      field: 'category',
      message: 'A categoria do lancamento deve ter no maximo 80 caracteres.',
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
      message: 'O valor do lancamento deve ser informado em centavos inteiros.',
    });
  }

  if (input.amountInCents <= 0) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor do lancamento deve ser maior que zero.',
    });
  }

  if (!isValidDateString(input.transactionDate.trim())) {
    issues.push({
      field: 'transactionDate',
      message: 'Informe uma data valida no formato AAAA-MM-DD.',
    });
  }

  return issues;
};

export const sanitizeTransactionInput = <T extends ValidatedTransactionInput>(
  input: T,
): T => ({
  ...input,
  accountId: input.accountId.trim(),
  description: normalizeTransactionDescription(input.description),
  category: sanitizeCategoryLabel(input.category),
  tagIds: sanitizeTagIds(input.tagIds),
  transactionDate: input.transactionDate.trim(),
});

