import type { DatabaseExecutor } from './database';

export type DataRetentionPolicy = {
  authAuditLogRetentionDays: number;
  privacyRequestRetentionDays: number;
  sessionRetentionDays: number;
  tokenRetentionDays: number;
};

export type DataRetentionSummary = {
  deletedAuthAuditLogs: number;
  deletedEmailVerificationTokens: number;
  deletedExpiredSessions: number;
  deletedPasswordResetTokens: number;
  deletedResolvedPrivacyRequests: number;
  executedAt: string;
};

export async function applyDataRetentionPolicy(
  database: DatabaseExecutor,
  now: Date,
  policy: DataRetentionPolicy,
): Promise<DataRetentionSummary> {
  const authAuditCutoff = subtractDays(now, policy.authAuditLogRetentionDays);
  const privacyRequestCutoff = subtractDays(now, policy.privacyRequestRetentionDays);
  const sessionCutoff = subtractDays(now, policy.sessionRetentionDays);
  const tokenCutoff = subtractDays(now, policy.tokenRetentionDays);

  const deletedExpiredSessions = await database.query(
    `delete from auth.sessions
      where coalesce(revoked_at, expires_at) < $1`,
    [sessionCutoff.toISOString()],
  );

  const deletedPasswordResetTokens = await database.query(
    `delete from auth.password_reset_tokens
      where coalesce(consumed_at, expires_at) < $1`,
    [tokenCutoff.toISOString()],
  );

  const deletedEmailVerificationTokens = await database.query(
    `delete from auth.email_verification_tokens
      where coalesce(consumed_at, expires_at) < $1`,
    [tokenCutoff.toISOString()],
  );

  const deletedAuthAuditLogs = await database.query(
    `delete from auth.audit_logs
      where occurred_at < $1`,
    [authAuditCutoff.toISOString()],
  );

  const deletedResolvedPrivacyRequests = await database.query(
    `delete from auth.privacy_requests
      where status in ('completed', 'rejected')
        and coalesce(resolved_at, requested_at) < $1`,
    [privacyRequestCutoff.toISOString()],
  );

  return {
    deletedAuthAuditLogs: deletedAuthAuditLogs.rowCount ?? 0,
    deletedEmailVerificationTokens: deletedEmailVerificationTokens.rowCount ?? 0,
    deletedExpiredSessions: deletedExpiredSessions.rowCount ?? 0,
    deletedPasswordResetTokens: deletedPasswordResetTokens.rowCount ?? 0,
    deletedResolvedPrivacyRequests: deletedResolvedPrivacyRequests.rowCount ?? 0,
    executedAt: now.toISOString(),
  };
}

function subtractDays(value: Date, days: number): Date {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000);
}