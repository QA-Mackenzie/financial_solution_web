import type { SessionPayload } from '@economy-cash/contracts';

import type { AuthService } from './auth-service';
import { AppError } from './errors';

export type AuthorizedSession = {
  session: SessionPayload;
  sessionToken: string;
  userId: string;
};

export class SessionGuard {
  constructor(private readonly authService: AuthService) {}

  async requireUserSession(
    sessionToken: string | undefined,
    renew = false,
  ): Promise<AuthorizedSession> {
    const sessionResult = await this.authService.getSession(sessionToken, renew);

    if (!sessionResult) {
      throw new AppError(
        401,
        'AUTH_UNAUTHENTICATED',
        'Sessao invalida ou expirada.',
      );
    }

    return {
      session: sessionResult.session,
      sessionToken: sessionResult.sessionToken,
      userId: sessionResult.session.user.id,
    };
  }

  assertResourceOwnership(
    sessionUserId: string,
    resourceUserId: string,
  ): void {
    if (sessionUserId !== resourceUserId) {
      throw new AppError(
        404,
        'FINANCE_RESOURCE_NOT_FOUND',
        'Recurso financeiro nao encontrado.',
      );
    }
  }
}