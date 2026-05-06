import { randomUUID } from 'node:crypto';

import type {
  Account,
  AccountListItem,
  CreateAccountInput,
  CreateTagInput,
  CreateTransactionInput,
  HorizonSettings,
  ManualTransaction,
  Tag,
  TagListItem,
  TransactionListItem,
} from '@shf/contracts';
import {
  sanitizeAccountInput,
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
  ): Promise<Account> {
    const sanitizedInput = sanitizeAccountInput(input);
    const nowIsoString = now.toISOString();
    const result = await this.database.query<AccountRow>(
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
  ): Promise<ManualTransaction> {
    const sanitizedInput = sanitizeTransactionInput(input);
    const tagIds = sanitizeTagIds(sanitizedInput.tagIds);

    return this.database.runInTransaction(async (transaction) => {
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
    });
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

  readonly legacyImport: LegacyImportRepository;

  readonly manualTransactions: ManualTransactionsRepository;

  readonly tags: TagsRepository;

  readonly userSettings: UserSettingsRepository;

  constructor(database: DatabaseClient) {
    this.accounts = new AccountsRepository(database);
    this.legacyImport = new LegacyImportRepository(database);
    this.manualTransactions = new ManualTransactionsRepository(database);
    this.tags = new TagsRepository(database);
    this.userSettings = new UserSettingsRepository(database);
  }
}