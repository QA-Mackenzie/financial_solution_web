import { randomUUID } from 'node:crypto';

import type {
  ArchiveAccountInput,
  Account,
  AccountListItem,
  Contract,
  ContractAdjustment,
  ContractListItem,
  CreateAccountInput,
  CreateContractAdjustmentInput,
  CreateContractInput,
  CreateTagInput,
  CreateTransactionInput,
  EndContractInput,
  HorizonSettings,
  ManualTransaction,
  Tag,
  TagListItem,
  UpdateContractInput,
  UpdateAccountInput,
  UpdateTransactionInput,
  TransactionListItem,
} from '@shf/contracts';
import {
  sanitizeAccountInput,
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

  readonly contracts: ContractsRepository;

  readonly legacyImport: LegacyImportRepository;

  readonly manualTransactions: ManualTransactionsRepository;

  readonly tags: TagsRepository;

  readonly userSettings: UserSettingsRepository;

  constructor(database: DatabaseClient) {
    this.accounts = new AccountsRepository(database);
    this.contracts = new ContractsRepository(database);
    this.legacyImport = new LegacyImportRepository(database);
    this.manualTransactions = new ManualTransactionsRepository(database);
    this.tags = new TagsRepository(database);
    this.userSettings = new UserSettingsRepository(database);
  }
}