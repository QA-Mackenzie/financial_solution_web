import { randomUUID } from 'node:crypto';

import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@shf/contracts';
import type {
  Account,
  AccountListItem,
  AccountsSnapshot,
  ArchiveAccountInput,
  CreateAccountInput,
  CreateTransactionInput,
  HorizonSettings,
  HorizonSnapshot,
  ManualTransaction,
  TransactionsSnapshot,
  UpdateHorizonSettingsInput,
  UpdateAccountInput,
  UpdateTransactionInput,
} from '@shf/contracts';
import {
  buildAccountsSnapshot,
  buildTransactionsSnapshot,
  sanitizeAccountInput,
  sanitizeTransactionInput,
  validateAccountInput,
  validateTransactionInput,
} from '@shf/domain-core';

import type { DatabaseClient, DatabaseExecutor } from './database';
import { AppError } from './errors';
import { FinancialDataAccess } from './finance-repositories';
import { buildOfficialHorizonSnapshot } from './horizon-snapshot';
import { SessionGuard, type AuthorizedSession } from './session-guard';

export type FinanceRequestContext = {
  ipAddress: string | null;
  requestId: string;
  userAgent: string | null;
};

type FinancialAuditAction =
  | 'ACCOUNT_ARCHIVED'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_UPDATED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_DELETED'
  | 'TRANSACTION_UPDATED';

type FinancialAuditResourceType = 'account' | 'manual_transaction';

type HorizonCacheEntry = {
  referenceDate: string;
  snapshot: HorizonSnapshot;
};

export type HorizonSnapshotResult = {
  cacheStatus: 'hit' | 'miss';
  durationInMs: number;
  snapshot: HorizonSnapshot;
};

export class FinanceService {
  private readonly dataAccess: FinancialDataAccess;
  private readonly horizonCache = new Map<string, HorizonCacheEntry>();

  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionGuard: SessionGuard,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.dataAccess = new FinancialDataAccess(database);
  }

  requireAuthorizedSession(
    sessionToken: string | undefined,
  ): Promise<AuthorizedSession> {
    return this.sessionGuard.requireUserSession(sessionToken, false);
  }

  async listAccounts(userId: string): Promise<AccountListItem[]> {
    return this.dataAccess.accounts.listByUserId(userId);
  }

  async getAccountsSnapshot(userId: string): Promise<AccountsSnapshot> {
    const accounts = await this.dataAccess.accounts.listByUserId(userId);
    const baseAccounts: Account[] = accounts.map((account) => ({
      archivedAt: account.archivedAt,
      createdAt: account.createdAt,
      id: account.id,
      isArchived: account.isArchived,
      name: account.name,
      openingBalanceInCents: account.openingBalanceInCents,
      type: account.type,
      updatedAt: account.updatedAt,
    }));

    return buildAccountsSnapshot(
      baseAccounts,
      Object.fromEntries(
        accounts.map((account) => [
          account.id,
          account.currentBalanceInCents - account.openingBalanceInCents,
        ]),
      ),
    );
  }

  async createAccount(
    userId: string,
    input: CreateAccountInput,
    context: FinanceRequestContext,
  ): Promise<Account> {
    const sanitizedInput = sanitizeAccountInput(input);
    const issues = validateAccountInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const account = await this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'account',
        account.id,
        'ACCOUNT_CREATED',
        context,
        {
          name: account.name,
          type: account.type,
        },
      );

      return account;
    });

    this.invalidateHorizonCache(userId);

    return account;
  }

  async updateAccount(
    userId: string,
    input: UpdateAccountInput,
    context: FinanceRequestContext,
  ): Promise<Account> {
    const sanitizedInput = sanitizeAccountInput(input);
    const issues = validateAccountInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const account = await this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'account',
        account.id,
        'ACCOUNT_UPDATED',
        context,
        {
          name: account.name,
          type: account.type,
        },
      );

      return account;
    });

    this.invalidateHorizonCache(userId);

    return account;
  }

  async archiveAccount(
    userId: string,
    input: ArchiveAccountInput,
    context: FinanceRequestContext,
  ): Promise<Account> {
    const account = await this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.archive(
        userId,
        input,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'account',
        account.id,
        'ACCOUNT_ARCHIVED',
        context,
        {
          name: account.name,
        },
      );

      return account;
    });

    this.invalidateHorizonCache(userId);

    return account;
  }

  async listTransactions(userId: string): Promise<TransactionsSnapshot> {
    const transactions = await this.dataAccess.manualTransactions.listByUserId(userId);

    return buildTransactionsSnapshot(transactions);
  }

  async getHorizonSettings(userId: string): Promise<HorizonSettings> {
    return (await this.getOrCreateUserSettings(userId)).horizonSettings;
  }

  async updateHorizonSettings(
    userId: string,
    input: UpdateHorizonSettingsInput,
  ): Promise<HorizonSettings> {
    const currentSettings = await this.dataAccess.userSettings.getByUserId(userId);
    const updatedSettings = await this.dataAccess.userSettings.upsert(
      userId,
      {
        currencyCode: currentSettings?.currencyCode,
        locale: currentSettings?.locale,
        horizonSettings: input,
      },
      this.now(),
    );

    this.invalidateHorizonCache(userId);

    return updatedSettings.horizonSettings;
  }

  async getHorizonSnapshot(userId: string): Promise<HorizonSnapshotResult> {
    const startedAt = Date.now();
    const now = this.now();
    const generatedAt = now.toISOString();
    const referenceDate = generatedAt.slice(0, 10);
    const cachedSnapshot = this.horizonCache.get(userId);

    if (cachedSnapshot && cachedSnapshot.referenceDate === referenceDate) {
      return {
        cacheStatus: 'hit',
        durationInMs: Date.now() - startedAt,
        snapshot: cachedSnapshot.snapshot,
      };
    }

    const settings = await this.getHorizonSettings(userId);
    const [accountsSnapshot, transactionsSnapshot] = await Promise.all([
      this.getAccountsSnapshot(userId),
      this.listTransactions(userId),
    ]);
    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot,
      generatedAt,
      referenceDate,
      settings,
      transactionsSnapshot,
    });

    this.horizonCache.set(userId, {
      referenceDate,
      snapshot,
    });

    return {
      cacheStatus: 'miss',
      durationInMs: Date.now() - startedAt,
      snapshot,
    };
  }

  async createTransaction(
    userId: string,
    input: CreateTransactionInput,
    context: FinanceRequestContext,
  ): Promise<ManualTransaction> {
    const sanitizedInput = sanitizeTransactionInput(input);
    const issues = validateTransactionInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const createdTransaction = await this.database.runInTransaction(async (transaction) => {
      const createdTransaction = await this.dataAccess.manualTransactions.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'manual_transaction',
        createdTransaction.id,
        'TRANSACTION_CREATED',
        context,
        {
          accountId: createdTransaction.accountId,
          type: createdTransaction.type,
        },
      );

      return createdTransaction;
    });

    this.invalidateHorizonCache(userId);

    return createdTransaction;
  }

  async updateTransaction(
    userId: string,
    input: UpdateTransactionInput,
    context: FinanceRequestContext,
  ): Promise<ManualTransaction> {
    const sanitizedInput = sanitizeTransactionInput(input);
    const issues = validateTransactionInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const updatedTransaction = await this.database.runInTransaction(async (transaction) => {
      const updatedTransaction = await this.dataAccess.manualTransactions.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'manual_transaction',
        updatedTransaction.id,
        'TRANSACTION_UPDATED',
        context,
        {
          accountId: updatedTransaction.accountId,
          type: updatedTransaction.type,
        },
      );

      return updatedTransaction;
    });

    this.invalidateHorizonCache(userId);

    return updatedTransaction;
  }

  async deleteTransaction(
    userId: string,
    transactionId: string,
    context: FinanceRequestContext,
  ): Promise<void> {
    await this.database.runInTransaction(async (transaction) => {
      const deletedTransaction = await this.dataAccess.manualTransactions.delete(
        userId,
        transactionId,
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'manual_transaction',
        deletedTransaction.id,
        'TRANSACTION_DELETED',
        context,
        {
          accountId: deletedTransaction.accountId,
          type: deletedTransaction.type,
        },
      );
    });

    this.invalidateHorizonCache(userId);
  }

  private async getOrCreateUserSettings(userId: string) {
    const currentSettings = await this.dataAccess.userSettings.getByUserId(userId);

    if (currentSettings) {
      return currentSettings;
    }

    return this.dataAccess.userSettings.upsert(
      userId,
      {
        horizonSettings: {
          safetyMarginInCents: DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
          variableExpenseWindowInMonths:
            DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
        },
      },
      this.now(),
    );
  }

  private invalidateHorizonCache(userId: string) {
    this.horizonCache.delete(userId);
  }

  private async insertAuditEvent(
    database: DatabaseExecutor,
    userId: string,
    resourceType: FinancialAuditResourceType,
    resourceId: string,
    action: FinancialAuditAction,
    context: FinanceRequestContext,
    details: Record<string, unknown>,
  ): Promise<void> {
    await database.query(
      `insert into audit.financial_events (
         id,
         user_id,
         resource_type,
         resource_id,
         action,
         request_id,
         details,
         occurred_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        userId,
        resourceType,
        resourceId,
        action,
        context.requestId,
        JSON.stringify({
          ...details,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        }),
        this.now().toISOString(),
      ],
    );
  }
}