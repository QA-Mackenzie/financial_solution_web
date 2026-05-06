import type { LoginInput, RegisterInput, SessionPayload } from '@shf/contracts';

export function makeRegisterInputFixture(
  overrides: Partial<RegisterInput> = {},
): RegisterInput {
  return {
    consentAccepted: true,
    consentVersion: '2026-05',
    name: 'Alexandre Demo',
    email: 'alexandre@example.com',
    password: 'senha-segura-123',
    ...overrides,
  };
}

export function makeLoginInputFixture(
  overrides: Partial<LoginInput> = {},
): LoginInput {
  return {
    email: 'alexandre@example.com',
    password: 'senha-segura-123',
    ...overrides,
  };
}

export function makeSessionFixture(
  overrides: Partial<SessionPayload> = {},
): SessionPayload {
  return {
    user: {
      id: '92f49d09-7671-4518-bd08-c566ce68636a',
      name: 'Alexandre Demo',
      email: 'alexandre@example.com',
      emailVerifiedAt: null,
    },
    expiresAt: new Date('2026-01-08T12:00:00.000Z').toISOString(),
    issuedAt: new Date('2026-01-01T12:00:00.000Z').toISOString(),
    ...overrides,
  };
}