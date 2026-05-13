import { z } from 'zod';

const DEVELOPMENT_DEFAULTS = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/economy_cash',
  SESSION_SECRET: 'change-me-in-local-dev',
  WEB_ORIGIN: 'http://localhost:5173',
} as const;

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  AUTH_AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(180),
  CONSENT_VERSION: z.string().min(1).default('2026-05'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(DEVELOPMENT_DEFAULTS.DATABASE_URL),
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
  WEB_ORIGIN: z.string().url().default(DEVELOPMENT_DEFAULTS.WEB_ORIGIN),
  SESSION_COOKIE_NAME: z.string().min(3).default('economy_cash_session'),
  SESSION_SECRET: z
    .string()
    .min(12)
    .default(DEVELOPMENT_DEFAULTS.SESSION_SECRET),
  SESSION_ABSOLUTE_TTL_HOURS: z.coerce.number().int().positive().default(720),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getProductionConfigViolations(
  rawEnv: NodeJS.ProcessEnv,
  env: z.infer<typeof envSchema>,
) {
  const violations: string[] = [];

  if (!rawEnv.DATABASE_URL || env.DATABASE_URL === DEVELOPMENT_DEFAULTS.DATABASE_URL) {
    violations.push('DATABASE_URL deve ser definido explicitamente em producao.');
  } else {
    const databaseUrl = new URL(env.DATABASE_URL);

    if (isLocalHostname(databaseUrl.hostname)) {
      violations.push('DATABASE_URL nao pode apontar para localhost em producao.');
    }
  }

  if (!rawEnv.WEB_ORIGIN || env.WEB_ORIGIN === DEVELOPMENT_DEFAULTS.WEB_ORIGIN) {
    violations.push('WEB_ORIGIN deve ser definido explicitamente em producao.');
  } else {
    const webOriginUrl = new URL(env.WEB_ORIGIN);

    if (webOriginUrl.protocol !== 'https:') {
      violations.push('WEB_ORIGIN deve usar https em producao.');
    }

    if (isLocalHostname(webOriginUrl.hostname)) {
      violations.push('WEB_ORIGIN nao pode apontar para localhost em producao.');
    }
  }

  if (!rawEnv.SESSION_SECRET || env.SESSION_SECRET === DEVELOPMENT_DEFAULTS.SESSION_SECRET) {
    violations.push('SESSION_SECRET deve ser definido explicitamente em producao.');
  } else if (env.SESSION_SECRET.length < 32) {
    violations.push('SESSION_SECRET deve ter ao menos 32 caracteres em producao.');
  }

  return violations;
}

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(rawEnv);

  if (env.NODE_ENV !== 'production') {
    return env;
  }

  const violations = getProductionConfigViolations(rawEnv, env);

  if (violations.length > 0) {
    throw new Error(`Configuracao insegura para producao: ${violations.join(' ')}`);
  }

  return env;
}

export const env = parseEnv(process.env);

