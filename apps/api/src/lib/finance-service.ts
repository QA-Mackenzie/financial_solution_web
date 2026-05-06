import { randomUUID } from 'node:crypto';

import type {
  Account,
  AccountListItem,
  AccountsSnapshot,
  ArchiveAccountInput,
  CreateAccountInput,
  CreateTransactionInput,
  ManualTransaction,
  TransactionsSnapshot,
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

export class FinanceService {
  private readonly dataAccess: FinancialDataAccess;

  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionGuard: SessionGuard,
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

    return this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.create(
        userId,
        sanitizedInput,
        new Date(),
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

    return this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.update(
        userId,
        sanitizedInput,
        new Date(),
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
  }

  async archiveAccount(
    userId: string,
    input: ArchiveAccountInput,
    context: FinanceRequestContext,
  ): Promise<Account> {
    return this.database.runInTransaction(async (transaction) => {
      const account = await this.dataAccess.accounts.archive(
        userId,
        input,
        new Date(),
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
  }

  async listTransactions(userId: string): Promise<TransactionsSnapshot> {
    const transactions = await this.dataAccess.manualTransactions.listByUserId(userId);

    return buildTransactionsSnapshot(transactions);
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

    return this.database.runInTransaction(async (transaction) => {
      const createdTransaction = await this.dataAccess.manualTransactions.create(
        userId,
        sanitizedInput,
        new Date(),
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

    return this.database.runInTransaction(async (transaction) => {
      const updatedTransaction = await this.dataAccess.manualTransactions.update(
        userId,
        sanitizedInput,
        new Date(),
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
        new Date().toISOString(),
      ],
    );
  }
}