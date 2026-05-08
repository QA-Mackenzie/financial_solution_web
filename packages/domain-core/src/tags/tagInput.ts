import type {
  CreateTagInput,
  UpdateTagInput,
} from '@economy-cash/contracts';

type ValidatedTagInput = CreateTagInput | UpdateTagInput;

export interface TagValidationIssue {
  field: 'name';
  message: string;
}

const MAX_TAG_COUNT_PER_ENTITY = 8;

export const normalizeTagName = (value: string) =>
  value.trim().replace(/\s+/g, ' ');

export const sanitizeTagIds = (tagIds?: readonly string[]) =>
  [
    ...new Set((tagIds ?? []).map((tagId) => tagId.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));

export const validateTagIds = (tagIds?: readonly string[]) => {
  const sanitizedTagIds = sanitizeTagIds(tagIds);

  if (sanitizedTagIds.length > MAX_TAG_COUNT_PER_ENTITY) {
    return [
      'Selecione no maximo 8 tags para o mesmo item financeiro.',
    ] as const;
  }

  return [] as const;
};

export const validateTagInput = (input: {
  name: string;
}): TagValidationIssue[] => {
  const issues: TagValidationIssue[] = [];
  const normalizedName = normalizeTagName(input.name);

  if (!normalizedName) {
    issues.push({
      field: 'name',
      message: 'Informe um nome para a tag.',
    });
  }

  if (normalizedName.length > 40) {
    issues.push({
      field: 'name',
      message: 'O nome da tag deve ter no maximo 40 caracteres.',
    });
  }

  return issues;
};

export const sanitizeTagInput = <T extends ValidatedTagInput>(input: T): T => ({
  ...input,
  name: normalizeTagName(input.name),
});

