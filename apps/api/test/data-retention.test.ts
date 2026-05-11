import { makeRegisterInputFixture } from '@economy-cash/test-fixtures';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyDataRetentionPolicy } from '../src/lib/data-retention';

import {
  createAuthTestEnvironment,
  type AuthTestEnvironment,
} from './helpers/create-auth-test-environment';

let authEnvironment: AuthTestEnvironment | null = null;

beforeEach(async () => {
  authEnvironment = await createAuthTestEnvironment();
});

afterEach(async () => {
  await authEnvironment?.cleanup();
  authEnvironment = null;
});

describe('data retention policy', () => {
  it('remove sessoes, tokens, logs e solicitacoes resolvidas fora da janela', async () => {
    const registerResponse = await authEnvironment!.app.inject({
      method: 'POST',
      payload: makeRegisterInputFixture(),
      url: '/api/v1/auth/register',
    });

    expect(registerResponse.statusCode).toBe(201);

    const userResult = await authEnvironment!.database.query<{ id: string }>(
      `select id from auth.users where email = $1`,
      ['alexandre@example.com'],
    );
    const userId = userResult.rows[0]?.id;

    if (!userId) {
      throw new Error('Usuario de teste nao encontrado.');
    }

    await authEnvironment!.database.query(
      `insert into auth.sessions (
        id,
        user_id,
        created_at,
        issued_at,
        expires_at,
        last_seen_at,
        revoked_at
      ) values ($1, $2, $3, $3, $4, $3, $5)`,
      [
        '11111111-1111-4111-8111-111111111111',
        userId,
        '2025-01-01T00:00:00.000Z',
        '2025-01-02T00:00:00.000Z',
        '2025-01-03T00:00:00.000Z',
      ],
    );

    await authEnvironment!.database.query(
      `insert into auth.password_reset_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at,
        consumed_at
      ) values ($1, $2, $3, $4, $5, $6)`,
      [
        '22222222-2222-4222-8222-222222222222',
        userId,
        'old-password-reset-token',
        '2025-01-03T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
        '2025-01-04T00:00:00.000Z',
      ],
    );

    await authEnvironment!.database.query(
      `insert into auth.email_verification_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at,
        consumed_at
      ) values ($1, $2, $3, $4, $5, $6)`,
      [
        '33333333-3333-4333-8333-333333333333',
        userId,
        'old-email-verification-token',
        '2025-01-03T00:00:00.000Z',
        '2025-01-01T00:00:00.000Z',
        '2025-01-04T00:00:00.000Z',
      ],
    );

    await authEnvironment!.database.query(
      `insert into auth.audit_logs (
        id,
        user_id,
        event_type,
        ip_address,
        user_agent,
        request_id,
        details,
        occurred_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        '44444444-4444-4444-8444-444444444444',
        userId,
        'LEGACY_SECURITY_EVENT',
        '127.0.0.1',
        'vitest',
        'req-old-1',
        JSON.stringify({ scope: 'security' }),
        '2025-01-02T00:00:00.000Z',
      ],
    );

    await authEnvironment!.database.query(
      `insert into auth.privacy_requests (
        id,
        user_id,
        request_type,
        status,
        justification,
        requested_at,
        resolved_at
      ) values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '55555555-5555-4555-8555-555555555555',
        userId,
        'anonymization',
        'completed',
        'Solicitacao antiga ja concluida.',
        '2025-01-02T00:00:00.000Z',
        '2025-01-03T00:00:00.000Z',
      ],
    );

    await authEnvironment!.database.query(
      `insert into auth.privacy_requests (
        id,
        user_id,
        request_type,
        status,
        justification,
        requested_at,
        resolved_at
      ) values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        '66666666-6666-4666-8666-666666666666',
        userId,
        'erasure',
        'pending',
        'Solicitacao recente ainda em andamento.',
        '2026-04-20T00:00:00.000Z',
        null,
      ],
    );

    const summary = await applyDataRetentionPolicy(
      authEnvironment!.database,
      new Date('2026-05-11T00:00:00.000Z'),
      {
        authAuditLogRetentionDays: 180,
        privacyRequestRetentionDays: 365,
        sessionRetentionDays: 30,
        tokenRetentionDays: 30,
      },
    );

    expect(summary).toMatchObject({
      deletedAuthAuditLogs: 1,
      deletedEmailVerificationTokens: 1,
      deletedExpiredSessions: 1,
      deletedPasswordResetTokens: 1,
      deletedResolvedPrivacyRequests: 1,
    });

    const remainingPrivacyRequests = await authEnvironment!.database.query<{ status: string }>(
      `select status from auth.privacy_requests order by requested_at asc`,
    );
    const remainingAuditLogs = await authEnvironment!.database.query<{ event_type: string }>(
      `select event_type from auth.audit_logs`,
    );

    expect(remainingPrivacyRequests.rows).toEqual([
      {
        status: 'pending',
      },
    ]);
    expect(
      remainingAuditLogs.rows.some((row) => row.event_type === 'LEGACY_SECURITY_EVENT'),
    ).toBe(false);
  });
});