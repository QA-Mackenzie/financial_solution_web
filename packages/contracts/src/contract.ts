import { z } from 'zod';

import { transactionTypes, type TransactionType } from './transaction';

export const contractStatuses = ['active', 'inactive'] as const;

export const contractTypes = transactionTypes;

export type ContractStatus = (typeof contractStatuses)[number];
export type ContractType = TransactionType;

export const contractStatusSchema = z.enum(contractStatuses);

export const contractTypeSchema = z.enum(contractTypes);

export const contractAdjustmentSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  amountInCents: z.number().int().positive(),
  effectiveStartDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  createdAt: z.string().datetime(),
});

export const contractSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  type: contractTypeSchema,
  amountInCents: z.number().int().positive(),
  dueDay: z.number().int().min(1).max(31),
  startDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
  endDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).nullable().optional(),
  status: contractStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const contractListItemSchema = contractSchema.extend({
  accountName: z.string().min(1),
  adjustments: z.array(contractAdjustmentSchema).optional(),
});

export const contractsSnapshotSchema = z.object({
  activeContracts: z.array(contractListItemSchema),
  inactiveContracts: z.array(contractListItemSchema),
  totalActiveIncomeInCents: z.number().int(),
  totalActiveExpenseInCents: z.number().int(),
  netActiveAmountInCents: z.number().int(),
});

export const createContractInputSchema = z.object({
  accountId: z.string().uuid('Selecione uma conta válida.'),
  name: z
    .string()
    .min(1, 'Informe um nome para o contrato.')
    .max(120, 'O nome do contrato deve ter no máximo 120 caracteres.'),
  category: z
    .string()
    .min(1, 'Informe uma categoria para o contrato.')
    .max(80, 'A categoria do contrato deve ter no máximo 80 caracteres.'),
  type: contractTypeSchema,
  amountInCents: z
    .number()
    .int('O valor do contrato deve ser informado em centavos inteiros.')
    .positive('O valor do contrato deve ser maior que zero.'),
  dueDay: z
    .number()
    .int('O dia de vencimento do contrato deve estar entre 1 e 31.')
    .min(1, 'O dia de vencimento do contrato deve estar entre 1 e 31.')
    .max(31, 'O dia de vencimento do contrato deve estar entre 1 e 31.'),
  startDate: z.string().regex(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    'Informe uma data inicial válida no formato AAAA-MM-DD.',
  ),
  status: contractStatusSchema,
});

export const updateContractInputSchema = createContractInputSchema.extend({
  id: z.string().uuid(),
});

export const createContractAdjustmentInputSchema = z.object({
  contractId: z.string().uuid(),
  amountInCents: z
    .number()
    .int('O valor do reajuste deve ser informado em centavos inteiros.')
    .positive('O valor do reajuste deve ser maior que zero.'),
  effectiveStartDate: z.string().regex(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    'Informe uma data efetiva válida no formato AAAA-MM-DD.',
  ),
});

export const endContractInputSchema = z.object({
  contractId: z.string().uuid(),
  endDate: z.string().regex(
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
    'Informe uma data final válida no formato AAAA-MM-DD.',
  ),
});

export const projectedContractOccurrenceSchema = z.object({
  id: z.string().min(1),
  contractId: z.string().uuid(),
  contractName: z.string().min(1),
  accountId: z.string().uuid(),
  accountName: z.string().min(1),
  category: z.string().min(1),
  type: contractTypeSchema,
  amountInCents: z.number().int().positive(),
  signedAmountInCents: z.number().int(),
  occurrenceDate: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
});

export interface ContractAdjustment {
  id: string;
  contractId: string;
  amountInCents: number;
  effectiveStartDate: string;
  createdAt: string;
}

export interface Contract {
  id: string;
  accountId: string;
  name: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  dueDay: number;
  startDate: string;
  endDate?: string | null;
  status: ContractStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContractListItem extends Contract {
  accountName: string;
  adjustments?: ContractAdjustment[];
}

export interface ContractsSnapshot {
  activeContracts: ContractListItem[];
  inactiveContracts: ContractListItem[];
  totalActiveIncomeInCents: number;
  totalActiveExpenseInCents: number;
  netActiveAmountInCents: number;
}

export interface CreateContractInput {
  accountId: string;
  name: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  dueDay: number;
  startDate: string;
  status: ContractStatus;
}

export interface UpdateContractInput extends CreateContractInput {
  id: string;
}

export interface CreateContractAdjustmentInput {
  contractId: string;
  amountInCents: number;
  effectiveStartDate: string;
}

export interface EndContractInput {
  contractId: string;
  endDate: string;
}

export interface ProjectedContractOccurrence {
  id: string;
  contractId: string;
  contractName: string;
  accountId: string;
  accountName: string;
  category: string;
  type: ContractType;
  amountInCents: number;
  signedAmountInCents: number;
  occurrenceDate: string;
}

export type ContractAdjustmentPayload = z.infer<typeof contractAdjustmentSchema>;
export type ContractPayload = z.infer<typeof contractSchema>;
export type ContractListItemPayload = z.infer<typeof contractListItemSchema>;
export type ContractsSnapshotPayload = z.infer<typeof contractsSnapshotSchema>;
export type CreateContractInputPayload = z.infer<typeof createContractInputSchema>;
export type UpdateContractInputPayload = z.infer<typeof updateContractInputSchema>;
export type CreateContractAdjustmentInputPayload = z.infer<
  typeof createContractAdjustmentInputSchema
>;
export type EndContractInputPayload = z.infer<typeof endContractInputSchema>;
export type ProjectedContractOccurrencePayload = z.infer<
  typeof projectedContractOccurrenceSchema
>;
