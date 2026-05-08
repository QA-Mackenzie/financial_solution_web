import { zodResolver } from '@hookform/resolvers/zod';
import type {
  CreateProvisionInput,
  ProjectedProvisionOccurrence,
  ProjectedVariableExpenseOccurrence,
  ProvisionListItem,
  RedeemProvisionInput,
  VariableExpenseOverride,
} from '@economy-cash/contracts';
import {
  createProvisionInputSchema,
  redeemProvisionInputSchema,
  variableExpenseOverrideSchema,
} from '@economy-cash/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CurrencyInput } from '../../components/CurrencyInput';
import {
  formatCategoryLabel,
  formatCurrencyInCents,
  formatDate,
} from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useCreateProvisionMutation,
  useProvisionsSnapshotQuery,
  useRedeemProvisionMutation,
  useUpdateProvisionMutation,
  useUpsertVariableExpenseOverrideMutation,
  useVariableExpenseSnapshotQuery,
} from '../finance/use-finance';

const today = new Date().toISOString().slice(0, 10);

const provisionDefaultValues: CreateProvisionInput = {
  accountId: '',
  category: '',
  description: '',
  startDate: today,
  targetAmountInCents: 0,
  targetDate: today,
};

const redeemDefaultValues: RedeemProvisionInput = {
  provisionId: '',
  redeemedAt: today,
};

const overrideDefaultValues: VariableExpenseOverride = {
  accountId: '',
  amountInCents: 0,
  description: '',
  occurrenceDate: today,
};

function getProvisionOccurrenceLabel(occurrence: ProjectedProvisionOccurrence) {
  return occurrence.kind === 'allocation'
    ? 'Reserva mensal'
    : 'Liberação no resgate';
}

function getProvisionOccurrencePillClass(occurrence: ProjectedProvisionOccurrence) {
  return occurrence.kind === 'allocation'
    ? 'status-pill status-pill-accent'
    : 'status-pill status-pill-success';
}

function getVariableExpenseSourceLabel(
  occurrence: ProjectedVariableExpenseOccurrence,
) {
  return occurrence.source === 'manualOverride'
    ? 'Override manual'
    : 'Média móvel';
}

function getVariableExpenseSourcePillClass(
  occurrence: ProjectedVariableExpenseOccurrence,
) {
  return occurrence.source === 'manualOverride'
    ? 'status-pill status-pill-accent'
    : 'status-pill status-pill-muted';
}

export function ProvisionsPage() {
  const [editingProvision, setEditingProvision] =
    useState<ProvisionListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const provisionsSnapshotQuery = useProvisionsSnapshotQuery();
  const variableExpenseSnapshotQuery = useVariableExpenseSnapshotQuery();
  const createProvisionMutation = useCreateProvisionMutation();
  const updateProvisionMutation = useUpdateProvisionMutation();
  const redeemProvisionMutation = useRedeemProvisionMutation();
  const upsertOverrideMutation = useUpsertVariableExpenseOverrideMutation();
  const {
    control: provisionControl,
    handleSubmit: handleProvisionSubmit,
    register: registerProvision,
    reset: resetProvision,
    setValue: setProvisionValue,
    formState: { errors: provisionErrors },
  } = useForm<CreateProvisionInput>({
    resolver: zodResolver(createProvisionInputSchema),
    defaultValues: provisionDefaultValues,
  });
  const {
    handleSubmit: handleRedeemSubmit,
    register: registerRedeem,
    reset: resetRedeem,
    setValue: setRedeemValue,
    formState: { errors: redeemErrors },
  } = useForm<RedeemProvisionInput>({
    resolver: zodResolver(redeemProvisionInputSchema),
    defaultValues: redeemDefaultValues,
  });
  const {
    control: overrideControl,
    handleSubmit: handleOverrideSubmit,
    register: registerOverride,
    reset: resetOverride,
    setValue: setOverrideValue,
    formState: { errors: overrideErrors },
  } = useForm<VariableExpenseOverride>({
    resolver: zodResolver(variableExpenseOverrideSchema),
    defaultValues: overrideDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const firstAvailableAccountId = availableAccounts[0]?.id ?? '';
  const activeProvisions = provisionsSnapshotQuery.data?.activeProvisions ?? [];
  const redeemedProvisions = provisionsSnapshotQuery.data?.redeemedProvisions ?? [];
  const projectedOccurrences = provisionsSnapshotQuery.data?.projectedOccurrences ?? [];
  const overrides = variableExpenseSnapshotQuery.data?.overrides ?? [];
  const projectedVariableExpenses =
    variableExpenseSnapshotQuery.data?.projectedOccurrences ?? [];
  const firstActiveProvisionId = activeProvisions[0]?.id ?? '';
  const provisionMutationError =
    createProvisionMutation.error ??
    updateProvisionMutation.error ??
    redeemProvisionMutation.error;
  const overrideMutationError = upsertOverrideMutation.error;

  useEffect(() => {
    if (firstAvailableAccountId && !editingProvision) {
      setProvisionValue('accountId', firstAvailableAccountId);
    }

    if (firstAvailableAccountId) {
      setOverrideValue('accountId', firstAvailableAccountId);
    }
  }, [
    editingProvision,
    firstAvailableAccountId,
    setOverrideValue,
    setProvisionValue,
  ]);

  useEffect(() => {
    if (firstActiveProvisionId) {
      setRedeemValue('provisionId', firstActiveProvisionId);
    }
  }, [firstActiveProvisionId, setRedeemValue]);

  const onSubmitProvision = handleProvisionSubmit(async (values) => {
    const savedProvision = editingProvision
      ? await updateProvisionMutation.mutateAsync({
          ...values,
          id: editingProvision.id,
        })
      : await createProvisionMutation.mutateAsync(values);

    setEditingProvision(null);
    resetProvision({
      ...provisionDefaultValues,
      accountId: firstAvailableAccountId,
      startDate: today,
      targetDate: savedProvision.targetDate,
    });
    setRedeemValue('provisionId', savedProvision.id);
  });

  const onSubmitRedeem = handleRedeemSubmit(async (values) => {
    await redeemProvisionMutation.mutateAsync(values);

    resetRedeem({
      ...redeemDefaultValues,
      provisionId: firstActiveProvisionId,
      redeemedAt: today,
    });
  });

  const onSubmitOverride = handleOverrideSubmit(async (values) => {
    await upsertOverrideMutation.mutateAsync(values);

    resetOverride({
      ...overrideDefaultValues,
      accountId: firstAvailableAccountId,
      occurrenceDate: values.occurrenceDate,
    });
  });

  function startEditingProvision(provision: ProvisionListItem) {
    setEditingProvision(provision);
    resetProvision({
      accountId: provision.accountId,
      category: provision.category,
      description: provision.description,
      startDate: provision.startDate,
      targetAmountInCents: provision.targetAmountInCents,
      targetDate: provision.targetDate,
    });
    setRedeemValue('provisionId', provision.id);
  }

  function cancelEditingProvision() {
    setEditingProvision(null);
    resetProvision({
      ...provisionDefaultValues,
      accountId: firstAvailableAccountId,
    });
  }

  function prepareRedeemProvision(provision: ProvisionListItem) {
    setRedeemValue('provisionId', provision.id);
    setRedeemValue('redeemedAt', provision.targetDate);
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Planejamento</div>
        <h2>Provisões e despesas variáveis futuras</h2>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Reserva</div>
              <h3>{editingProvision ? 'Editar provisão' : 'Nova provisão'}</h3>
            </div>
            {editingProvision ? (
              <button
                className="ghost-button"
                onClick={cancelEditingProvision}
                type="button"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de criar provisões.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitProvision}>
              <label>
                <span>Conta de reserva</span>
                <select {...registerProvision('accountId')}>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <small>{provisionErrors.accountId?.message}</small>
              </label>

              <label>
                <span>Descrição</span>
                <input
                  {...registerProvision('description')}
                  placeholder="Ex.: IPVA, seguro anual, viagem"
                />
                <small>{provisionErrors.description?.message}</small>
              </label>

              <label>
                <span>Categoria</span>
                <input {...registerProvision('category')} placeholder="Ex.: Casa" />
                <small>{provisionErrors.category?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Meta em reais</span>
                  <CurrencyInput
                    control={provisionControl}
                    name="targetAmountInCents"
                  />
                  <small>{provisionErrors.targetAmountInCents?.message}</small>
                </label>

                <label>
                  <span>Início da reserva</span>
                  <input {...registerProvision('startDate')} type="date" />
                  <small>{provisionErrors.startDate?.message}</small>
                </label>
              </div>

              <label>
                <span>Data de resgate</span>
                <input {...registerProvision('targetDate')} type="date" />
                <small>{provisionErrors.targetDate?.message}</small>
              </label>

              {provisionMutationError ? (
                <div className="feedback feedback-error">
                  {provisionMutationError.message}
                </div>
              ) : null}

              <button
                disabled={
                  createProvisionMutation.isPending || updateProvisionMutation.isPending
                }
                type="submit"
              >
                {createProvisionMutation.isPending || updateProvisionMutation.isPending
                  ? 'Salvando...'
                  : editingProvision
                    ? 'Atualizar provisão'
                    : 'Criar provisão'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Resgate</div>
              <h3>Fechar provisão ativa</h3>
            </div>
          </div>

          {activeProvisions.length === 0 ? (
            <p>Nenhuma provisão ativa para resgatar.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitRedeem}>
              <label>
                <span>Provisão</span>
                <select {...registerRedeem('provisionId')}>
                  {activeProvisions.map((provision) => (
                    <option key={provision.id} value={provision.id}>
                      {provision.description}
                    </option>
                  ))}
                </select>
                <small>{redeemErrors.provisionId?.message}</small>
              </label>

              <label>
                <span>Data do resgate</span>
                <input {...registerRedeem('redeemedAt')} type="date" />
                <small>{redeemErrors.redeemedAt?.message}</small>
              </label>

              {provisionMutationError ? (
                <div className="feedback feedback-error">
                  {provisionMutationError.message}
                </div>
              ) : null}

              <button disabled={redeemProvisionMutation.isPending} type="submit">
                {redeemProvisionMutation.isPending
                  ? 'Resgatando...'
                  : 'Registrar resgate'}
              </button>
            </form>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Override</div>
              <h3>Despesa variável futura</h3>
            </div>
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de sobrescrever a média móvel.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitOverride}>
              <label>
                <span>Conta</span>
                <select {...registerOverride('accountId')}>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <small>{overrideErrors.accountId?.message}</small>
              </label>

              <label>
                <span>Descrição da série</span>
                <input
                  {...registerOverride('description')}
                  placeholder="Ex.: supermercado, energia, combustivel"
                />
                <small>{overrideErrors.description?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Mês futuro</span>
                  <input {...registerOverride('occurrenceDate')} type="date" />
                  <small>{overrideErrors.occurrenceDate?.message}</small>
                </label>

                <label>
                  <span>Novo valor em reais</span>
                  <CurrencyInput control={overrideControl} name="amountInCents" />
                  <small>{overrideErrors.amountInCents?.message}</small>
                </label>
              </div>

              {overrideMutationError ? (
                <div className="feedback feedback-error">
                  {overrideMutationError.message}
                </div>
              ) : null}

              <button disabled={upsertOverrideMutation.isPending} type="submit">
                {upsertOverrideMutation.isPending
                  ? 'Salvando...'
                  : 'Salvar override'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card summary-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Radar</div>
              <h3>Impacto consolidado da sprint</h3>
            </div>
          </div>

          <div className="stats-grid stats-grid-inline">
            <div className="stat-item">
              <span>Total reservado</span>
              <strong>
                {formatCurrencyInCents(
                  provisionsSnapshotQuery.data?.totalActiveTargetAmountInCents ?? 0,
                )}
              </strong>
            </div>
            <div className="stat-item">
              <span>Overrides salvos</span>
              <strong>{overrides.length}</strong>
            </div>
            <div className="stat-item">
              <span>Séries variáveis projetadas</span>
              <strong>{projectedVariableExpenses.length}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Carteira</div>
              <h3>Provisões cadastradas</h3>
            </div>
          </div>

          {activeProvisions.length === 0 && redeemedProvisions.length === 0 ? (
            <p>Nenhuma provisão registrada ainda.</p>
          ) : (
            <div className="stack-list">
              {activeProvisions.map((provision) => (
                <article className="entity-card" key={provision.id}>
                  <div className="section-heading-row compact-row">
                    <div>
                      <strong>{provision.description}</strong>
                      <div className="helper-text">
                        {provision.accountName} • resgate em {formatDate(provision.targetDate)}
                      </div>
                    </div>
                    <span className="status-pill status-pill-accent">Ativa</span>
                  </div>

                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Meta</span>
                      <strong>
                        {formatCurrencyInCents(provision.targetAmountInCents)}
                      </strong>
                    </div>
                    <div className="stat-item">
                      <span>Início</span>
                      <strong>{formatDate(provision.startDate)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Categoria</span>
                      <strong>{formatCategoryLabel(provision.category)}</strong>
                    </div>
                  </div>

                  <div className="entity-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditingProvision(provision)}
                      type="button"
                    >
                      Editar provisão
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => prepareRedeemProvision(provision)}
                      type="button"
                    >
                      Preparar resgate
                    </button>
                  </div>
                </article>
              ))}

              {redeemedProvisions.length > 0 ? (
                <div className="stack-list">
                  <div className="eyebrow">Histórico resgatado</div>
                  {redeemedProvisions.map((provision) => (
                    <article className="entity-card" key={provision.id}>
                      <div className="section-heading-row compact-row">
                        <div>
                          <strong>{provision.description}</strong>
                          <div className="helper-text">
                            {provision.accountName} • resgatada em{' '}
                            {provision.redeemedAt
                              ? formatDate(provision.redeemedAt)
                              : '--'}
                          </div>
                        </div>
                        <span className="status-pill status-pill-success">
                          Resgatada
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </article>

        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Timeline</div>
              <h3>Distribuição mensal planejada</h3>
            </div>
          </div>

          {projectedOccurrences.length === 0 ? (
            <p>Não há ocorrências futuras de provisão no horizonte atual.</p>
          ) : (
            <div className="sub-entity-list">
              {projectedOccurrences.map((occurrence) => (
                <div className="sub-entity-item" key={occurrence.id}>
                  <div>
                    <strong>{occurrence.description}</strong>
                    <div className="helper-text">
                      {getProvisionOccurrenceLabel(occurrence)} •{' '}
                      {formatDate(occurrence.occurrenceDate)}
                    </div>
                  </div>
                  <div className="entity-actions compact-row">
                    <span className={getProvisionOccurrencePillClass(occurrence)}>
                      {occurrence.kind === 'allocation' ? 'Reserva' : 'Liberação'}
                    </span>
                    <strong>{formatCurrencyInCents(occurrence.amountInCents)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Média móvel</div>
              <h3>Despesas variáveis projetadas</h3>
            </div>
          </div>

          {projectedVariableExpenses.length === 0 ? (
            <p>
              Ainda não existe histórico suficiente para projetar séries variáveis.
            </p>
          ) : (
            <div className="sub-entity-list">
              {projectedVariableExpenses.map((occurrence) => (
                <div className="sub-entity-item" key={occurrence.id}>
                  <div>
                    <strong>{occurrence.description}</strong>
                    <div className="helper-text">
                      {occurrence.accountName} • {formatDate(occurrence.occurrenceDate)}
                    </div>
                  </div>
                  <div className="entity-actions compact-row">
                    <span className={getVariableExpenseSourcePillClass(occurrence)}>
                      {getVariableExpenseSourceLabel(occurrence)}
                    </span>
                    <strong>{formatCurrencyInCents(occurrence.amountInCents)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
