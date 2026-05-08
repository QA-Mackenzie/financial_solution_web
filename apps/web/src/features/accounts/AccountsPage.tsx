import { zodResolver } from '@hookform/resolvers/zod';
import type { AccountListItem, CreateAccountInput } from '@shf/contracts';
import { createAccountInputSchema } from '@shf/contracts';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { CurrencyInput } from '../../components/CurrencyInput';
import { formatCurrencyInCents } from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useArchiveAccountMutation,
  useCreateAccountMutation,
  useUpdateAccountMutation,
} from '../finance/use-finance';

const accountDefaultValues: CreateAccountInput = {
  name: '',
  openingBalanceInCents: 0,
  type: 'checking',
};

const accountTypeLabelByValue = {
  cash: 'Dinheiro',
  checking: 'Conta corrente',
  investment: 'Investimento',
  other: 'Outro',
  savings: 'Poupança',
} as const;

export function AccountsPage() {
  const [editingAccount, setEditingAccount] = useState<AccountListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const createAccountMutation = useCreateAccountMutation();
  const updateAccountMutation = useUpdateAccountMutation();
  const archiveAccountMutation = useArchiveAccountMutation();
  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountInputSchema),
    defaultValues: accountDefaultValues,
  });

  const activeAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const archivedAccounts = accountsSnapshotQuery.data?.archivedAccounts ?? [];

  const currentMutationError =
    createAccountMutation.error ?? updateAccountMutation.error ?? archiveAccountMutation.error;

  const onSubmit = handleSubmit(async (values) => {
    if (editingAccount) {
      await updateAccountMutation.mutateAsync({
        ...values,
        id: editingAccount.id,
      });
    } else {
      await createAccountMutation.mutateAsync(values);
    }

    setEditingAccount(null);
    reset(accountDefaultValues);
  });

  function startEditing(account: AccountListItem) {
    setEditingAccount(account);
    reset({
      name: account.name,
      openingBalanceInCents: account.openingBalanceInCents,
      type: account.type,
    });
  }

  function cancelEditing() {
    setEditingAccount(null);
    reset(accountDefaultValues);
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Contas</div>
        <h2>Contas e saldo atual</h2>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Cadastro</div>
              <h3>{editingAccount ? 'Editar conta' : 'Nova conta'}</h3>
            </div>
            {editingAccount ? (
              <button className="ghost-button" onClick={cancelEditing} type="button">
                Cancelar edição
              </button>
            ) : null}
          </div>

          <form className="finance-form" onSubmit={onSubmit}>
            <label>
              <span>Nome da conta</span>
              <input {...register('name')} placeholder="Conta principal" />
              <small>{errors.name?.message}</small>
            </label>

            <label>
              <span>Tipo</span>
              <select {...register('type')}>
                <option value="checking">Conta corrente</option>
                <option value="savings">Poupança</option>
                <option value="cash">Dinheiro</option>
                <option value="investment">Investimento</option>
                <option value="other">Outro</option>
              </select>
              <small>{errors.type?.message}</small>
            </label>

            <label>
              <span>Saldo inicial em reais</span>
              <CurrencyInput control={control} name="openingBalanceInCents" />
              <small>{errors.openingBalanceInCents?.message}</small>
            </label>

            {currentMutationError ? (
              <div className="feedback feedback-error">{currentMutationError.message}</div>
            ) : null}

            <button
              disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
              type="submit"
            >
              {createAccountMutation.isPending || updateAccountMutation.isPending
                ? 'Salvando...'
                : editingAccount
                  ? 'Atualizar conta'
                  : 'Criar conta'}
            </button>
          </form>
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Saldo consolidado</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              accountsSnapshotQuery.data?.consolidatedBalanceInCents ?? 0,
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Contas ativas</span>
              <strong>{activeAccounts.length}</strong>
            </div>
            <div className="stat-item">
              <span>Contas arquivadas</span>
              <strong>{archivedAccounts.length}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Contas ativas</div>
              <h3>Operacionais</h3>
            </div>
          </div>

          {accountsSnapshotQuery.isLoading ? (
            <p>Carregando contas...</p>
          ) : activeAccounts.length === 0 ? (
            <p>Nenhuma conta ativa cadastrada ainda.</p>
          ) : (
            <div className="stack-list">
              {activeAccounts.map((account) => (
                <div className="entity-card" key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{accountTypeLabelByValue[account.type]}</span>
                  </div>
                  <div className="entity-metrics">
                    <span>Saldo atual</span>
                    <strong>{formatCurrencyInCents(account.currentBalanceInCents)}</strong>
                    <small>
                      Saldo inicial {formatCurrencyInCents(account.openingBalanceInCents)}
                    </small>
                  </div>
                  <div className="entity-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditing(account)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="ghost-button"
                      disabled={archiveAccountMutation.isPending}
                      onClick={() => archiveAccountMutation.mutate(account.id)}
                      type="button"
                    >
                      Arquivar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">Histórico</div>
          <h3>Contas arquivadas</h3>

          {archivedAccounts.length === 0 ? (
            <p>Nenhuma conta arquivada até o momento.</p>
          ) : (
            <div className="stack-list">
              {archivedAccounts.map((account) => (
                <div className="entity-card" key={account.id}>
                  <div>
                    <strong>{account.name}</strong>
                    <span>{accountTypeLabelByValue[account.type]}</span>
                  </div>
                  <div className="entity-metrics">
                    <span>Saldo final</span>
                    <strong>{formatCurrencyInCents(account.currentBalanceInCents)}</strong>
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
