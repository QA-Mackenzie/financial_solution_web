import { zodResolver } from '@hookform/resolvers/zod';
import type {
  ContractListItem,
  CreateContractAdjustmentInput,
  CreateContractInput,
  EndContractInput,
} from '@shf/contracts';
import {
  createContractAdjustmentInputSchema,
  createContractInputSchema,
  endContractInputSchema,
} from '@shf/contracts';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { formatCurrencyInCents, formatDate } from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useContractsSnapshotQuery,
  useCreateContractAdjustmentMutation,
  useCreateContractMutation,
  useEndContractMutation,
  useUpdateContractMutation,
} from '../finance/use-finance';

const today = new Date().toISOString().slice(0, 10);

const contractDefaultValues: CreateContractInput = {
  accountId: '',
  name: '',
  category: '',
  type: 'expense',
  amountInCents: 0,
  dueDay: 10,
  startDate: today,
  status: 'active',
};

const adjustmentDefaultValues: CreateContractAdjustmentInput = {
  contractId: '',
  amountInCents: 0,
  effectiveStartDate: today,
};

const endDefaultValues: EndContractInput = {
  contractId: '',
  endDate: today,
};

function getSignedContractAmountInCents(contract: ContractListItem) {
  return contract.type === 'income'
    ? contract.amountInCents
    : -contract.amountInCents;
}

export function ContractsPage() {
  const [editingContract, setEditingContract] = useState<ContractListItem | null>(null);
  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const contractsSnapshotQuery = useContractsSnapshotQuery();
  const createContractMutation = useCreateContractMutation();
  const updateContractMutation = useUpdateContractMutation();
  const createAdjustmentMutation = useCreateContractAdjustmentMutation();
  const endContractMutation = useEndContractMutation();
  const {
    handleSubmit: handleContractSubmit,
    register: registerContract,
    reset: resetContract,
    setValue: setContractValue,
    formState: { errors: contractErrors },
  } = useForm<CreateContractInput>({
    resolver: zodResolver(createContractInputSchema),
    defaultValues: contractDefaultValues,
  });
  const {
    handleSubmit: handleAdjustmentSubmit,
    register: registerAdjustment,
    reset: resetAdjustment,
    setValue: setAdjustmentValue,
    formState: { errors: adjustmentErrors },
  } = useForm<CreateContractAdjustmentInput>({
    resolver: zodResolver(createContractAdjustmentInputSchema),
    defaultValues: adjustmentDefaultValues,
  });
  const {
    handleSubmit: handleEndSubmit,
    register: registerEnd,
    reset: resetEnd,
    setValue: setEndValue,
    formState: { errors: endErrors },
  } = useForm<EndContractInput>({
    resolver: zodResolver(endContractInputSchema),
    defaultValues: endDefaultValues,
  });

  const availableAccounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const firstAvailableAccountId = availableAccounts[0]?.id ?? '';
  const activeContracts = contractsSnapshotQuery.data?.activeContracts ?? [];
  const inactiveContracts = contractsSnapshotQuery.data?.inactiveContracts ?? [];
  const firstActiveContractId = activeContracts[0]?.id ?? '';
  const currentMutationError =
    createContractMutation.error ??
    updateContractMutation.error ??
    createAdjustmentMutation.error ??
    endContractMutation.error;

  useEffect(() => {
    if (firstAvailableAccountId && !editingContract) {
      setContractValue('accountId', firstAvailableAccountId);
    }
  }, [editingContract, firstAvailableAccountId, setContractValue]);

  useEffect(() => {
    if (firstActiveContractId) {
      setAdjustmentValue('contractId', firstActiveContractId);
      setEndValue('contractId', firstActiveContractId);
    }
  }, [firstActiveContractId, setAdjustmentValue, setEndValue]);

  const onSubmitContract = handleContractSubmit(async (values) => {
    if (editingContract) {
      await updateContractMutation.mutateAsync({
        ...values,
        id: editingContract.id,
      });
    } else {
      await createContractMutation.mutateAsync(values);
    }

    setEditingContract(null);
    resetContract({
      ...contractDefaultValues,
      accountId: firstAvailableAccountId,
    });
  });

  const onSubmitAdjustment = handleAdjustmentSubmit(async (values) => {
    await createAdjustmentMutation.mutateAsync(values);
    resetAdjustment({
      ...adjustmentDefaultValues,
      contractId: values.contractId,
      effectiveStartDate: values.effectiveStartDate,
    });
  });

  const onSubmitEnd = handleEndSubmit(async (values) => {
    await endContractMutation.mutateAsync(values);
    resetEnd({
      ...endDefaultValues,
      contractId: firstActiveContractId,
    });
  });

  function startEditing(contract: ContractListItem) {
    setEditingContract(contract);
    resetContract({
      accountId: contract.accountId,
      name: contract.name,
      category: contract.category,
      type: contract.type,
      amountInCents: contract.amountInCents,
      dueDay: contract.dueDay,
      startDate: contract.startDate,
      status: contract.status,
    });
  }

  function cancelEditing() {
    setEditingContract(null);
    resetContract({
      ...contractDefaultValues,
      accountId: firstAvailableAccountId,
    });
  }

  function prepareAdjustment(contract: ContractListItem) {
    const latestAmount = contract.adjustments?.[0]?.amountInCents ?? contract.amountInCents;

    resetAdjustment({
      contractId: contract.id,
      amountInCents: latestAmount,
      effectiveStartDate: today,
    });
  }

  function prepareEnd(contract: ContractListItem) {
    resetEnd({
      contractId: contract.id,
      endDate: contract.endDate ?? today,
    });
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Sprint 5</div>
        <h2>Contratos recorrentes</h2>
        <p>
          Cadastre receitas e despesas fixas, programe reajustes futuros e
          encerre recorrencias sem perder historico. O horizonte oficial passa a
          considerar esses compromissos automaticamente.
        </p>
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Cadastro</div>
              <h3>{editingContract ? 'Editar contrato' : 'Novo contrato'}</h3>
            </div>
            {editingContract ? (
              <button className="ghost-button" onClick={cancelEditing} type="button">
                Cancelar edicao
              </button>
            ) : null}
          </div>

          {availableAccounts.length === 0 ? (
            <p>Cadastre uma conta ativa antes de registrar contratos recorrentes.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitContract}>
              <label>
                <span>Conta de referencia</span>
                <select {...registerContract('accountId')}>
                  {availableAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
                <small>{contractErrors.accountId?.message}</small>
              </label>

              <label>
                <span>Nome do contrato</span>
                <input {...registerContract('name')} placeholder="Ex.: aluguel" />
                <small>{contractErrors.name?.message}</small>
              </label>

              <label>
                <span>Categoria</span>
                <input {...registerContract('category')} placeholder="Ex.: moradia" />
                <small>{contractErrors.category?.message}</small>
              </label>

              <div className="settings-grid">
                <label>
                  <span>Tipo</span>
                  <select {...registerContract('type')}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                  <small>{contractErrors.type?.message}</small>
                </label>

                <label>
                  <span>Status</span>
                  <select {...registerContract('status')}>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                  <small>{contractErrors.status?.message}</small>
                </label>
              </div>

              <div className="settings-grid">
                <label>
                  <span>Valor em centavos</span>
                  <input
                    {...registerContract('amountInCents', { valueAsNumber: true })}
                    placeholder="0"
                    type="number"
                  />
                  <small>{contractErrors.amountInCents?.message}</small>
                </label>

                <label>
                  <span>Dia de vencimento</span>
                  <input
                    {...registerContract('dueDay', { valueAsNumber: true })}
                    max={31}
                    min={1}
                    type="number"
                  />
                  <small>{contractErrors.dueDay?.message}</small>
                </label>
              </div>

              <label>
                <span>Inicio da recorrencia</span>
                <input {...registerContract('startDate')} type="date" />
                <small>{contractErrors.startDate?.message}</small>
              </label>

              {currentMutationError ? (
                <div className="feedback feedback-error">{currentMutationError.message}</div>
              ) : null}

              <button
                disabled={createContractMutation.isPending || updateContractMutation.isPending}
                type="submit"
              >
                {createContractMutation.isPending || updateContractMutation.isPending
                  ? 'Salvando...'
                  : editingContract
                    ? 'Atualizar contrato'
                    : 'Criar contrato'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Resumo recorrente</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(
              contractsSnapshotQuery.data?.netActiveAmountInCents ?? 0,
            )}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Contratos ativos</span>
              <strong>{activeContracts.length}</strong>
            </div>
            <div className="stat-item">
              <span>Contratos inativos</span>
              <strong>{inactiveContracts.length}</strong>
            </div>
            <div className="stat-item">
              <span>Receitas recorrentes</span>
              <strong>
                {formatCurrencyInCents(
                  contractsSnapshotQuery.data?.totalActiveIncomeInCents ?? 0,
                )}
              </strong>
            </div>
            <div className="stat-item">
              <span>Despesas recorrentes</span>
              <strong>
                {formatCurrencyInCents(
                  -1 * (contractsSnapshotQuery.data?.totalActiveExpenseInCents ?? 0),
                )}
              </strong>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="eyebrow">Reajustes</div>
          <h3>Programar novo valor</h3>

          {activeContracts.length === 0 ? (
            <p>Crie um contrato ativo antes de agendar reajustes.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitAdjustment}>
              <label>
                <span>Contrato</span>
                <select {...registerAdjustment('contractId')}>
                  {activeContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.name}
                    </option>
                  ))}
                </select>
                <small>{adjustmentErrors.contractId?.message}</small>
              </label>

              <label>
                <span>Novo valor em centavos</span>
                <input
                  {...registerAdjustment('amountInCents', { valueAsNumber: true })}
                  placeholder="0"
                  type="number"
                />
                <small>{adjustmentErrors.amountInCents?.message}</small>
              </label>

              <label>
                <span>Inicio do reajuste</span>
                <input {...registerAdjustment('effectiveStartDate')} type="date" />
                <small>{adjustmentErrors.effectiveStartDate?.message}</small>
              </label>

              <button disabled={createAdjustmentMutation.isPending} type="submit">
                {createAdjustmentMutation.isPending ? 'Salvando...' : 'Salvar reajuste'}
              </button>
            </form>
          )}
        </article>

        <article className="dashboard-card form-card">
          <div className="eyebrow">Encerramento</div>
          <h3>Finalizar recorrencia</h3>

          {activeContracts.length === 0 ? (
            <p>Nenhum contrato ativo disponivel para encerramento.</p>
          ) : (
            <form className="finance-form" onSubmit={onSubmitEnd}>
              <label>
                <span>Contrato</span>
                <select {...registerEnd('contractId')}>
                  {activeContracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.name}
                    </option>
                  ))}
                </select>
                <small>{endErrors.contractId?.message}</small>
              </label>

              <label>
                <span>Data final</span>
                <input {...registerEnd('endDate')} type="date" />
                <small>{endErrors.endDate?.message}</small>
              </label>

              <button disabled={endContractMutation.isPending} type="submit">
                {endContractMutation.isPending ? 'Encerrando...' : 'Encerrar contrato'}
              </button>
            </form>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Ativos</div>
              <h3>Recorrencias em execucao</h3>
            </div>
          </div>

          {contractsSnapshotQuery.isLoading ? (
            <p>Carregando contratos...</p>
          ) : activeContracts.length === 0 ? (
            <p>Nenhum contrato ativo cadastrado ainda.</p>
          ) : (
            <div className="stack-list">
              {activeContracts.map((contract) => (
                <div className="entity-card" key={contract.id}>
                  <div>
                    <strong>{contract.name}</strong>
                    <span>
                      {contract.accountName} • {contract.category} • dia {contract.dueDay}
                    </span>
                    <small>
                      Inicio {formatDate(contract.startDate)}
                      {contract.endDate ? ` • fim ${formatDate(contract.endDate)}` : ''}
                    </small>
                  </div>

                  <div className="entity-metrics">
                    <span>{contract.type === 'income' ? 'Receita mensal' : 'Despesa mensal'}</span>
                    <strong
                      className={
                        getSignedContractAmountInCents(contract) >= 0
                          ? 'amount-positive'
                          : 'amount-negative'
                      }
                    >
                      {formatCurrencyInCents(getSignedContractAmountInCents(contract))}
                    </strong>
                    <small>{contract.adjustments?.length ?? 0} reajuste(s) programado(s)</small>
                  </div>

                  {contract.adjustments && contract.adjustments.length > 0 ? (
                    <div className="sub-entity-list">
                      {contract.adjustments.map((adjustment) => (
                        <div className="sub-entity-item" key={adjustment.id}>
                          <strong>
                            {formatCurrencyInCents(
                              contract.type === 'income'
                                ? adjustment.amountInCents
                                : -adjustment.amountInCents,
                            )}
                          </strong>
                          <span>Efetivo em {formatDate(adjustment.effectiveStartDate)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="entity-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditing(contract)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => prepareAdjustment(contract)}
                      type="button"
                    >
                      Novo reajuste
                    </button>
                    <button
                      className="ghost-button"
                      onClick={() => prepareEnd(contract)}
                      type="button"
                    >
                      Preparar encerramento
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">Historico</div>
          <h3>Contratos inativos</h3>

          {inactiveContracts.length === 0 ? (
            <p>Nenhum contrato inativo ate o momento.</p>
          ) : (
            <div className="stack-list">
              {inactiveContracts.map((contract) => (
                <div className="entity-card" key={contract.id}>
                  <div>
                    <strong>{contract.name}</strong>
                    <span>
                      {contract.accountName} • {contract.category} • {contract.status}
                    </span>
                    <small>
                      Inicio {formatDate(contract.startDate)}
                      {contract.endDate ? ` • fim ${formatDate(contract.endDate)}` : ''}
                    </small>
                  </div>

                  <div className="entity-metrics">
                    <span>Ultimo valor conhecido</span>
                    <strong
                      className={
                        getSignedContractAmountInCents(contract) >= 0
                          ? 'amount-positive'
                          : 'amount-negative'
                      }
                    >
                      {formatCurrencyInCents(getSignedContractAmountInCents(contract))}
                    </strong>
                  </div>

                  <div className="entity-actions">
                    <button
                      className="ghost-button"
                      onClick={() => startEditing(contract)}
                      type="button"
                    >
                      Editar
                    </button>
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