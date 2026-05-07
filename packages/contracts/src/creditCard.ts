import { z } from 'zod';

export const creditCardInvoiceStatuses = ['open', 'upcoming', 'overdue'] as const;

export const creditCardInvoiceStatusSchema = z.enum(creditCardInvoiceStatuses);

export const creditCardStatementCycleSchema = z.object({
  invoiceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const creditCardInvoicePreviewSchema = z.object({
  id: z.string().min(1),
  creditCardId: z.string().uuid(),
  creditCardName: z.string().min(1).max(80),
  invoiceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmountInCents: z.number().int().nonnegative(),
});

export const creditCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  creditLimitInCents: z.number().int().positive(),
  statementClosingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  paymentAccountId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const creditCardPurchaseSchema = z.object({
  id: z.string().uuid(),
  creditCardId: z.string().uuid(),
  description: z.string().min(1).max(120),
  category: z.string().min(1).max(80).optional(),
  tagIds: z.array(z.string().uuid()).max(8).optional(),
  amountInCents: z.number().int().positive(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const creditCardPurchaseListItemSchema = creditCardPurchaseSchema.extend({
  creditCardName: z.string().min(1).max(80),
  paymentAccountId: z.string().uuid(),
  paymentAccountName: z.string().min(1).max(120),
  invoiceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isProjected: z.boolean().optional(),
});

export const creditCardInvoiceSchema = z.object({
  id: z.string().min(1),
  creditCardId: z.string().uuid(),
  creditCardName: z.string().min(1).max(80),
  paymentAccountId: z.string().uuid(),
  paymentAccountName: z.string().min(1).max(120),
  invoiceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cycleEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAmountInCents: z.number().int().nonnegative(),
  purchaseCount: z.number().int().nonnegative(),
  status: creditCardInvoiceStatusSchema,
  purchases: z.array(creditCardPurchaseListItemSchema),
});

export const projectedCreditCardInvoiceOccurrenceSchema = z.object({
  id: z.string().min(1),
  creditCardId: z.string().uuid(),
  creditCardName: z.string().min(1).max(80),
  paymentAccountId: z.string().uuid(),
  paymentAccountName: z.string().min(1).max(120),
  invoiceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amountInCents: z.number().int().nonnegative(),
  signedAmountInCents: z.number().int(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const creditCardListItemSchema = creditCardSchema.extend({
  paymentAccountName: z.string().min(1).max(120),
  currentCycle: creditCardStatementCycleSchema,
  currentInvoice: creditCardInvoicePreviewSchema,
});

export const creditCardsSnapshotSchema = z.object({
  cards: z.array(creditCardListItemSchema),
  purchases: z.array(creditCardPurchaseListItemSchema),
  invoices: z.array(creditCardInvoiceSchema),
  projectedInvoices: z.array(projectedCreditCardInvoiceOccurrenceSchema),
  totalCreditLimitInCents: z.number().int().nonnegative(),
  totalInvoiceAmountInCents: z.number().int().nonnegative(),
});

const createCreditCardInputBaseSchema = z.object({
  name: z
    .string()
    .min(1, 'Informe um nome para o cartao.')
    .max(80, 'O nome do cartao deve ter no maximo 80 caracteres.'),
  creditLimitInCents: z
    .number()
    .int('O limite do cartao deve ser informado em centavos inteiros.')
    .positive('O limite do cartao deve ser maior que zero.'),
  statementClosingDay: z
    .number()
    .int('O dia de fechamento deve estar entre 1 e 31.')
    .min(1, 'O dia de fechamento deve estar entre 1 e 31.')
    .max(31, 'O dia de fechamento deve estar entre 1 e 31.'),
  dueDay: z
    .number()
    .int('O dia de vencimento deve estar entre 1 e 31.')
    .min(1, 'O dia de vencimento deve estar entre 1 e 31.')
    .max(31, 'O dia de vencimento deve estar entre 1 e 31.'),
  paymentAccountId: z.string().uuid('Selecione a conta pagadora padrao do cartao.'),
});

export const createCreditCardInputSchema = createCreditCardInputBaseSchema.superRefine((value, context) => {
  if (value.statementClosingDay === value.dueDay) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'O vencimento do cartao deve ser diferente do dia de fechamento.',
      path: ['dueDay'],
    });
  }
});

export const updateCreditCardInputSchema = createCreditCardInputBaseSchema
  .extend({
    id: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.statementClosingDay === value.dueDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O vencimento do cartao deve ser diferente do dia de fechamento.',
        path: ['dueDay'],
      });
    }
  });

export const createCreditCardPurchaseInputSchema = z.object({
  creditCardId: z.string().uuid('Selecione um cartao para registrar a compra.'),
  description: z
    .string()
    .min(1, 'Informe uma descricao para a compra no cartao.')
    .max(120, 'A descricao da compra deve ter no maximo 120 caracteres.'),
  category: z
    .string()
    .max(80, 'A categoria da compra deve ter no maximo 80 caracteres.')
    .optional(),
  tagIds: z
    .array(z.string().uuid())
    .max(8, 'Selecione no maximo 8 tags para o mesmo item financeiro.')
    .optional(),
  amountInCents: z
    .number()
    .int('O valor da compra deve ser informado em centavos inteiros.')
    .positive('O valor da compra deve ser maior que zero.'),
  purchaseDate: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Informe uma data valida no formato AAAA-MM-DD.',
  ),
});

export const updateCreditCardPurchaseInputSchema =
  createCreditCardPurchaseInputSchema.extend({
    id: z.string().uuid(),
  });

export interface CreditCard {
  id: string;
  name: string;
  creditLimitInCents: number;
  statementClosingDay: number;
  dueDay: number;
  paymentAccountId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardStatementCycle {
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
}

export interface CreditCardInvoicePreview {
  id: string;
  creditCardId: string;
  creditCardName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  totalAmountInCents: number;
}

export interface CreditCardPurchase {
  id: string;
  creditCardId: string;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditCardPurchaseListItem extends CreditCardPurchase {
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  isProjected?: boolean;
}

export type CreditCardInvoiceStatus = (typeof creditCardInvoiceStatuses)[number];

export interface CreditCardInvoice {
  id: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  cycleStartDate: string;
  cycleEndDate: string;
  dueDate: string;
  totalAmountInCents: number;
  purchaseCount: number;
  status: CreditCardInvoiceStatus;
  purchases: CreditCardPurchaseListItem[];
}

export interface CreditCardListItem extends CreditCard {
  paymentAccountName: string;
  currentCycle: CreditCardStatementCycle;
  currentInvoice: CreditCardInvoicePreview;
}

export interface CreditCardsSnapshot {
  cards: CreditCardListItem[];
  purchases: CreditCardPurchaseListItem[];
  invoices: CreditCardInvoice[];
  projectedInvoices: ProjectedCreditCardInvoiceOccurrence[];
  totalCreditLimitInCents: number;
  totalInvoiceAmountInCents: number;
}

export interface CreateCreditCardInput {
  name: string;
  creditLimitInCents: number;
  statementClosingDay: number;
  dueDay: number;
  paymentAccountId: string;
}

export interface UpdateCreditCardInput extends CreateCreditCardInput {
  id: string;
}

export interface CreateCreditCardPurchaseInput {
  creditCardId: string;
  description: string;
  category?: string;
  tagIds?: string[];
  amountInCents: number;
  purchaseDate: string;
}

export interface UpdateCreditCardPurchaseInput extends CreateCreditCardPurchaseInput {
  id: string;
}

export interface ProjectedCreditCardInvoiceOccurrence {
  id: string;
  creditCardId: string;
  creditCardName: string;
  paymentAccountId: string;
  paymentAccountName: string;
  invoiceMonth: string;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
}

export type CreditCardPayload = z.infer<typeof creditCardSchema>;
export type CreditCardStatementCyclePayload = z.infer<
  typeof creditCardStatementCycleSchema
>;
export type CreditCardInvoicePreviewPayload = z.infer<
  typeof creditCardInvoicePreviewSchema
>;
export type CreditCardPurchasePayload = z.infer<typeof creditCardPurchaseSchema>;
export type CreditCardPurchaseListItemPayload = z.infer<
  typeof creditCardPurchaseListItemSchema
>;
export type CreditCardInvoicePayload = z.infer<typeof creditCardInvoiceSchema>;
export type CreditCardListItemPayload = z.infer<typeof creditCardListItemSchema>;
export type CreditCardsSnapshotPayload = z.infer<typeof creditCardsSnapshotSchema>;
export type CreateCreditCardInputPayload = z.infer<
  typeof createCreditCardInputSchema
>;
export type UpdateCreditCardInputPayload = z.infer<
  typeof updateCreditCardInputSchema
>;
export type CreateCreditCardPurchaseInputPayload = z.infer<
  typeof createCreditCardPurchaseInputSchema
>;
export type UpdateCreditCardPurchaseInputPayload = z.infer<
  typeof updateCreditCardPurchaseInputSchema
>;
export type ProjectedCreditCardInvoiceOccurrencePayload = z.infer<
  typeof projectedCreditCardInvoiceOccurrenceSchema
>;
