import { supportedFinancialModules } from '@shf/domain-core';

export function DashboardPage() {
  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Roadmap em execucao</div>
        <h2>Base web pronta para evoluir os modulos financeiros.</h2>
        <p>
          Esta primeira entrega estabelece shell autenticado, contratos
          compartilhados e uma API que pode evoluir para tenancy, persistencia e
          calculo oficial do horizonte.
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
          Persistencia com PostgreSQL, isolamento por usuario, CRUD de contas e
          primeiros lancamentos manuais.
        </p>
      </article>
    </section>
  );
}
