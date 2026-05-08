import { zodResolver } from '@hookform/resolvers/zod';
import type {
  AnticipateInstallmentPlanInput,
  CreateInstallmentPlanInput,
  InstallmentOccurrenceListItem,
  InstallmentOperation,
  InstallmentPlanListItem,
  ProjectedInstallmentCreditCardPurchase,
} from '@economy-cash/contracts';
import {
  anticipateInstallmentPlanInputSchema,
  createInstallmentPlanInputSchema,
} from '@economy-cash/contracts';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CurrencyInput } from '../../components/CurrencyInput';
import { formatCurrencyInCents, formatDate } from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useAnticipateInstallmentPlanMutation,
  useCreateInstallmentPlanMutation,
  useCreditCardsSnapshotQuery,
  useInstallmentsSnapshotQuery,
  useUpdateInstallmentPlanMutation,
} from '../finance/use-finance';

const today = new Date().toISOString().slice(0, 10);
const emptyPlans: InstallmentPlanListItem[] = [];
const emptyOccurrences: InstallmentOccurrenceListItem[] = [];
const emptyOperations: InstallmentOperation[] = [];
const emptyProjectedCreditCardPurchases: ProjectedInstallmentCreditCardPurchase[] = [];

const planDefaultValues: CreateInstallmentPlanInput = {
  sourceType: 'account',
  accountId: undefined,
  creditCardId: undefined,
  description: '',
  totalAmountInCents: 0,
  installmentCount: 2,
  firstOccurrenceDate: today,
};

const anticipationDefaultValues: AnticipateInstallmentPlanInput = {
  planId: '',
  operationDate: today,
  affectedInstallmentCount: 1,
};

function describePlanSource(plan: InstallmentPlanListItem) {
  if (plan.sourceType === 'account') {
    return `Debita direto em ${plan.accountName ?? 'conta removida'}`;
  }

  return `Projeta compras em ${plan.creditCardName ?? 'cartão removido'} • paga por ${plan.paymentAccountName ?? 'conta removida'}`;
}

function getOccurrenceBadge(occurrence: InstallmentOccurrenceListItem) {
  return occurrence.anticipatedOperationId
    ? `Antecipada para ${formatDate(occurrence.occurrenceDate)}`
    : `Mantida em ${formatDate(occurrence.occurrenceDate)}`;
}

export function InstallmentsPage() {
  const [editingPlan, setEditingPlan] = useState<InstallmentPlanListItem | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const creditCardsSnapshotQuery = useCreditCardsSnapshotQuery();
  const installmentsSnapshotQuery = useInstallmentsSnapshotQuery();
  const createInstallmentPlanMutation = useCreateInstallmentPlanMutation();
  const updateInstallmentPlanMutation = useUpdateInstallmentPlanMutation();
  const anticipateInstallmentPlanMutation = useAnticipateInstallmentPlanMutation();
  const {
    control: planControl,
    handleSubmit: handlePlanSubmit,
    register: registerPlan,
    reset: resetPlan,
    setValue: setPlanValue,
    watch: watchPlan,
    formState: { errors: planErrors },
  } = useForm<CreateInstallmentPlanInput>({
    resolver: zodResolver(createInstallmentPlanInputSchema),
    defaultValues: planDefaultValues,
  });
  const {
    handleSubmit: handleAnticipationSubmit,
    register: registerAnticipation,
    reset: resetAnticipation,
    setValue: setAnticipationValue,
    formState: { errors: anticipationErrors },
  } = useForm<AnticipateInstallmentPlanInput>({
    resolver: zodResolver(anticipateInstallmentPlanInputSchema),
    defaultValues: anticipationDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const availableCards = creditCardsSnapshotQuery.data?.cards ?? [];
  const plans = installmentsSnapshotQuery.data?.plans ?? emptyPlans;
  const operations = installmentsSnapshotQuery.data?.operations ?? emptyOperations;
  const occurrences = installmentsSnapshotQuery.data?.occurrences ?? emptyOccurrences;
  const projectedAccountOccurrences =
    installmentsSnapshotQuery.data?.projectedAccountOccurrences ?? [];
  const projectedCreditCardPurchases =
    installmentsSnapshotQuery.data?.projectedCreditCardPurchases ??
    emptyProjectedCreditCardPurchases;
  const firstAvailableAccountId = availableAccounts[0]?.id;
  const firstAvailableCardId = availableCards[0]?.id;
  const firstPlanId = plans[0]?.id ?? '';
  const selectedSourceType = watchPlan('sourceType');
  const currentMutationError =
    createInstallmentPlanMutation.error ??
    updateInstallmentPlanMutation.error ??
    anticipateInstallmentPlanMutation.error;

  useEffect(() => {
    if (!selectedPlanId && firstPlanId) {
      setSelectedPlanId(firstPlanId);
      setAnticipationValue('planId', firstPlanId);
    }
  }, [firstPlanId, selectedPlanId, setAnticipationValue]);

  useEffect(() => {
    if (selectedPlanId && !plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(firstPlanId);
      setAnticipationValue('planId', firstPlanId);
    }
  }, [firstPlanId, plans, selectedPlanId, setAnticipationValue]);

  useEffect(() => {
    if (selectedSourceType === 'account') {
      setPlanValue('creditCardId', undefined);

      if (!editingPlan && firstAvailableAccountId) {
        setPlanValue('accountId', firstAvailableAccountId);
      }

      return;
    }

    setPlanValue('accountId', undefined);

    if (!editingPlan && firstAvailableCardId) {
      setPlanValue('creditCardId', firstAvailableCardId);
    }
  }, [
    editingPlan,
    firstAvailableAccountId,
    firstAvailableCardId,
    selectedSourceType,
    setPlanValue,
  ]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );
  const selectedPlanOccurrences = useMemo(
    () => occurrences.filter((occurrence) => occurrence.planId === selectedPlanId),
    [occurrences, selectedPlanId],
  );
  const selectedPlanOperations = useMemo(
    () => operations.filter((operation) => operation.planId === selectedPlanId),
    [operations, selectedPlanId],
  );
  const selectedPlanProjectedCardPurchases = useMemo(
    () =>
      projectedCreditCardPurchases.filter((purchase) => purchase.planId === selectedPlanId),
    [projectedCreditCardPurchases, selectedPlanId],
  );

  const onSubmitPlan = handlePlanSubmit(async (values) => {
    const savedPlan = editingPlan
      ? await updateInstallmentPlanMutation.mutateAsync({
          ...values,
          id: editingPlan.id,
        })
      : await createInstallmentPlanMutation.mutateAsync(values);

    setEditingPlan(null);
    setSelectedPlanId(savedPlan.id);
    setAnticipationValue('planId', savedPlan.id);
    resetPlan({
      ...planDefaultValues,
      accountId: firstAvailableAccountId,
      creditCardId: undefined,
    });
  });

  const onSubmitAnticipation = handleAnticipationSubmit(async (values) => {
    await anticipateInstallmentPlanMutation.mutateAsync(values);

    setSelectedPlanId(values.planId);
    resetAnticipation({
      ...anticipationDefaultValues,
      planId: values.planId,
      operationDate: today,
    });
  });

  function startEditing(plan: InstallmentPlanListItem) {
    setEditingPlan(plan);
    setSelectedPlanId(plan.id);
    setAnticipationValue('planId', plan.id);
    resetPlan({
      sourceType: plan.sourceType,
      accountId: plan.accountId ?? undefined,
      creditCardId: plan.creditCardId ?? undefined,
      description: plan.description,
      totalAmountInCents: plan.totalAmountInCents,
      installmentCount: plan.installmentCount,
      firstOccurrenceDate: plan.firstOccurrenceDate,
    });
  }

  function cancelEditing() {
    setEditingPlan(null);
    resetPlan({
      ...planDefaultValues,
      accountId: firstAvailableAccountId,
      creditCardId: undefined,
    });
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Parcelamentos</div>
        <h2>Parcelamentos, cronograma e antecipações</h2>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Plano</div>
              <h3>{editingPlan ? 'Editar parcelamento' : 'Novo parcelamento'}</h3>
            </div>
            {editingPlan ? (
              <button className="ghost-button" onClick={cancelEditing} type="button">
                Cancelar edição
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 && availableCards.length === 0 ? (
            <p>Cadastre uma conta ou um cartão antes de registrar parcelamentos.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitPlan}>
              <label>
                <span>Origem do parcelamento</span>
                <select
                  {...registerPlan('sourceType', {
                    onChange: (event) => {
                      const nextSourceType = event.target.value;

                      if (nextSourceType === 'account') {
                        setPlanValue('accountId', firstAvailableAccountId);
                        setPlanValue('creditCardId', undefined);
                        return;
                      }

                      setPlanValue('accountId', undefined);
                      setPlanValue('creditCardId', firstAvailableCardId);
                    },
                  })}
                >
                  <option value="account">Conta</option>
                  <option value="creditCard">Cartão de crédito</option>
                </select>
                <small>{planErrors.sourceType?.message}</small>
              </label>

              {selectedSourceType === 'account' ? (
                <label>
                  <span>Conta de lançamento</span>
                  <select {...registerPlan('accountId')}>
                    {availableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                  <small>{planErrors.accountId?.message}</small>
                </label>
              ) : (
                <label>
                  <span>Cartão vinculado</span>
                  <select {...registerPlan('creditCardId')}>
                    {availableCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                  <small>{planErrors.creditCardId?.message}</small>
                </label>
              )}

              <label>
                <span>Descrição do parcelamento</span>
                <input
                  {...registerPlan('description')}
                  placeholder="Ex.: notebook parcelado"
                />
                <small>{planErrors.description?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Valor total em reais</span>
                  <CurrencyInput control={planControl} name="totalAmountInCents" />
                  <small>{planErrors.totalAmountInCents?.message}</small>
                </label>

                <label>
                  <span>Quantidade de parcelas</span>
                  <input
                    {...registerPlan('installmentCount', { valueAsNumber: true })}
                    max={60}
                    min={2}
                    type="number"
                  />
                  <small>{planErrors.installmentCount?.message}</small>
                </label>
              </div>

              <label>
                <span>Primeira ocorrência</span>
                <input {...registerPlan('firstOccurrenceDate')} type="date" />
                <small>{planErrors.firstOccurrenceDate?.message}</small>
              </label>

              {currentMutationError ? (
                <div className="feedback feedback-error">{currentMutationError.message}</div>
              ) : null}

              <button
                disabled={
                  createInstallmentPlanMutation.isPending ||
                  updateInstallmentPlanMutation.isPending
                }
                type="submit"
              >
                {createInstallmentPlanMutation.isPending ||
                updateInstallmentPlanMutation.isPending
                  ? 'Salvando...'
                  : editingPlan
                    ? 'Atualizar parcelamento'
                    : 'Criar parcelamento'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card form-card">
          <div className="eyebrow">Antecipação</div>
          <h3>Antecipar parcelas futuras</h3>

          {plans.length === 0 ? (
            <p>Crie um parcelamento antes de antecipar parcelas restantes.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitAnticipation}>
              <label>
                <span>Parcelamento</span>
                <select
                  {...registerAnticipation('planId')}
                  onChange={(event) => {
                    setSelectedPlanId(event.target.value);
                    setAnticipationValue('planId', event.target.value);
                  }}
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.description}
                    </option>
                  ))}
                </select>
                <small>{anticipationErrors.planId?.message}</small>
              </label>

              <label>
                <span>Data da antecipação</span>
                <input {...registerAnticipation('operationDate')} type="date" />
                <small>{anticipationErrors.operationDate?.message}</small>
              </label>

              <label>
                <span>Quantidade de parcelas afetadas</span>
                <input
                  {...registerAnticipation('affectedInstallmentCount', {
                    valueAsNumber: true,
                  })}
                  max={60}
                  min={1}
                  type="number"
                />
                <small>{anticipationErrors.affectedInstallmentCount?.message}</small>
              </label>

              <button disabled={anticipateInstallmentPlanMutation.isPending} type="submit">
                {anticipateInstallmentPlanMutation.isPending
                  ? 'Antecipando...'
                  : 'Antecipar parcelas'}
              </button>
            </form>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card summary-card">
          <div className="eyebrow">Resumo dos parcelamentos</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              -1 * (installmentsSnapshotQuery.data?.totalRemainingAmountInCents ?? 0),
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Planos ativos</span>
              <strong>{plans.length}</strong>
            </div>
            <div className="stat-item">
              <span>Operações de antecipação</span>
              <strong>{operations.length}</strong>
            </div>
            <div className="stat-item">
              <span>Parcelas em conta</span>
              <strong>{projectedAccountOccurrences.length}</strong>
            </div>
            <div className="stat-item">
              <span>Compras projetadas no cartão</span>
              <strong>{projectedCreditCardPurchases.length}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Carteira de planos</div>
              <h3>Parcelamentos cadastrados</h3>
            </div>
          </div>

          {plans.length === 0 ? (
            <p>Nenhum parcelamento cadastrado ainda.</p>
          ) : (
            <div className="sub-entity-list">
              {plans.map((plan) => (
                <div className="sub-entity-item" key={plan.id}>
                  <div>
                    <strong>{plan.description}</strong>
                    <span>{describePlanSource(plan)}</span>
                    <span>
                      {plan.installmentCount} parcelas • primeira em{' '}
                      {formatDate(plan.firstOccurrenceDate)}
                    </span>
                  </div>
                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Total</span>
                      <strong>{formatCurrencyInCents(-1 * plan.totalAmountInCents)}</strong>
                    </div>
                  </div>
                  <div className="section-heading-row compact-row">
                    <button
                      className="ghost-button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setAnticipationValue('planId', plan.id);
                      }}
                      type="button"
                    >
                      Ver cronograma
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => startEditing(plan)}
                      type="button"
                    >
                      Editar parcelamento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Cronograma</div>
              <h3>Cronograma do parcelamento</h3>
            </div>
          </div>

          {!selectedPlan ? (
            <p>Selecione um parcelamento para ver as parcelas e as datas recalculadas.</p>
          ) : (
            <>
              <p>{describePlanSource(selectedPlan)}</p>

              <div className="sub-entity-list">
                {selectedPlanOccurrences.map((occurrence) => (
                  <div className="sub-entity-item" key={occurrence.id}>
                    <div>
                      <strong>
                        Parcela {occurrence.installmentNumber}/{occurrence.totalInstallments}
                      </strong>
                      <span>{getOccurrenceBadge(occurrence)}</span>
                      <span>
                        Original em {formatDate(occurrence.originalOccurrenceDate)}
                      </span>
                    </div>
                    <strong>{formatCurrencyInCents(-1 * occurrence.amountInCents)}</strong>
                  </div>
                ))}
              </div>

              {selectedPlanProjectedCardPurchases.length > 0 ? (
                <>
                  <div className="eyebrow">Impacto no cartão</div>
                  <div className="sub-entity-list">
                    {selectedPlanProjectedCardPurchases.map((purchase) => (
                      <div className="sub-entity-item" key={purchase.id}>
                        <div>
                          <strong>
                            Compra projetada {purchase.installmentNumber}/
                            {purchase.totalInstallments}
                          </strong>
                          <span>
                            {purchase.creditCardName} • {formatDate(purchase.purchaseDate)}
                          </span>
                          <span>{purchase.paymentAccountName}</span>
                        </div>
                        <strong>{formatCurrencyInCents(-1 * purchase.amountInCents)}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </article>

        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Histórico</div>
              <h3>Antecipações registradas</h3>
            </div>
          </div>

          {selectedPlanOperations.length === 0 ? (
            <p>Nenhuma antecipação aplicada ao parcelamento selecionado.</p>
          ) : (
            <div className="sub-entity-list">
              {selectedPlanOperations.map((operation) => (
                <div className="sub-entity-item" key={operation.id}>
                  <div>
                    <strong>{formatDate(operation.operationDate)}</strong>
                    <span>{operation.affectedInstallmentCount} parcelas afetadas</span>
                    <span>Criada em {formatDate(operation.createdAt.slice(0, 10))}</span>
                  </div>
                  <strong>
                    {formatCurrencyInCents(-1 * operation.affectedAmountInCents)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
