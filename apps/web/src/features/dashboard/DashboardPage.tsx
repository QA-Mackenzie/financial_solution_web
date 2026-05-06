import { supportedFinancialModules } from '@shf/domain-core';

import { formatCurrencyInCents } from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useTransactionsSnapshotQuery,
} from '../finance/use-finance';

export function DashboardPage() {
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const transactionsSnapshotQuery = useTransactionsSnapshotQuery();

  return (
    <section className="dashboard-grid">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Shell financeira</div>
        <h2>Saldo atual, contas e lancamentos manuais prontos.</h2>
        <p>
          A Sprint 3 entrega o primeiro fluxo financeiro real da SHF Web com
          contas, lancamentos manuais, saldo consolidado e trilha auditavel.
        </p>
      </article>

      <article className="dashboard-card">
        <h3>Saldo consolidado</h3>
        <strong className="summary-amount">
          {formatCurrencyInCents(
            accountsSnapshotQuery.data?.consolidatedBalanceInCents ?? 0,
          )}
        </strong>
        <p>
          {accountsSnapshotQuery.data?.activeAccounts.length ?? 0} conta(s)
          ativa(s) alimentam o saldo atual do usuario autenticado.
        </p>
      </article>

      <article className="dashboard-card">
        <h3>Movimentacao atual</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Total de entradas</strong>
            <span>
              {formatCurrencyInCents(
                transactionsSnapshotQuery.data?.totalIncomeInCents ?? 0,
              )}
            </span>
          </div>
          <div className="detail-item">
            <strong>Total de saidas</strong>
            <span>
              {formatCurrencyInCents(
                transactionsSnapshotQuery.data?.totalExpenseInCents ?? 0,
              )}
            </span>
          </div>
        </div>
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
          Sprint 4 eleva o horizonte para calculo oficial no backend, usando a
          base de contas e lancamentos entregue nesta sprint.
        </p>
      </article>
    </section>
  );
}
