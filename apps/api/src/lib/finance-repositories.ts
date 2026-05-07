import { randomUUID } from 'node:crypto';

import type {
  ArchiveAccountInput,
  Account,
  AccountListItem,
  AnticipateInstallmentPlanInput,
  CreditCard,
  CreditCardInvoice,
  CreditCardListItem,
  CreditCardPurchase,
  CreditCardPurchaseListItem,
  CreditCardsSnapshot,
  Contract,
  ContractAdjustment,
  ContractListItem,
  CreateAccountInput,
  CreateCreditCardInput,
  CreateCreditCardPurchaseInput,
  CreateContractAdjustmentInput,
  CreateContractInput,
  CreateInstallmentPlanInput,
  CreateProvisionInput,
  CreateTagInput,
  CreateTransactionInput,
  EndContractInput,
  HorizonSettings,
  InstallmentOperation,
  InstallmentPlan,
  InstallmentPlanListItem,
  InstallmentsSnapshot,
  ManualTransaction,
  Provision,
  ProvisionListItem,
  ProvisionsSnapshot,
  RedeemProvisionInput,
  RemoveVariableExpenseOverrideInput,
  Tag,
  TagListItem,
  UpdateInstallmentAnticipationInput,
  UpdateInstallmentPlanInput,
  UpdateProvisionInput,
  UpdateCreditCardInput,
  UpdateCreditCardPurchaseInput,
  UpdateContractInput,
  UpdateAccountInput,
  UpdateTransactionInput,
  TransactionListItem,
  VariableExpenseOverride,
  VariableExpenseOverrideListItem,
} from '@shf/contracts';
import {
  buildCreditCardInvoices,
  buildCreditCardPurchaseListItems,
  buildCurrentCreditCardCycle,
  buildCurrentCreditCardInvoicePreview,
  buildInstallmentOccurrenceListItems,
  buildProjectedInstallmentCreditCardPurchases,
  buildProjectedInstallmentOccurrences,
  buildProjectedCreditCardInvoiceOccurrences,
  sanitizeAccountInput,
  sanitizeInstallmentAnticipationInput,
  sanitizeInstallmentPlanInput,
  sanitizeProvisionInput,
  sanitizeCreditCardInput,
  sanitizeCreditCardPurchaseInput,
  sanitizeContractInput,
  sanitizeTagIds,
  sanitizeTagInput,
  sanitizeTransactionInput,
} from '@shf/domain-core';
import type { QueryResultRow } from 'pg';

import type { DatabaseClient, DatabaseExecutor } from './database';
import { AppError } from './errors';

export type UserSettings = {
  createdAt: string;
  currencyCode: string;
  horizonSettings: HorizonSettings;
  locale: string;
  updatedAt: string;
  userId: string;
};

export type UpsertUserSettingsInput = {
  currencyCode?: string;
  horizonSettings: HorizonSettings;
  locale?: string;
};

export type LegacyImportBatchStatus =
  | 'failed'
  | 'imported'
  | 'staged'
  | 'validated';

export type LegacyImportBatch = {
  createdAt: string;
  id: string;
  sourceChecksum: string;
  sourcePath: string;
  status: LegacyImportBatchStatus;
  summary: Record<string, unknown>;
  updatedAt: string;
  userId: string;
};

export type CreateLegacyImportBatchInput = {
  sourceChecksum: string;
  sourcePath: string;
  status?: LegacyImportBatchStatus;
  summary?: Record<string, unknown>;
};

export type LegacyImportRow = {
  batchId: string;
  id: string;
  payload: Record<string, unknown>;
  sourceRowId: string;
  sourceTable: string;
  stagedAt: string;
  userId: string;
};

export type StageLegacyImportRowInput = {
  payload: Record<string, unknown>;
  sourceRowId: string;
  sourceTable: string;
};

type UserSettingsRow = QueryResultRow & {
  created_at: Date | string;
  currency_code: string;
  horizon_settings: unknown;
  locale: string;
  updated_at: Date | string;
  user_id: string;
};

type AccountRow = QueryResultRow & {
  archived_at: Date | string | null;
  created_at: Date | string;
  current_balance_in_cents?: number | string;
  id: string;
  is_archived: boolean;
  name: string;
  opening_balance_in_cents: number | string;
  type: Account['type'];
  updated_at: Date | string;
  user_id: string;
};

type TagRow = QueryResultRow & {
  created_at: Date | string;
  id: string;
  name: string;
  updated_at: Date | string;
  usage_count?: number | string;
  user_id: string;
};

type ManualTransactionRow = QueryResultRow & {
  account_id: string;
  account_name?: string;
  amount_in_cents: number | string;
  category: string | null;
  created_at: Date | string;
  description: string;
  id: string;
  tag_ids?: string[] | null;
  transaction_date: Date | string;
  type: ManualTransaction['type'];
  updated_at: Date | string;
  user_id: string;
};

type ContractRow = QueryResultRow & {
  account_id: string;
  account_name?: string;
  amount_in_cents: number | string;
  category: string;
  created_at: Date | string;
  due_day: number | string;
  end_date: Date | string | null;
  id: string;
  name: string;
  start_date: Date | string;
  status: Contract['status'];
  type: Contract['type'];
  updated_at: Date | string;
  user_id: string;
};

type ContractAdjustmentRow = QueryResultRow & {
  amount_in_cents: number | string;
  contract_id: string;
  created_at: Date | string;
  effective_start_date: Date | string;
  id: string;
  user_id: string;
};

type CreditCardRow = QueryResultRow & {
  created_at: Date | string;
  credit_limit_in_cents: number | string;
  due_day: number | string;
  id: string;
  name: string;
  payment_account_id: string;
  payment_account_name?: string;
  statement_closing_day: number | string;
  updated_at: Date | string;
  user_id: string;
};

type CreditCardPurchaseRow = QueryResultRow & {
  amount_in_cents: number | string;
  category: string | null;
  created_at: Date | string;
  credit_card_id: string;
  credit_card_name?: string;
  description: string;
  due_day?: number | string;
  id: string;
  payment_account_id?: string;
  payment_account_name?: string;
  purchase_date: Date | string;
  statement_closing_day?: number | string;
  tag_ids?: string[] | null;
  updated_at: Date | string;
  user_id: string;
};

type InstallmentPlanRow = QueryResultRow & {
  account_id: string | null;
  account_name?: string | null;
  created_at: Date | string;
  credit_card_id: string | null;
  credit_card_name?: string | null;
  description: string;
  first_occurrence_date: Date | string;
  id: string;
  installment_count: number | string;
  payment_account_id?: string | null;
  payment_account_name?: string | null;
  source_type: InstallmentPlan['sourceType'];
  total_amount_in_cents: number | string;
  updated_at: Date | string;
  user_id: string;
};

type InstallmentOperationRow = QueryResultRow & {
  affected_amount_in_cents: number | string;
  affected_installment_count: number | string;
  created_at: Date | string;
  id: string;
  operation_date: Date | string;
  plan_id: string;
  type: InstallmentOperation['type'];
  user_id: string;
};

type ProvisionRow = QueryResultRow & {
  account_id: string;
  account_name?: string;
  category: string;
  created_at: Date | string;
  description: string;
  id: string;
  redeemed_at: Date | string | null;
  start_date: Date | string;
  status: Provision['status'];
  target_amount_in_cents: number | string;
  target_date: Date | string;
  updated_at: Date | string;
  user_id: string;
};

type VariableExpenseOverrideRow = QueryResultRow & {
  account_id: string;
  account_name?: string;
  amount_in_cents: number | string;
  created_at: Date | string;
  description: string;
  id: string;
  occurrence_date: Date | string;
  updated_at: Date | string;
  user_id: string;
};

type LegacyImportBatchRow = QueryResultRow & {
  created_at: Date | string;
  id: string;
  source_checksum: string;
  source_path: string;
  status: LegacyImportBatchStatus;
  summary: unknown;
  updated_at: Date | string;
  user_id: string;
};

type LegacyImportRowRecord = QueryResultRow & {
  batch_id: string;
  id: string;
  payload: unknown;
  source_row_id: string;
  source_table: string;
  staged_at: Date | string;
  user_id: string;
};

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);

  if (!Number.isNaN(parsed.valueOf())) {
    return parsed.toISOString();
  }

  return value;
}

function toDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date(value).toISOString().slice(0, 10);
}

function toNullableIsoString(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  return toIsoString(value);
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function parseObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    return JSON.parse(value) as Record<string, unknown>;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseHorizonSettings(value: unknown): HorizonSettings {
  const parsed = parseObject(value);

  return {
    safetyMarginInCents: toNumber(parsed.safetyMarginInCents as number | string),
    variableExpenseWindowInMonths: toNumber(
      parsed.variableExpenseWindowInMonths as number | string,
    ),
  };
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function assertOwnedAccount(
  database: DatabaseExecutor,
  userId: string,
  accountId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.accounts where user_id = $1 and id = $2',
    [userId, accountId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_ACCOUNT_NOT_FOUND',
      'Conta nao encontrada para o usuario autenticado.',
    );
  }
}

async function assertOwnedContract(
  database: DatabaseExecutor,
  userId: string,
  contractId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.recurring_contracts where user_id = $1 and id = $2',
    [userId, contractId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_CONTRACT_NOT_FOUND',
      'Contrato nao encontrado para o usuario autenticado.',
    );
  }
}

async function assertOwnedCreditCard(
  database: DatabaseExecutor,
  userId: string,
  creditCardId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.credit_cards where user_id = $1 and id = $2',
    [userId, creditCardId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_CREDIT_CARD_NOT_FOUND',
      'Cartao nao encontrado para o usuario autenticado.',
    );
  }
}

async function assertOwnedInstallmentPlan(
  database: DatabaseExecutor,
  userId: string,
  planId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.installment_plans where user_id = $1 and id = $2',
    [userId, planId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_INSTALLMENT_PLAN_NOT_FOUND',
      'Parcelamento nao encontrado para o usuario autenticado.',
    );
  }
}

async function assertOwnedInstallmentOperation(
  database: DatabaseExecutor,
  userId: string,
  operationId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.installment_operations where user_id = $1 and id = $2',
    [userId, operationId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_INSTALLMENT_OPERATION_NOT_FOUND',
      'Operacao de parcelamento nao encontrada para o usuario autenticado.',
    );
  }
}

async function assertOwnedProvision(
  database: DatabaseExecutor,
  userId: string,
  provisionId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from finance.provisions where user_id = $1 and id = $2',
    [userId, provisionId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'FINANCE_PROVISION_NOT_FOUND',
      'Provisao nao encontrada para o usuario autenticado.',
    );
  }
}

async function assertOwnedTags(
  database: DatabaseExecutor,
  userId: string,
  tagIds: readonly string[],
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }

  const placeholders = tagIds.map((_, index) => `$${index + 2}`).join(', ');
  const result = await database.query<{ id: string }>(
    `select id from finance.tags where user_id = $1 and id in (${placeholders})`,
    [userId, ...tagIds],
  );

  if ((result.rowCount ?? 0) !== tagIds.length) {
    throw new AppError(
      404,
      'FINANCE_TAG_NOT_FOUND',
      'Uma ou mais tags nao pertencem ao usuario autenticado.',
    );
  }
}

async function assertOwnedImportBatch(
  database: DatabaseExecutor,
  userId: string,
  batchId: string,
): Promise<void> {
  const result = await database.query<{ id: string }>(
    'select id from legacy_import.sqlite_import_batches where user_id = $1 and id = $2',
    [userId, batchId],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new AppError(
      404,
      'LEGACY_IMPORT_BATCH_NOT_FOUND',
      'Lote de importacao nao encontrado para o usuario autenticado.',
    );
  }
}

function mapUserSettings(row: UserSettingsRow): UserSettings {
  return {
    createdAt: toIsoString(row.created_at),
    currencyCode: row.currency_code,
    horizonSettings: parseHorizonSettings(row.horizon_settings),
    locale: row.locale,
    updatedAt: toIsoString(row.updated_at),
    userId: row.user_id,
  };
}

function mapAccount(row: AccountRow): Account {
  return {
    archivedAt: toNullableIsoString(row.archived_at),
    createdAt: toIsoString(row.created_at),
    id: row.id,
    isArchived: row.is_archived,
    name: row.name,
    openingBalanceInCents: toNumber(row.opening_balance_in_cents),
    type: row.type,
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAccountListItem(row: AccountRow): AccountListItem {
  return {
    ...mapAccount(row),
    currentBalanceInCents: toNumber(
      row.current_balance_in_cents ?? row.opening_balance_in_cents,
    ),
  };
}

function mapTag(row: TagRow): Tag {
  return {
    createdAt: toIsoString(row.created_at),
    id: row.id,
    name: row.name,
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapTagListItem(row: TagRow): TagListItem {
  return {
    ...mapTag(row),
    usageCount: toNumber(row.usage_count),
  };
}

function mapManualTransaction(row: ManualTransactionRow): ManualTransaction {
  const tagIds = (row.tag_ids ?? []).filter(
    (tagId): tagId is string => typeof tagId === 'string' && tagId.length > 0,
  );

  return {
    accountId: row.account_id,
    amountInCents: toNumber(row.amount_in_cents),
    category: row.category ?? undefined,
    createdAt: toIsoString(row.created_at),
    description: row.description,
    id: row.id,
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    transactionDate: toDateOnly(row.transaction_date),
    type: row.type,
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapContract(row: ContractRow): Contract {
  return {
    accountId: row.account_id,
    amountInCents: toNumber(row.amount_in_cents),
    category: row.category,
    createdAt: toIsoString(row.created_at),
    dueDay: toNumber(row.due_day),
    endDate: row.end_date ? toDateOnly(row.end_date) : null,
    id: row.id,
    name: row.name,
    startDate: toDateOnly(row.start_date),
    status: row.status,
    type: row.type,
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapContractAdjustment(
  row: ContractAdjustmentRow,
): ContractAdjustment {
  return {
    amountInCents: toNumber(row.amount_in_cents),
    contractId: row.contract_id,
    createdAt: toIsoString(row.created_at),
    effectiveStartDate: toDateOnly(row.effective_start_date),
    id: row.id,
  };
}

function mapContractListItem(
  row: ContractRow,
  adjustments: ContractAdjustment[] = [],
): ContractListItem {
  return {
    ...mapContract(row),
    accountName: row.account_name ?? '',
    adjustments,
  };
}

function mapCreditCard(row: CreditCardRow): CreditCard {
  return {
    createdAt: toIsoString(row.created_at),
    creditLimitInCents: toNumber(row.credit_limit_in_cents),
    dueDay: toNumber(row.due_day),
    id: row.id,
    name: row.name,
    paymentAccountId: row.payment_account_id,
    statementClosingDay: toNumber(row.statement_closing_day),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapCreditCardPurchase(row: CreditCardPurchaseRow): CreditCardPurchase {
  const tagIds = (row.tag_ids ?? []).filter(
    (tagId): tagId is string => typeof tagId === 'string' && tagId.length > 0,
  );

  return {
    amountInCents: toNumber(row.amount_in_cents),
    category: row.category ?? undefined,
    createdAt: toIsoString(row.created_at),
    creditCardId: row.credit_card_id,
    description: row.description,
    id: row.id,
    purchaseDate: toDateOnly(row.purchase_date),
    tagIds: tagIds.length > 0 ? tagIds : undefined,
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapCreditCardBillingCardFromCardRow(
  row: CreditCardRow,
): Pick<
  CreditCardListItem,
  | 'id'
  | 'name'
  | 'statementClosingDay'
  | 'dueDay'
  | 'paymentAccountId'
  | 'paymentAccountName'
> {
  return {
    dueDay: toNumber(row.due_day),
    id: row.id,
    name: row.name,
    paymentAccountId: row.payment_account_id,
    paymentAccountName: row.payment_account_name ?? '',
    statementClosingDay: toNumber(row.statement_closing_day),
  };
}

function mapCreditCardBillingCardFromPurchaseRow(
  row: CreditCardPurchaseRow,
): Pick<
  CreditCardListItem,
  | 'id'
  | 'name'
  | 'statementClosingDay'
  | 'dueDay'
  | 'paymentAccountId'
  | 'paymentAccountName'
> {
  return {
    dueDay: toNumber(row.due_day),
    id: row.credit_card_id,
    name: row.credit_card_name ?? '',
    paymentAccountId: row.payment_account_id ?? '',
    paymentAccountName: row.payment_account_name ?? '',
    statementClosingDay: toNumber(row.statement_closing_day),
  };
}

function buildCreditCardsSnapshotFromRows(
  cardRows: CreditCardRow[],
  purchaseRows: CreditCardPurchaseRow[],
  currentDate?: string,
): CreditCardsSnapshot {
  if (cardRows.length === 0) {
    return {
      cards: [],
      invoices: [],
      projectedInvoices: [],
      purchases: [],
      totalCreditLimitInCents: 0,
      totalInvoiceAmountInCents: 0,
    };
  }

  const billingCards = cardRows.map(mapCreditCardBillingCardFromCardRow);
  const purchases = buildCreditCardPurchaseListItems(
    billingCards,
    purchaseRows.map(mapCreditCardPurchase),
  );
  const invoices = buildCreditCardInvoices(purchases, currentDate);
  const projectedInvoices = buildProjectedCreditCardInvoiceOccurrences(
    invoices,
    currentDate,
  );
  const invoicesById = invoices.reduce<Map<string, CreditCardInvoice>>((map, invoice) => {
    map.set(invoice.id, invoice);

    return map;
  }, new Map<string, CreditCardInvoice>());
  const cards = cardRows.map((row) => {
    const card = mapCreditCard(row);
    const currentCycle = buildCurrentCreditCardCycle(card, currentDate);
    const currentInvoicePreview = buildCurrentCreditCardInvoicePreview(card, currentDate);

    return {
      ...card,
      currentCycle,
      currentInvoice: {
        ...currentInvoicePreview,
        totalAmountInCents:
          invoicesById.get(currentInvoicePreview.id)?.totalAmountInCents ?? 0,
      },
      paymentAccountName: row.payment_account_name ?? '',
    } satisfies CreditCardListItem;
  });

  return {
    cards,
    invoices,
    projectedInvoices,
    purchases,
    totalCreditLimitInCents: cards.reduce(
      (sum, card) => sum + card.creditLimitInCents,
      0,
    ),
    totalInvoiceAmountInCents: invoices.reduce(
      (sum, invoice) => sum + invoice.totalAmountInCents,
      0,
    ),
  };
}

function mapInstallmentPlan(row: InstallmentPlanRow): InstallmentPlanListItem {
  return {
    accountId: row.account_id,
    accountName: row.account_name ?? null,
    createdAt: toIsoString(row.created_at),
    creditCardId: row.credit_card_id,
    creditCardName: row.credit_card_name ?? null,
    description: row.description,
    firstOccurrenceDate: toDateOnly(row.first_occurrence_date),
    id: row.id,
    installmentCount: toNumber(row.installment_count),
    paymentAccountId: row.payment_account_id ?? null,
    paymentAccountName: row.payment_account_name ?? null,
    sourceType: row.source_type,
    totalAmountInCents: toNumber(row.total_amount_in_cents),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapInstallmentOperation(
  row: InstallmentOperationRow,
): InstallmentOperation {
  return {
    affectedAmountInCents: toNumber(row.affected_amount_in_cents),
    affectedInstallmentCount: toNumber(row.affected_installment_count),
    createdAt: toIsoString(row.created_at),
    id: row.id,
    operationDate: toDateOnly(row.operation_date),
    planId: row.plan_id,
    type: row.type,
  };
}

function buildInstallmentsSnapshotFromRows(
  planRows: InstallmentPlanRow[],
  operationRows: InstallmentOperationRow[],
  currentDate?: string,
): InstallmentsSnapshot {
  if (planRows.length === 0) {
    return {
      occurrences: [],
      operations: [],
      plans: [],
      projectedAccountOccurrences: [],
      projectedCreditCardPurchases: [],
      totalRemainingAmountInCents: 0,
    };
  }

  const plans = planRows.map(mapInstallmentPlan);
  const operations = operationRows.map(mapInstallmentOperation);
  const occurrences = buildInstallmentOccurrenceListItems(plans, operations);
  const projectedAccountOccurrences = buildProjectedInstallmentOccurrences(
    occurrences,
    currentDate,
  );
  const projectedCreditCardPurchases =
    buildProjectedInstallmentCreditCardPurchases(occurrences, currentDate);

  return {
    occurrences,
    operations,
    plans,
    projectedAccountOccurrences,
    projectedCreditCardPurchases,
    totalRemainingAmountInCents:
      projectedAccountOccurrences.reduce(
        (sum, occurrence) => sum + occurrence.amountInCents,
        0,
      ) +
      projectedCreditCardPurchases.reduce(
        (sum, purchase) => sum + purchase.amountInCents,
        0,
      ),
  };
}

  function mapProvision(row: ProvisionRow): Provision {
    return {
      accountId: row.account_id,
      category: row.category,
      createdAt: toIsoString(row.created_at),
      description: row.description,
      id: row.id,
      redeemedAt: row.redeemed_at ? toDateOnly(row.redeemed_at) : null,
      startDate: toDateOnly(row.start_date),
      status: row.status,
      targetAmountInCents: toNumber(row.target_amount_in_cents),
      targetDate: toDateOnly(row.target_date),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  function mapProvisionListItem(row: ProvisionRow): ProvisionListItem {
    return {
      ...mapProvision(row),
      accountName: row.account_name ?? '',
    };
  }

  function buildProvisionsSnapshotFromRows(rows: ProvisionRow[]): ProvisionsSnapshot {
    const listItems = rows.map(mapProvisionListItem);
    const activeProvisions = listItems
      .filter((provision) => provision.status === 'active')
      .sort((left, right) =>
        left.targetDate.localeCompare(right.targetDate) ||
        left.description.localeCompare(right.description),
      );
    const redeemedProvisions = listItems
      .filter((provision) => provision.status === 'redeemed')
      .sort((left, right) =>
        (right.redeemedAt ?? right.targetDate).localeCompare(
          left.redeemedAt ?? left.targetDate,
        ) || left.description.localeCompare(right.description),
      );

    return {
      activeProvisions,
      redeemedProvisions,
      totalActiveTargetAmountInCents: activeProvisions.reduce(
        (sum, provision) => sum + provision.targetAmountInCents,
        0,
      ),
    };
  }

  function mapVariableExpenseOverride(
    row: VariableExpenseOverrideRow,
  ): VariableExpenseOverrideListItem {
    return {
      accountId: row.account_id,
      accountName: row.account_name ?? '',
      amountInCents: toNumber(row.amount_in_cents),
      createdAt: toIsoString(row.created_at),
      description: row.description,
      id: row.id,
      occurrenceDate: toDateOnly(row.occurrence_date),
      updatedAt: toIsoString(row.updated_at),
    };
  }

function mapTransactionListItem(row: ManualTransactionRow): TransactionListItem {
  const transaction = mapManualTransaction(row);
  const signedAmountInCents =
    transaction.type === 'expense'
      ? -transaction.amountInCents
      : transaction.amountInCents;

  return {
    ...transaction,
    accountName: row.account_name ?? '',
    signedAmountInCents,
  };
}

function mapLegacyImportBatch(row: LegacyImportBatchRow): LegacyImportBatch {
  return {
    createdAt: toIsoString(row.created_at),
    id: row.id,
    sourceChecksum: row.source_checksum,
    sourcePath: row.source_path,
    status: row.status,
    summary: parseObject(row.summary),
    updatedAt: toIsoString(row.updated_at),
    userId: row.user_id,
  };
}

function mapLegacyImportRow(row: LegacyImportRowRecord): LegacyImportRow {
  return {
    batchId: row.batch_id,
    id: row.id,
    payload: parseObject(row.payload),
    sourceRowId: row.source_row_id,
    sourceTable: row.source_table,
    stagedAt: toIsoString(row.staged_at),
    userId: row.user_id,
  };
}

function buildManualTransactionsSelect(whereClause: string) {
  return `select mt.id,
                 mt.user_id,
                 mt.account_id,
                 mt.type,
                 mt.description,
                 mt.category,
                 mt.amount_in_cents,
                 mt.transaction_date,
                 mt.created_at,
                 mt.updated_at,
                 a.name as account_name,
                 array_agg(mtt.tag_id order by mtt.tag_id) as tag_ids
          from finance.manual_transactions mt
          join finance.accounts a
            on a.user_id = mt.user_id
           and a.id = mt.account_id
          left join finance.manual_transaction_tags mtt
            on mtt.user_id = mt.user_id
           and mtt.manual_transaction_id = mt.id
          ${whereClause}
          group by mt.id,
                   mt.user_id,
                   mt.account_id,
                   mt.type,
                   mt.description,
                   mt.category,
                   mt.amount_in_cents,
                   mt.transaction_date,
                   mt.created_at,
                   mt.updated_at,
                   a.name`;
}

function buildCreditCardsSelect(whereClause: string) {
  return `select cc.id,
                 cc.user_id,
                 cc.name,
                 cc.credit_limit_in_cents,
                 cc.statement_closing_day,
                 cc.due_day,
                 cc.payment_account_id,
                 cc.created_at,
                 cc.updated_at,
                 a.name as payment_account_name
          from finance.credit_cards cc
          join finance.accounts a
            on a.user_id = cc.user_id
           and a.id = cc.payment_account_id
          ${whereClause}`;
}

function buildCreditCardPurchasesSelect(whereClause: string) {
  return `select ccp.id,
                 ccp.user_id,
                 ccp.credit_card_id,
                 ccp.description,
                 ccp.category,
                 ccp.amount_in_cents,
                 ccp.purchase_date,
                 ccp.created_at,
                 ccp.updated_at,
                 cc.name as credit_card_name,
                 cc.statement_closing_day,
                 cc.due_day,
                 cc.payment_account_id,
                 a.name as payment_account_name,
                 array_agg(ccpt.tag_id order by ccpt.tag_id) as tag_ids
          from finance.credit_card_purchases ccp
          join finance.credit_cards cc
            on cc.user_id = ccp.user_id
           and cc.id = ccp.credit_card_id
          join finance.accounts a
            on a.user_id = cc.user_id
           and a.id = cc.payment_account_id
          left join finance.credit_card_purchase_tags ccpt
            on ccpt.user_id = ccp.user_id
           and ccpt.credit_card_purchase_id = ccp.id
          ${whereClause}
          group by ccp.id,
                   ccp.user_id,
                   ccp.credit_card_id,
                   ccp.description,
                   ccp.category,
                   ccp.amount_in_cents,
                   ccp.purchase_date,
                   ccp.created_at,
                   ccp.updated_at,
                   cc.name,
                   cc.statement_closing_day,
                   cc.due_day,
                   cc.payment_account_id,
                   a.name`;
}

function buildInstallmentsSelect(whereClause: string) {
  return `select ip.id,
                 ip.user_id,
                 ip.source_type,
                 ip.account_id,
                 ip.credit_card_id,
                 ip.description,
                 ip.total_amount_in_cents,
                 ip.installment_count,
                 ip.first_occurrence_date,
                 ip.created_at,
                 ip.updated_at,
                 a.name as account_name,
                 cc.name as credit_card_name,
                 cc.payment_account_id,
                 pa.name as payment_account_name
          from finance.installment_plans ip
          left join finance.accounts a
            on a.user_id = ip.user_id
           and a.id = ip.account_id
          left join finance.credit_cards cc
            on cc.user_id = ip.user_id
           and cc.id = ip.credit_card_id
          left join finance.accounts pa
            on pa.user_id = cc.user_id
           and pa.id = cc.payment_account_id
          ${whereClause}`;
}

function buildInstallmentOperationsSelect(whereClause: string) {
  return `select io.id,
                 io.user_id,
                 io.installment_plan_id as plan_id,
                 io.type,
                 io.operation_date,
                 io.affected_installment_count,
                 io.affected_amount_in_cents,
                 io.created_at
          from finance.installment_operations io
          ${whereClause}`;
}

function buildProvisionsSelect(whereClause: string) {
  return `select p.id,
                 p.user_id,
                 p.account_id,
                 p.description,
                 p.category,
                 p.target_amount_in_cents,
                 p.start_date,
                 p.target_date,
                 p.status,
                 p.redeemed_at,
                 p.created_at,
                 p.updated_at,
                 a.name as account_name
          from finance.provisions p
          join finance.accounts a
            on a.user_id = p.user_id
           and a.id = p.account_id
          ${whereClause}`;
}

function buildVariableExpenseOverridesSelect(whereClause: string) {
  return `select veo.id,
                 veo.user_id,
                 veo.account_id,
                 veo.description,
                 veo.occurrence_date,
                 veo.amount_in_cents,
                 veo.created_at,
                 veo.updated_at,
                 a.name as account_name
          from finance.variable_expense_overrides veo
          join finance.accounts a
            on a.user_id = veo.user_id
           and a.id = veo.account_id
          ${whereClause}`;
}

export class UserSettingsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async getByUserId(userId: string): Promise<UserSettings | null> {
    const result = await this.database.query<UserSettingsRow>(
      `select user_id,
              currency_code,
              locale,
              horizon_settings,
              created_at,
              updated_at
         from finance.user_settings
        where user_id = $1`,
      [userId],
    );

    return result.rows[0] ? mapUserSettings(result.rows[0]) : null;
  }

  async upsert(
    userId: string,
    input: UpsertUserSettingsInput,
    now = new Date(),
  ): Promise<UserSettings> {
    const nowIsoString = now.toISOString();
    const result = await this.database.query<UserSettingsRow>(
      `insert into finance.user_settings (
         user_id,
         currency_code,
         locale,
         horizon_settings,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6)
       on conflict (user_id) do update
       set currency_code = excluded.currency_code,
           locale = excluded.locale,
           horizon_settings = excluded.horizon_settings,
           updated_at = excluded.updated_at
       returning user_id,
                 currency_code,
                 locale,
                 horizon_settings,
                 created_at,
                 updated_at`,
      [
        userId,
        input.currencyCode ?? 'BRL',
        input.locale ?? 'pt-BR',
        JSON.stringify(input.horizonSettings),
        nowIsoString,
        nowIsoString,
      ],
    );

    return mapUserSettings(result.rows[0]);
  }
}

export class AccountsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateAccountInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Account> {
    const sanitizedInput = sanitizeAccountInput(input);
    const nowIsoString = now.toISOString();
    const result = await database.query<AccountRow>(
      `insert into finance.accounts (
         id,
         user_id,
         name,
         type,
         opening_balance_in_cents,
         is_archived,
         archived_at,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, false, null, $6, $7)
       returning id,
                 user_id,
                 name,
                 type,
                 opening_balance_in_cents,
                 is_archived,
                 archived_at,
                 created_at,
                 updated_at`,
      [
        randomUUID(),
        userId,
        sanitizedInput.name,
        sanitizedInput.type,
        sanitizedInput.openingBalanceInCents,
        nowIsoString,
        nowIsoString,
      ],
    );

    return mapAccount(result.rows[0]);
  }

  async update(
    userId: string,
    input: UpdateAccountInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Account> {
    const sanitizedInput = sanitizeAccountInput(input);
    const nowIsoString = now.toISOString();
    const result = await database.query<AccountRow>(
      `update finance.accounts
          set name = $3,
              type = $4,
              opening_balance_in_cents = $5,
              updated_at = $6
        where user_id = $1 and id = $2
        returning id,
                  user_id,
                  name,
                  type,
                  opening_balance_in_cents,
                  is_archived,
                  archived_at,
                  created_at,
                  updated_at`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.name,
        sanitizedInput.type,
        sanitizedInput.openingBalanceInCents,
        nowIsoString,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_ACCOUNT_NOT_FOUND',
        'Conta nao encontrada para o usuario autenticado.',
      );
    }

    return mapAccount(result.rows[0]);
  }

  async archive(
    userId: string,
    input: ArchiveAccountInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Account> {
    const nowIsoString = now.toISOString();
    const result = await database.query<AccountRow>(
      `update finance.accounts
          set is_archived = true,
              archived_at = coalesce(archived_at, $3),
              updated_at = $3
        where user_id = $1 and id = $2
        returning id,
                  user_id,
                  name,
                  type,
                  opening_balance_in_cents,
                  is_archived,
                  archived_at,
                  created_at,
                  updated_at`,
      [userId, input.id, nowIsoString],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_ACCOUNT_NOT_FOUND',
        'Conta nao encontrada para o usuario autenticado.',
      );
    }

    return mapAccount(result.rows[0]);
  }

  async findById(userId: string, accountId: string): Promise<Account | null> {
    const result = await this.database.query<AccountRow>(
      `select id,
              user_id,
              name,
              type,
              opening_balance_in_cents,
              is_archived,
              archived_at,
              created_at,
              updated_at
         from finance.accounts
        where user_id = $1 and id = $2`,
      [userId, accountId],
    );

    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async listByUserId(userId: string): Promise<AccountListItem[]> {
    const result = await this.database.query<AccountRow>(
      `select a.id,
              a.user_id,
              a.name,
              a.type,
              a.opening_balance_in_cents,
              a.is_archived,
              a.archived_at,
              a.created_at,
              a.updated_at,
              a.opening_balance_in_cents + coalesce(
                sum(
                  case
                    when mt.type = 'income' then mt.amount_in_cents
                    else -mt.amount_in_cents
                  end
                ),
                0
              ) as current_balance_in_cents
         from finance.accounts a
         left join finance.manual_transactions mt
           on mt.user_id = a.user_id
          and mt.account_id = a.id
        where a.user_id = $1
        group by a.id,
                 a.user_id,
                 a.name,
                 a.type,
                 a.opening_balance_in_cents,
                 a.is_archived,
                 a.archived_at,
                 a.created_at,
                 a.updated_at
        order by a.is_archived asc, a.name asc`,
      [userId],
    );

    return result.rows.map(mapAccountListItem);
  }
}

export class ContractsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateContractInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Contract> {
    const sanitizedInput = sanitizeContractInput(input);
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, sanitizedInput.accountId);

    const result = await database.query<ContractRow>(
      `insert into finance.recurring_contracts (
         id,
         user_id,
         account_id,
         name,
         category,
         type,
         amount_in_cents,
         due_day,
         start_date,
         end_date,
         status,
         payload,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, null, $10, $11, $12, $13)
       returning id,
                 user_id,
                 account_id,
                 name,
                 category,
                 type,
                 amount_in_cents,
                 due_day,
                 start_date,
                 end_date,
                 status,
                 created_at,
                 updated_at`,
      [
        randomUUID(),
        userId,
        sanitizedInput.accountId,
        sanitizedInput.name,
        sanitizedInput.category,
        sanitizedInput.type,
        sanitizedInput.amountInCents,
        sanitizedInput.dueDay,
        sanitizedInput.startDate,
        sanitizedInput.status,
        JSON.stringify({}),
        nowIsoString,
        nowIsoString,
      ],
    );

    return mapContract(result.rows[0]);
  }

  async update(
    userId: string,
    input: UpdateContractInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Contract> {
    const sanitizedInput = sanitizeContractInput(input);
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, sanitizedInput.accountId);

    const result = await database.query<ContractRow>(
      `update finance.recurring_contracts
          set account_id = $3,
              name = $4,
              category = $5,
              type = $6,
              amount_in_cents = $7,
              due_day = $8,
              start_date = $9,
              status = $10,
              updated_at = $11
        where user_id = $1 and id = $2
        returning id,
                  user_id,
                  account_id,
                  name,
                  category,
                  type,
                  amount_in_cents,
                  due_day,
                  start_date,
                  end_date,
                  status,
                  created_at,
                  updated_at`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.accountId,
        sanitizedInput.name,
        sanitizedInput.category,
        sanitizedInput.type,
        sanitizedInput.amountInCents,
        sanitizedInput.dueDay,
        sanitizedInput.startDate,
        sanitizedInput.status,
        nowIsoString,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_CONTRACT_NOT_FOUND',
        'Contrato nao encontrado para o usuario autenticado.',
      );
    }

    return mapContract(result.rows[0]);
  }

  async createAdjustment(
    userId: string,
    input: CreateContractAdjustmentInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<ContractAdjustment> {
    const nowIsoString = now.toISOString();

    await assertOwnedContract(database, userId, input.contractId);

    const result = await database.query<ContractAdjustmentRow>(
      `insert into finance.recurring_contract_adjustments (
         id,
         user_id,
         recurring_contract_id,
         amount_in_cents,
         effective_start_date,
         payload,
         created_at
       ) values ($1, $2, $3, $4, $5, $6, $7)
       returning id,
                 user_id,
                 recurring_contract_id as contract_id,
                 amount_in_cents,
                 effective_start_date,
                 created_at`,
      [
        randomUUID(),
        userId,
        input.contractId,
        input.amountInCents,
        input.effectiveStartDate,
        JSON.stringify({}),
        nowIsoString,
      ],
    );

    return mapContractAdjustment(result.rows[0]);
  }

  async end(
    userId: string,
    input: EndContractInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<Contract> {
    const nowIsoString = now.toISOString();
    const result = await database.query<ContractRow>(
      `update finance.recurring_contracts
          set end_date = $3,
              updated_at = $4
        where user_id = $1 and id = $2
        returning id,
                  user_id,
                  account_id,
                  name,
                  category,
                  type,
                  amount_in_cents,
                  due_day,
                  start_date,
                  end_date,
                  status,
                  created_at,
                  updated_at`,
      [userId, input.contractId, input.endDate, nowIsoString],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_CONTRACT_NOT_FOUND',
        'Contrato nao encontrado para o usuario autenticado.',
      );
    }

    return mapContract(result.rows[0]);
  }

  async findById(
    userId: string,
    contractId: string,
    database: DatabaseExecutor = this.database,
  ): Promise<ContractListItem | null> {
    const result = await database.query<ContractRow>(
      `select c.id,
              c.user_id,
              c.account_id,
              a.name as account_name,
              c.name,
              c.category,
              c.type,
              c.amount_in_cents,
              c.due_day,
              c.start_date,
              c.end_date,
              c.status,
              c.created_at,
              c.updated_at
         from finance.recurring_contracts c
         inner join finance.accounts a
           on a.user_id = c.user_id
          and a.id = c.account_id
        where c.user_id = $1 and c.id = $2`,
      [userId, contractId],
    );

    const contractRow = result.rows[0];

    if (!contractRow) {
      return null;
    }

    const adjustments = await database.query<ContractAdjustmentRow>(
      `select id,
              user_id,
              recurring_contract_id as contract_id,
              amount_in_cents,
              effective_start_date,
              created_at
         from finance.recurring_contract_adjustments
        where user_id = $1 and recurring_contract_id = $2
        order by effective_start_date asc, created_at asc, id asc`,
      [userId, contractId],
    );

    return mapContractListItem(
      contractRow,
      adjustments.rows.map(mapContractAdjustment),
    );
  }

  async listByUserId(userId: string): Promise<ContractListItem[]> {
    const result = await this.database.query<ContractRow>(
      `select c.id,
              c.user_id,
              c.account_id,
              a.name as account_name,
              c.name,
              c.category,
              c.type,
              c.amount_in_cents,
              c.due_day,
              c.start_date,
              c.end_date,
              c.status,
              c.created_at,
              c.updated_at
         from finance.recurring_contracts c
         inner join finance.accounts a
           on a.user_id = c.user_id
          and a.id = c.account_id
        where c.user_id = $1
        order by c.status asc, c.due_day asc, c.name asc`,
      [userId],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const contractIds = result.rows.map((row) => row.id);
    const placeholders = contractIds.map((_, index) => `$${index + 2}`).join(', ');
    const adjustments = await this.database.query<ContractAdjustmentRow>(
      `select id,
              user_id,
              recurring_contract_id as contract_id,
              amount_in_cents,
              effective_start_date,
              created_at
         from finance.recurring_contract_adjustments
        where user_id = $1 and recurring_contract_id in (${placeholders})
        order by effective_start_date asc, created_at asc, id asc`,
      [userId, ...contractIds],
    );
    const adjustmentsByContractId = adjustments.rows.reduce<
      Map<string, ContractAdjustment[]>
    >((map, row) => {
      const contractAdjustments = map.get(row.contract_id) ?? [];
      contractAdjustments.push(mapContractAdjustment(row));
      map.set(row.contract_id, contractAdjustments);

      return map;
    }, new Map<string, ContractAdjustment[]>());

    return result.rows.map((row) =>
      mapContractListItem(row, adjustmentsByContractId.get(row.id) ?? []),
    );
  }
}

export class ProvisionsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateProvisionInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<ProvisionListItem> {
    const sanitizedInput = sanitizeProvisionInput(input);
    const id = randomUUID();
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, sanitizedInput.accountId);

    await database.query(
      `insert into finance.provisions (
         id,
         user_id,
         account_id,
         description,
         category,
         target_amount_in_cents,
         start_date,
         target_date,
         status,
         redeemed_at,
         payload,
         created_at,
         updated_at
       ) values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         'active',
         null,
         '{}'::jsonb,
         $9,
         $9
       )`,
      [
        id,
        userId,
        sanitizedInput.accountId,
        sanitizedInput.description,
        sanitizedInput.category,
        sanitizedInput.targetAmountInCents,
        sanitizedInput.startDate,
        sanitizedInput.targetDate,
        nowIsoString,
      ],
    );

    const provision = await this.findById(userId, id, database);

    if (!provision) {
      throw new AppError(
        500,
        'FINANCE_PROVISION_CREATE_FAILED',
        'Falha ao criar provisao.',
      );
    }

    return provision;
  }

  async update(
    userId: string,
    input: UpdateProvisionInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<ProvisionListItem> {
    const sanitizedInput = sanitizeProvisionInput(input);
    const nowIsoString = now.toISOString();

    await assertOwnedProvision(database, userId, sanitizedInput.id);
    await assertOwnedAccount(database, userId, sanitizedInput.accountId);

    const result = await database.query<{ id: string }>(
      `update finance.provisions
          set account_id = $3,
              description = $4,
              category = $5,
              target_amount_in_cents = $6,
              start_date = $7,
              target_date = $8,
              status = 'active',
              redeemed_at = null,
              updated_at = $9
        where user_id = $1 and id = $2
        returning id`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.accountId,
        sanitizedInput.description,
        sanitizedInput.category,
        sanitizedInput.targetAmountInCents,
        sanitizedInput.startDate,
        sanitizedInput.targetDate,
        nowIsoString,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_PROVISION_NOT_FOUND',
        'Provisao nao encontrada para o usuario autenticado.',
      );
    }

    const provision = await this.findById(userId, sanitizedInput.id, database);

    if (!provision) {
      throw new AppError(
        500,
        'FINANCE_PROVISION_UPDATE_FAILED',
        'Falha ao atualizar provisao.',
      );
    }

    return provision;
  }

  async redeem(
    userId: string,
    input: RedeemProvisionInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<ProvisionListItem> {
    await assertOwnedProvision(database, userId, input.provisionId);

    const result = await database.query<{ id: string }>(
      `update finance.provisions
          set status = 'redeemed',
              redeemed_at = $3,
              updated_at = $4
        where user_id = $1 and id = $2
        returning id`,
      [userId, input.provisionId, input.redeemedAt, now.toISOString()],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_PROVISION_NOT_FOUND',
        'Provisao nao encontrada para o usuario autenticado.',
      );
    }

    const provision = await this.findById(userId, input.provisionId, database);

    if (!provision) {
      throw new AppError(
        500,
        'FINANCE_PROVISION_REDEEM_FAILED',
        'Falha ao resgatar provisao.',
      );
    }

    return provision;
  }

  async findById(
    userId: string,
    provisionId: string,
    database: DatabaseExecutor = this.database,
  ): Promise<ProvisionListItem | null> {
    const result = await database.query<ProvisionRow>(
      `${buildProvisionsSelect('where p.user_id = $1 and p.id = $2')}
       order by p.target_date asc, p.description asc`,
      [userId, provisionId],
    );

    const row = result.rows[0];

    return row ? mapProvisionListItem(row) : null;
  }

  async listByUserId(userId: string): Promise<ProvisionListItem[]> {
    const result = await this.database.query<ProvisionRow>(
      `${buildProvisionsSelect('where p.user_id = $1')}
       order by p.status asc, p.target_date asc, p.description asc`,
      [userId],
    );

    return result.rows.map(mapProvisionListItem);
  }

  async getSnapshot(userId: string): Promise<ProvisionsSnapshot> {
    const result = await this.database.query<ProvisionRow>(
      `${buildProvisionsSelect('where p.user_id = $1')}
       order by p.status asc, p.target_date asc, p.description asc`,
      [userId],
    );

    return buildProvisionsSnapshotFromRows(result.rows);
  }
}

export class VariableExpenseOverridesRepository {
  constructor(private readonly database: DatabaseClient) {}

  async upsert(
    userId: string,
    input: VariableExpenseOverride,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<VariableExpenseOverrideListItem> {
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, input.accountId);

    const existing = await this.findByNaturalKey(userId, input, database);

    if (existing) {
      await database.query(
        `update finance.variable_expense_overrides
            set amount_in_cents = $5,
                updated_at = $6
          where user_id = $1
            and account_id = $2
            and description = $3
            and occurrence_date = $4`,
        [
          userId,
          input.accountId,
          input.description,
          input.occurrenceDate,
          input.amountInCents,
          nowIsoString,
        ],
      );

      const updated = await this.findById(userId, existing.id, database);

      if (!updated) {
        throw new AppError(
          500,
          'FINANCE_VARIABLE_EXPENSE_OVERRIDE_UPDATE_FAILED',
          'Falha ao atualizar override de despesa variavel.',
        );
      }

      return updated;
    }

    const id = randomUUID();
    await database.query(
      `insert into finance.variable_expense_overrides (
         id,
         user_id,
         account_id,
         description,
         occurrence_date,
         amount_in_cents,
         payload,
         created_at,
         updated_at
       ) values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         '{}'::jsonb,
         $7,
         $7
       )`,
      [
        id,
        userId,
        input.accountId,
        input.description,
        input.occurrenceDate,
        input.amountInCents,
        nowIsoString,
      ],
    );

    const created = await this.findById(userId, id, database);

    if (!created) {
      throw new AppError(
        500,
        'FINANCE_VARIABLE_EXPENSE_OVERRIDE_CREATE_FAILED',
        'Falha ao criar override de despesa variavel.',
      );
    }

    return created;
  }

  async remove(
    userId: string,
    input: RemoveVariableExpenseOverrideInput,
    database: DatabaseExecutor = this.database,
  ): Promise<VariableExpenseOverrideListItem> {
    const existing = await this.findByNaturalKey(userId, input, database);

    if (!existing) {
      throw new AppError(
        404,
        'FINANCE_VARIABLE_EXPENSE_OVERRIDE_NOT_FOUND',
        'Override de despesa variavel nao encontrado para o usuario autenticado.',
      );
    }

    await database.query(
      `delete from finance.variable_expense_overrides
        where user_id = $1
          and account_id = $2
          and description = $3
          and occurrence_date = $4`,
      [userId, input.accountId, input.description, input.occurrenceDate],
    );

    return existing;
  }

  async findById(
    userId: string,
    overrideId: string,
    database: DatabaseExecutor = this.database,
  ): Promise<VariableExpenseOverrideListItem | null> {
    const result = await database.query<VariableExpenseOverrideRow>(
      `${buildVariableExpenseOverridesSelect(
        'where veo.user_id = $1 and veo.id = $2',
      )}
       order by veo.occurrence_date asc, veo.description asc`,
      [userId, overrideId],
    );

    const row = result.rows[0];

    return row ? mapVariableExpenseOverride(row) : null;
  }

  async findByNaturalKey(
    userId: string,
    input: Pick<
      VariableExpenseOverride,
      'accountId' | 'description' | 'occurrenceDate'
    >,
    database: DatabaseExecutor = this.database,
  ): Promise<VariableExpenseOverrideListItem | null> {
    const result = await database.query<VariableExpenseOverrideRow>(
      `${buildVariableExpenseOverridesSelect(
        'where veo.user_id = $1 and veo.account_id = $2 and veo.description = $3 and veo.occurrence_date = $4',
      )}
       order by veo.occurrence_date asc, veo.description asc`,
      [userId, input.accountId, input.description, input.occurrenceDate],
    );

    const row = result.rows[0];

    return row ? mapVariableExpenseOverride(row) : null;
  }

  async listByUserId(userId: string): Promise<VariableExpenseOverrideListItem[]> {
    const result = await this.database.query<VariableExpenseOverrideRow>(
      `${buildVariableExpenseOverridesSelect('where veo.user_id = $1')}
       order by veo.occurrence_date asc, veo.description asc`,
      [userId],
    );

    return result.rows.map(mapVariableExpenseOverride);
  }
}

export class InstallmentsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateInstallmentPlanInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<InstallmentPlanListItem> {
    const sanitizedInput = sanitizeInstallmentPlanInput(input);
    const nowIsoString = now.toISOString();

    if (sanitizedInput.sourceType === 'account') {
      await assertOwnedAccount(database, userId, sanitizedInput.accountId!);
    } else {
      await assertOwnedCreditCard(database, userId, sanitizedInput.creditCardId!);
    }

    const planId = randomUUID();

    await database.query(
      `insert into finance.installment_plans (
         id,
         user_id,
         source_type,
         account_id,
         credit_card_id,
         description,
         total_amount_in_cents,
         installment_count,
         first_occurrence_date,
         payload,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, '{}'::jsonb, $10, $11)`,
      [
        planId,
        userId,
        sanitizedInput.sourceType,
        sanitizedInput.sourceType === 'account' ? sanitizedInput.accountId! : null,
        sanitizedInput.sourceType === 'creditCard'
          ? sanitizedInput.creditCardId!
          : null,
        sanitizedInput.description,
        sanitizedInput.totalAmountInCents,
        sanitizedInput.installmentCount,
        sanitizedInput.firstOccurrenceDate,
        nowIsoString,
        nowIsoString,
      ],
    );

    return (await this.findById(userId, planId, database))!;
  }

  async update(
    userId: string,
    input: UpdateInstallmentPlanInput,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<InstallmentPlanListItem> {
    const sanitizedInput = sanitizeInstallmentPlanInput(input);
    const nowIsoString = now.toISOString();

    if (sanitizedInput.sourceType === 'account') {
      await assertOwnedAccount(database, userId, sanitizedInput.accountId!);
    } else {
      await assertOwnedCreditCard(database, userId, sanitizedInput.creditCardId!);
    }

    const result = await database.query(
      `update finance.installment_plans
          set source_type = $3,
              account_id = $4,
              credit_card_id = $5,
              description = $6,
              total_amount_in_cents = $7,
              installment_count = $8,
              first_occurrence_date = $9,
              updated_at = $10
        where user_id = $1 and id = $2`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.sourceType,
        sanitizedInput.sourceType === 'account' ? sanitizedInput.accountId! : null,
        sanitizedInput.sourceType === 'creditCard'
          ? sanitizedInput.creditCardId!
          : null,
        sanitizedInput.description,
        sanitizedInput.totalAmountInCents,
        sanitizedInput.installmentCount,
        sanitizedInput.firstOccurrenceDate,
        nowIsoString,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_INSTALLMENT_PLAN_NOT_FOUND',
        'Parcelamento nao encontrado para o usuario autenticado.',
      );
    }

    return (await this.findById(userId, sanitizedInput.id, database))!;
  }

  async anticipate(
    userId: string,
    input: AnticipateInstallmentPlanInput,
    now = new Date(),
    database?: DatabaseExecutor,
  ): Promise<InstallmentOperation> {
    const sanitizedInput = sanitizeInstallmentAnticipationInput(input);

    if (database) {
      return this.createAnticipationWithinTransaction(
        database,
        userId,
        sanitizedInput,
        now,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.createAnticipationWithinTransaction(
        transaction,
        userId,
        sanitizedInput,
        now,
      ),
    );
  }

  async updateAnticipation(
    userId: string,
    input: UpdateInstallmentAnticipationInput,
    database?: DatabaseExecutor,
  ): Promise<InstallmentOperation> {
    const sanitizedInput = sanitizeInstallmentAnticipationInput(input);

    if (database) {
      return this.updateAnticipationWithinTransaction(
        database,
        userId,
        sanitizedInput,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.updateAnticipationWithinTransaction(
        transaction,
        userId,
        sanitizedInput,
      ),
    );
  }

  async findById(
    userId: string,
    planId: string,
    database: DatabaseExecutor = this.database,
  ): Promise<InstallmentPlanListItem | null> {
    const result = await database.query<InstallmentPlanRow>(
      `${buildInstallmentsSelect('where ip.user_id = $1 and ip.id = $2')}`,
      [userId, planId],
    );

    return result.rows[0] ? mapInstallmentPlan(result.rows[0]) : null;
  }

  async findOperationById(
    userId: string,
    operationId: string,
    database: DatabaseExecutor = this.database,
  ): Promise<InstallmentOperation | null> {
    const result = await database.query<InstallmentOperationRow>(
      `${buildInstallmentOperationsSelect('where io.user_id = $1 and io.id = $2')}`,
      [userId, operationId],
    );

    return result.rows[0] ? mapInstallmentOperation(result.rows[0]) : null;
  }

  async listByUserId(userId: string): Promise<InstallmentPlanListItem[]> {
    const result = await this.database.query<InstallmentPlanRow>(
      `${buildInstallmentsSelect('where ip.user_id = $1')}
       order by ip.first_occurrence_date asc, ip.description asc`,
      [userId],
    );

    return result.rows.map(mapInstallmentPlan);
  }

  async listOperationsByUserId(userId: string): Promise<InstallmentOperation[]> {
    const result = await this.database.query<InstallmentOperationRow>(
      `${buildInstallmentOperationsSelect('where io.user_id = $1')}
       order by io.operation_date desc, io.created_at desc, io.id desc`,
      [userId],
    );

    return result.rows.map(mapInstallmentOperation);
  }

  async getSnapshot(
    userId: string,
    currentDate: string,
  ): Promise<InstallmentsSnapshot> {
    const [planRows, operationRows] = await Promise.all([
      this.database.query<InstallmentPlanRow>(
        `${buildInstallmentsSelect('where ip.user_id = $1')}
         order by ip.first_occurrence_date asc, ip.description asc`,
        [userId],
      ),
      this.database.query<InstallmentOperationRow>(
        `${buildInstallmentOperationsSelect('where io.user_id = $1')}
         order by io.operation_date asc, io.created_at asc, io.id asc`,
        [userId],
      ),
    ]);

    return buildInstallmentsSnapshotFromRows(
      planRows.rows,
      operationRows.rows,
      currentDate,
    );
  }

  private async createAnticipationWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: AnticipateInstallmentPlanInput,
    now: Date,
  ): Promise<InstallmentOperation> {
    const anticipation = await this.prepareAnticipation(
      transaction,
      userId,
      sanitizedInput,
    );
    const operationId = randomUUID();
    const nowIsoString = now.toISOString();

    await transaction.query(
      `insert into finance.installment_operations (
         id,
         user_id,
         installment_plan_id,
         type,
         operation_date,
         affected_installment_count,
         affected_amount_in_cents,
         payload,
         created_at
       ) values ($1, $2, $3, 'anticipation', $4, $5, $6, '{}'::jsonb, $7)`,
      [
        operationId,
        userId,
        anticipation.planId,
        sanitizedInput.operationDate,
        anticipation.affectedInstallmentCount,
        anticipation.affectedAmountInCents,
        nowIsoString,
      ],
    );

    return (await this.findOperationById(userId, operationId, transaction))!;
  }

  private async updateAnticipationWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: UpdateInstallmentAnticipationInput,
  ): Promise<InstallmentOperation> {
    await assertOwnedInstallmentOperation(transaction, userId, sanitizedInput.id);

    const anticipation = await this.prepareAnticipation(
      transaction,
      userId,
      sanitizedInput,
      sanitizedInput.id,
    );

    await transaction.query(
      `update finance.installment_operations
          set installment_plan_id = $3,
              operation_date = $4,
              affected_installment_count = $5,
              affected_amount_in_cents = $6
        where user_id = $1 and id = $2`,
      [
        userId,
        sanitizedInput.id,
        anticipation.planId,
        sanitizedInput.operationDate,
        anticipation.affectedInstallmentCount,
        anticipation.affectedAmountInCents,
      ],
    );

    return (await this.findOperationById(
      userId,
      sanitizedInput.id,
      transaction,
    ))!;
  }

  private async prepareAnticipation(
    transaction: DatabaseExecutor,
    userId: string,
    input:
      | AnticipateInstallmentPlanInput
      | UpdateInstallmentAnticipationInput,
    excludedOperationId?: string,
  ): Promise<{
    affectedAmountInCents: number;
    affectedInstallmentCount: number;
    planId: string;
  }> {
    await assertOwnedInstallmentPlan(transaction, userId, input.planId);

    const planRows = await transaction.query<InstallmentPlanRow>(
      `${buildInstallmentsSelect('where ip.user_id = $1 and ip.id = $2')}`,
      [userId, input.planId],
    );
    const operationRows = await transaction.query<InstallmentOperationRow>(
      `${buildInstallmentOperationsSelect(
        excludedOperationId
          ? 'where io.user_id = $1 and io.installment_plan_id = $2 and io.id <> $3'
          : 'where io.user_id = $1 and io.installment_plan_id = $2',
      )}
       order by io.operation_date asc, io.created_at asc, io.id asc`,
      excludedOperationId
        ? [userId, input.planId, excludedOperationId]
        : [userId, input.planId],
    );

    const snapshot = buildInstallmentsSnapshotFromRows(
      planRows.rows,
      operationRows.rows,
    );
    const eligibleOccurrences = snapshot.occurrences
      .filter((occurrence) => occurrence.occurrenceDate > input.operationDate)
      .sort(
        (left, right) =>
          left.occurrenceDate.localeCompare(right.occurrenceDate) ||
          left.installmentNumber - right.installmentNumber ||
          left.id.localeCompare(right.id),
      );

    if (eligibleOccurrences.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', [
        {
          field: 'operationDate',
          message:
            'Nao existem parcelas restantes elegiveis para antecipacao nessa data.',
        },
      ]);
    }

    if (input.affectedInstallmentCount > eligibleOccurrences.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', [
        {
          field: 'affectedInstallmentCount',
          message:
            'A quantidade informada excede as parcelas restantes elegiveis para antecipacao.',
        },
      ]);
    }

    const affectedOccurrences = eligibleOccurrences.slice(
      0,
      input.affectedInstallmentCount,
    );

    return {
      affectedAmountInCents: affectedOccurrences.reduce(
        (sum, occurrence) => sum + occurrence.amountInCents,
        0,
      ),
      affectedInstallmentCount: input.affectedInstallmentCount,
      planId: input.planId,
    };
  }
}

export class CreditCardsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateCreditCardInput,
    currentDate: string,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<CreditCardListItem> {
    const sanitizedInput = sanitizeCreditCardInput(input);
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, sanitizedInput.paymentAccountId);

    await database.query(
      `insert into finance.credit_cards (
         id,
         user_id,
         name,
         normalized_name,
         credit_limit_in_cents,
         statement_closing_day,
         due_day,
         payment_account_id,
         payload,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $10)`,
      [
        randomUUID(),
        userId,
        sanitizedInput.name,
        normalizeName(sanitizedInput.name),
        sanitizedInput.creditLimitInCents,
        sanitizedInput.statementClosingDay,
        sanitizedInput.dueDay,
        sanitizedInput.paymentAccountId,
        nowIsoString,
        nowIsoString,
      ],
    );

    const result = await database.query<CreditCardRow>(
      `${buildCreditCardsSelect('where cc.user_id = $1 and cc.normalized_name = $2')}`,
      [userId, normalizeName(sanitizedInput.name)],
    );

    return buildCreditCardsSnapshotFromRows(result.rows, [], currentDate).cards[0]!;
  }

  async update(
    userId: string,
    input: UpdateCreditCardInput,
    currentDate: string,
    now = new Date(),
    database: DatabaseExecutor = this.database,
  ): Promise<CreditCardListItem> {
    const sanitizedInput = sanitizeCreditCardInput(input);
    const nowIsoString = now.toISOString();

    await assertOwnedAccount(database, userId, sanitizedInput.paymentAccountId);

    const result = await database.query(
      `update finance.credit_cards
          set name = $3,
              normalized_name = $4,
              credit_limit_in_cents = $5,
              statement_closing_day = $6,
              due_day = $7,
              payment_account_id = $8,
              updated_at = $9
      where user_id = $1 and id = $2`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.name,
        normalizeName(sanitizedInput.name),
        sanitizedInput.creditLimitInCents,
        sanitizedInput.statementClosingDay,
        sanitizedInput.dueDay,
        sanitizedInput.paymentAccountId,
        nowIsoString,
      ],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_CREDIT_CARD_NOT_FOUND',
        'Cartao nao encontrado para o usuario autenticado.',
      );
    }

    const cardRows = await database.query<CreditCardRow>(
      `${buildCreditCardsSelect('where cc.user_id = $1 and cc.id = $2')}`,
      [userId, sanitizedInput.id],
    );

    const purchaseRows = await database.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect(
        'where ccp.user_id = $1 and ccp.credit_card_id = $2',
      )}`,
      [userId, sanitizedInput.id],
    );

    return buildCreditCardsSnapshotFromRows(
      cardRows.rows,
      purchaseRows.rows,
      currentDate,
    ).cards[0]!;
  }

  async createPurchase(
    userId: string,
    input: CreateCreditCardPurchaseInput,
    now = new Date(),
    database?: DatabaseExecutor,
  ): Promise<CreditCardPurchaseListItem> {
    const sanitizedInput = sanitizeCreditCardPurchaseInput(input);
    const tagIds = sanitizeTagIds(sanitizedInput.tagIds);

    if (database) {
      return this.createPurchaseWithinTransaction(
        database,
        userId,
        sanitizedInput,
        tagIds,
        now,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.createPurchaseWithinTransaction(
        transaction,
        userId,
        sanitizedInput,
        tagIds,
        now,
      ),
    );
  }

  async updatePurchase(
    userId: string,
    input: UpdateCreditCardPurchaseInput,
    now = new Date(),
    database?: DatabaseExecutor,
  ): Promise<CreditCardPurchaseListItem> {
    const sanitizedInput = sanitizeCreditCardPurchaseInput(input);
    const tagIds = sanitizeTagIds(sanitizedInput.tagIds);

    if (database) {
      return this.updatePurchaseWithinTransaction(
        database,
        userId,
        sanitizedInput,
        tagIds,
        now,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.updatePurchaseWithinTransaction(
        transaction,
        userId,
        sanitizedInput,
        tagIds,
        now,
      ),
    );
  }

  async findById(
    userId: string,
    creditCardId: string,
    currentDate: string,
    database: DatabaseExecutor = this.database,
  ): Promise<CreditCardListItem | null> {
    const cardRows = await database.query<CreditCardRow>(
      `${buildCreditCardsSelect('where cc.user_id = $1 and cc.id = $2')}`,
      [userId, creditCardId],
    );

    if (cardRows.rows.length === 0) {
      return null;
    }

    const purchaseRows = await database.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect(
        'where ccp.user_id = $1 and ccp.credit_card_id = $2',
      )}`,
      [userId, creditCardId],
    );

    return buildCreditCardsSnapshotFromRows(
      cardRows.rows,
      purchaseRows.rows,
      currentDate,
    ).cards[0] ?? null;
  }

  async findPurchaseById(
    userId: string,
    purchaseId: string,
  ): Promise<CreditCardPurchaseListItem | null> {
    const result = await this.database.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect('where ccp.user_id = $1 and ccp.id = $2')}`,
      [userId, purchaseId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const purchase = result.rows[0]!;

    return buildCreditCardPurchaseListItems(
      [mapCreditCardBillingCardFromPurchaseRow(purchase)],
      [mapCreditCardPurchase(purchase)],
    )[0] ?? null;
  }

  async listByUserId(userId: string, currentDate: string): Promise<CreditCardListItem[]> {
    const snapshot = await this.getSnapshot(userId, currentDate);

    return snapshot.cards;
  }

  async listPurchasesByUserId(userId: string): Promise<CreditCardPurchaseListItem[]> {
    const result = await this.database.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect('where ccp.user_id = $1')}
       order by ccp.purchase_date desc, ccp.created_at desc`,
      [userId],
    );

    if (result.rows.length === 0) {
      return [];
    }

    const cardsById = result.rows.reduce<
      Map<
        string,
        Pick<
          CreditCardListItem,
          | 'id'
          | 'name'
          | 'statementClosingDay'
          | 'dueDay'
          | 'paymentAccountId'
          | 'paymentAccountName'
        >
      >
    >((map, row) => {
      map.set(row.credit_card_id, mapCreditCardBillingCardFromPurchaseRow(row));

      return map;
    }, new Map());

    return buildCreditCardPurchaseListItems(
      [...cardsById.values()],
      result.rows.map(mapCreditCardPurchase),
    );
  }

  async getSnapshot(userId: string, currentDate: string): Promise<CreditCardsSnapshot> {
    const [cardRows, purchaseRows] = await Promise.all([
      this.database.query<CreditCardRow>(
        `${buildCreditCardsSelect('where cc.user_id = $1')}
         order by cc.name asc`,
        [userId],
      ),
      this.database.query<CreditCardPurchaseRow>(
        `${buildCreditCardPurchasesSelect('where ccp.user_id = $1')}
         order by ccp.purchase_date desc, ccp.created_at desc`,
        [userId],
      ),
    ]);

    return buildCreditCardsSnapshotFromRows(
      cardRows.rows,
      purchaseRows.rows,
      currentDate,
    );
  }

  private async createPurchaseWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: CreateCreditCardPurchaseInput,
    tagIds: readonly string[],
    now: Date,
  ): Promise<CreditCardPurchaseListItem> {
    await assertOwnedCreditCard(transaction, userId, sanitizedInput.creditCardId);
    await assertOwnedTags(transaction, userId, tagIds);

    const purchaseId = randomUUID();
    const nowIsoString = now.toISOString();
    await transaction.query(
      `insert into finance.credit_card_purchases (
         id,
         user_id,
         credit_card_id,
         description,
         category,
         amount_in_cents,
         purchase_date,
         installment_count,
         payload,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, 1, '{}'::jsonb, $8, $9)`,
      [
        purchaseId,
        userId,
        sanitizedInput.creditCardId,
        sanitizedInput.description,
        sanitizedInput.category ?? null,
        sanitizedInput.amountInCents,
        sanitizedInput.purchaseDate,
        nowIsoString,
        nowIsoString,
      ],
    );

    for (const tagId of tagIds) {
      await transaction.query(
        `insert into finance.credit_card_purchase_tags (
           user_id,
           credit_card_purchase_id,
           tag_id,
           created_at
         ) values ($1, $2, $3, $4)`,
        [userId, purchaseId, tagId, nowIsoString],
      );
    }

    const created = await transaction.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect('where ccp.user_id = $1 and ccp.id = $2')}`,
      [userId, purchaseId],
    );
    const createdPurchase = created.rows[0]!;

    return buildCreditCardPurchaseListItems(
      [mapCreditCardBillingCardFromPurchaseRow(createdPurchase)],
      [mapCreditCardPurchase(createdPurchase)],
    )[0]!;
  }

  private async updatePurchaseWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: UpdateCreditCardPurchaseInput,
    tagIds: readonly string[],
    now: Date,
  ): Promise<CreditCardPurchaseListItem> {
    const existing = await transaction.query<{ id: string }>(
      'select id from finance.credit_card_purchases where user_id = $1 and id = $2',
      [userId, sanitizedInput.id],
    );

    if ((existing.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_CREDIT_CARD_PURCHASE_NOT_FOUND',
        'Compra no cartao nao encontrada para o usuario autenticado.',
      );
    }

    await assertOwnedCreditCard(transaction, userId, sanitizedInput.creditCardId);
    await assertOwnedTags(transaction, userId, tagIds);

    await transaction.query(
      `update finance.credit_card_purchases
          set credit_card_id = $3,
              description = $4,
              category = $5,
              amount_in_cents = $6,
              purchase_date = $7,
              updated_at = $8
        where user_id = $1 and id = $2`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.creditCardId,
        sanitizedInput.description,
        sanitizedInput.category ?? null,
        sanitizedInput.amountInCents,
        sanitizedInput.purchaseDate,
        now.toISOString(),
      ],
    );

    await transaction.query(
      'delete from finance.credit_card_purchase_tags where user_id = $1 and credit_card_purchase_id = $2',
      [userId, sanitizedInput.id],
    );

    for (const tagId of tagIds) {
      await transaction.query(
        `insert into finance.credit_card_purchase_tags (
           user_id,
           credit_card_purchase_id,
           tag_id,
           created_at
         ) values ($1, $2, $3, $4)`,
        [userId, sanitizedInput.id, tagId, now.toISOString()],
      );
    }

    const updated = await transaction.query<CreditCardPurchaseRow>(
      `${buildCreditCardPurchasesSelect('where ccp.user_id = $1 and ccp.id = $2')}`,
      [userId, sanitizedInput.id],
    );
    const updatedPurchase = updated.rows[0]!;

    return buildCreditCardPurchaseListItems(
      [mapCreditCardBillingCardFromPurchaseRow(updatedPurchase)],
      [mapCreditCardPurchase(updatedPurchase)],
    )[0]!;
  }
}

export class TagsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(userId: string, input: CreateTagInput, now = new Date()): Promise<Tag> {
    const sanitizedInput = sanitizeTagInput(input);
    const normalizedName = normalizeName(sanitizedInput.name);
    const existing = await this.database.query<{ id: string }>(
      'select id from finance.tags where user_id = $1 and normalized_name = $2',
      [userId, normalizedName],
    );

    if ((existing.rowCount ?? 0) > 0) {
      throw new AppError(
        409,
        'FINANCE_DUPLICATE_TAG',
        'Ja existe uma tag com este nome para o usuario autenticado.',
      );
    }

    const nowIsoString = now.toISOString();
    const result = await this.database.query<TagRow>(
      `insert into finance.tags (
         id,
         user_id,
         name,
         normalized_name,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6)
       returning id, user_id, name, created_at, updated_at`,
      [
        randomUUID(),
        userId,
        sanitizedInput.name,
        normalizedName,
        nowIsoString,
        nowIsoString,
      ],
    );

    return mapTag(result.rows[0]);
  }

  async findById(userId: string, tagId: string): Promise<Tag | null> {
    const result = await this.database.query<TagRow>(
      `select id, user_id, name, created_at, updated_at
         from finance.tags
        where user_id = $1 and id = $2`,
      [userId, tagId],
    );

    return result.rows[0] ? mapTag(result.rows[0]) : null;
  }

  async listByUserId(userId: string): Promise<TagListItem[]> {
    const result = await this.database.query<TagRow>(
      `select t.id,
              t.user_id,
              t.name,
              t.created_at,
              t.updated_at,
              (
                count(distinct mtt.manual_transaction_id)
                + count(distinct rct.recurring_contract_id)
                + count(distinct ccpt.credit_card_purchase_id)
              )::text as usage_count
         from finance.tags t
         left join finance.manual_transaction_tags mtt
           on mtt.user_id = t.user_id
          and mtt.tag_id = t.id
         left join finance.recurring_contract_tags rct
           on rct.user_id = t.user_id
          and rct.tag_id = t.id
         left join finance.credit_card_purchase_tags ccpt
           on ccpt.user_id = t.user_id
          and ccpt.tag_id = t.id
        where t.user_id = $1
        group by t.id, t.user_id, t.name, t.created_at, t.updated_at
        order by t.name asc`,
      [userId],
    );

    return result.rows.map(mapTagListItem);
  }
}

export class ManualTransactionsRepository {
  constructor(private readonly database: DatabaseClient) {}

  async create(
    userId: string,
    input: CreateTransactionInput,
    now = new Date(),
    database?: DatabaseExecutor,
  ): Promise<ManualTransaction> {
    const sanitizedInput = sanitizeTransactionInput(input);
    const tagIds = sanitizeTagIds(sanitizedInput.tagIds);

    if (database) {
      return this.createWithinTransaction(
        database,
        userId,
        sanitizedInput,
        tagIds,
        now,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.createWithinTransaction(transaction, userId, sanitizedInput, tagIds, now),
    );
  }

  async update(
    userId: string,
    input: UpdateTransactionInput,
    now = new Date(),
    database?: DatabaseExecutor,
  ): Promise<ManualTransaction> {
    const sanitizedInput = sanitizeTransactionInput(input);
    const tagIds = sanitizeTagIds(sanitizedInput.tagIds);

    if (database) {
      return this.updateWithinTransaction(
        database,
        userId,
        sanitizedInput,
        tagIds,
        now,
      );
    }

    return this.database.runInTransaction((transaction) =>
      this.updateWithinTransaction(transaction, userId, sanitizedInput, tagIds, now),
    );
  }

  async delete(
    userId: string,
    transactionId: string,
    database?: DatabaseExecutor,
  ): Promise<ManualTransaction> {
    if (database) {
      return this.deleteWithinTransaction(database, userId, transactionId);
    }

    return this.database.runInTransaction((transaction) =>
      this.deleteWithinTransaction(transaction, userId, transactionId),
    );
  }

  private async createWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: CreateTransactionInput,
    tagIds: readonly string[],
    now: Date,
  ): Promise<ManualTransaction> {
    await assertOwnedAccount(transaction, userId, sanitizedInput.accountId);
    await assertOwnedTags(transaction, userId, tagIds);

    const transactionId = randomUUID();
    const nowIsoString = now.toISOString();
    await transaction.query(
      `insert into finance.manual_transactions (
         id,
         user_id,
         account_id,
         type,
         description,
         category,
         amount_in_cents,
         transaction_date,
         payload,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, $9, $10)`,
      [
        transactionId,
        userId,
        sanitizedInput.accountId,
        sanitizedInput.type,
        sanitizedInput.description,
        sanitizedInput.category ?? null,
        sanitizedInput.amountInCents,
        sanitizedInput.transactionDate,
        nowIsoString,
        nowIsoString,
      ],
    );

    for (const tagId of tagIds) {
      await transaction.query(
        `insert into finance.manual_transaction_tags (
           user_id,
           manual_transaction_id,
           tag_id,
           created_at
         ) values ($1, $2, $3, $4)`,
        [userId, transactionId, tagId, nowIsoString],
      );
    }

    const created = await transaction.query<ManualTransactionRow>(
      `${buildManualTransactionsSelect(
        'where mt.user_id = $1 and mt.id = $2',
      )}`,
      [userId, transactionId],
    );

    return mapManualTransaction(created.rows[0]);
  }

  private async updateWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    sanitizedInput: UpdateTransactionInput,
    tagIds: readonly string[],
    now: Date,
  ): Promise<ManualTransaction> {
    const existing = await transaction.query<{ id: string }>(
      'select id from finance.manual_transactions where user_id = $1 and id = $2',
      [userId, sanitizedInput.id],
    );

    if ((existing.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_TRANSACTION_NOT_FOUND',
        'Lancamento nao encontrado para o usuario autenticado.',
      );
    }

    await assertOwnedAccount(transaction, userId, sanitizedInput.accountId);
    await assertOwnedTags(transaction, userId, tagIds);

    await transaction.query(
      `update finance.manual_transactions
          set account_id = $3,
              type = $4,
              description = $5,
              category = $6,
              amount_in_cents = $7,
              transaction_date = $8,
              updated_at = $9
        where user_id = $1 and id = $2`,
      [
        userId,
        sanitizedInput.id,
        sanitizedInput.accountId,
        sanitizedInput.type,
        sanitizedInput.description,
        sanitizedInput.category ?? null,
        sanitizedInput.amountInCents,
        sanitizedInput.transactionDate,
        now.toISOString(),
      ],
    );

    await transaction.query(
      'delete from finance.manual_transaction_tags where user_id = $1 and manual_transaction_id = $2',
      [userId, sanitizedInput.id],
    );

    for (const tagId of tagIds) {
      await transaction.query(
        `insert into finance.manual_transaction_tags (
           user_id,
           manual_transaction_id,
           tag_id,
           created_at
         ) values ($1, $2, $3, $4)`,
        [userId, sanitizedInput.id, tagId, now.toISOString()],
      );
    }

    const updated = await transaction.query<ManualTransactionRow>(
      `${buildManualTransactionsSelect(
        'where mt.user_id = $1 and mt.id = $2',
      )}`,
      [userId, sanitizedInput.id],
    );

    return mapManualTransaction(updated.rows[0]);
  }

  private async deleteWithinTransaction(
    transaction: DatabaseExecutor,
    userId: string,
    transactionId: string,
  ): Promise<ManualTransaction> {
    const existing = await transaction.query<ManualTransactionRow>(
      `${buildManualTransactionsSelect('where mt.user_id = $1 and mt.id = $2')}`,
      [userId, transactionId],
    );

    if ((existing.rowCount ?? 0) === 0) {
      throw new AppError(
        404,
        'FINANCE_TRANSACTION_NOT_FOUND',
        'Lancamento nao encontrado para o usuario autenticado.',
      );
    }

    await transaction.query(
      'delete from finance.manual_transactions where user_id = $1 and id = $2',
      [userId, transactionId],
    );

    return mapManualTransaction(existing.rows[0]);
  }

  async findById(
    userId: string,
    transactionId: string,
  ): Promise<ManualTransaction | null> {
    const result = await this.database.query<ManualTransactionRow>(
      `${buildManualTransactionsSelect('where mt.user_id = $1 and mt.id = $2')}`,
      [userId, transactionId],
    );

    return result.rows[0] ? mapManualTransaction(result.rows[0]) : null;
  }

  async listByUserId(userId: string): Promise<TransactionListItem[]> {
    const result = await this.database.query<ManualTransactionRow>(
      `${buildManualTransactionsSelect('where mt.user_id = $1')}
       order by mt.transaction_date desc, mt.created_at desc`,
      [userId],
    );

    return result.rows.map(mapTransactionListItem);
  }
}

export class LegacyImportRepository {
  constructor(private readonly database: DatabaseClient) {}

  async createBatch(
    userId: string,
    input: CreateLegacyImportBatchInput,
    now = new Date(),
  ): Promise<LegacyImportBatch> {
    const nowIsoString = now.toISOString();
    const result = await this.database.query<LegacyImportBatchRow>(
      `insert into legacy_import.sqlite_import_batches (
         id,
         user_id,
         source_path,
         source_checksum,
         status,
         summary,
         created_at,
         updated_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id,
                 user_id,
                 source_path,
                 source_checksum,
                 status,
                 summary,
                 created_at,
                 updated_at`,
      [
        randomUUID(),
        userId,
        input.sourcePath,
        input.sourceChecksum,
        input.status ?? 'staged',
        JSON.stringify(input.summary ?? {}),
        nowIsoString,
        nowIsoString,
      ],
    );

    return mapLegacyImportBatch(result.rows[0]);
  }

  async getBatchById(
    userId: string,
    batchId: string,
  ): Promise<LegacyImportBatch | null> {
    const result = await this.database.query<LegacyImportBatchRow>(
      `select id,
              user_id,
              source_path,
              source_checksum,
              status,
              summary,
              created_at,
              updated_at
         from legacy_import.sqlite_import_batches
        where user_id = $1 and id = $2`,
      [userId, batchId],
    );

    return result.rows[0] ? mapLegacyImportBatch(result.rows[0]) : null;
  }

  async listRows(
    userId: string,
    batchId: string,
  ): Promise<LegacyImportRow[]> {
    await assertOwnedImportBatch(this.database, userId, batchId);

    const result = await this.database.query<LegacyImportRowRecord>(
      `select id,
              batch_id,
              user_id,
              source_table,
              source_row_id,
              payload,
              staged_at
         from legacy_import.sqlite_import_rows
        where user_id = $1 and batch_id = $2
        order by source_table asc, source_row_id asc`,
      [userId, batchId],
    );

    return result.rows.map(mapLegacyImportRow);
  }

  async stageRows(
    userId: string,
    batchId: string,
    rows: readonly StageLegacyImportRowInput[],
    now = new Date(),
  ): Promise<LegacyImportRow[]> {
    return this.database.runInTransaction(async (transaction) => {
      await assertOwnedImportBatch(transaction, userId, batchId);

      for (const row of rows) {
        await transaction.query(
          `insert into legacy_import.sqlite_import_rows (
             id,
             batch_id,
             user_id,
             source_table,
             source_row_id,
             payload,
             staged_at
           ) values ($1, $2, $3, $4, $5, $6, $7)`,
          [
            randomUUID(),
            batchId,
            userId,
            row.sourceTable,
            row.sourceRowId,
            JSON.stringify(row.payload),
            now.toISOString(),
          ],
        );
      }

      const stagedRows = await transaction.query<LegacyImportRowRecord>(
        `select id,
                batch_id,
                user_id,
                source_table,
                source_row_id,
                payload,
                staged_at
           from legacy_import.sqlite_import_rows
          where user_id = $1 and batch_id = $2
          order by source_table asc, source_row_id asc`,
        [userId, batchId],
      );

      return stagedRows.rows.map(mapLegacyImportRow);
    });
  }
}

export class FinancialDataAccess {
  readonly accounts: AccountsRepository;

  readonly creditCards: CreditCardsRepository;

  readonly contracts: ContractsRepository;

  readonly provisions: ProvisionsRepository;

  readonly installments: InstallmentsRepository;

  readonly legacyImport: LegacyImportRepository;

  readonly manualTransactions: ManualTransactionsRepository;

  readonly variableExpenseOverrides: VariableExpenseOverridesRepository;

  readonly tags: TagsRepository;

  readonly userSettings: UserSettingsRepository;

  constructor(database: DatabaseClient) {
    this.accounts = new AccountsRepository(database);
    this.creditCards = new CreditCardsRepository(database);
    this.contracts = new ContractsRepository(database);
    this.provisions = new ProvisionsRepository(database);
    this.installments = new InstallmentsRepository(database);
    this.legacyImport = new LegacyImportRepository(database);
    this.manualTransactions = new ManualTransactionsRepository(database);
    this.variableExpenseOverrides = new VariableExpenseOverridesRepository(database);
    this.tags = new TagsRepository(database);
    this.userSettings = new UserSettingsRepository(database);
  }
}