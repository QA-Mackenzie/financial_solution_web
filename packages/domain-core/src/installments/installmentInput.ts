import {
  installmentSourceTypes,
  type AnticipateInstallmentPlanInput,
  type CreateInstallmentPlanInput,
  type InstallmentSourceType,
  type UpdateInstallmentAnticipationInput,
  type UpdateInstallmentPlanInput,
} from '@economy-cash/contracts';

type ValidatedInstallmentPlanInput =
  | CreateInstallmentPlanInput
  | UpdateInstallmentPlanInput;
type ValidatedInstallmentAnticipationInput =
  | AnticipateInstallmentPlanInput
  | UpdateInstallmentAnticipationInput;

export interface InstallmentValidationIssue {
  field:
    | 'sourceType'
    | 'accountId'
    | 'creditCardId'
    | 'description'
    | 'totalAmountInCents'
    | 'installmentCount'
    | 'firstOccurrenceDate';
  message: string;
}

export interface InstallmentAnticipationValidationIssue {
  field: 'planId' | 'operationDate' | 'affectedInstallmentCount';
  message: string;
}

export const normalizeInstallmentDescription = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const isInstallmentSourceType = (
  value: string,
): value is InstallmentSourceType =>
  installmentSourceTypes.includes(value as InstallmentSourceType);

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

export const validateInstallmentPlanInput = (input: {
  sourceType: string;
  accountId?: string;
  creditCardId?: string;
  description: string;
  totalAmountInCents: number;
  installmentCount: number;
  firstOccurrenceDate: string;
}): InstallmentValidationIssue[] => {
  const issues: InstallmentValidationIssue[] = [];
  const normalizedDescription = normalizeInstallmentDescription(
    input.description,
  );
  const accountId = input.accountId?.trim() ?? '';
  const creditCardId = input.creditCardId?.trim() ?? '';

  if (!isInstallmentSourceType(input.sourceType)) {
    issues.push({
      field: 'sourceType',
      message: 'Selecione uma origem valida para o parcelamento.',
    });
  }

  if (input.sourceType === 'account' && !accountId) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para o parcelamento.',
    });
  }

  if (input.sourceType === 'creditCard' && !creditCardId) {
    issues.push({
      field: 'creditCardId',
      message: 'Selecione um cartao para o parcelamento.',
    });
  }

  if (!normalizedDescription) {
    issues.push({
      field: 'description',
      message: 'Informe uma descricao para o parcelamento.',
    });
  }

  if (normalizedDescription.length > 120) {
    issues.push({
      field: 'description',
      message: 'A descricao do parcelamento deve ter no maximo 120 caracteres.',
    });
  }

  if (
    !Number.isFinite(input.totalAmountInCents) ||
    !Number.isInteger(input.totalAmountInCents)
  ) {
    issues.push({
      field: 'totalAmountInCents',
      message:
        'O valor total do parcelamento deve ser informado em centavos inteiros.',
    });
  }

  if (input.totalAmountInCents <= 0) {
    issues.push({
      field: 'totalAmountInCents',
      message: 'O valor total do parcelamento deve ser maior que zero.',
    });
  }

  if (
    !Number.isInteger(input.installmentCount) ||
    input.installmentCount < 2 ||
    input.installmentCount > 60
  ) {
    issues.push({
      field: 'installmentCount',
      message: 'A quantidade de parcelas deve ficar entre 2 e 60.',
    });
  }

  if (
    Number.isInteger(input.installmentCount) &&
    input.totalAmountInCents > 0 &&
    input.totalAmountInCents < input.installmentCount
  ) {
    issues.push({
      field: 'totalAmountInCents',
      message:
        'O valor total do parcelamento precisa ser suficiente para gerar parcelas acima de zero.',
    });
  }

  if (!isValidDateString(input.firstOccurrenceDate.trim())) {
    issues.push({
      field: 'firstOccurrenceDate',
      message: 'Informe uma data inicial valida no formato AAAA-MM-DD.',
    });
  }

  return issues;
};

export const sanitizeInstallmentPlanInput = <
  T extends ValidatedInstallmentPlanInput,
>(
  input: T,
): T => ({
  ...input,
  accountId: input.accountId?.trim(),
  creditCardId: input.creditCardId?.trim(),
  description: normalizeInstallmentDescription(input.description),
  firstOccurrenceDate: input.firstOccurrenceDate.trim(),
});

export const validateInstallmentAnticipationInput = (input: {
  planId: string;
  operationDate: string;
  affectedInstallmentCount: number;
}): InstallmentAnticipationValidationIssue[] => {
  const issues: InstallmentAnticipationValidationIssue[] = [];

  if (!input.planId.trim()) {
    issues.push({
      field: 'planId',
      message: 'Selecione um parcelamento para antecipar.',
    });
  }

  if (!isValidDateString(input.operationDate.trim())) {
    issues.push({
      field: 'operationDate',
      message:
        'Informe uma data valida para a antecipacao no formato AAAA-MM-DD.',
    });
  }

  if (
    !Number.isInteger(input.affectedInstallmentCount) ||
    input.affectedInstallmentCount < 1 ||
    input.affectedInstallmentCount > 60
  ) {
    issues.push({
      field: 'affectedInstallmentCount',
      message: 'A quantidade de parcelas antecipadas deve ficar entre 1 e 60.',
    });
  }

  return issues;
};

export const sanitizeInstallmentAnticipationInput = <
  T extends ValidatedInstallmentAnticipationInput,
>(
  input: T,
): T => ({
  ...input,
  planId: input.planId.trim(),
  operationDate: input.operationDate.trim(),
});

