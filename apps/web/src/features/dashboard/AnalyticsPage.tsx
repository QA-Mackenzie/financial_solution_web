import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';

import {
  initialCategoryDefinitions,
  type FinancialRecordFilter,
  type FinancialRecordListItem,
  type TagListItem,
} from '@shf/contracts';

import {
  formatCategoryLabel,
  formatCurrencyInCents,
  formatDate,
  formatMonthYear,
} from '../../lib/finance-format';
import {
  useAccountsSnapshotQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
  useFinancialAnalyticsQuery,
  useFinancialRecordsQuery,
  useTagsSnapshotQuery,
  useUpdateTagMutation,
} from '../finance/use-finance';

type FilterFormState = {
  accountId: string;
  category: string;
  entityId: string;
  entityKind: '' | 'account' | 'creditCard';
  fromDate: string;
  recordKind: '' | 'manualTransaction' | 'creditCardPurchase';
  tagId: string;
  toDate: string;
  type: '' | 'income' | 'expense';
};

const defaultFilters: FilterFormState = {
  accountId: '',
  category: '',
  entityId: '',
  entityKind: '',
  fromDate: '',
  recordKind: '',
  tagId: '',
  toDate: '',
  type: '',
};

const typeLabelByValue = {
  expense: 'Saída',
  income: 'Entrada',
} as const;

const recordKindLabelByValue = {
  creditCardPurchase: 'Compra no crédito',
  manualTransaction: 'Lançamento manual',
} as const;

const entityKindLabelByValue = {
  account: 'Conta',
  creditCard: 'Cartão',
} as const;

function buildAppliedFilters(values: FilterFormState): FinancialRecordFilter {
  return {
    accountId: values.accountId || undefined,
    category: values.category || undefined,
    entityId: values.entityId || undefined,
    entityKind: values.entityKind || undefined,
    fromDate: values.fromDate || undefined,
    recordKind: values.recordKind || undefined,
    tagId: values.tagId || undefined,
    toDate: values.toDate || undefined,
    type: values.type || undefined,
  };
}

function getRecordTagNames(record: FinancialRecordListItem) {
  if (record.tags.length === 0) {
    return 'Sem tags';
  }

  return record.tags.map((tag) => tag.name).join(', ');
}

function getTagUsageLabel(tag: TagListItem) {
  if (tag.usageCount === 0) {
    return 'Sem uso';
  }

  if (tag.usageCount === 1) {
    return '1 item vinculado';
  }

  return `${tag.usageCount} itens vinculados`;
}

export function AnalyticsPage() {
  const [filterForm, setFilterForm] = useState<FilterFormState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FinancialRecordFilter>({});
  const [editingTag, setEditingTag] = useState<TagListItem | null>(null);
  const [tagName, setTagName] = useState('');

  const accountsSnapshotQuery = useAccountsSnapshotQuery();
  const tagsSnapshotQuery = useTagsSnapshotQuery();
  const recordsQuery = useFinancialRecordsQuery(appliedFilters);
  const analyticsQuery = useFinancialAnalyticsQuery(appliedFilters);
  const createTagMutation = useCreateTagMutation();
  const updateTagMutation = useUpdateTagMutation();
  const deleteTagMutation = useDeleteTagMutation();

  const accounts = accountsSnapshotQuery.data?.activeAccounts ?? [];
  const tags = tagsSnapshotQuery.data?.tags ?? [];
  const recordsSnapshot = recordsQuery.data;
  const analyticsSnapshot = analyticsQuery.data;
  const entityOptions = analyticsSnapshot?.byEntity ?? [];
  const tagMutationError =
    createTagMutation.error ??
    updateTagMutation.error ??
    deleteTagMutation.error;

  function handleFilterFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setFilterForm((current) => {
      if (name === 'entityKind') {
        return {
          ...current,
          entityId: '',
          entityKind: value as FilterFormState['entityKind'],
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  }

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(buildAppliedFilters(filterForm));
  }

  function handleClearFilters() {
    setFilterForm(defaultFilters);
    setAppliedFilters({});
  }

  async function handleTagSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = tagName.trim();

    if (!normalizedName) {
      return;
    }

    if (editingTag) {
      await updateTagMutation.mutateAsync({
        id: editingTag.id,
        name: normalizedName,
      });
    } else {
      await createTagMutation.mutateAsync({
        name: normalizedName,
      });
    }

    setEditingTag(null);
    setTagName('');
  }

  function handleStartTagEdit(tag: TagListItem) {
    setEditingTag(tag);
    setTagName(tag.name);
  }

  function handleCancelTagEdit() {
    setEditingTag(null);
    setTagName('');
  }

  async function handleDeleteTag(tag: TagListItem) {
    await deleteTagMutation.mutateAsync(tag.id);

    if (editingTag?.id === tag.id) {
      handleCancelTagEdit();
    }
  }

  return (
    <section className="page-stack">
      <article className="dashboard-card hero-card">
        <div className="eyebrow">Analytics</div>
        <h2>Analytics financeiro consolidado</h2>
      </article>

      <div className="panel-grid panel-grid-3">
        <article className="dashboard-card summary-card">
          <div className="eyebrow">Escopo filtrado</div>
          <strong className="summary-amount">
            {formatCurrencyInCents(analyticsSnapshot?.netAmountInCents ?? 0)}
          </strong>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Registros</span>
              <strong>{analyticsSnapshot?.recordCount ?? 0}</strong>
            </div>
            <div className="stat-item">
              <span>Entradas</span>
              <strong>
                {formatCurrencyInCents(analyticsSnapshot?.totalIncomeInCents ?? 0)}
              </strong>
            </div>
            <div className="stat-item">
              <span>Saídas</span>
              <strong>
                {formatCurrencyInCents(
                  -1 * (analyticsSnapshot?.totalExpenseInCents ?? 0),
                )}
              </strong>
            </div>
          </div>
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Cobertura</div>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Contas ativas</strong>
              <span>{accounts.length}</span>
            </div>
            <div className="detail-item">
              <strong>Tags cadastradas</strong>
              <span>{tags.length}</span>
            </div>
            <div className="detail-item">
              <strong>Entidades no corte</strong>
              <span>{analyticsSnapshot?.byEntity.length ?? 0}</span>
            </div>
          </div>
        </article>

        <article className="dashboard-card summary-card">
          <div className="eyebrow">Leitura rápida</div>
          <div className="detail-list">
            <div className="detail-item">
              <strong>Maior categoria</strong>
              <span>
                {analyticsSnapshot?.byCategory[0]?.category
                  ? formatCategoryLabel(analyticsSnapshot.byCategory[0].category)
                  : '--'}
              </span>
            </div>
            <div className="detail-item">
              <strong>Tag dominante</strong>
              <span>{analyticsSnapshot?.byTag[0]?.tagName ?? '--'}</span>
            </div>
            <div className="detail-item">
              <strong>Último mês</strong>
              <span>
                {analyticsSnapshot?.byMonth[0]
                  ? formatMonthYear(analyticsSnapshot.byMonth[0].monthStart)
                  : '--'}
              </span>
            </div>
          </div>
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Filtros</div>
              <h3>Recorte analítico</h3>
            </div>
            <button className="ghost-button" onClick={handleClearFilters} type="button">
              Limpar filtros
            </button>
          </div>

          <form className="finance-form" onSubmit={handleApplyFilters}>
            <div className="filter-grid filter-grid-3">
              <label>
                <span>Conta</span>
                <select
                  name="accountId"
                  onChange={handleFilterFieldChange}
                  value={filterForm.accountId}
                >
                  <option value="">Todas</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tipo</span>
                <select
                  name="type"
                  onChange={handleFilterFieldChange}
                  value={filterForm.type}
                >
                  <option value="">Todos</option>
                  <option value="income">Entrada</option>
                  <option value="expense">Saída</option>
                </select>
              </label>

              <label>
                <span>Origem</span>
                <select
                  name="recordKind"
                  onChange={handleFilterFieldChange}
                  value={filterForm.recordKind}
                >
                  <option value="">Todas</option>
                  <option value="manualTransaction">Lançamento manual</option>
                  <option value="creditCardPurchase">Compra no crédito</option>
                </select>
              </label>

              <label>
                <span>Categoria</span>
                <select
                  name="category"
                  onChange={handleFilterFieldChange}
                  value={filterForm.category}
                >
                  <option value="">Todas</option>
                  {initialCategoryDefinitions.map((definition) => (
                    <option key={definition.label} value={definition.label}>
                      {definition.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tag</span>
                <select
                  name="tagId"
                  onChange={handleFilterFieldChange}
                  value={filterForm.tagId}
                >
                  <option value="">Todas</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tipo de entidade</span>
                <select
                  name="entityKind"
                  onChange={handleFilterFieldChange}
                  value={filterForm.entityKind}
                >
                  <option value="">Todas</option>
                  <option value="account">Conta</option>
                  <option value="creditCard">Cartão</option>
                </select>
              </label>

              <label>
                <span>Entidade</span>
                <select
                  disabled={!filterForm.entityKind}
                  name="entityId"
                  onChange={handleFilterFieldChange}
                  value={filterForm.entityId}
                >
                  <option value="">Todas</option>
                  {entityOptions
                    .filter(
                      (entity) =>
                        !filterForm.entityKind ||
                        entity.entityKind === filterForm.entityKind,
                    )
                    .map((entity) => (
                      <option key={entity.entityId} value={entity.entityId}>
                        {entity.entityName}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>De</span>
                <input
                  name="fromDate"
                  onChange={handleFilterFieldChange}
                  type="date"
                  value={filterForm.fromDate}
                />
              </label>

              <label>
                <span>Até</span>
                <input
                  name="toDate"
                  onChange={handleFilterFieldChange}
                  type="date"
                  value={filterForm.toDate}
                />
              </label>
            </div>

            <button disabled={recordsQuery.isFetching || analyticsQuery.isFetching} type="submit">
              {recordsQuery.isFetching || analyticsQuery.isFetching
                ? 'Atualizando...'
                : 'Aplicar filtros'}
            </button>
          </form>

          {recordsQuery.error ? (
            <div className="feedback feedback-error">{recordsQuery.error.message}</div>
          ) : null}
          {analyticsQuery.error ? (
            <div className="feedback feedback-error">{analyticsQuery.error.message}</div>
          ) : null}
        </article>

        <article className="dashboard-card form-card">
          <div className="section-heading-row">
            <div>
              <div className="eyebrow">Tags</div>
              <h3>{editingTag ? 'Editar tag' : 'Nova tag'}</h3>
            </div>
            {editingTag ? (
              <button className="ghost-button" onClick={handleCancelTagEdit} type="button">
                Cancelar edição
              </button>
            ) : null}
          </div>

          <form className="finance-form" onSubmit={handleTagSubmit}>
            <label>
              <span>Nome da tag</span>
              <input
                maxLength={40}
                onChange={(event) => setTagName(event.target.value)}
                placeholder="Ex.: familia, recorrente, viagem"
                value={tagName}
              />
            </label>

            {tagMutationError ? (
              <div className="feedback feedback-error">{tagMutationError.message}</div>
            ) : null}

            <button
              disabled={createTagMutation.isPending || updateTagMutation.isPending}
              type="submit"
            >
              {createTagMutation.isPending || updateTagMutation.isPending
                ? 'Salvando...'
                : editingTag
                  ? 'Atualizar tag'
                  : 'Criar tag'}
            </button>
          </form>

          {tagsSnapshotQuery.isLoading ? (
            <p>Carregando tags...</p>
          ) : tags.length === 0 ? (
            <p>Nenhuma tag cadastrada até o momento.</p>
          ) : (
            <div className="stack-list">
              {tags.map((tag) => (
                <div className="entity-card" key={tag.id}>
                  <div className="section-heading-row compact-row">
                    <div>
                      <strong>{tag.name}</strong>
                      <span>{getTagUsageLabel(tag)}</span>
                    </div>
                    <div className="entity-actions">
                      <button
                        className="ghost-button"
                        onClick={() => handleStartTagEdit(tag)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="ghost-button"
                        disabled={deleteTagMutation.isPending}
                        onClick={() => handleDeleteTag(tag)}
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="dashboard-card">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Registros</div>
            <h3>Preview do fluxo financeiro filtrado</h3>
          </div>
          <small className="helper-text">
            {recordsSnapshot?.appliedFilters.tagId
              ? 'Filtro por tag ativo.'
              : 'Sem filtro de tag ativo.'}
          </small>
        </div>

        {recordsQuery.isLoading ? (
          <p>Carregando registros...</p>
        ) : (recordsSnapshot?.records.length ?? 0) === 0 ? (
          <p>Nenhum registro encontrado para o recorte atual.</p>
        ) : (
          <div className="stack-list">
            {recordsSnapshot?.records.map((record) => (
              <div className="entity-card" key={`${record.recordKind}-${record.id}`}>
                <div className="section-heading-row compact-row">
                  <div>
                    <strong>{record.description}</strong>
                    <span>
                      {recordKindLabelByValue[record.recordKind]} •{' '}
                      {entityKindLabelByValue[record.entityKind]} {record.entityName}
                    </span>
                    <small>
                      {record.accountName} • {formatCategoryLabel(record.category)} • {formatDate(record.occurrenceDate)}
                    </small>
                  </div>
                  <div className="entity-metrics">
                    <span>{typeLabelByValue[record.type]}</span>
                    <strong
                      className={
                        record.signedAmountInCents >= 0
                          ? 'amount-positive'
                          : 'amount-negative'
                      }
                    >
                      {formatCurrencyInCents(record.signedAmountInCents)}
                    </strong>
                  </div>
                </div>

                <div className="tag-badge-row" title={getRecordTagNames(record)}>
                  {record.tags.length === 0 ? (
                    <span className="tag-badge tag-badge-muted">Sem tags</span>
                  ) : (
                    record.tags.map((tag) => (
                      <span className="tag-badge" key={tag.id}>
                        {tag.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </article>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="eyebrow">Categorias</div>
          <h3>Impacto por categoria</h3>

          {(analyticsSnapshot?.byCategory.length ?? 0) === 0 ? (
            <p>Nenhuma categoria encontrada para o recorte atual.</p>
          ) : (
            <div className="stack-list">
              {analyticsSnapshot?.byCategory.map((item) => (
                <div className="entity-card" key={item.category}>
                  <div className="section-heading-row compact-row">
                    <strong>{formatCategoryLabel(item.category)}</strong>
                    <strong>{formatCurrencyInCents(item.netAmountInCents)}</strong>
                  </div>
                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Registros</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Entradas</span>
                      <strong>{formatCurrencyInCents(item.incomeInCents)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Saídas</span>
                      <strong>{formatCurrencyInCents(-1 * item.expenseInCents)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">Tags</div>
          <h3>Impacto por tag</h3>

          {(analyticsSnapshot?.byTag.length ?? 0) === 0 ? (
            <p>Nenhuma tag usada nos registros do recorte atual.</p>
          ) : (
            <div className="stack-list">
              {analyticsSnapshot?.byTag.map((item) => (
                <div className="entity-card" key={item.tagId}>
                  <div className="section-heading-row compact-row">
                    <strong>{item.tagName}</strong>
                    <strong>{formatCurrencyInCents(item.netAmountInCents)}</strong>
                  </div>
                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Registros</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Entradas</span>
                      <strong>{formatCurrencyInCents(item.incomeInCents)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Saídas</span>
                      <strong>{formatCurrencyInCents(-1 * item.expenseInCents)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <div className="panel-grid panel-grid-2">
        <article className="dashboard-card">
          <div className="eyebrow">Entidades</div>
          <h3>Impacto por conta e cartão</h3>

          {(analyticsSnapshot?.byEntity.length ?? 0) === 0 ? (
            <p>Nenhuma entidade encontrada para o recorte atual.</p>
          ) : (
            <div className="stack-list">
              {analyticsSnapshot?.byEntity.map((item) => (
                <div className="entity-card" key={`${item.entityKind}-${item.entityId}`}>
                  <div className="section-heading-row compact-row">
                    <div>
                      <strong>{item.entityName}</strong>
                      <span>{entityKindLabelByValue[item.entityKind]}</span>
                    </div>
                    <strong>{formatCurrencyInCents(item.netAmountInCents)}</strong>
                  </div>
                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Registros</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Entradas</span>
                      <strong>{formatCurrencyInCents(item.incomeInCents)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Saídas</span>
                      <strong>{formatCurrencyInCents(-1 * item.expenseInCents)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card">
          <div className="eyebrow">Linha do tempo</div>
          <h3>Impacto mensal</h3>

          {(analyticsSnapshot?.byMonth.length ?? 0) === 0 ? (
            <p>Nenhum mês agregado para o recorte atual.</p>
          ) : (
            <div className="stack-list">
              {analyticsSnapshot?.byMonth.map((item) => (
                <div className="entity-card" key={item.monthStart}>
                  <div className="section-heading-row compact-row">
                    <strong>{formatMonthYear(item.monthStart)}</strong>
                    <strong>{formatCurrencyInCents(item.netAmountInCents)}</strong>
                  </div>
                  <div className="stats-grid stats-grid-inline">
                    <div className="stat-item">
                      <span>Registros</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Entradas</span>
                      <strong>{formatCurrencyInCents(item.incomeInCents)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Saídas</span>
                      <strong>{formatCurrencyInCents(-1 * item.expenseInCents)}</strong>
                    </div>
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
