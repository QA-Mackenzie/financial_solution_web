import {
  accountTypes,
  type AccountType,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@shf/contracts';

type ValidatedAccountInput = CreateAccountInput | UpdateAccountInput;

export interface AccountValidationIssue {
  field: 'name' | 'type' | 'openingBalanceInCents';
  message: string;
}

export const normalizeAccountName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const isAccountType = (value: string): value is AccountType =>
  accountTypes.includes(value as AccountType);

export const validateAccountInput = (input: {
  name: string;
  type: string;
  openingBalanceInCents: number;
}): AccountValidationIssue[] => {
  const issues: AccountValidationIssue[] = [];
  const normalizedName = normalizeAccountName(input.name);

  if (!normalizedName) {
    issues.push({
      field: 'name',
      message: 'Informe um nome para a conta.',
    });
  }

  if (normalizedName.length > 80) {
    issues.push({
      field: 'name',
      message: 'O nome da conta deve ter no maximo 80 caracteres.',
    });
  }

  if (!isAccountType(input.type)) {
    issues.push({
      field: 'type',
      message: 'Selecione um tipo de conta valido.',
    });
  }

  if (
    !Number.isFinite(input.openingBalanceInCents) ||
    !Number.isInteger(input.openingBalanceInCents)
  ) {
    issues.push({
      field: 'openingBalanceInCents',
      message: 'O saldo inicial deve ser informado em centavos inteiros.',
    });
  }

  return issues;
};

export const sanitizeAccountInput = <T extends ValidatedAccountInput>(
  input: T,
): T => ({
  ...input,
  name: normalizeAccountName(input.name),
});

