import {
  type FinancialHorizonMonth,
} from '@economy-cash/contracts';

import {
  formatCurrencyInCents,
  formatDateTime,
  formatMonthYear,
} from '../../lib/finance-format';
import {
  useContractsSnapshotQuery,
  useHorizonSnapshotQuery,
  useProvisionsSnapshotQuery,
  useVariableExpenseSnapshotQuery,
} from '../finance/use-finance';

const riskLabelByLevel = {
  attention: 'Atenção',
  critical: 'Crítico',
  healthy: 'Saudável',
} as const;

function getPrimaryRiskMonth(months: FinancialHorizonMonth[]) {
  return (
    months.find((month) => month.riskLevel === 'critical') ??
    months.find((month) => month.riskLevel === 'attention') ??
    null
  );
}

function buildVariableExpenseSummaryByMonth(
  months: Array<{
    amountInCents: number;
    occurrenceDate: string;
    source: 'manualOverride' | 'movingAverage';
  }>,
) {
  return months.reduce<
    Record<
      string,
      {
        manualOverrideCount: number;
        movingAverageCount: number;
        totalAmountInCents: number;
      }
    >
  >((result, occurrence) => {
    const monthStart = `${occurrence.occurrenceDate.slice(0, 7)}-01`;
    const currentMonth = result[monthStart] ?? {
      manualOverrideCount: 0,
      movingAverageCount: 0,
      totalAmountInCents: 0,
    };

    currentMonth.totalAmountInCents += occurrence.amountInCents;

    if (occurrence.source === 'manualOverride') {
      currentMonth.manualOverrideCount += 1;
    } else {
      currentMonth.movingAverageCount += 1;
    }

    result[monthStart] = currentMonth;

    return result;
  }, {});
}

function getNextProvisionRelease(
  occurrences: Array<{ amountInCents: number; kind: 'allocation' | 'release'; occurrenceDate: string }>,
) {
  return occurrences.find((occurrence) => occurrence.kind === 'release') ?? null;
}

export function DashboardPage() {
  const horizonSnapshotQuery = useHorizonSnapshotQuery();
  const contractsSnapshotQuery = useContractsSnapshotQuery();
  const provisionsSnapshotQuery = useProvisionsSnapshotQuery();
  const variableExpenseSnapshotQuery = useVariableExpenseSnapshotQuery();

  const settings = horizonSnapshotQuery.data?.settings;
  const months = horizonSnapshotQuery.data?.horizon.months ?? [];
  const currentMonth = months[0] ?? null;
  const primaryRiskMonth = getPrimaryRiskMonth(months);
  const recurringSummary = contractsSnapshotQuery.data;
  const totalReservedInCurrentMonth =
    currentMonth?.provisionReservedBalanceInCents ?? 0;
  const nextProvisionRelease = getNextProvisionRelease(
    provisionsSnapshotQuery.data?.projectedOccurrences ?? [],
  );
  const variableExpenseSummaryByMonth = buildVariableExpenseSummaryByMonth(
    variableExpenseSnapshotQuery.data?.projectedOccurrences ?? [],
  );

  return (
    <section className="dashboard-grid dashboard-grid-horizon">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Horizonte oficial</div>
        <h2>Horizonte oficial de 24 meses no backend.</h2>
        <small className="helper-text">
          Última geração:{' '}
          {horizonSnapshotQuery.data
            ? formatDateTime(horizonSnapshotQuery.data.generatedAt)
            : 'aguardando carga'}
        </small>
      </article>

      <article className="dashboard-card">
        <h3>Fechamento do mês atual</h3>
        <strong className="summary-amount">
          {formatCurrencyInCents(currentMonth?.closingBalanceInCents ?? 0)}
        </strong>
        <p>
          {currentMonth
            ? `Mês de referência: ${formatMonthYear(currentMonth.monthStart)}.`
            : 'O backend ainda não retornou o horizonte oficial.'}
        </p>
        {currentMonth?.cashClosingBalanceInCents !== undefined ? (
          <div className="detail-list">
            <div className="detail-item">
              <strong>Fechamento de caixa</strong>
              <span>
                {formatCurrencyInCents(currentMonth.cashClosingBalanceInCents)}
              </span>
            </div>
            <div className="detail-item">
              <strong>Reserva blindada</strong>
              <span>{formatCurrencyInCents(totalReservedInCurrentMonth)}</span>
            </div>
          </div>
        ) : null}
      </article>

      <article className="dashboard-card">
        <h3>Principal risco do horizonte</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Primeiro alerta relevante</strong>
            <span>
              {primaryRiskMonth
                ? `${formatMonthYear(primaryRiskMonth.monthStart)} • ${riskLabelByLevel[primaryRiskMonth.riskLevel]}`
                : 'Nenhum alerta nos 24 meses'}
            </span>
          </div>
          <div className="detail-item">
            <strong>Margem configurada</strong>
            <span>
              {formatCurrencyInCents(settings?.safetyMarginInCents ?? 0)}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card">
        <h3>Recorrências ativas</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Contratos ativos</strong>
            <span>{recurringSummary?.activeContracts.length ?? 0}</span>
          </div>
          <div className="detail-item">
            <strong>Receitas recorrentes</strong>
            <span>
              {formatCurrencyInCents(
                recurringSummary?.totalActiveIncomeInCents ?? 0,
              )}
            </span>
          </div>
          <div className="detail-item">
            <strong>Despesas recorrentes</strong>
            <span>
              {formatCurrencyInCents(
                -1 * (recurringSummary?.totalActiveExpenseInCents ?? 0),
              )}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card">
        <h3>Blindagem por provisão</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Meta total ativa</strong>
            <span>
              {formatCurrencyInCents(
                provisionsSnapshotQuery.data?.totalActiveTargetAmountInCents ?? 0,
              )}
            </span>
          </div>
          <div className="detail-item">
            <strong>Reserva disponível hoje</strong>
            <span>{formatCurrencyInCents(totalReservedInCurrentMonth)}</span>
          </div>
          <div className="detail-item">
            <strong>Próxima liberação</strong>
            <span>
              {nextProvisionRelease
                ? `${formatMonthYear(nextProvisionRelease.occurrenceDate)} • ${formatCurrencyInCents(nextProvisionRelease.amountInCents)}`
                : 'Nenhuma liberação futura'}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card hero-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">24 meses</div>
            <h3>Breakdown mensal do horizonte</h3>
          </div>
          <span className="helper-text">
            {horizonSnapshotQuery.isLoading
              ? 'Carregando...'
              : `${months.length} mês(es) calculado(s)`}
          </span>
        </div>

        {horizonSnapshotQuery.isLoading ? (
          <p>Carregando horizonte oficial...</p>
        ) : (
          <div className="horizon-list">
            {months.map((month) => (
              <div
                className={`horizon-list-card horizon-list-card-${month.riskLevel}`}
                key={month.id}
              >
                <div className="horizon-list-header">
                  <div>
                    <strong>{formatMonthYear(month.monthStart)}</strong>
                    <div className="helper-text">{month.monthStart}</div>
                  </div>
                  <span className={`risk-pill risk-pill-${month.riskLevel}`}>
                    {riskLabelByLevel[month.riskLevel]}
                  </span>
                </div>

                <div className="horizon-metrics">
                  {month.cashOpeningBalanceInCents !== undefined ? (
                    <div className="detail-item">
                      <strong>Caixa bruto</strong>
                      <span>
                        {formatCurrencyInCents(month.cashOpeningBalanceInCents)}
                      </span>
                    </div>
                  ) : null}
                  <div className="detail-item">
                    <strong>Abertura</strong>
                    <span>{formatCurrencyInCents(month.openingBalanceInCents)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Entradas</strong>
                    <span>{formatCurrencyInCents(month.incomeInCents)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Saídas</strong>
                    <span>{formatCurrencyInCents(month.expenseInCents)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Fechamento</strong>
                    <span>{formatCurrencyInCents(month.closingBalanceInCents)}</span>
                  </div>
                  {month.provisionAllocationInCents ? (
                    <div className="detail-item">
                      <strong>Reserva do mês</strong>
                      <span>
                        {formatCurrencyInCents(month.provisionAllocationInCents)}
                      </span>
                    </div>
                  ) : null}
                  {month.provisionReleaseInCents ? (
                    <div className="detail-item">
                      <strong>Liberação</strong>
                      <span>
                        {formatCurrencyInCents(month.provisionReleaseInCents)}
                      </span>
                    </div>
                  ) : null}
                  {month.provisionReservedBalanceInCents ? (
                    <div className="detail-item">
                      <strong>Blindagem acumulada</strong>
                      <span>
                        {formatCurrencyInCents(
                          month.provisionReservedBalanceInCents,
                        )}
                      </span>
                    </div>
                  ) : null}
                  {(variableExpenseSummaryByMonth[month.monthStart]?.totalAmountInCents ?? 0) >
                  0 ? (
                    <div className="detail-item">
                      <strong>Despesa variável</strong>
                      <span>
                        {formatCurrencyInCents(
                          variableExpenseSummaryByMonth[month.monthStart]
                            .totalAmountInCents,
                        )}
                      </span>
                    </div>
                  ) : null}
                  {(variableExpenseSummaryByMonth[month.monthStart]?.manualOverrideCount ??
                    0) > 0 ? (
                    <div className="detail-item">
                      <strong>Overrides manuais</strong>
                      <span>
                        {
                          variableExpenseSummaryByMonth[month.monthStart]
                            .manualOverrideCount
                        }
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
