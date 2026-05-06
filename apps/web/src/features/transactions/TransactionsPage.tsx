import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateTransactionInput, TransactionListItem } from '@shf/contracts';
import { createTransactionInputSchema } from '@shf/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { formatCurrencyInCents, formatDate } from '../../lib/finance-format';
import { useAccountsSnapshotQuery } from '../finance/use-finance';
import {
  useCreateTransactionMutation,
  useDeleteTransactionMutation,
  useTransactionsSnapshotQuery,
  useUpdateTransactionMutation,
} from '../finance/use-finance';

const transactionDefaultValues: CreateTransactionInput = {
  accountId: '',
  amountInCents: 0,
  category: '',
  description: '',
  transactionDate: new Date().toISOString().slice(0, 10),
  type: 'expense',
};

export function TransactionsPage() {
  const [editingTransaction, setEditingTransaction] = useState<TransactionListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const transactionsSnapshotQuery = useTransactionsSnapshotQuery();
  const createTransactionMutation = useCreateTransactionMutation();
  const updateTransactionMutation = useUpdateTransactionMutation();
  const deleteTransactionMutation = useDeleteTransactionMutation();
  const {
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionInputSchema),
    defaultValues: transactionDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const firstAvailableAccountId = availableAccounts[0]?.id ?? '';
  const transactions = transactionsSnapshotQuery.data?.transactions ?? [];
  const currentMutationError =
    createTransactionMutation.error ?? updateTransactionMutation.error ?? deleteTransactionMutation.error;

  useEffect(() => {
    if (firstAvailableAccountId && !editingTransaction) {
      setValue('accountId', firstAvailableAccountId);
    }
  }, [editingTransaction, firstAvailableAccountId, setValue]);

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
      category: transaction.category ?? '',
      description: transaction.description,
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
                <input {...register('category')} placeholder="Ex.: trabalho" />
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
              <span>Total de saidas</span>
              <strong>
                {formatCurrencyInCents(
                  transactionsSnapshotQuery.data?.totalExpenseInCents ?? 0,
                )}
              </strong>
            </div>
          </div>
        </article>
      </div>

      <article className="dashboard-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Historico</div>
            <h3>Lancamentos recentes</h3>
          </div>
        </div>

        {transactionsSnapshotQuery.isLoading ? (
          <p>Carregando lancamentos...</p>
        ) : transactions.length === 0 ? (
          <p>Nenhum lancamento manual registrado ate o momento.</p>
        ) : (
          <div className="stack-list">
            {transactions.map((transaction) => (
              <div className="entity-card" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <span>
                    {transaction.accountName} • {transaction.category ?? 'Sem categoria'}
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