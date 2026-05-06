export type CategoryFlow = 'income' | 'expense' | 'both';

export interface CategoryDefinition {
  label: string;
  flow: CategoryFlow;
}

export const DEFAULT_UNCATEGORIZED_CATEGORY = 'Sem categoria';

export const initialCategoryDefinitions: CategoryDefinition[] = [
  { label: DEFAULT_UNCATEGORIZED_CATEGORY, flow: 'both' },
  { label: 'Casa', flow: 'expense' },
  { label: 'Alimentacao', flow: 'expense' },
  { label: 'Transporte', flow: 'expense' },
  { label: 'Saude', flow: 'expense' },
  { label: 'Educacao', flow: 'expense' },
  { label: 'Lazer', flow: 'expense' },
  { label: 'Assinaturas', flow: 'expense' },
  { label: 'Impostos', flow: 'expense' },
  { label: 'Veiculo', flow: 'expense' },
  { label: 'Pet', flow: 'expense' },
  { label: 'Viagem', flow: 'expense' },
  { label: 'Investimentos', flow: 'both' },
  { label: 'Trabalho', flow: 'both' },
  { label: 'Transferencias', flow: 'both' },
  { label: 'Outros', flow: 'both' },
];

export const normalizeCategoryLabel = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const sanitizeCategoryLabel = (
  value?: string | null,
  fallback = DEFAULT_UNCATEGORIZED_CATEGORY,
) => {
  const normalized = normalizeCategoryLabel(value ?? '');

  return normalized || fallback;
};
