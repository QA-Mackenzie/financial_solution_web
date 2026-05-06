import { supportedFinancialModules } from '@shf/domain-core';

export function DashboardPage() {
  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Shell autenticada</div>
        <h2>Identidade, sessao segura e dominio compartilhado prontos.</h2>
        <p>
          Esta entrega estabelece a trilha autenticada da SHF Web com login,
          cadastro, recuperacao de senha, auditoria minima e o primeiro pacote
          compartilhado das regras financeiras puras.
        </p>
      </article>

      <article className="dashboard-card">
        <h3>Modulos priorizados</h3>
        <ul className="module-list">
          {supportedFinancialModules.map((moduleName) => (
            <li key={moduleName}>{moduleName}</li>
          ))}
        </ul>
      </article>

      <article className="dashboard-card">
        <h3>Proximas entregas</h3>
        <p>
          Sprint 2 abre o modelo financeiro multiusuario com user_id,
          autorizacao owner-based e persistencia das entidades core.
        </p>
      </article>
    </section>
  );
}
