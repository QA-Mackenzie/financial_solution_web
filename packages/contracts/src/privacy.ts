import { z } from 'zod';

export const privacyRequestTypeSchema = z.enum(['anonymization', 'erasure']);

export const privacyRequestStatusSchema = z.enum([
  'completed',
  'pending',
  'processing',
  'rejected',
]);

export const privacyRequestSchema = z.object({
  id: z.string().uuid(),
  justification: z.string().min(10).max(400),
  requestType: privacyRequestTypeSchema,
  requestedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  status: privacyRequestStatusSchema,
});

export const privacyRequestsSnapshotSchema = z.object({
  requests: z.array(privacyRequestSchema),
});

export const createPrivacyRequestInputSchema = z.object({
  justification: z
    .string()
    .trim()
    .min(10, 'Descreva em poucas palavras o motivo da solicitacao.')
    .max(400, 'A justificativa deve ter no maximo 400 caracteres.'),
  requestType: privacyRequestTypeSchema,
});

export interface PrivacyRequest {
  id: string;
  justification: string;
  requestType: 'anonymization' | 'erasure';
  requestedAt: string;
  resolvedAt: string | null;
  status: 'completed' | 'pending' | 'processing' | 'rejected';
}

export interface PrivacyRequestsSnapshot {
  requests: PrivacyRequest[];
}

export interface CreatePrivacyRequestInput {
  justification: string;
  requestType: 'anonymization' | 'erasure';
}

export type PrivacyRequestPayload = z.infer<typeof privacyRequestSchema>;
export type PrivacyRequestsSnapshotPayload = z.infer<
  typeof privacyRequestsSnapshotSchema
>;
export type CreatePrivacyRequestInputPayload = z.infer<
  typeof createPrivacyRequestInputSchema
>;