import { randomUUID } from 'node:crypto';

import type {
  AuthenticatedUser,
  LoginInput,
  RegisterInput,
  SessionPayload,
} from '@shf/contracts';
import { normalizeEmail } from '@shf/domain-core';

import { AppError } from './errors';

type StoredUser = AuthenticatedUser & {
  password: string;
};

class AuthStoreError extends AppError {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(statusCode, code, message);
  }
}

class InMemoryAuthStore {
  private usersByEmail = new Map<string, StoredUser>();

  private sessionToUserId = new Map<string, string>();

  register(input: RegisterInput): { sessionId: string; session: SessionPayload } {
    const normalizedEmail = normalizeEmail(input.email);

    if (this.usersByEmail.has(normalizedEmail)) {
      throw new AuthStoreError(
        409,
        'AUTH_DUPLICATE_EMAIL',
        'Ja existe uma conta com este email.',
      );
    }

    const user: StoredUser = {
      id: randomUUID(),
      name: input.name.trim(),
      email: normalizedEmail,
      password: input.password,
    };

    this.usersByEmail.set(normalizedEmail, user);

    return this.createSession(user);
  }

  login(input: LoginInput): { sessionId: string; session: SessionPayload } {
    const normalizedEmail = normalizeEmail(input.email);
    const user = this.usersByEmail.get(normalizedEmail);

    if (!user || user.password !== input.password) {
      throw new AuthStoreError(
        401,
        'AUTH_INVALID_CREDENTIALS',
        'Credenciais invalidas.',
      );
    }

    return this.createSession(user);
  }

  getSession(sessionId?: string): SessionPayload | null {
    if (!sessionId) {
      return null;
    }

    const userId = this.sessionToUserId.get(sessionId);

    if (!userId) {
      return null;
    }

    const user = [...this.usersByEmail.values()].find((entry) => entry.id === userId);

    if (!user) {
      this.sessionToUserId.delete(sessionId);
      return null;
    }

    return {
      user: this.toAuthenticatedUser(user),
      issuedAt: new Date().toISOString(),
    };
  }

  logout(sessionId?: string): void {
    if (!sessionId) {
      return;
    }

    this.sessionToUserId.delete(sessionId);
  }

  reset(): void {
    this.usersByEmail.clear();
    this.sessionToUserId.clear();
  }

  private createSession(user: StoredUser): { sessionId: string; session: SessionPayload } {
    const sessionId = randomUUID();
    this.sessionToUserId.set(sessionId, user.id);

    return {
      sessionId,
      session: {
        user: this.toAuthenticatedUser(user),
        issuedAt: new Date().toISOString(),
      },
    };
  }

  private toAuthenticatedUser(user: StoredUser): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}

export const authStore = new InMemoryAuthStore();
export { AuthStoreError };

