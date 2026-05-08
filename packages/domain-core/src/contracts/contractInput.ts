import {
  contractStatuses,
  contractTypes,
  type ContractStatus,
  type ContractType,
  type CreateContractInput,
  type UpdateContractInput,
} from '@economy-cash/contracts';

type ValidatedContractInput = CreateContractInput | UpdateContractInput;

export interface ContractValidationIssue {
  field:
    | 'accountId'
    | 'name'
    | 'category'
    | 'type'
    | 'amountInCents'
    | 'dueDay'
    | 'startDate'
    | 'status';
  message: string;
}

export const normalizeContractName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const normalizeContractCategory = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const isContractStatus = (value: string): value is ContractStatus =>
  contractStatuses.includes(value as ContractStatus);

export const isContractType = (value: string): value is ContractType =>
  contractTypes.includes(value as ContractType);

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

export const validateContractInput = (input: {
  accountId: string;
  name: string;
  category: string;
  type: string;
  amountInCents: number;
  dueDay: number;
  startDate: string;
  status: string;
}): ContractValidationIssue[] => {
  const issues: ContractValidationIssue[] = [];
  const normalizedName = normalizeContractName(input.name);
  const normalizedCategory = normalizeContractCategory(input.category);

  if (!input.accountId.trim()) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para o contrato.',
    });
  }

  if (!normalizedName) {
    issues.push({
      field: 'name',
      message: 'Informe um nome para o contrato.',
    });
  }

  if (normalizedName.length > 120) {
    issues.push({
      field: 'name',
      message: 'O nome do contrato deve ter no maximo 120 caracteres.',
    });
  }

  if (!normalizedCategory) {
    issues.push({
      field: 'category',
      message: 'Informe uma categoria para o contrato.',
    });
  }

  if (normalizedCategory.length > 80) {
    issues.push({
      field: 'category',
      message: 'A categoria do contrato deve ter no maximo 80 caracteres.',
    });
  }

  if (!isContractType(input.type)) {
    issues.push({
      field: 'type',
      message: 'Selecione um tipo valido para o contrato.',
    });
  }

  if (
    !Number.isFinite(input.amountInCents) ||
    !Number.isInteger(input.amountInCents)
  ) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor do contrato deve ser informado em centavos inteiros.',
    });
  }

  if (input.amountInCents <= 0) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor do contrato deve ser maior que zero.',
    });
  }

  if (
    !Number.isInteger(input.dueDay) ||
    input.dueDay < 1 ||
    input.dueDay > 31
  ) {
    issues.push({
      field: 'dueDay',
      message: 'O dia de vencimento do contrato deve estar entre 1 e 31.',
    });
  }

  if (!isValidDateString(input.startDate.trim())) {
    issues.push({
      field: 'startDate',
      message: 'Informe uma data inicial valida no formato AAAA-MM-DD.',
    });
  }

  if (!isContractStatus(input.status)) {
    issues.push({
      field: 'status',
      message: 'Selecione um status valido para o contrato.',
    });
  }

  return issues;
};

export const sanitizeContractInput = <T extends ValidatedContractInput>(
  input: T,
): T => ({
  ...input,
  accountId: input.accountId.trim(),
  name: normalizeContractName(input.name),
  category: normalizeContractCategory(input.category),
  startDate: input.startDate.trim(),
});

