import type {
  CreateCreditCardInput,
  UpdateCreditCardInput,
} from '@economy-cash/contracts';

type ValidatedCreditCardInput = CreateCreditCardInput | UpdateCreditCardInput;

export interface CreditCardValidationIssue {
  field:
    | 'name'
    | 'creditLimitInCents'
    | 'statementClosingDay'
    | 'dueDay'
    | 'paymentAccountId';
  message: string;
}

export const normalizeCreditCardName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const validateCreditCardInput = (input: {
  name: string;
  creditLimitInCents: number;
  statementClosingDay: number;
  dueDay: number;
  paymentAccountId: string;
}): CreditCardValidationIssue[] => {
  const issues: CreditCardValidationIssue[] = [];
  const normalizedName = normalizeCreditCardName(input.name);

  if (!normalizedName) {
    issues.push({
      field: 'name',
      message: 'Informe um nome para o cartao.',
    });
  }

  if (normalizedName.length > 80) {
    issues.push({
      field: 'name',
      message: 'O nome do cartao deve ter no maximo 80 caracteres.',
    });
  }

  if (
    !Number.isFinite(input.creditLimitInCents) ||
    !Number.isInteger(input.creditLimitInCents)
  ) {
    issues.push({
      field: 'creditLimitInCents',
      message: 'O limite do cartao deve ser informado em centavos inteiros.',
    });
  }

  if (input.creditLimitInCents <= 0) {
    issues.push({
      field: 'creditLimitInCents',
      message: 'O limite do cartao deve ser maior que zero.',
    });
  }

  if (
    !Number.isInteger(input.statementClosingDay) ||
    input.statementClosingDay < 1 ||
    input.statementClosingDay > 31
  ) {
    issues.push({
      field: 'statementClosingDay',
      message: 'O dia de fechamento deve estar entre 1 e 31.',
    });
  }

  if (
    !Number.isInteger(input.dueDay) ||
    input.dueDay < 1 ||
    input.dueDay > 31
  ) {
    issues.push({
      field: 'dueDay',
      message: 'O dia de vencimento deve estar entre 1 e 31.',
    });
  }

  if (
    Number.isInteger(input.statementClosingDay) &&
    Number.isInteger(input.dueDay) &&
    input.statementClosingDay === input.dueDay
  ) {
    issues.push({
      field: 'dueDay',
      message:
        'O vencimento do cartao deve ser diferente do dia de fechamento.',
    });
  }

  if (!input.paymentAccountId.trim()) {
    issues.push({
      field: 'paymentAccountId',
      message: 'Selecione a conta pagadora padrao do cartao.',
    });
  }

  return issues;
};

export const sanitizeCreditCardInput = <T extends ValidatedCreditCardInput>(
  input: T,
): T => ({
  ...input,
  name: normalizeCreditCardName(input.name),
  paymentAccountId: input.paymentAccountId.trim(),
});

