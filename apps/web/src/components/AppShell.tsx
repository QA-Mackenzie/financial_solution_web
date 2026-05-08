import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

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
          <span>Usuário autenticado</span>
          <strong>{session?.user.name}</strong>
        </div>

        <nav className="shell-nav" aria-label="Navegação privada">
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            end
            to="/app"
          >
            Visão geral
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/contas"
          >
            Contas
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/lancamentos"
          >
            Lançamentos
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/contratos"
          >
            Contratos
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/cartoes"
          >
            Cartões
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/parcelamentos"
          >
            Parcelamentos
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/provisoes"
          >
            Provisões
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/analytics"
          >
            Analytics
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              isActive ? 'shell-nav-link shell-nav-link-active' : 'shell-nav-link'
            }
            to="/app/acesso"
          >
            Segurança da conta
          </NavLink>
        </nav>

        <button
          className="secondary-button"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
          type="button"
        >
          Encerrar sessão
        </button>
      </aside>

      <main className="content-panel">{children}</main>
    </div>
  );
}
