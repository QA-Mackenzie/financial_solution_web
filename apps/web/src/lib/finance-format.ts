const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
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