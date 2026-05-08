import { z } from 'zod';

export const provisionStatuses = ['active', 'redeemed'] as const;

export const provisionStatusSchema = z.enum(provisionStatuses);

export type ProvisionStatus = (typeof provisionStatuses)[number];

export const provisionSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  description: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  targetAmountInCents: z.number().int().positive(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: provisionStatusSchema,
  redeemedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const provisionListItemSchema = provisionSchema.extend({
  accountName: z.string().min(1).max(120),
});

export const provisionsSnapshotSchema = z.object({
  activeProvisions: z.array(provisionListItemSchema),
  redeemedProvisions: z.array(provisionListItemSchema),
  totalActiveTargetAmountInCents: z.number().int().nonnegative(),
});

const createProvisionInputBaseSchema = z.object({
  accountId: z.string().uuid('Selecione uma conta válida para a provisão.'),
  description: z
    .string()
    .min(1, 'Informe uma descrição para a provisão.')
    .max(120, 'A descrição da provisão deve ter no máximo 120 caracteres.'),
  category: z
    .string()
    .min(1, 'Informe uma categoria para a provisão.')
    .max(80, 'A categoria da provisão deve ter no máximo 80 caracteres.'),
  targetAmountInCents: z
    .number()
    .int('O valor-alvo da provisão deve ser informado corretamente.')
    .positive('O valor-alvo da provisão deve ser maior que zero.'),
  startDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data inicial válida no formato AAAA-MM-DD.',
  ),
  targetDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data de resgate válida no formato AAAA-MM-DD.',
  ),
});

export const createProvisionInputSchema = createProvisionInputBaseSchema.superRefine(
  (value, context) => {
    if (value.targetDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'A data de resgate deve ser igual ou posterior ao início da provisão.',
        path: ['targetDate'],
      });
    }
  },
);

export const updateProvisionInputSchema = createProvisionInputBaseSchema
  .extend({
    id: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.targetDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'A data de resgate deve ser igual ou posterior ao início da provisão.',
        path: ['targetDate'],
      });
    }
  });

export const redeemProvisionInputSchema = z.object({
  provisionId: z.string().uuid('Selecione uma provisão válida.'),
  redeemedAt: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data de resgate válida no formato AAAA-MM-DD.',
  ),
});

export const projectedProvisionOccurrenceKinds = [
  'allocation',
  'release',
] as const;

export const projectedProvisionOccurrenceKindSchema = z.enum(
  projectedProvisionOccurrenceKinds,
);

export const projectedProvisionOccurrenceSchema = z.object({
  id: z.string().min(1),
  provisionId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountName: z.string().min(1).max(120),
  description: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  amountInCents: z.number().int().positive(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: projectedProvisionOccurrenceKindSchema,
});

export const provisionsPlanningSnapshotSchema = provisionsSnapshotSchema.extend({
  projectedOccurrences: z.array(projectedProvisionOccurrenceSchema),
});

export interface Provision {
  id: string;
  accountId: string;
  description: string;
  category: string;
  targetAmountInCents: number;
  startDate: string;
  targetDate: string;
  status: ProvisionStatus;
  redeemedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionListItem extends Provision {
  accountName: string;
}

export interface ProvisionsSnapshot {
  activeProvisions: ProvisionListItem[];
  redeemedProvisions: ProvisionListItem[];
  totalActiveTargetAmountInCents: number;
}

export interface CreateProvisionInput {
  accountId: string;
  description: string;
  category: string;
  targetAmountInCents: number;
  startDate: string;
  targetDate: string;
}

export interface UpdateProvisionInput extends CreateProvisionInput {
  id: string;
}

export interface RedeemProvisionInput {
  provisionId: string;
  redeemedAt: string;
}

export type ProjectedProvisionOccurrenceKind =
  (typeof projectedProvisionOccurrenceKinds)[number];

export interface ProjectedProvisionOccurrence {
  id: string;
  provisionId: string;
  accountId: string;
  accountName: string;
  description: string;
  category: string;
  amountInCents: number;
  occurrenceDate: string;
  kind: ProjectedProvisionOccurrenceKind;
}

export type ProvisionsPlanningSnapshot = ProvisionsSnapshot & {
  projectedOccurrences: ProjectedProvisionOccurrence[];
};

export type ProvisionPayload = z.infer<typeof provisionSchema>;
export type ProvisionListItemPayload = z.infer<typeof provisionListItemSchema>;
export type ProvisionsSnapshotPayload = z.infer<typeof provisionsSnapshotSchema>;
export type CreateProvisionInputPayload = z.infer<
  typeof createProvisionInputSchema
>;
export type UpdateProvisionInputPayload = z.infer<
  typeof updateProvisionInputSchema
>;
export type RedeemProvisionInputPayload = z.infer<
  typeof redeemProvisionInputSchema
>;
export type ProjectedProvisionOccurrencePayload = z.infer<
  typeof projectedProvisionOccurrenceSchema
>;
export type ProvisionsPlanningSnapshotPayload = z.infer<
  typeof provisionsPlanningSnapshotSchema
>;
