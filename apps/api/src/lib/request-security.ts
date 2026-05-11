import { randomUUID } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import type { DatabaseExecutor } from './database';

type RateLimitPolicy = {
  bucket: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const mutatingMethods = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);
const trustedFetchSites = new Set(['none', 'same-origin', 'same-site']);

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitState>();

  check(key: string, policy: RateLimitPolicy, now: Date): RateLimitResult {
    const nowMs = now.getTime();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= nowMs) {
      this.buckets.set(key, {
        count: 1,
        resetAt: nowMs + policy.windowMs,
      });
      this.cleanup(nowMs);

      return {
        allowed: true,
        limit: policy.limit,
        remaining: Math.max(policy.limit - 1, 0),
        resetAt: nowMs + policy.windowMs,
        retryAfterSeconds: 0,
      };
    }

    if (bucket.count >= policy.limit) {
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - nowMs) / 1000), 1),
      };
    }

    bucket.count += 1;

    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(policy.limit - bucket.count, 0),
      resetAt: bucket.resetAt,
      retryAfterSeconds: 0,
    };
  }

  private cleanup(nowMs: number): void {
    if (this.buckets.size < 512) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= nowMs) {
        this.buckets.delete(key);
      }
    }
  }
}

export function getRequestPath(url: string): string {
  const querySeparatorIndex = url.indexOf('?');

  if (querySeparatorIndex === -1) {
    return url;
  }

  return url.slice(0, querySeparatorIndex);
}

export function resolveRateLimitPolicy(
  method: string,
  path: string,
  options: {
    authMax: number;
    authWindowMs: number;
    expensiveReadMax: number;
    expensiveReadWindowMs: number;
    passwordRecoveryMax: number;
    passwordRecoveryWindowMs: number;
  },
): RateLimitPolicy | null {
  if (method === 'POST') {
    if (path === '/api/v1/auth/password-recovery') {
      return {
        bucket: 'auth-password-recovery',
        limit: options.passwordRecoveryMax,
        windowMs: options.passwordRecoveryWindowMs,
      };
    }

    if (
      path === '/api/v1/auth/login' ||
      path === '/api/v1/auth/register' ||
      path === '/api/v1/auth/password-reset'
    ) {
      return {
        bucket: 'auth-mutation',
        limit: options.authMax,
        windowMs: options.authWindowMs,
      };
    }
  }

  if (
    method === 'GET' &&
    (path === '/api/v1/horizon' ||
      path === '/api/v1/analytics' ||
      path === '/api/v1/records')
  ) {
    return {
      bucket: 'expensive-read',
      limit: options.expensiveReadMax,
      windowMs: options.expensiveReadWindowMs,
    };
  }

  return null;
}

export function getOriginViolation(
  request: FastifyRequest,
  allowedOrigin: string,
): { offendingOrigin: string | null; path: string; reason: string } | null {
  if (!mutatingMethods.has(request.method.toUpperCase())) {
    return null;
  }

  const originHeader =
    typeof request.headers.origin === 'string' ? request.headers.origin.trim() : null;

  if (originHeader === 'null') {
    return {
      offendingOrigin: originHeader,
      path: getRequestPath(request.url),
      reason: 'origin-null',
    };
  }

  if (originHeader && originHeader !== allowedOrigin) {
    return {
      offendingOrigin: originHeader,
      path: getRequestPath(request.url),
      reason: 'origin-mismatch',
    };
  }

  const refererHeader =
    typeof request.headers.referer === 'string' ? request.headers.referer.trim() : null;

  if (refererHeader) {
    try {
      const refererOrigin = new URL(refererHeader).origin;

      if (refererOrigin !== allowedOrigin) {
        return {
          offendingOrigin: refererOrigin,
          path: getRequestPath(request.url),
          reason: 'referer-mismatch',
        };
      }
    } catch {
      return {
        offendingOrigin: refererHeader,
        path: getRequestPath(request.url),
        reason: 'referer-invalid',
      };
    }
  }

  const fetchSiteHeader =
    typeof request.headers['sec-fetch-site'] === 'string'
      ? request.headers['sec-fetch-site'].trim().toLowerCase()
      : null;

  if (fetchSiteHeader && !trustedFetchSites.has(fetchSiteHeader)) {
    return {
      offendingOrigin: originHeader,
      path: getRequestPath(request.url),
      reason: 'cross-site-fetch-metadata',
    };
  }

  return null;
}

export async function insertSecurityAuditLog(
  database: DatabaseExecutor,
  now: Date,
  eventType: string,
  request: FastifyRequest,
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
      null,
      eventType,
      request.ip ?? null,
      typeof request.headers['user-agent'] === 'string'
        ? request.headers['user-agent']
        : null,
      request.id,
      JSON.stringify(details),
      now.toISOString(),
    ],
  );
}