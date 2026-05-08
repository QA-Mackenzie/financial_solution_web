import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCreditCardInputSchema,
  createCreditCardPurchaseInputSchema,
  DEFAULT_UNCATEGORIZED_CATEGORY,
  initialCategoryDefinitions,
  type CreateCreditCardInput,
  type CreateCreditCardPurchaseInput,
  type CreditCardInvoice,
  type CreditCardInvoicePreview,
  type CreditCardListItem,
  type CreditCardPurchaseListItem,
} from '@shf/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CurrencyInput } from '../../components/CurrencyInput';
import {
  formatCategoryLabel,
  formatCurrencyInCents,
  formatDate,
  formatMonthYear,
} from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useCreateCreditCardMutation,
  useCreateCreditCardPurchaseMutation,
  useCreditCardsSnapshotQuery,
  useTagsSnapshotQuery,
  useUpdateCreditCardMutation,
  useUpdateCreditCardPurchaseMutation,
} from '../finance/use-finance';

const today = new Date().toISOString().slice(0, 10);

const creditCardDefaultValues: CreateCreditCardInput = {
  name: '',
  creditLimitInCents: 0,
  statementClosingDay: 25,
  dueDay: 8,
  paymentAccountId: '',
};

const purchaseDefaultValues: CreateCreditCardPurchaseInput = {
  creditCardId: '',
  description: '',
  category: DEFAULT_UNCATEGORIZED_CATEGORY,
  amountInCents: 0,
  purchaseDate: today,
  tagIds: [],
};

const purchaseCategories = initialCategoryDefinitions.filter(
  (definition) => definition.flow !== 'income',
);

const invoiceStatusLabel = {
  open: 'Aberta',
  overdue: 'Atrasada',
  upcoming: 'Projetada',
} as const;

function describeInvoice(
  invoice: Pick<CreditCardInvoice | CreditCardInvoicePreview, 'invoiceMonth' | 'dueDate'>,
) {
  return `${formatMonthYear(`${invoice.invoiceMonth}-01`)} • vence em ${formatDate(invoice.dueDate)}`;
}

export function CreditCardsPage() {
  const [editingCard, setEditingCard] = useState<CreditCardListItem | null>(null);
  const [editingPurchase, setEditingPurchase] =
    useState<CreditCardPurchaseListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const creditCardsSnapshotQuery = useCreditCardsSnapshotQuery();
  const tagsSnapshotQuery = useTagsSnapshotQuery();
  const createCreditCardMutation = useCreateCreditCardMutation();
  const updateCreditCardMutation = useUpdateCreditCardMutation();
  const createCreditCardPurchaseMutation = useCreateCreditCardPurchaseMutation();
  const updateCreditCardPurchaseMutation = useUpdateCreditCardPurchaseMutation();
  const {
    control: cardControl,
    handleSubmit: handleCardSubmit,
    register: registerCard,
    reset: resetCard,
    setValue: setCardValue,
    formState: { errors: cardErrors },
  } = useForm<CreateCreditCardInput>({
    resolver: zodResolver(createCreditCardInputSchema),
    defaultValues: creditCardDefaultValues,
  });
  const {
    control: purchaseControl,
    handleSubmit: handlePurchaseSubmit,
    register: registerPurchase,
    reset: resetPurchase,
    setValue: setPurchaseValue,
    watch: watchPurchase,
    formState: { errors: purchaseErrors },
  } = useForm<CreateCreditCardPurchaseInput>({
    resolver: zodResolver(createCreditCardPurchaseInputSchema),
    defaultValues: purchaseDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const cards = creditCardsSnapshotQuery.data?.cards ?? [];
  const invoices = creditCardsSnapshotQuery.data?.invoices ?? [];
  const purchases = creditCardsSnapshotQuery.data?.purchases ?? [];
  const projectedInvoices = creditCardsSnapshotQuery.data?.projectedInvoices ?? [];
  const tags = tagsSnapshotQuery.data?.tags ?? [];
  const firstAvailableAccountId = availableAccounts[0]?.id ?? '';
  const firstAvailableCardId = cards[0]?.id ?? '';
  const watchedPurchaseCategory = watchPurchase('category');
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const currentMutationError =
    createCreditCardMutation.error ??
    updateCreditCardMutation.error ??
    createCreditCardPurchaseMutation.error ??
    updateCreditCardPurchaseMutation.error;

  useEffect(() => {
    if (firstAvailableAccountId && !editingCard) {
      setCardValue('paymentAccountId', firstAvailableAccountId);
    }
  }, [editingCard, firstAvailableAccountId, setCardValue]);

  useEffect(() => {
    if (firstAvailableCardId && !editingPurchase) {
      setPurchaseValue('creditCardId', firstAvailableCardId);
    }
  }, [editingPurchase, firstAvailableCardId, setPurchaseValue]);

  useEffect(() => {
    const categoryStillAvailable = purchaseCategories.some(
      (category) => category.label === watchedPurchaseCategory,
    );

    if (!categoryStillAvailable) {
      setPurchaseValue('category', DEFAULT_UNCATEGORIZED_CATEGORY);
    }
  }, [setPurchaseValue, watchedPurchaseCategory]);

  const onSubmitCard = handleCardSubmit(async (values) => {
    if (editingCard) {
      await updateCreditCardMutation.mutateAsync({
        ...values,
        id: editingCard.id,
      });
    } else {
      await createCreditCardMutation.mutateAsync(values);
    }

    setEditingCard(null);
    resetCard({
      ...creditCardDefaultValues,
      paymentAccountId: firstAvailableAccountId,
    });
  });

  const onSubmitPurchase = handlePurchaseSubmit(async (values) => {
    if (editingPurchase) {
      await updateCreditCardPurchaseMutation.mutateAsync({
        ...values,
        id: editingPurchase.id,
      });
    } else {
      await createCreditCardPurchaseMutation.mutateAsync(values);
    }

    setEditingPurchase(null);
    resetPurchase({
      ...purchaseDefaultValues,
      creditCardId: firstAvailableCardId,
      purchaseDate: today,
    });
  });

  function startEditingCard(card: CreditCardListItem) {
    setEditingCard(card);
    resetCard({
      creditLimitInCents: card.creditLimitInCents,
      dueDay: card.dueDay,
      name: card.name,
      paymentAccountId: card.paymentAccountId,
      statementClosingDay: card.statementClosingDay,
    });
  }

  function cancelEditingCard() {
    setEditingCard(null);
    resetCard({
      ...creditCardDefaultValues,
      paymentAccountId: firstAvailableAccountId,
    });
  }

  function startEditingPurchase(purchase: CreditCardPurchaseListItem) {
    if (purchase.isProjected) {
      return;
    }

    setEditingPurchase(purchase);
    resetPurchase({
      amountInCents: purchase.amountInCents,
      category: purchase.category ?? DEFAULT_UNCATEGORIZED_CATEGORY,
      creditCardId: purchase.creditCardId,
      description: purchase.description,
      purchaseDate: purchase.purchaseDate,
      tagIds: purchase.tagIds,
    });
  }

  function cancelEditingPurchase() {
    setEditingPurchase(null);
    resetPurchase({
      ...purchaseDefaultValues,
      creditCardId: firstAvailableCardId,
      purchaseDate: today,
    });
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Crédito</div>
        <h2>Cartões de crédito e ciclo de fatura</h2>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Cartão</div>
              <h3>{editingCard ? 'Editar cartão' : 'Novo cartão'}</h3>
            </div>
            {editingCard ? (
              <button className="ghost-button" onClick={cancelEditingCard} type="button">
                Cancelar edição
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de definir a conta pagadora do cartão.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitCard}>
              <label>
                <span>Nome do cartão</span>
                <input {...registerCard('name')} placeholder="Ex.: Visa Platinum" />
                <small>{cardErrors.name?.message}</small>
              </label>

              <label>
                <span>Conta pagadora padrão</span>
                <select {...registerCard('paymentAccountId')}>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <small>{cardErrors.paymentAccountId?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Limite em reais</span>
                  <CurrencyInput control={cardControl} name="creditLimitInCents" />
                  <small>{cardErrors.creditLimitInCents?.message}</small>
                </label>

                <label>
                  <span>Fechamento</span>
                  <input
                    {...registerCard('statementClosingDay', { valueAsNumber: true })}
                    max={31}
                    min={1}
                    type="number"
                  />
                  <small>{cardErrors.statementClosingDay?.message}</small>
                </label>
              </div>

              <label>
                <span>Vencimento</span>
                <input
                  {...registerCard('dueDay', { valueAsNumber: true })}
                  max={31}
                  min={1}
                  type="number"
                />
                <small>{cardErrors.dueDay?.message}</small>
              </label>

              {currentMutationError ? (
                <div className="feedback feedback-error">{currentMutationError.message}</div>
              ) : null}

              <button
                disabled={createCreditCardMutation.isPending || updateCreditCardMutation.isPending}
                type="submit"
              >
                {createCreditCardMutation.isPending || updateCreditCardMutation.isPending
                  ? 'Salvando...'
                  : editingCard
                    ? 'Atualizar cartão'
                    : 'Criar cartão'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Compra</div>
              <h3>{editingPurchase ? 'Editar compra no crédito' : 'Nova compra no crédito'}</h3>
            </div>
            {editingPurchase ? (
              <button
                className="ghost-button"
                onClick={cancelEditingPurchase}
                type="button"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>

          {cards.length === 0 ? (
            <p>Cadastre um cartão antes de registrar compras no crédito.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitPurchase}>
              <label>
                <span>Cartão</span>
                <select {...registerPurchase('creditCardId')}>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
                <small>{purchaseErrors.creditCardId?.message}</small>
              </label>

              <label>
                <span>Descrição</span>
                <input {...registerPurchase('description')} placeholder="Ex.: notebook" />
                <small>{purchaseErrors.description?.message}</small>
              </label>

              <label>
                <span>Categoria</span>
                <select {...registerPurchase('category')}>
                  {purchaseCategories.map((category) => (
                    <option key={category.label} value={category.label}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <small>{purchaseErrors.category?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Valor em reais</span>
                  <CurrencyInput control={purchaseControl} name="amountInCents" />
                  <small>{purchaseErrors.amountInCents?.message}</small>
                </label>

                <label>
                  <span>Data da compra</span>
                  <input {...registerPurchase('purchaseDate')} type="date" />
                  <small>{purchaseErrors.purchaseDate?.message}</small>
                </label>
              </div>

              <fieldset>
                <legend>Tags</legend>
                {tagsSnapshotQuery.isLoading ? (
                  <div className="tag-checklist-empty">Carregando tags...</div>
                ) : tags.length === 0 ? (
                  <div className="tag-checklist-empty">
                    Nenhuma tag cadastrada ainda na área de analytics.
                  </div>
                ) : (
                  <div className="tag-checklist tag-checklist-grid">
                    {tags.map((tag) => (
                      <label className="tag-check-item" key={tag.id}>
                        <input {...registerPurchase('tagIds')} type="checkbox" value={tag.id} />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <button
                disabled={
                  createCreditCardPurchaseMutation.isPending ||
                  updateCreditCardPurchaseMutation.isPending
                }
                type="submit"
              >
                {createCreditCardPurchaseMutation.isPending ||
                updateCreditCardPurchaseMutation.isPending
                  ? 'Salvando...'
                  : editingPurchase
                    ? 'Atualizar compra'
                    : 'Criar compra'}
              </button>
            </form>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card summary-card">
          <div className="eyebrow">Resumo de crédito</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              creditCardsSnapshotQuery.data?.totalInvoiceAmountInCents ?? 0,
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Cartões cadastrados</span>
              <strong>{cards.length}</strong>
            </div>
            <div className="stat-item">
              <span>Limite consolidado</span>
              <strong>
                {formatCurrencyInCents(
                  creditCardsSnapshotQuery.data?.totalCreditLimitInCents ?? 0,
                )}
              </strong>
            </div>
            <div className="stat-item">
              <span>Faturas abertas</span>
              <strong>{invoices.length}</strong>
            </div>
            <div className="stat-item">
              <span>Compras registradas</span>
              <strong>{purchases.length}</strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">Débitos projetados</div>
          <h3>Próximos vencimentos</h3>

          {projectedInvoices.length === 0 ? (
            <p>Nenhum débito futuro de fatura calculado no momento.</p>
          ) : (
            <div className="sub-entity-list">
              {projectedInvoices.map((invoice) => (
                <div className="sub-entity-item" key={invoice.id}>
                  <div>
                    <strong>{invoice.creditCardName}</strong>
                    <span>
                      {invoice.paymentAccountName} • {formatDate(invoice.occurrenceDate)}
                    </span>
                  </div>
                  <strong className="amount-negative">
                    {formatCurrencyInCents(invoice.amountInCents)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="dashboard-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Cartões</div>
            <h3>Visão atual de limite, ciclo e fatura</h3>
          </div>
        </div>

        {creditCardsSnapshotQuery.isLoading ? (
          <p>Carregando cartões...</p>
        ) : cards.length === 0 ? (
          <p>Nenhum cartão cadastrado até o momento.</p>
        ) : (
          <div className="stack-list">
            {cards.map((card) => (
              <div className="entity-card" key={card.id}>
                <div className="section-heading-row compact-row">
                  <div>
                    <strong>{card.name}</strong>
                    <span>
                      Conta pagadora: {card.paymentAccountName} • fechamento dia{' '}
                      {card.statementClosingDay} • vencimento dia {card.dueDay}
                    </span>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() => startEditingCard(card)}
                    type="button"
                  >
                    Editar cartão
                  </button>
                </div>

                <div className="stats-grid stats-grid-inline">
                  <div className="stat-item">
                    <span>Limite consolidado</span>
                    <strong>{formatCurrencyInCents(card.creditLimitInCents)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Fatura atual</span>
                    <strong>{formatCurrencyInCents(card.currentInvoice.totalAmountInCents)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Ciclo atual</span>
                    <strong>{describeInvoice(card.currentInvoice)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Faturas</div>
              <h3>Consolidação por vencimento</h3>
            </div>
          </div>

          {invoices.length === 0 ? (
            <p>Nenhuma fatura consolidada ainda.</p>
          ) : (
            <div className="stack-list">
              {invoices.map((invoice) => (
                <div className="entity-card" key={invoice.id}>
                  <div className="section-heading-row compact-row">
                    <div>
                      <strong>{invoice.creditCardName}</strong>
                      <span>{describeInvoice(invoice)}</span>
                    </div>
                    <span className={`invoice-pill invoice-pill-${invoice.status}`}>
                      {invoiceStatusLabel[invoice.status]}
                    </span>
                  </div>

                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Total da fatura</span>
                      <strong>{formatCurrencyInCents(invoice.totalAmountInCents)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Compras consolidadas</span>
                      <strong>{invoice.purchaseCount}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Débito na conta</span>
                      <strong>{invoice.paymentAccountName}</strong>
                    </div>
                  </div>

                  {invoice.purchases.length > 0 ? (
                    <div className="sub-entity-list">
                      {invoice.purchases.slice(0, 3).map((purchase) => (
                        <div className="sub-entity-item" key={purchase.id}>
                          <div>
                            <strong>{purchase.description}</strong>
                            <span>{formatDate(purchase.purchaseDate)}</span>
                          </div>
                          <strong className="amount-negative">
                            {formatCurrencyInCents(purchase.amountInCents)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Histórico</div>
              <h3>Compras no crédito</h3>
            </div>
          </div>

          {purchases.length === 0 ? (
            <p>Nenhuma compra no crédito registrada até o momento.</p>
          ) : (
            <div className="stack-list">
              {purchases.map((purchase) => (
                <div className="entity-card" key={purchase.id}>
                  <div className="section-heading-row compact-row">
                    <div>
                      <strong>{purchase.description}</strong>
                      <span>
                        {purchase.creditCardName} • vence em {formatDate(purchase.dueDate)}
                      </span>
                      <small>
                        Compra em {formatDate(purchase.purchaseDate)} • fatura{' '}
                        {formatMonthYear(`${purchase.invoiceMonth}-01`)}
                      </small>
                    </div>
                    {purchase.isProjected ? (
                      <span>Gerada por parcelamento</span>
                    ) : (
                      <button
                        className="ghost-button"
                        onClick={() => startEditingPurchase(purchase)}
                        type="button"
                      >
                        Editar compra
                      </button>
                    )}
                  </div>

                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Valor</span>
                      <strong className="amount-negative">
                        {formatCurrencyInCents(purchase.amountInCents)}
                      </strong>
                    </div>
                    <div className="stat-item">
                      <span>Conta impactada</span>
                      <strong>{purchase.paymentAccountName}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Categoria</span>
                      <strong>
                        {formatCategoryLabel(
                          purchase.category ??
                            (purchase.isProjected
                              ? 'Parcelamento projetado'
                              : DEFAULT_UNCATEGORIZED_CATEGORY),
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="tag-badge-row">
                    {(purchase.tagIds ?? []).length === 0 ? (
                      <span className="tag-badge tag-badge-muted">Sem tags</span>
                    ) : (
                      (purchase.tagIds ?? []).map((tagId) => (
                        <span className="tag-badge" key={tagId}>
                          {tagNameById.get(tagId) ?? 'Tag removida'}
                        </span>
                      ))
                    )}
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
