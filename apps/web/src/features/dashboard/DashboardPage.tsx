import { zodResolver } from '@hookform/resolvers/zod';
import { supportedFinancialModules } from '@shf/domain-core';
import {
  updateHorizonSettingsInputSchema,
  type FinancialHorizonMonth,
  type UpdateHorizonSettingsInput,
} from '@shf/contracts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import {
  formatCurrencyInCents,
  formatDate,
  formatDateTime,
  formatMonthYear,
} from '../../lib/finance-format';
import {
  useContractsSnapshotQuery,
  useHorizonSnapshotQuery,
  useProvisionsSnapshotQuery,
  useUpdateHorizonSettingsMutation,
  useVariableExpenseSnapshotQuery,
} from '../finance/use-finance';

const defaultSettings: UpdateHorizonSettingsInput = {
  safetyMarginInCents: 50000,
  variableExpenseWindowInMonths: 3,
};

const riskLabelByLevel = {
  attention: 'Atencao',
  critical: 'Critico',
  healthy: 'Saudavel',
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

function getNextManualOverride(
  occurrences: Array<{ amountInCents: number; occurrenceDate: string; source: 'manualOverride' | 'movingAverage' }>,
) {
  return (
    occurrences.find((occurrence) => occurrence.source === 'manualOverride') ?? null
  );
}

export function DashboardPage() {
  const horizonSnapshotQuery = useHorizonSnapshotQuery();
  const contractsSnapshotQuery = useContractsSnapshotQuery();
  const provisionsSnapshotQuery = useProvisionsSnapshotQuery();
  const updateHorizonSettingsMutation = useUpdateHorizonSettingsMutation();
  const variableExpenseSnapshotQuery = useVariableExpenseSnapshotQuery();
  const {
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<UpdateHorizonSettingsInput>({
    resolver: zodResolver(updateHorizonSettingsInputSchema),
    defaultValues: defaultSettings,
  });

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
  const nextManualOverride = getNextManualOverride(
    variableExpenseSnapshotQuery.data?.projectedOccurrences ?? [],
  );
  const variableExpenseSummaryByMonth = buildVariableExpenseSummaryByMonth(
    variableExpenseSnapshotQuery.data?.projectedOccurrences ?? [],
  );

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [reset, settings]);

  const onSubmit = handleSubmit(async (values) => {
    await updateHorizonSettingsMutation.mutateAsync(values);
  });

  return (
    <section className="dashboard-grid dashboard-grid-horizon">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Horizonte oficial</div>
        <h2>Horizonte oficial de 24 meses no backend.</h2>
        <p>
          O horizonte oficial agora combina saldo atual, historico recente e
          contratos recorrentes com faturas de cartao, parcelamentos,
          provisoes e despesas variaveis calculadas no backend com suporte a
          override manual por mes futuro.
        </p>
        <small className="helper-text">
          Ultima geracao:{' '}
          {horizonSnapshotQuery.data
            ? formatDateTime(horizonSnapshotQuery.data.generatedAt)
            : 'aguardando carga'}
        </small>
      </article>

      <article className="dashboard-card">
        <h3>Fechamento do mes atual</h3>
        <strong className="summary-amount">
          {formatCurrencyInCents(currentMonth?.closingBalanceInCents ?? 0)}
        </strong>
        <p>
          {currentMonth
            ? `Mes de referencia: ${formatMonthYear(currentMonth.monthStart)}.`
            : 'O backend ainda nao retornou o horizonte oficial.'}
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
        <h3>Recorrencias ativas</h3>
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
        <h3>Blindagem por provisao</h3>
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
            <strong>Reserva disponivel hoje</strong>
            <span>{formatCurrencyInCents(totalReservedInCurrentMonth)}</span>
          </div>
          <div className="detail-item">
            <strong>Proxima liberacao</strong>
            <span>
              {nextProvisionRelease
                ? `${formatMonthYear(nextProvisionRelease.occurrenceDate)} • ${formatCurrencyInCents(nextProvisionRelease.amountInCents)}`
                : 'Nenhuma liberacao futura'}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card">
        <h3>Despesas variaveis futuras</h3>
        <div className="detail-list">
          <div className="detail-item">
            <strong>Series projetadas</strong>
            <span>
              {variableExpenseSnapshotQuery.data?.projectedOccurrences.length ?? 0}
            </span>
          </div>
          <div className="detail-item">
            <strong>Overrides manuais</strong>
            <span>{variableExpenseSnapshotQuery.data?.overrides.length ?? 0}</span>
          </div>
          <div className="detail-item">
            <strong>Proximo ajuste manual</strong>
            <span>
              {nextManualOverride
                ? `${formatDate(nextManualOverride.occurrenceDate)} • ${formatCurrencyInCents(nextManualOverride.amountInCents)}`
                : 'Sem override futuro'}
            </span>
          </div>
        </div>
      </article>

      <article className="dashboard-card form-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Configuracoes</div>
            <h3>Ajustes do horizonte</h3>
          </div>
        </div>

        <form className="finance-form" onSubmit={onSubmit}>
          <div className="settings-grid">
            <label>
              <span>Margem de seguranca em centavos</span>
              <input
                {...register('safetyMarginInCents', { valueAsNumber: true })}
                placeholder="50000"
                type="number"
              />
              <small>{errors.safetyMarginInCents?.message}</small>
            </label>

            <label>
              <span>Janela da media movel</span>
              <select
                {...register('variableExpenseWindowInMonths', {
                  valueAsNumber: true,
                })}
              >
                <option value={3}>3 meses</option>
                <option value={4}>4 meses</option>
                <option value={5}>5 meses</option>
                <option value={6}>6 meses</option>
              </select>
              <small>{errors.variableExpenseWindowInMonths?.message}</small>
            </label>
          </div>

          {horizonSnapshotQuery.error ? (
            <div className="feedback feedback-error">
              {horizonSnapshotQuery.error.message}
            </div>
          ) : null}

          {updateHorizonSettingsMutation.error ? (
            <div className="feedback feedback-error">
              {updateHorizonSettingsMutation.error.message}
            </div>
          ) : null}

          <button disabled={updateHorizonSettingsMutation.isPending} type="submit">
            {updateHorizonSettingsMutation.isPending
              ? 'Atualizando...'
              : 'Salvar configuracoes'}
          </button>
        </form>
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
          Contratos, cartoes, parcelamentos, provisoes e overrides manuais ja
          alimentam o horizonte oficial. O proximo passo natural e aprofundar a
          leitura analitica e a automacao operacional sobre essa base.
        </p>
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
              : `${months.length} mes(es) calculado(s)`}
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
                    <strong>Saidas</strong>
                    <span>{formatCurrencyInCents(month.expenseInCents)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Fechamento</strong>
                    <span>{formatCurrencyInCents(month.closingBalanceInCents)}</span>
                  </div>
                  {month.provisionAllocationInCents ? (
                    <div className="detail-item">
                      <strong>Reserva do mes</strong>
                      <span>
                        {formatCurrencyInCents(month.provisionAllocationInCents)}
                      </span>
                    </div>
                  ) : null}
                  {month.provisionReleaseInCents ? (
                    <div className="detail-item">
                      <strong>Liberacao</strong>
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
                      <strong>Despesa variavel</strong>
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
