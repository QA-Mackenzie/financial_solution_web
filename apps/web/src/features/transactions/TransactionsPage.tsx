import { zodResolver } from '@hookform/resolvers/zod';
import type { ChangeEvent } from 'react';
import {
  createTransactionInputSchema,
  DEFAULT_UNCATEGORIZED_CATEGORY,
  initialCategoryDefinitions,
  type CreateTransactionInput,
  type TransactionListItem,
} from '@shf/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { formatCurrencyInCents, formatDate } from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useTagsSnapshotQuery,
  useTransactionsSnapshotQuery,
  useUpdateTransactionMutation,
} from '../finance/use-finance';

const transactionDefaultValues: CreateTransactionInput = {
  accountId: '',
  amountInCents: 0,
  category: DEFAULT_UNCATEGORIZED_CATEGORY,
  description: '',
  tagIds: [],
  transactionDate: new Date().toISOString().slice(0, 10),
  type: 'expense',
};

type TransactionFilterState = {
  accountId: string;
  category: string;
  fromDate: string;
  tagId: string;
  toDate: string;
  type: '' | 'income' | 'expense';
};

const defaultTransactionFilters: TransactionFilterState = {
  accountId: '',
  category: '',
  fromDate: '',
  tagId: '',
  toDate: '',
  type: '',
};

function getTransactionCategories(type: CreateTransactionInput['type']) {
  return initialCategoryDefinitions.filter(
    (definition) => definition.flow === 'both' || definition.flow === type,
  );
}

export function TransactionsPage() {
  const [editingTransaction, setEditingTransaction] = useState<TransactionListItem | null>(null);
  const [filters, setFilters] = useState<TransactionFilterState>(defaultTransactionFilters);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const tagsSnapshotQuery = useTagsSnapshotQuery();
  const transactionsSnapshotQuery = useTransactionsSnapshotQuery();
  const createTransactionMutation = useCreateTransactionMutation();
  const updateTransactionMutation = useUpdateTransactionMutation();
  const deleteTransactionMutation = useDeleteTransactionMutation();
  const {
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionInputSchema),
    defaultValues: transactionDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const tags = tagsSnapshotQuery.data?.tags ?? [];
  const firstAvailableAccountId = availableAccounts[0]?.id ?? '';
  const transactions = transactionsSnapshotQuery.data?.transactions ?? [];
  const watchedType = watch('type');
  const watchedCategory = watch('category');
  const availableCategories = getTransactionCategories(watchedType);
  const tagNameById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const filteredTransactions = transactions.filter((transaction) => {
    const transactionCategory =
      transaction.category ?? DEFAULT_UNCATEGORIZED_CATEGORY;

    if (filters.accountId && transaction.accountId !== filters.accountId) {
      return false;
    }

    if (filters.type && transaction.type !== filters.type) {
      return false;
    }

    if (filters.category && transactionCategory !== filters.category) {
      return false;
    }

    if (filters.fromDate && transaction.transactionDate < filters.fromDate) {
      return false;
    }

    if (filters.toDate && transaction.transactionDate > filters.toDate) {
      return false;
    }

    if (filters.tagId && !(transaction.tagIds ?? []).includes(filters.tagId)) {
      return false;
    }

    return true;
  });
  const filteredIncomeInCents = filteredTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + transaction.amountInCents, 0);
  const filteredExpenseInCents = filteredTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + transaction.amountInCents, 0);
  const currentMutationError =
    createTransactionMutation.error ?? updateTransactionMutation.error ?? deleteTransactionMutation.error;

  useEffect(() => {
    if (firstAvailableAccountId && !editingTransaction) {
      setValue('accountId', firstAvailableAccountId);
    }
  }, [editingTransaction, firstAvailableAccountId, setValue]);

  useEffect(() => {
    const categoryStillAvailable = getTransactionCategories(watchedType).some(
      (definition) => definition.label === watchedCategory,
    );

    if (!categoryStillAvailable) {
      setValue('category', DEFAULT_UNCATEGORIZED_CATEGORY);
    }
  }, [setValue, watchedCategory, watchedType]);

  const onSubmit = handleSubmit(async (values) => {
    if (editingTransaction) {
      await updateTransactionMutation.mutateAsync({
        ...values,
        id: editingTransaction.id,
      });
    } else {
      await createTransactionMutation.mutateAsync(values);
    }

    setEditingTransaction(null);
    reset({
      ...transactionDefaultValues,
      accountId: firstAvailableAccountId,
    });
  });

  function startEditing(transaction: TransactionListItem) {
    setEditingTransaction(transaction);
    reset({
      accountId: transaction.accountId,
      amountInCents: transaction.amountInCents,
      category: transaction.category ?? DEFAULT_UNCATEGORIZED_CATEGORY,
      description: transaction.description,
      tagIds: transaction.tagIds ?? [],
      transactionDate: transaction.transactionDate,
      type: transaction.type,
    });
  }

  function cancelEditing() {
    setEditingTransaction(null);
    reset({
      ...transactionDefaultValues,
      accountId: firstAvailableAccountId,
    });
  }

  function handleFilterChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleClearFilters() {
    setFilters(defaultTransactionFilters);
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Sprint 3</div>
        <h2>Lancamentos manuais</h2>
        <p>
          Registre entradas e saidas para consolidar o saldo atual por conta,
          manter historico e preparar a leitura do horizonte nas proximas
          sprints.
        </p>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Lancamento</div>
              <h3>{editingTransaction ? 'Editar lancamento' : 'Novo lancamento'}</h3>
            </div>
            {editingTransaction ? (
              <button className="ghost-button" onClick={cancelEditing} type="button">
                Cancelar edicao
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de registrar lancamentos.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmit}>
              <label>
                <span>Conta</span>
                <select {...register('accountId')}>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <small>{errors.accountId?.message}</small>
              </label>

              <label>
                <span>Tipo</span>
                <select {...register('type')}>
                  <option value="income">Entrada</option>
                  <option value="expense">Saida</option>
                </select>
                <small>{errors.type?.message}</small>
              </label>

              <label>
                <span>Descricao</span>
                <input {...register('description')} placeholder="Ex.: salario" />
                <small>{errors.description?.message}</small>
              </label>

              <label>
                <span>Categoria</span>
                <select {...register('category')}>
                  {availableCategories.map((category) => (
                    <option key={category.label} value={category.label}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <small>{errors.category?.message}</small>
              </label>

              <label>
                <span>Valor em centavos</span>
                <input
                  {...register('amountInCents', { valueAsNumber: true })}
                  placeholder="0"
                  type="number"
                />
                <small>{errors.amountInCents?.message}</small>
              </label>

              <label>
                <span>Data</span>
                <input {...register('transactionDate')} type="date" />
                <small>{errors.transactionDate?.message}</small>
              </label>

              <fieldset>
                <legend>Tags</legend>
                {tagsSnapshotQuery.isLoading ? (
                  <div className="tag-checklist-empty">Carregando tags...</div>
                ) : tags.length === 0 ? (
                  <div className="tag-checklist-empty">
                    Nenhuma tag cadastrada ainda na area de analytics.
                  </div>
                ) : (
                  <div className="tag-checklist tag-checklist-grid">
                    {tags.map((tag) => (
                      <label className="tag-check-item" key={tag.id}>
                        <input {...register('tagIds')} type="checkbox" value={tag.id} />
                        <span>{tag.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              {currentMutationError ? (
                <div className="feedback feedback-error">{currentMutationError.message}</div>
              ) : null}

              <button
                disabled={createTransactionMutation.isPending || updateTransactionMutation.isPending}
                type="submit"
              >
                {createTransactionMutation.isPending || updateTransactionMutation.isPending
                  ? 'Salvando...'
                  : editingTransaction
                    ? 'Atualizar lancamento'
                    : 'Criar lancamento'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Resumo filtrado</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              filteredIncomeInCents - filteredExpenseInCents,
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Total de entradas</span>
              <strong>{formatCurrencyInCents(filteredIncomeInCents)}</strong>
            </div>
            <div className="stat-item">
              <span>Total de saidas</span>
              <strong>{formatCurrencyInCents(-1 * filteredExpenseInCents)}</strong>
            </div>
            <div className="stat-item">
              <span>Itens exibidos</span>
              <strong>{filteredTransactions.length}</strong>
            </div>
          </div>
        </article>
      </div>

      <article className="dashboard-card form-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Filtros</div>
            <h3>Recorte visual do historico</h3>
          </div>
          <button className="ghost-button" onClick={handleClearFilters} type="button">
            Limpar filtros
          </button>
        </div>

        <div className="filter-grid filter-grid-3">
          <label>
            <span>Conta</span>
            <select name="accountId" onChange={handleFilterChange} value={filters.accountId}>
              <option value="">Todas</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tipo</span>
            <select name="type" onChange={handleFilterChange} value={filters.type}>
              <option value="">Todos</option>
              <option value="income">Entrada</option>
              <option value="expense">Saida</option>
            </select>
          </label>

          <label>
            <span>Categoria</span>
            <select name="category" onChange={handleFilterChange} value={filters.category}>
              <option value="">Todas</option>
              {initialCategoryDefinitions.map((category) => (
                <option key={category.label} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tag</span>
            <select name="tagId" onChange={handleFilterChange} value={filters.tagId}>
              <option value="">Todas</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>De</span>
            <input name="fromDate" onChange={handleFilterChange} type="date" value={filters.fromDate} />
          </label>

          <label>
            <span>Ate</span>
            <input name="toDate" onChange={handleFilterChange} type="date" value={filters.toDate} />
          </label>
        </div>
      </article>

      <article className="dashboard-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Historico</div>
            <h3>Lancamentos recentes</h3>
          </div>
        </div>

        {transactionsSnapshotQuery.isLoading ? (
          <p>Carregando lancamentos...</p>
        ) : filteredTransactions.length === 0 ? (
          <p>Nenhum lancamento manual registrado ate o momento.</p>
        ) : (
          <div className="stack-list">
            {filteredTransactions.map((transaction) => (
              <div className="entity-card" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <span>
                    {transaction.accountName} •{' '}
                    {transaction.category ?? DEFAULT_UNCATEGORIZED_CATEGORY}
                  </span>
                  <small>{formatDate(transaction.transactionDate)}</small>
                </div>
                <div className="entity-metrics">
                  <span>{transaction.type === 'income' ? 'Entrada' : 'Saida'}</span>
                  <strong
                    className={
                      transaction.signedAmountInCents >= 0
                        ? 'amount-positive'
                        : 'amount-negative'
                    }
                  >
                    {formatCurrencyInCents(transaction.signedAmountInCents)}
                  </strong>
                </div>
                <div className="tag-badge-row">
                  {(transaction.tagIds ?? []).length === 0 ? (
                    <span className="tag-badge tag-badge-muted">Sem tags</span>
                  ) : (
                    (transaction.tagIds ?? []).map((tagId) => (
                      <span className="tag-badge" key={tagId}>
                        {tagNameById.get(tagId) ?? 'Tag removida'}
                      </span>
                    ))
                  )}
                </div>
                <div className="entity-actions">
                  <button
                    className="ghost-button"
                    onClick={() => startEditing(transaction)}
                    type="button"
                  >
                    Editar
                  </button>
                  <button
                    className="ghost-button"
                    disabled={deleteTransactionMutation.isPending}
                    onClick={() => deleteTransactionMutation.mutate(transaction.id)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}