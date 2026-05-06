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

export function formatCurrencyInCents(value: number): string {
  return currencyFormatter.format(value / 100);
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