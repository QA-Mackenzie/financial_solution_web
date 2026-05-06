import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

export const sessionSchema = z.object({
  user: userSchema,
  issuedAt: z.string().datetime(),
});

export const loginInputSchema = z.object({
  email: z.string().email('Informe um email valido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

export const registerInputSchema = loginInputSchema.extend({
  name: z.string().min(2, 'Informe seu nome completo.'),
});

export type AuthenticatedUser = z.infer<typeof userSchema>;
export type SessionPayload = z.infer<typeof sessionSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
