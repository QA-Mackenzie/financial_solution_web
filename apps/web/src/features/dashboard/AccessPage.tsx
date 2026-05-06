import { useSessionQuery } from '../auth/use-session';

export function AccessPage() {
  const { data: session } = useSessionQuery();

  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Conta autenticada</div>
        <h2>Seguranca da conta</h2>
        <p>
          Esta area resume o estado atual da identidade autenticada e prepara a
          shell privada para as proximas telas protegidas.
        </p>
      </article>

      <article className="dashboard-card">
        <h3>Resumo da sessao</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Usuario</strong>
            <span>{session?.user.name ?? '--'}</span>
          </div>
          <div className="detail-item">
            <strong>Email</strong>
            <span>{session?.user.email ?? '--'}</span>
          </div>
          <div className="detail-item">
            <strong>Email verificado</strong>
            <span>{session?.user.emailVerifiedAt ? 'Sim' : 'Pendente'}</span>
          </div>
          <div className="detail-item">
            <strong>Expiracao da sessao</strong>
            <span>
              {session?.expiresAt
                ? new Date(session.expiresAt).toLocaleString('pt-BR')
                : '--'}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card">
        <h3>Controles ativos</h3>
        <p>
          Cookies HttpOnly, expiracao definida, reset de senha e auditoria de
          login/logout ja fazem parte da fundacao da plataforma.
        </p>
      </article>
    </section>
  );
}