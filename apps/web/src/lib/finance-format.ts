const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
});

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const categoryLabelByLegacyValue: Record<string, string> = {
  Alimentacao: 'Alimentação',
  Educacao: 'Educação',
  Saude: 'Saúde',
  Transferencias: 'Transferências',
  Veiculo: 'Veículo',
};

export function formatCurrencyInCents(value: number): string {
  return currencyFormatter.format(value / 100);
}

export function parseCurrencyInputToCents(value: string): number {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  const isNegative = trimmedValue.includes('-');
  const normalizedValue = trimmedValue.replace(/[^\d,.-]/g, '');
  const commaIndex = normalizedValue.lastIndexOf(',');
  const dotIndex = normalizedValue.lastIndexOf('.');
  const decimalSeparator =
    commaIndex > -1 ? ',' : dotIndex > -1 && normalizedValue.length - dotIndex <= 3 ? '.' : '';

  if (!decimalSeparator) {
    const integerDigits = normalizedValue.replace(/\D/g, '');
    const integerAmount = Number.parseInt(integerDigits || '0', 10) * 100;

    return isNegative ? -integerAmount : integerAmount;
  }

  const separatorIndex = normalizedValue.lastIndexOf(decimalSeparator);
  const integerDigits = normalizedValue.slice(0, separatorIndex).replace(/\D/g, '');
  const decimalDigits = normalizedValue
    .slice(separatorIndex + 1)
    .replace(/\D/g, '')
    .padEnd(2, '0')
    .slice(0, 2);
  const amount =
    Number.parseInt(integerDigits || '0', 10) * 100 +
    Number.parseInt(decimalDigits || '0', 10);

  return isNegative ? -amount : amount;
}

export function formatDate(value: string): string {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;

  return new Date(normalizedValue).toLocaleDateString('pt-BR');
}

export function formatMonthYear(value: string): string {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;

  return monthFormatter.format(new Date(normalizedValue));
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatCategoryLabel(value?: string | null): string {
  if (!value) {
    return 'Sem categoria';
  }

  return categoryLabelByLegacyValue[value] ?? value;
}
