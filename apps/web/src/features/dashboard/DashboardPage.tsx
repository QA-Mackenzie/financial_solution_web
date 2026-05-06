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
  formatDateTime,
  formatMonthYear,
} from '../../lib/finance-format';
import {
  useHorizonSnapshotQuery,
  useUpdateHorizonSettingsMutation,
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

export function DashboardPage() {
  const horizonSnapshotQuery = useHorizonSnapshotQuery();
  const updateHorizonSettingsMutation = useUpdateHorizonSettingsMutation();
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
          A Sprint 4 transforma o horizonte em um servico oficial do backend,
          com classificacao de risco mensal, cache por usuario e dashboard
          consumindo o payload auditavel da API.
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
          Sprint 5 adiciona contratos recorrentes e reajustes para alimentar o
          horizonte automaticamente com receitas e despesas fixas.
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
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
