import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTransactionInputSchema,
  DEFAULT_UNCATEGORIZED_CATEGORY,
  initialCategoryDefinitions,
  type CreateTransactionInput,
  type TransactionListItem,
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

function getTransactionCategories(type: CreateTransactionInput['type']) {
  return initialCategoryDefinitions.filter(
    (definition) => definition.flow === 'both' || definition.flow === type,
  );
}

export function TransactionsPage() {
  const [editingTransaction, setEditingTransaction] = useState<TransactionListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const tagsSnapshotQuery = useTagsSnapshotQuery();
  const transactionsSnapshotQuery = useTransactionsSnapshotQuery();
  const createTransactionMutation = useCreateTransactionMutation();
  const updateTransactionMutation = useUpdateTransactionMutation();
  const deleteTransactionMutation = useDeleteTransactionMutation();
  const {
    control,
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

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Lançamentos</div>
        <h2>Lançamentos manuais</h2>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Lançamento</div>
              <h3>{editingTransaction ? 'Editar lançamento' : 'Novo lançamento'}</h3>
            </div>
            {editingTransaction ? (
              <button className="ghost-button" onClick={cancelEditing} type="button">
                Cancelar edição
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de registrar lançamentos.</p>
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
                  <option value="expense">Saída</option>
                </select>
                <small>{errors.type?.message}</small>
              </label>

              <label>
                <span>Descrição</span>
                <input {...register('description')} placeholder="Ex.: salário" />
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
                <span>Valor em reais</span>
                <CurrencyInput control={control} name="amountInCents" />
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
                    Nenhuma tag cadastrada ainda na área de analytics.
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
                    ? 'Atualizar lançamento'
                    : 'Criar lançamento'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Resumo atual</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              (transactionsSnapshotQuery.data?.totalIncomeInCents ?? 0) -
                (transactionsSnapshotQuery.data?.totalExpenseInCents ?? 0),
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Total de entradas</span>
              <strong>
                {formatCurrencyInCents(
                  transactionsSnapshotQuery.data?.totalIncomeInCents ?? 0,
                )}
              </strong>
            </div>
            <div className="stat-item">
              <span>Total de saídas</span>
              <strong>
                {formatCurrencyInCents(
                  transactionsSnapshotQuery.data?.totalExpenseInCents ?? 0,
                )}
              </strong>
            </div>
            <div className="stat-item">
              <span>Itens exibidos</span>
              <strong>{transactions.length}</strong>
            </div>
          </div>
        </article>
      </div>

      <article className="dashboard-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Histórico</div>
            <h3>Lançamentos recentes</h3>
          </div>
        </div>

        {transactionsSnapshotQuery.isLoading ? (
          <p>Carregando lançamentos...</p>
        ) : transactions.length === 0 ? (
          <p>Nenhum lançamento manual registrado até o momento.</p>
        ) : (
          <div className="stack-list">
            {transactions.map((transaction) => (
              <div className="entity-card" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <span>
                    {transaction.accountName} •{' '}
                    {formatCategoryLabel(
                      transaction.category ?? DEFAULT_UNCATEGORIZED_CATEGORY,
                    )}
                  </span>
                  <small>{formatDate(transaction.transactionDate)}</small>
                </div>
                <div className="entity-metrics">
                  <span>{transaction.type === 'income' ? 'Entrada' : 'Saída'}</span>
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
