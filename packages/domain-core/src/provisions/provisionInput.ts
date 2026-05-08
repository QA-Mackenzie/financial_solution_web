import { sanitizeCategoryLabel } from '@economy-cash/contracts';
import {
  provisionStatuses,
  type CreateProvisionInput,
  type ProvisionStatus,
  type RedeemProvisionInput,
  type UpdateProvisionInput,
} from '@economy-cash/contracts';

type ValidatedProvisionInput = CreateProvisionInput | UpdateProvisionInput;

export interface ProvisionValidationIssue {
  field:
    | 'accountId'
    | 'description'
    | 'category'
    | 'targetAmountInCents'
    | 'startDate'
    | 'targetDate'
    | 'status'
    | 'redeemedAt';
  message: string;
}

export const normalizeProvisionDescription = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const isProvisionStatus = (value: string): value is ProvisionStatus =>
  provisionStatuses.includes(value as ProvisionStatus);

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

export const validateProvisionInput = (input: {
  accountId: string;
  description: string;
  category: string;
  targetAmountInCents: number;
  startDate: string;
  targetDate: string;
}): ProvisionValidationIssue[] => {
  const issues: ProvisionValidationIssue[] = [];
  const normalizedDescription = normalizeProvisionDescription(
    input.description,
  );
  const normalizedCategory = sanitizeCategoryLabel(input.category);

  if (!input.accountId.trim()) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para a provisao.',
    });
  }

  if (!normalizedDescription) {
    issues.push({
      field: 'description',
      message: 'Informe uma descricao para a provisao.',
    });
  }

  if (normalizedDescription.length > 120) {
    issues.push({
      field: 'description',
      message: 'A descricao da provisao deve ter no maximo 120 caracteres.',
    });
  }

  if (normalizedCategory.length > 80) {
    issues.push({
      field: 'category',
      message: 'A categoria da provisao deve ter no maximo 80 caracteres.',
    });
  }

  if (
    !Number.isFinite(input.targetAmountInCents) ||
    !Number.isInteger(input.targetAmountInCents)
  ) {
    issues.push({
      field: 'targetAmountInCents',
      message:
        'O valor-alvo da provisao deve ser informado em centavos inteiros.',
    });
  }

  if (input.targetAmountInCents <= 0) {
    issues.push({
      field: 'targetAmountInCents',
      message: 'O valor-alvo da provisao deve ser maior que zero.',
    });
  }

  if (!isValidDateString(input.startDate.trim())) {
    issues.push({
      field: 'startDate',
      message: 'Informe uma data inicial valida no formato AAAA-MM-DD.',
    });
  }

  if (!isValidDateString(input.targetDate.trim())) {
    issues.push({
      field: 'targetDate',
      message: 'Informe uma data de resgate valida no formato AAAA-MM-DD.',
    });
  }

  if (
    isValidDateString(input.startDate.trim()) &&
    isValidDateString(input.targetDate.trim()) &&
    input.targetDate.trim() < input.startDate.trim()
  ) {
    issues.push({
      field: 'targetDate',
      message:
        'A data de resgate deve ser igual ou posterior ao inicio da provisao.',
    });
  }

  return issues;
};

export const sanitizeProvisionInput = <T extends ValidatedProvisionInput>(
  input: T,
): T => ({
  ...input,
  accountId: input.accountId.trim(),
  description: normalizeProvisionDescription(input.description),
  category: sanitizeCategoryLabel(input.category),
  startDate: input.startDate.trim(),
  targetDate: input.targetDate.trim(),
});

export const validateProvisionRedeemInput = (
  input: RedeemProvisionInput,
): ProvisionValidationIssue[] => {
  const issues: ProvisionValidationIssue[] = [];

  if (!input.provisionId.trim()) {
    issues.push({
      field: 'status',
      message: 'Provisao nao encontrada.',
    });
  }

  if (!isValidDateString(input.redeemedAt.trim())) {
    issues.push({
      field: 'redeemedAt',
      message: 'Informe uma data de resgate valida no formato AAAA-MM-DD.',
    });
  }

  return issues;
};

