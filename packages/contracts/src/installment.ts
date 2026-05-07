import { z } from 'zod';

export const installmentSourceTypes = ['account', 'creditCard'] as const;

export const installmentSourceTypeSchema = z.enum(installmentSourceTypes);

export type InstallmentSourceType = (typeof installmentSourceTypes)[number];

export const installmentOperationTypes = ['anticipation'] as const;

export const installmentOperationTypeSchema = z.enum(installmentOperationTypes);

export type InstallmentOperationType =
  (typeof installmentOperationTypes)[number];

export const installmentPlanSchema = z.object({
  id: z.string().uuid(),
  sourceType: installmentSourceTypeSchema,
  accountId: z.string().uuid().nullable(),
  creditCardId: z.string().uuid().nullable(),
  description: z.string().min(1).max(120),
  totalAmountInCents: z.number().int().positive(),
  installmentCount: z.number().int().min(2).max(60),
  firstOccurrenceDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const installmentPlanListItemSchema = installmentPlanSchema.extend({
  accountName: z.string().min(1).max(120).nullable(),
  creditCardName: z.string().min(1).max(80).nullable(),
  paymentAccountId: z.string().uuid().nullable(),
  paymentAccountName: z.string().min(1).max(120).nullable(),
});

export const installmentOccurrenceSchema = z.object({
  id: z.string().min(1),
  planId: z.string().uuid(),
  sourceType: installmentSourceTypeSchema,
  accountId: z.string().uuid().nullable(),
  creditCardId: z.string().uuid().nullable(),
  description: z.string().min(1).max(120),
  installmentNumber: z.number().int().min(1),
  totalInstallments: z.number().int().min(2).max(60),
  amountInCents: z.number().int().positive(),
  originalOccurrenceDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  occurrenceDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  anticipatedOperationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const installmentOccurrenceListItemSchema = installmentOccurrenceSchema.extend({
  accountName: z.string().min(1).max(120).nullable(),
  creditCardName: z.string().min(1).max(80).nullable(),
  paymentAccountId: z.string().uuid().nullable(),
  paymentAccountName: z.string().min(1).max(120).nullable(),
});

export const installmentOperationSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  type: installmentOperationTypeSchema,
  operationDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  affectedInstallmentCount: z.number().int().min(1).max(60),
  affectedAmountInCents: z.number().int().positive(),
  createdAt: z.string().datetime(),
});

export const projectedInstallmentOccurrenceSchema = z.object({
  id: z.string().min(1),
  planId: z.string().uuid(),
  description: z.string().min(1).max(120),
  accountId: z.string().uuid(),
  accountName: z.string().min(1).max(120),
  amountInCents: z.number().int().positive(),
  signedAmountInCents: z.number().int(),
  occurrenceDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  installmentNumber: z.number().int().min(1),
  totalInstallments: z.number().int().min(2).max(60),
});

export const projectedInstallmentCreditCardPurchaseSchema = z.object({
  id: z.string().min(1),
  planId: z.string().uuid(),
  creditCardId: z.string().uuid(),
  creditCardName: z.string().min(1).max(80),
  paymentAccountId: z.string().uuid(),
  paymentAccountName: z.string().min(1).max(120),
  description: z.string().min(1).max(120),
  amountInCents: z.number().int().positive(),
  purchaseDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  installmentNumber: z.number().int().min(1),
  totalInstallments: z.number().int().min(2).max(60),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const installmentsSnapshotSchema = z.object({
  plans: z.array(installmentPlanListItemSchema),
  occurrences: z.array(installmentOccurrenceListItemSchema),
  operations: z.array(installmentOperationSchema),
  projectedAccountOccurrences: z.array(projectedInstallmentOccurrenceSchema),
  projectedCreditCardPurchases: z.array(
    projectedInstallmentCreditCardPurchaseSchema,
  ),
  totalRemainingAmountInCents: z.number().int().nonnegative(),
});

const createInstallmentPlanInputBaseSchema = z.object({
  sourceType: installmentSourceTypeSchema,
  accountId: z.string().uuid('Selecione uma conta para o parcelamento.').optional(),
  creditCardId: z.string().uuid('Selecione um cartao para o parcelamento.').optional(),
  description: z
    .string()
    .min(1, 'Informe uma descricao para o parcelamento.')
    .max(120, 'A descricao do parcelamento deve ter no maximo 120 caracteres.'),
  totalAmountInCents: z
    .number()
    .int(
      'O valor total do parcelamento deve ser informado em centavos inteiros.',
    )
    .positive('O valor total do parcelamento deve ser maior que zero.'),
  installmentCount: z
    .number()
    .int('A quantidade de parcelas deve ficar entre 2 e 60.')
    .min(2, 'A quantidade de parcelas deve ficar entre 2 e 60.')
    .max(60, 'A quantidade de parcelas deve ficar entre 2 e 60.'),
  firstOccurrenceDate: z.string().regex(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    'Informe uma data inicial valida no formato AAAA-MM-DD.',
  ),
});

export const createInstallmentPlanInputSchema =
  createInstallmentPlanInputBaseSchema.superRefine((value, context) => {
    if (value.sourceType === 'account' && !value.accountId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione uma conta para o parcelamento.',
        path: ['accountId'],
      });
    }

    if (value.sourceType === 'creditCard' && !value.creditCardId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Selecione um cartao para o parcelamento.',
        path: ['creditCardId'],
      });
    }

    if (value.totalAmountInCents < value.installmentCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'O valor total do parcelamento precisa ser suficiente para gerar parcelas acima de zero.',
        path: ['totalAmountInCents'],
      });
    }
  });

export const updateInstallmentPlanInputSchema =
  createInstallmentPlanInputBaseSchema
    .extend({
      id: z.string().uuid(),
    })
    .superRefine((value, context) => {
      if (value.sourceType === 'account' && !value.accountId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecione uma conta para o parcelamento.',
          path: ['accountId'],
        });
      }

      if (value.sourceType === 'creditCard' && !value.creditCardId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Selecione um cartao para o parcelamento.',
          path: ['creditCardId'],
        });
      }

      if (value.totalAmountInCents < value.installmentCount) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'O valor total do parcelamento precisa ser suficiente para gerar parcelas acima de zero.',
          path: ['totalAmountInCents'],
        });
      }
    });

const anticipateInstallmentPlanInputBaseSchema = z.object({
  planId: z.string().uuid('Selecione um parcelamento para antecipar.'),
  operationDate: z.string().regex(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    'Informe uma data valida para a antecipacao no formato AAAA-MM-DD.',
  ),
  affectedInstallmentCount: z
    .number()
    .int('A quantidade de parcelas antecipadas deve ficar entre 1 e 60.')
    .min(1, 'A quantidade de parcelas antecipadas deve ficar entre 1 e 60.')
    .max(60, 'A quantidade de parcelas antecipadas deve ficar entre 1 e 60.'),
});

export const anticipateInstallmentPlanInputSchema =
  anticipateInstallmentPlanInputBaseSchema;

export const updateInstallmentAnticipationInputSchema =
  anticipateInstallmentPlanInputBaseSchema.extend({
    id: z.string().uuid(),
  });

export interface InstallmentPlan {
  id: string;
  sourceType: InstallmentSourceType;
  accountId: string | null;
  creditCardId: string | null;
  description: string;
  totalAmountInCents: number;
  installmentCount: number;
  firstOccurrenceDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentPlanListItem extends InstallmentPlan {
  accountName: string | null;
  creditCardName: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
}

export interface InstallmentOccurrence {
  id: string;
  planId: string;
  sourceType: InstallmentSourceType;
  accountId: string | null;
  creditCardId: string | null;
  description: string;
  installmentNumber: number;
  totalInstallments: number;
  amountInCents: number;
  originalOccurrenceDate: string;
  occurrenceDate: string;
  anticipatedOperationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentOccurrenceListItem extends InstallmentOccurrence {
  accountName: string | null;
  creditCardName: string | null;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
}

export interface InstallmentOperation {
  id: string;
  planId: string;
  type: InstallmentOperationType;
  operationDate: string;
  affectedInstallmentCount: number;
  affectedAmountInCents: number;
  createdAt: string;
}

export interface ProjectedInstallmentOccurrence {
  id: string;
  planId: string;
  description: string;
  accountId: string;
  accountName: string;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
  installmentNumber: number;
  totalInstallments: number;
}

export interface ProjectedInstallmentCreditCardPurchase {
  id: string;
  planId: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  description: string;
  amountInCents: number;
  purchaseDate: string;
  installmentNumber: number;
  totalInstallments: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstallmentsSnapshot {
  plans: InstallmentPlanListItem[];
  occurrences: InstallmentOccurrenceListItem[];
  operations: InstallmentOperation[];
  projectedAccountOccurrences: ProjectedInstallmentOccurrence[];
  projectedCreditCardPurchases: ProjectedInstallmentCreditCardPurchase[];
  totalRemainingAmountInCents: number;
}

export interface CreateInstallmentPlanInput {
  sourceType: InstallmentSourceType;
  accountId?: string;
  creditCardId?: string;
  description: string;
  totalAmountInCents: number;
  installmentCount: number;
  firstOccurrenceDate: string;
}

export interface UpdateInstallmentPlanInput extends CreateInstallmentPlanInput {
  id: string;
}

export interface AnticipateInstallmentPlanInput {
  planId: string;
  operationDate: string;
  affectedInstallmentCount: number;
}

export interface UpdateInstallmentAnticipationInput extends AnticipateInstallmentPlanInput {
  id: string;
}

export type InstallmentSourceTypePayload = z.infer<
  typeof installmentSourceTypeSchema
>;
export type InstallmentOperationTypePayload = z.infer<
  typeof installmentOperationTypeSchema
>;
export type InstallmentPlanPayload = z.infer<typeof installmentPlanSchema>;
export type InstallmentPlanListItemPayload = z.infer<
  typeof installmentPlanListItemSchema
>;
export type InstallmentOccurrencePayload = z.infer<
  typeof installmentOccurrenceSchema
>;
export type InstallmentOccurrenceListItemPayload = z.infer<
  typeof installmentOccurrenceListItemSchema
>;
export type InstallmentOperationPayload = z.infer<
  typeof installmentOperationSchema
>;
export type ProjectedInstallmentOccurrencePayload = z.infer<
  typeof projectedInstallmentOccurrenceSchema
>;
export type ProjectedInstallmentCreditCardPurchasePayload = z.infer<
  typeof projectedInstallmentCreditCardPurchaseSchema
>;
export type InstallmentsSnapshotPayload = z.infer<
  typeof installmentsSnapshotSchema
>;
export type CreateInstallmentPlanInputPayload = z.infer<
  typeof createInstallmentPlanInputSchema
>;
export type UpdateInstallmentPlanInputPayload = z.infer<
  typeof updateInstallmentPlanInputSchema
>;
export type AnticipateInstallmentPlanInputPayload = z.infer<
  typeof anticipateInstallmentPlanInputSchema
>;
export type UpdateInstallmentAnticipationInputPayload = z.infer<
  typeof updateInstallmentAnticipationInputSchema
>;
