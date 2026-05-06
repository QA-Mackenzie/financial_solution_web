import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
});

export const sessionSchema = z.object({
  expiresAt: z.string().datetime(),
  user: userSchema,
  issuedAt: z.string().datetime(),
});

export const loginInputSchema = z.object({
  email: z.string().email('Informe um email valido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

export const registerInputSchema = loginInputSchema.extend({
  consentAccepted: z.boolean().refine((value) => value, {
    message: 'Voce precisa aceitar a politica para continuar.',
  }),
  consentVersion: z.string().min(1),
  name: z.string().min(2, 'Informe seu nome completo.'),
});

export const passwordResetRequestInputSchema = z.object({
  email: z.string().email('Informe um email valido.'),
});

export const passwordResetInputSchema = z.object({
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  token: z.string().min(20, 'Informe um token de reset valido.'),
});

export const passwordResetRequestResultSchema = z.object({
  message: z.string(),
  previewToken: z.string().nullable().optional(),
});

export type AuthenticatedUser = z.infer<typeof userSchema>;
export type SessionPayload = z.infer<typeof sessionSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetInputSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestInputSchema
>;
export type PasswordResetRequestResult = z.infer<
  typeof passwordResetRequestResultSchema
>;
