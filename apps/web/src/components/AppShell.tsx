import type { PropsWithChildren } from 'react';

import { useLogoutMutation, useSessionQuery } from '../features/auth/use-session';

export function AppShell({ children }: PropsWithChildren) {
  const { data: session } = useSessionQuery();
  const logoutMutation = useLogoutMutation();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="eyebrow">SHF Web</div>
          <h1>Painel inicial</h1>
        </div>

        <div className="session-card">
          <span>Usuario autenticado</span>
          <strong>{session?.user.name}</strong>
          <small>{session?.user.email}</small>
        </div>

        <button
          className="secondary-button"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
          type="button"
        >
          Encerrar sessao
        </button>
      </aside>

      <main className="content-panel">{children}</main>
    </div>
  );
}
