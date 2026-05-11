import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  AUTH_AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  CONSENT_VERSION: z.string().min(1).default('2026-05'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://postgres:postgres@localhost:5432/economy_cash'),
  EXPENSIVE_READ_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  EXPENSIVE_READ_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  PASSWORD_RECOVERY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  PASSWORD_RECOVERY_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(900_000),
  PRIVACY_REQUEST_RETENTION_DAYS: z.coerce.number().int().positive().default(730),
  SESSION_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  TOKEN_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().min(3).default('economy_cash_session'),
  SESSION_SECRET: z
    .string()
    .min(12)
    .default('change-me-in-local-dev'),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().positive().default(720),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export const env = envSchema.parse(process.env);

