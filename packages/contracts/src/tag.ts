import { z } from 'zod';

export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(40),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tagListItemSchema = tagSchema.extend({
  usageCount: z.number().int().nonnegative(),
});

export const tagsSnapshotSchema = z.object({
  tags: z.array(tagListItemSchema),
});

export const createTagInputSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe um nome para a tag.')
    .max(40, 'O nome da tag deve ter no máximo 40 caracteres.'),
});

export const updateTagInputSchema = createTagInputSchema.extend({
  id: z.string().uuid(),
});

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagListItem extends Tag {
  usageCount: number;
}

export interface TagsSnapshot {
  tags: TagListItem[];
}

export interface CreateTagInput {
  name: string;
}

export interface UpdateTagInput extends CreateTagInput {
  id: string;
}

export type TagPayload = z.infer<typeof tagSchema>;
export type TagListItemPayload = z.infer<typeof tagListItemSchema>;
export type TagsSnapshotPayload = z.infer<typeof tagsSnapshotSchema>;
export type CreateTagInputPayload = z.infer<typeof createTagInputSchema>;
export type UpdateTagInputPayload = z.infer<typeof updateTagInputSchema>;
