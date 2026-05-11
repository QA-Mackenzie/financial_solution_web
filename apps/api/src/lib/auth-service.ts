import { randomUUID } from 'node:crypto';

import type {
  CreatePrivacyRequestInput,
  LoginInput,
  PasswordResetInput,
  PasswordResetRequestInput,
  PasswordResetRequestResult,
  PrivacyRequest,
  PrivacyRequestsSnapshot,
  RegisterInput,
  SessionPayload,
} from '@economy-cash/contracts';
import { normalizeEmail } from '@economy-cash/domain-core';
import type { QueryResultRow } from 'pg';

import { env } from '../config';
import type { DatabaseClient, DatabaseExecutor } from './database';
import { AppError } from './errors';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './auth-crypto';

export type AuthRequestContext = {
  ipAddress: string | null;
  requestId: string;
  userAgent: string | null;
};

type AuthServiceOptions = {
  consentVersion?: string;
  emailVerificationTokenTtlMs?: number;
  now?: () => Date;
  passwordResetTokenTtlMs?: number;
  sessionAbsoluteTtlMs?: number;
  sessionTtlMs?: number;
};

type UserRecord = QueryResultRow & {
  email: string;
  email_verified_at: Date | string | null;
  id: string;
  name: string;
  password_hash: string;
};

type SessionRecord = QueryResultRow & {
  created_at: Date | string;
  expires_at: Date | string;
  issued_at: Date | string;
  user_email: string;
  user_email_verified_at: Date | string | null;
  user_id: string;
  user_name: string;
};

type PasswordResetTokenRecord = QueryResultRow & {
  email: string;
  token_id: string;
  user_id: string;
};

type PrivacyRequestRecord = QueryResultRow & {
  id: string;
  justification: string;
  request_type: 'anonymization' | 'erasure';
  requested_at: Date | string;
  resolved_at: Date | string | null;
  status: 'completed' | 'pending' | 'processing' | 'rejected';
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AuthService {
  private readonly consentVersion: string;

  private readonly emailVerificationTokenTtlMs: number;

  private readonly now: () => Date;

  private readonly passwordResetTokenTtlMs: number;

  private readonly sessionAbsoluteTtlMs: number;

  private readonly sessionTtlMs: number;

  constructor(
    private readonly database: DatabaseClient,
    options: AuthServiceOptions = {},
  ) {
    this.consentVersion = options.consentVersion ?? env.CONSENT_VERSION;
    this.emailVerificationTokenTtlMs =
      options.emailVerificationTokenTtlMs ??
      env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000;
    this.now = options.now ?? (() => new Date());
    this.passwordResetTokenTtlMs =
      options.passwordResetTokenTtlMs ??
      env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000;
    this.sessionAbsoluteTtlMs =
      options.sessionAbsoluteTtlMs ??
      env.SESSION_ABSOLUTE_TTL_HOURS * 60 * 60 * 1000;
    this.sessionTtlMs = options.sessionTtlMs ?? env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  }

  getSessionCookieMaxAgeSeconds(): number {
    return Math.ceil(this.sessionTtlMs / 1000);
  }

  async register(
    input: RegisterInput,
    context: AuthRequestContext,
  ): Promise<{ session: SessionPayload; sessionToken: string }> {
    const email = normalizeEmail(input.email);
    const existingUser = await this.database.query<{ id: string }>(
      'select id from auth.users where email = $1',
      [email],
    );

    if ((existingUser.rowCount ?? 0) > 0) {
      await this.insertAuditLog(this.database, null, 'AUTH_REGISTER_FAILURE', context, {
        email,
        reason: 'duplicate-email',
      });

      throw new AppError(
        409,
        'AUTH_DUPLICATE_EMAIL',
        'Ja existe uma conta com este email.',
      );
    }

    const now = this.now();
    const passwordHash = await hashPassword(input.password);

    return this.database.runInTransaction(async (transaction) => {
      const userId = randomUUID();

      await transaction.query(
        `insert into auth.users (
          id,
          email,
          name,
          password_hash,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $5)`,
        [userId, email, input.name.trim(), passwordHash, now.toISOString()],
      );

      await transaction.query(
        `insert into auth.consents (
          id,
          user_id,
          consent_type,
          consent_version,
          granted_at
        ) values ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          userId,
          'terms-and-privacy',
          input.consentVersion || this.consentVersion,
          now.toISOString(),
        ],
      );

      await this.createEmailVerificationToken(transaction, userId, now);

      const sessionResult = await this.createSession(
        transaction,
        {
          email,
          emailVerifiedAt: null,
          id: userId,
          name: input.name.trim(),
        },
        context,
        now,
      );

      await this.insertAuditLog(transaction, userId, 'AUTH_REGISTER_SUCCESS', context, {
        email,
      });

      return sessionResult;
    });
  }

  async login(
    input: LoginInput,
    context: AuthRequestContext,
  ): Promise<{ session: SessionPayload; sessionToken: string }> {
    const email = normalizeEmail(input.email);
    const userResult = await this.database.query<UserRecord>(
      `select id, email, name, password_hash, email_verified_at
       from auth.users
       where email = $1`,
      [email],
    );
    const user = userResult.rows[0];

    if (!user) {
      await this.insertAuditLog(this.database, null, 'AUTH_LOGIN_FAILURE', context, {
        email,
        reason: 'unknown-email',
      });

      throw new AppError(
        401,
        'AUTH_INVALID_CREDENTIALS',
        'Credenciais invalidas.',
      );
    }

    const passwordMatches = await verifyPassword(input.password, user.password_hash);

    if (!passwordMatches) {
      await this.insertAuditLog(this.database, user.id, 'AUTH_LOGIN_FAILURE', context, {
        email,
        reason: 'invalid-password',
      });

      throw new AppError(
        401,
        'AUTH_INVALID_CREDENTIALS',
        'Credenciais invalidas.',
      );
    }

    const now = this.now();

    return this.database.runInTransaction(async (transaction) => {
      const sessionResult = await this.createSession(
        transaction,
        {
          email: user.email,
          emailVerifiedAt: user.email_verified_at,
          id: user.id,
          name: user.name,
        },
        context,
        now,
      );

      await this.insertAuditLog(transaction, user.id, 'AUTH_LOGIN_SUCCESS', context, {
        email,
      });

      return sessionResult;
    });
  }

  async getSession(
    sessionToken: string | undefined,
    renew: boolean,
  ): Promise<{ session: SessionPayload; sessionToken: string } | null> {
    const normalizedSessionToken = normalizeSessionToken(sessionToken);

    if (!normalizedSessionToken) {
      return null;
    }

    const session = await this.findSession(normalizedSessionToken);

    if (!session) {
      return null;
    }

    const now = this.now();
    const expiresAt = new Date(session.expires_at);
    const createdAt = new Date(session.created_at);

    if (createdAt.getTime() + this.sessionAbsoluteTtlMs <= now.getTime()) {
      await this.database.query(
        `update auth.sessions
         set revoked_at = $2
         where id = $1 and revoked_at is null`,
        [normalizedSessionToken, now.toISOString()],
      );

      return null;
    }

    if (expiresAt <= now) {
      await this.database.query(
        `update auth.sessions
         set revoked_at = $2
         where id = $1 and revoked_at is null`,
        [normalizedSessionToken, now.toISOString()],
      );

      return null;
    }

    if (!renew) {
      return {
        session: this.toSessionPayload(session),
        sessionToken: normalizedSessionToken,
      };
    }

    const renewedExpiresAt = new Date(now.getTime() + this.sessionTtlMs);

    await this.database.query(
      `update auth.sessions
       set expires_at = $2,
           last_seen_at = $3
       where id = $1`,
      [normalizedSessionToken, renewedExpiresAt.toISOString(), now.toISOString()],
    );

    return {
      session: {
        ...this.toSessionPayload(session),
        expiresAt: renewedExpiresAt.toISOString(),
      },
      sessionToken: normalizedSessionToken,
    };
  }

  async logout(
    sessionToken: string | undefined,
    context: AuthRequestContext,
  ): Promise<void> {
    const normalizedSessionToken = normalizeSessionToken(sessionToken);

    if (!normalizedSessionToken) {
      return;
    }

    const now = this.now();
    const result = await this.database.query<{ user_id: string }>(
      `update auth.sessions
       set revoked_at = $2
       where id = $1 and revoked_at is null
       returning user_id`,
      [normalizedSessionToken, now.toISOString()],
    );

    if ((result.rowCount ?? 0) > 0) {
      await this.insertAuditLog(
        this.database,
        result.rows[0].user_id,
        'AUTH_LOGOUT_SUCCESS',
        context,
        {},
      );
    }
  }

  async requestPasswordReset(
    input: PasswordResetRequestInput,
    context: AuthRequestContext,
  ): Promise<PasswordResetRequestResult> {
    const email = normalizeEmail(input.email);
    const userResult = await this.database.query<UserRecord>(
      `select id, email, name, password_hash, email_verified_at
       from auth.users
       where email = $1`,
      [email],
    );
    const user = userResult.rows[0];

    if (!user) {
      await this.insertAuditLog(this.database, null, 'AUTH_PASSWORD_RESET_IGNORED', context, {
        email,
      });

      return {
        message:
          'Se o email existir, um link de redefinicao sera disponibilizado.',
      };
    }

    const token = generateOpaqueToken();
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.passwordResetTokenTtlMs);

    await this.database.runInTransaction(async (transaction) => {
      await transaction.query(
        `update auth.password_reset_tokens
         set consumed_at = coalesce(consumed_at, $2)
         where user_id = $1 and consumed_at is null`,
        [user.id, now.toISOString()],
      );

      await transaction.query(
        `insert into auth.password_reset_tokens (
          id,
          user_id,
          token_hash,
          expires_at,
          created_at
        ) values ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          user.id,
          hashOpaqueToken(token),
          expiresAt.toISOString(),
          now.toISOString(),
        ],
      );

      await this.insertAuditLog(
        transaction,
        user.id,
        'AUTH_PASSWORD_RESET_REQUESTED',
        context,
        { email },
      );
    });

    return {
      message:
        'Se o email existir, um link de redefinicao sera disponibilizado.',
      previewToken: env.NODE_ENV === 'production' ? null : token,
    };
  }

  async resetPassword(
    input: PasswordResetInput,
    context: AuthRequestContext,
  ): Promise<void> {
    const now = this.now();
    const tokenHash = hashOpaqueToken(input.token);
    const resetTokenResult = await this.database.query<PasswordResetTokenRecord>(
      `select prt.id as token_id,
              prt.user_id,
              u.email
       from auth.password_reset_tokens prt
       join auth.users u on u.id = prt.user_id
       where prt.token_hash = $1
         and prt.consumed_at is null
         and prt.expires_at > $2`,
      [tokenHash, now.toISOString()],
    );
    const resetToken = resetTokenResult.rows[0];

    if (!resetToken) {
      throw new AppError(
        400,
        'AUTH_INVALID_RESET_TOKEN',
        'O token de redefinicao e invalido ou expirou.',
      );
    }

    const passwordHash = await hashPassword(input.password);

    await this.database.runInTransaction(async (transaction) => {
      await transaction.query(
        `update auth.users
         set password_hash = $2,
             updated_at = $3
         where id = $1`,
        [resetToken.user_id, passwordHash, now.toISOString()],
      );

      await transaction.query(
        `update auth.password_reset_tokens
         set consumed_at = $2
         where id = $1`,
        [resetToken.token_id, now.toISOString()],
      );

      await transaction.query(
        `update auth.sessions
         set revoked_at = $2
         where user_id = $1 and revoked_at is null`,
        [resetToken.user_id, now.toISOString()],
      );

      await this.insertAuditLog(
        transaction,
        resetToken.user_id,
        'AUTH_PASSWORD_RESET_SUCCESS',
        context,
        { email: resetToken.email },
      );
    });
  }

  async listPrivacyRequests(userId: string): Promise<PrivacyRequestsSnapshot> {
    const result = await this.database.query<PrivacyRequestRecord>(
      `select id,
              request_type,
              status,
              justification,
              requested_at,
              resolved_at
         from auth.privacy_requests
        where user_id = $1
        order by requested_at desc`,
      [userId],
    );

    return {
      requests: result.rows.map((request) => this.toPrivacyRequest(request)),
    };
  }

  async createPrivacyRequest(
    userId: string,
    input: CreatePrivacyRequestInput,
    context: AuthRequestContext,
  ): Promise<PrivacyRequest> {
    return this.database.runInTransaction(async (transaction) => {
      const existingRequest = await transaction.query<{ id: string }>(
        `select id
           from auth.privacy_requests
          where user_id = $1
            and request_type = $2
            and status in ('pending', 'processing')
          limit 1`,
        [userId, input.requestType],
      );

      if ((existingRequest.rowCount ?? 0) > 0) {
        throw new AppError(
          409,
          'PRIVACY_REQUEST_ALREADY_OPEN',
          'Ja existe uma solicitacao em andamento para esse tipo de atendimento.',
        );
      }

      const now = this.now();
      const result = await transaction.query<PrivacyRequestRecord>(
        `insert into auth.privacy_requests (
          id,
          user_id,
          request_type,
          status,
          justification,
          requested_at,
          resolved_at
        ) values ($1, $2, $3, $4, $5, $6, $7)
        returning id,
                  request_type,
                  status,
                  justification,
                  requested_at,
                  resolved_at`,
        [
          randomUUID(),
          userId,
          input.requestType,
          'pending',
          input.justification.trim(),
          now.toISOString(),
          null,
        ],
      );

      await this.insertAuditLog(transaction, userId, 'PRIVACY_REQUEST_CREATED', context, {
        requestType: input.requestType,
      });

      return this.toPrivacyRequest(result.rows[0]);
    });
  }

  private async createEmailVerificationToken(
    transaction: DatabaseExecutor,
    userId: string,
    now: Date,
  ): Promise<void> {
    await transaction.query(
      `insert into auth.email_verification_tokens (
        id,
        user_id,
        token_hash,
        expires_at,
        created_at
      ) values ($1, $2, $3, $4, $5)`,
      [
        randomUUID(),
        userId,
        hashOpaqueToken(generateOpaqueToken()),
        new Date(now.getTime() + this.emailVerificationTokenTtlMs).toISOString(),
        now.toISOString(),
      ],
    );
  }

  private async createSession(
    transaction: DatabaseExecutor,
    user: {
      email: string;
      emailVerifiedAt: Date | string | null;
      id: string;
      name: string;
    },
    context: AuthRequestContext,
    now: Date,
  ): Promise<{ session: SessionPayload; sessionToken: string }> {
    const sessionToken = randomUUID();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs);

    await transaction.query(
      `insert into auth.sessions (
        id,
        user_id,
        created_at,
        issued_at,
        expires_at,
        last_seen_at
      ) values ($1, $2, $3, $3, $4, $3)`,
      [sessionToken, user.id, now.toISOString(), expiresAt.toISOString()],
    );

    await this.insertAuditLog(transaction, user.id, 'AUTH_SESSION_ISSUED', context, {
      sessionId: sessionToken,
    });

    return {
      session: {
        expiresAt: expiresAt.toISOString(),
        issuedAt: now.toISOString(),
        user: {
          email: user.email,
          emailVerifiedAt: toIsoString(user.emailVerifiedAt),
          id: user.id,
          name: user.name,
        },
      },
      sessionToken,
    };
  }

  private async findSession(sessionToken: string): Promise<SessionRecord | null> {
    const result = await this.database.query<SessionRecord>(
      `select s.created_at,
              s.issued_at,
              s.expires_at,
              u.id as user_id,
              u.name as user_name,
              u.email as user_email,
              u.email_verified_at as user_email_verified_at
       from auth.sessions s
       join auth.users u on u.id = s.user_id
       where s.id = $1 and s.revoked_at is null`,
      [sessionToken],
    );

    return result.rows[0] ?? null;
  }

  private async insertAuditLog(
    database: DatabaseExecutor,
    userId: string | null,
    eventType: string,
    context: AuthRequestContext,
    details: Record<string, unknown>,
  ): Promise<void> {
    await database.query(
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
        randomUUID(),
        userId,
        eventType,
        context.ipAddress,
        context.userAgent,
        context.requestId,
        JSON.stringify(details),
        this.now().toISOString(),
      ],
    );
  }

  private toSessionPayload(session: SessionRecord): SessionPayload {
    return {
      expiresAt: toRequiredIsoString(session.expires_at),
      issuedAt: toRequiredIsoString(session.issued_at),
      user: {
        email: session.user_email,
        emailVerifiedAt: toIsoString(session.user_email_verified_at),
        id: session.user_id,
        name: session.user_name,
      },
    };
  }

  private toPrivacyRequest(request: PrivacyRequestRecord): PrivacyRequest {
    return {
      id: request.id,
      justification: request.justification,
      requestType: request.request_type,
      requestedAt: toRequiredIsoString(request.requested_at),
      resolvedAt: toIsoString(request.resolved_at),
      status: request.status,
    };
  }
}

function toIsoString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function toRequiredIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeSessionToken(sessionToken: string | undefined): string | null {
  const normalizedSessionToken = sessionToken?.trim();

  if (!normalizedSessionToken || !uuidPattern.test(normalizedSessionToken)) {
    return null;
  }

  return normalizedSessionToken;
}
