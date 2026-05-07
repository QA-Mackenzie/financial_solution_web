import { randomUUID } from 'node:crypto';

import {
  DEFAULT_HORIZON_SAFETY_MARGIN_IN_CENTS,
  DEFAULT_VARIABLE_EXPENSE_WINDOW_IN_MONTHS,
} from '@shf/contracts';
import type {
  Account,
  AccountListItem,
  AccountsSnapshot,
  AnticipateInstallmentPlanInput,
  ArchiveAccountInput,
  CreditCardListItem,
  CreditCardPurchaseListItem,
  CreditCardsSnapshot,
  Contract,
  ContractAdjustment,
  ContractsSnapshot,
  CreateAccountInput,
  CreateCreditCardInput,
  CreateCreditCardPurchaseInput,
  CreateContractAdjustmentInput,
  CreateContractInput,
  CreateInstallmentPlanInput,
  CreateTransactionInput,
  EndContractInput,
  HorizonSettings,
  HorizonSnapshot,
  InstallmentOperation,
  InstallmentPlanListItem,
  InstallmentsSnapshot,
  ManualTransaction,
  TransactionsSnapshot,
  UpdateInstallmentAnticipationInput,
  UpdateInstallmentPlanInput,
  UpdateCreditCardInput,
  UpdateCreditCardPurchaseInput,
  UpdateContractInput,
  UpdateHorizonSettingsInput,
  UpdateAccountInput,
  UpdateTransactionInput,
} from '@shf/contracts';
import {
  buildAccountsSnapshot,
  buildCombinedCreditCardFinancials,
  buildContractsSnapshot,
  buildTransactionsSnapshot,
  sanitizeAccountInput,
  sanitizeCreditCardInput,
  sanitizeCreditCardPurchaseInput,
  sanitizeContractInput,
  sanitizeInstallmentAnticipationInput,
  sanitizeInstallmentPlanInput,
  sanitizeTransactionInput,
  validateAccountInput,
  validateCreditCardInput,
  validateCreditCardPurchaseInput,
  validateContractInput,
  validateInstallmentAnticipationInput,
  validateInstallmentPlanInput,
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
  | 'CREDIT_CARD_CREATED'
  | 'CREDIT_CARD_PURCHASE_CREATED'
  | 'CREDIT_CARD_PURCHASE_UPDATED'
  | 'CREDIT_CARD_UPDATED'
  | 'CONTRACT_ADJUSTED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_ENDED'
  | 'CONTRACT_UPDATED'
  | 'INSTALLMENT_ANTICIPATED'
  | 'INSTALLMENT_ANTICIPATION_UPDATED'
  | 'INSTALLMENT_PLAN_CREATED'
  | 'INSTALLMENT_PLAN_UPDATED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_DELETED'
  | 'TRANSACTION_UPDATED';

type FinancialAuditResourceType =
  | 'account'
  | 'credit_card'
  | 'credit_card_purchase'
  | 'installment_operation'
  | 'installment_plan'
  | 'manual_transaction'
  | 'recurring_contract';

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

  async getContractsSnapshot(userId: string): Promise<ContractsSnapshot> {
    const contracts = await this.dataAccess.contracts.listByUserId(userId);

    return buildContractsSnapshot(contracts, {
      currentDate: this.now().toISOString().slice(0, 10),
    });
  }

  async getCreditCardsSnapshot(userId: string): Promise<CreditCardsSnapshot> {
    const currentDate = this.now().toISOString().slice(0, 10);
    const [creditCardsSnapshot, installmentsSnapshot] = await Promise.all([
      this.dataAccess.creditCards.getSnapshot(userId, currentDate),
      this.dataAccess.installments.getSnapshot(userId, currentDate),
    ]);
    const combinedFinancials = buildCombinedCreditCardFinancials(
      creditCardsSnapshot.cards,
      creditCardsSnapshot.purchases,
      installmentsSnapshot,
      currentDate,
    );

    return {
      ...creditCardsSnapshot,
      cards: combinedFinancials.cards,
      invoices: combinedFinancials.invoices,
      projectedInvoices: combinedFinancials.projectedInvoices,
      purchases: combinedFinancials.purchases,
      totalInvoiceAmountInCents: combinedFinancials.totalInvoiceAmountInCents,
    };
  }

  async getInstallmentsSnapshot(userId: string): Promise<InstallmentsSnapshot> {
    return this.dataAccess.installments.getSnapshot(
      userId,
      this.now().toISOString().slice(0, 10),
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

  async createContract(
    userId: string,
    input: CreateContractInput,
    context: FinanceRequestContext,
  ): Promise<Contract> {
    const sanitizedInput = sanitizeContractInput(input);
    const issues = validateContractInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const contract = await this.database.runInTransaction(async (transaction) => {
      const contract = await this.dataAccess.contracts.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'recurring_contract',
        contract.id,
        'CONTRACT_CREATED',
        context,
        {
          accountId: contract.accountId,
          amountInCents: contract.amountInCents,
          type: contract.type,
        },
      );

      return contract;
    });

    this.invalidateHorizonCache(userId);

    return contract;
  }

  async createCreditCard(
    userId: string,
    input: CreateCreditCardInput,
    context: FinanceRequestContext,
  ): Promise<CreditCardListItem> {
    const sanitizedInput = sanitizeCreditCardInput(input);
    const issues = validateCreditCardInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const currentDate = this.now().toISOString().slice(0, 10);
    const creditCard = await this.database.runInTransaction(async (transaction) => {
      const creditCard = await this.dataAccess.creditCards.create(
        userId,
        sanitizedInput,
        currentDate,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'credit_card',
        creditCard.id,
        'CREDIT_CARD_CREATED',
        context,
        {
          dueDay: creditCard.dueDay,
          paymentAccountId: creditCard.paymentAccountId,
          statementClosingDay: creditCard.statementClosingDay,
        },
      );

      return creditCard;
    });

    this.invalidateHorizonCache(userId);

    return creditCard;
  }

  async createInstallmentPlan(
    userId: string,
    input: CreateInstallmentPlanInput,
    context: FinanceRequestContext,
  ): Promise<InstallmentPlanListItem> {
    const sanitizedInput = sanitizeInstallmentPlanInput(input);
    const issues = validateInstallmentPlanInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const plan = await this.database.runInTransaction(async (transaction) => {
      const plan = await this.dataAccess.installments.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'installment_plan',
        plan.id,
        'INSTALLMENT_PLAN_CREATED',
        context,
        {
          installmentCount: plan.installmentCount,
          sourceType: plan.sourceType,
          totalAmountInCents: plan.totalAmountInCents,
        },
      );

      return plan;
    });

    this.invalidateHorizonCache(userId);

    return plan;
  }

  async updateCreditCard(
    userId: string,
    input: UpdateCreditCardInput,
    context: FinanceRequestContext,
  ): Promise<CreditCardListItem> {
    const sanitizedInput = sanitizeCreditCardInput(input);
    const issues = validateCreditCardInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const currentDate = this.now().toISOString().slice(0, 10);
    const creditCard = await this.database.runInTransaction(async (transaction) => {
      const creditCard = await this.dataAccess.creditCards.update(
        userId,
        sanitizedInput,
        currentDate,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'credit_card',
        creditCard.id,
        'CREDIT_CARD_UPDATED',
        context,
        {
          dueDay: creditCard.dueDay,
          paymentAccountId: creditCard.paymentAccountId,
          statementClosingDay: creditCard.statementClosingDay,
        },
      );

      return creditCard;
    });

    this.invalidateHorizonCache(userId);

    return creditCard;
  }

  async updateInstallmentPlan(
    userId: string,
    input: UpdateInstallmentPlanInput,
    context: FinanceRequestContext,
  ): Promise<InstallmentPlanListItem> {
    const sanitizedInput = sanitizeInstallmentPlanInput(input);
    const issues = validateInstallmentPlanInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const plan = await this.database.runInTransaction(async (transaction) => {
      const plan = await this.dataAccess.installments.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'installment_plan',
        plan.id,
        'INSTALLMENT_PLAN_UPDATED',
        context,
        {
          installmentCount: plan.installmentCount,
          sourceType: plan.sourceType,
          totalAmountInCents: plan.totalAmountInCents,
        },
      );

      return plan;
    });

    this.invalidateHorizonCache(userId);

    return plan;
  }

  async createCreditCardPurchase(
    userId: string,
    input: CreateCreditCardPurchaseInput,
    context: FinanceRequestContext,
  ): Promise<CreditCardPurchaseListItem> {
    const sanitizedInput = sanitizeCreditCardPurchaseInput(input);
    const issues = validateCreditCardPurchaseInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const purchase = await this.database.runInTransaction(async (transaction) => {
      const purchase = await this.dataAccess.creditCards.createPurchase(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'credit_card_purchase',
        purchase.id,
        'CREDIT_CARD_PURCHASE_CREATED',
        context,
        {
          amountInCents: purchase.amountInCents,
          creditCardId: purchase.creditCardId,
          invoiceMonth: purchase.invoiceMonth,
          purchaseDate: purchase.purchaseDate,
        },
      );

      return purchase;
    });

    this.invalidateHorizonCache(userId);

    return purchase;
  }

  async anticipateInstallmentPlan(
    userId: string,
    input: AnticipateInstallmentPlanInput,
    context: FinanceRequestContext,
  ): Promise<InstallmentOperation> {
    const sanitizedInput = sanitizeInstallmentAnticipationInput(input);
    const issues = validateInstallmentAnticipationInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const operation = await this.database.runInTransaction(async (transaction) => {
      const operation = await this.dataAccess.installments.anticipate(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'installment_operation',
        operation.id,
        'INSTALLMENT_ANTICIPATED',
        context,
        {
          affectedAmountInCents: operation.affectedAmountInCents,
          affectedInstallmentCount: operation.affectedInstallmentCount,
          operationDate: operation.operationDate,
          planId: operation.planId,
        },
      );

      return operation;
    });

    this.invalidateHorizonCache(userId);

    return operation;
  }

  async updateCreditCardPurchase(
    userId: string,
    input: UpdateCreditCardPurchaseInput,
    context: FinanceRequestContext,
  ): Promise<CreditCardPurchaseListItem> {
    const sanitizedInput = sanitizeCreditCardPurchaseInput(input);
    const issues = validateCreditCardPurchaseInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const purchase = await this.database.runInTransaction(async (transaction) => {
      const purchase = await this.dataAccess.creditCards.updatePurchase(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'credit_card_purchase',
        purchase.id,
        'CREDIT_CARD_PURCHASE_UPDATED',
        context,
        {
          amountInCents: purchase.amountInCents,
          creditCardId: purchase.creditCardId,
          invoiceMonth: purchase.invoiceMonth,
          purchaseDate: purchase.purchaseDate,
        },
      );

      return purchase;
    });

    this.invalidateHorizonCache(userId);

    return purchase;
  }

  async updateInstallmentAnticipation(
    userId: string,
    input: UpdateInstallmentAnticipationInput,
    context: FinanceRequestContext,
  ): Promise<InstallmentOperation> {
    const sanitizedInput = sanitizeInstallmentAnticipationInput(input);
    const issues = validateInstallmentAnticipationInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const operation = await this.database.runInTransaction(async (transaction) => {
      const operation = await this.dataAccess.installments.updateAnticipation(
        userId,
        sanitizedInput,
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'installment_operation',
        operation.id,
        'INSTALLMENT_ANTICIPATION_UPDATED',
        context,
        {
          affectedAmountInCents: operation.affectedAmountInCents,
          affectedInstallmentCount: operation.affectedInstallmentCount,
          operationDate: operation.operationDate,
          planId: operation.planId,
        },
      );

      return operation;
    });

    this.invalidateHorizonCache(userId);

    return operation;
  }

  async updateContract(
    userId: string,
    input: UpdateContractInput,
    context: FinanceRequestContext,
  ): Promise<Contract> {
    const sanitizedInput = sanitizeContractInput(input);
    const issues = validateContractInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const contract = await this.database.runInTransaction(async (transaction) => {
      const contract = await this.dataAccess.contracts.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'recurring_contract',
        contract.id,
        'CONTRACT_UPDATED',
        context,
        {
          accountId: contract.accountId,
          amountInCents: contract.amountInCents,
          type: contract.type,
        },
      );

      return contract;
    });

    this.invalidateHorizonCache(userId);

    return contract;
  }

  async createContractAdjustment(
    userId: string,
    input: CreateContractAdjustmentInput,
    context: FinanceRequestContext,
  ): Promise<ContractAdjustment> {
    const contract = await this.dataAccess.contracts.findById(
      userId,
      input.contractId,
    );

    if (!contract) {
      throw new AppError(
        404,
        'FINANCE_CONTRACT_NOT_FOUND',
        'Contrato nao encontrado para o usuario autenticado.',
      );
    }

    if (input.effectiveStartDate < contract.startDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', [
        {
          field: 'effectiveStartDate',
          message:
            'A data efetiva do reajuste nao pode ser anterior ao inicio do contrato.',
        },
      ]);
    }

    if (contract.endDate && input.effectiveStartDate > contract.endDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', [
        {
          field: 'effectiveStartDate',
          message:
            'A data efetiva do reajuste nao pode ultrapassar o encerramento do contrato.',
        },
      ]);
    }

    const adjustment = await this.database.runInTransaction(async (transaction) => {
      const adjustment = await this.dataAccess.contracts.createAdjustment(
        userId,
        input,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'recurring_contract',
        contract.id,
        'CONTRACT_ADJUSTED',
        context,
        {
          amountInCents: adjustment.amountInCents,
          effectiveStartDate: adjustment.effectiveStartDate,
        },
      );

      return adjustment;
    });

    this.invalidateHorizonCache(userId);

    return adjustment;
  }

  async endContract(
    userId: string,
    input: EndContractInput,
    context: FinanceRequestContext,
  ): Promise<Contract> {
    const contract = await this.dataAccess.contracts.findById(
      userId,
      input.contractId,
    );

    if (!contract) {
      throw new AppError(
        404,
        'FINANCE_CONTRACT_NOT_FOUND',
        'Contrato nao encontrado para o usuario autenticado.',
      );
    }

    if (input.endDate < contract.startDate) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', [
        {
          field: 'endDate',
          message:
            'A data final nao pode ser anterior ao inicio do contrato.',
        },
      ]);
    }

    const endedContract = await this.database.runInTransaction(async (transaction) => {
      const endedContract = await this.dataAccess.contracts.end(
        userId,
        input,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'recurring_contract',
        endedContract.id,
        'CONTRACT_ENDED',
        context,
        {
          endDate: endedContract.endDate,
        },
      );

      return endedContract;
    });

    this.invalidateHorizonCache(userId);

    return endedContract;
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
    const [accountsSnapshot, contractsSnapshot, creditCardsSnapshot, installmentsSnapshot, transactionsSnapshot] = await Promise.all([
      this.getAccountsSnapshot(userId),
      this.getContractsSnapshot(userId),
      this.getCreditCardsSnapshot(userId),
      this.getInstallmentsSnapshot(userId),
      this.listTransactions(userId),
    ]);
    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot,
      contractsSnapshot,
      creditCardsSnapshot,
      generatedAt,
      installmentsSnapshot,
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