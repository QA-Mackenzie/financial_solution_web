import { useSessionQuery } from '../auth/use-session';

export function AccessPage() {
  const { data: session } = useSessionQuery();

  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Conta autenticada</div>
        <h2>Segurança da conta</h2>
      </article>

      <article className="dashboard-card">
        <h3>Resumo da sessão</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Usuário</strong>
            <span>{session?.user.name ?? '--'}</span>
          </div>
          <div className="detail-item">
            <strong>Email</strong>
            <span>{session?.user.email ?? '--'}</span>
          </div>
        </div>
      </article>
    </section>
  );
}
