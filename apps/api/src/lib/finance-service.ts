import { randomUUID } from 'node:crypto';

import {
  DEFAULT_UNCATEGORIZED_CATEGORY,
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
  CreateProvisionInput,
  CreateTagInput,
  CreateTransactionInput,
  EndContractInput,
  FinancialAnalyticsSnapshot,
  FinancialRecordFilter,
  FinancialRecordListItem,
  FinancialRecordQuerySnapshot,
  HorizonSettings,
  HorizonSnapshot,
  InstallmentOperation,
  InstallmentPlanListItem,
  InstallmentsSnapshot,
  ManualTransaction,
  ProvisionsPlanningSnapshot,
  ProvisionListItem,
  RedeemProvisionInput,
  RemoveVariableExpenseOverrideInput,
  TagListItem,
  TagsSnapshot,
  TransactionListItem,
  TransactionsSnapshot,
  UpdateInstallmentAnticipationInput,
  UpdateInstallmentPlanInput,
  UpdateProvisionInput,
  UpdateCreditCardInput,
  UpdateCreditCardPurchaseInput,
  UpdateContractInput,
  UpdateHorizonSettingsInput,
  UpdateAccountInput,
  UpdateTagInput,
  UpdateTransactionInput,
  VariableExpenseOverride,
  VariableExpenseOverrideListItem,
  VariableExpenseSnapshot,
} from '@shf/contracts';
import {
  buildAccountsSnapshot,
  buildCombinedCreditCardFinancials,
  buildContractsSnapshot,
  buildFinancialAnalyticsSnapshot,
  buildFinancialRecordQuerySnapshot,
  buildProjectedProvisionOccurrences,
  buildProjectedVariableExpenseOccurrences,
  buildTransactionsSnapshot,
  sanitizeAccountInput,
  sanitizeCreditCardInput,
  sanitizeCreditCardPurchaseInput,
  sanitizeContractInput,
  sanitizeInstallmentAnticipationInput,
  sanitizeInstallmentPlanInput,
  sanitizeProvisionInput,
  sanitizeTagInput,
  sanitizeTransactionInput,
  validateAccountInput,
  validateCreditCardInput,
  validateCreditCardPurchaseInput,
  validateContractInput,
  validateInstallmentAnticipationInput,
  validateInstallmentPlanInput,
  validateProvisionInput,
  validateProvisionRedeemInput,
  validateTagInput,
  validateTransactionInput,
} from '@shf/domain-core';

import type { DatabaseClient, DatabaseExecutor } from './database';
import { AppError } from './errors';
import { FinancialDataAccess } from './finance-repositories';
import {
  buildOfficialHorizonSnapshot,
  OFFICIAL_HORIZON_TOTAL_MONTHS,
} from './horizon-snapshot';
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
  | 'PROVISION_CREATED'
  | 'PROVISION_REDEEMED'
  | 'PROVISION_UPDATED'
  | 'TAG_CREATED'
  | 'TAG_DELETED'
  | 'TAG_UPDATED'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_DELETED'
  | 'TRANSACTION_UPDATED'
  | 'VARIABLE_EXPENSE_OVERRIDE_CREATED'
  | 'VARIABLE_EXPENSE_OVERRIDE_REMOVED'
  | 'VARIABLE_EXPENSE_OVERRIDE_UPDATED';

type FinancialAuditResourceType =
  | 'account'
  | 'credit_card'
  | 'credit_card_purchase'
  | 'installment_operation'
  | 'installment_plan'
  | 'manual_transaction'
  | 'provision'
  | 'recurring_contract'
  | 'tag'
  | 'variable_expense_override';

type HorizonCacheEntry = {
  referenceDate: string;
  snapshot: HorizonSnapshot;
};

export type HorizonSnapshotResult = {
  cacheStatus: 'hit' | 'miss';
  durationInMs: number;
  snapshot: HorizonSnapshot;
};

type VariableExpenseOverrideValidationIssue = {
  field: 'accountId' | 'amountInCents' | 'description' | 'occurrenceDate';
  message: string;
};

function sanitizeVariableExpenseDescription(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

function sanitizeVariableExpenseOverrideInput<
  T extends VariableExpenseOverride | RemoveVariableExpenseOverrideInput,
>(input: T): T {
  return {
    ...input,
    accountId: input.accountId.trim(),
    description: sanitizeVariableExpenseDescription(input.description),
    occurrenceDate: input.occurrenceDate.trim(),
  };
}

function validateVariableExpenseOverrideInput(
  input: VariableExpenseOverride,
): VariableExpenseOverrideValidationIssue[] {
  const issues: VariableExpenseOverrideValidationIssue[] = [];

  if (!input.accountId) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para o override de despesa variavel.',
    });
  }

  if (!input.description) {
    issues.push({
      field: 'description',
      message: 'Informe uma descricao para a despesa variavel.',
    });
  }

  if (input.description.length > 120) {
    issues.push({
      field: 'description',
      message: 'A descricao da despesa variavel deve ter no maximo 120 caracteres.',
    });
  }

  if (!isDateOnly(input.occurrenceDate)) {
    issues.push({
      field: 'occurrenceDate',
      message: 'Informe uma data valida no formato AAAA-MM-DD.',
    });
  }

  if (
    !Number.isInteger(input.amountInCents) ||
    input.amountInCents <= 0
  ) {
    issues.push({
      field: 'amountInCents',
      message: 'O valor do override deve ser maior que zero em centavos inteiros.',
    });
  }

  return issues;
}

function validateRemoveVariableExpenseOverrideInput(
  input: RemoveVariableExpenseOverrideInput,
): VariableExpenseOverrideValidationIssue[] {
  const issues: VariableExpenseOverrideValidationIssue[] = [];

  if (!input.accountId) {
    issues.push({
      field: 'accountId',
      message: 'Selecione uma conta para remover o override.',
    });
  }

  if (!input.description) {
    issues.push({
      field: 'description',
      message: 'Informe a descricao do override a remover.',
    });
  }

  if (!isDateOnly(input.occurrenceDate)) {
    issues.push({
      field: 'occurrenceDate',
      message: 'Informe uma data valida no formato AAAA-MM-DD.',
    });
  }

  return issues;
}

function toVariableExpenseOverride(
  override: VariableExpenseOverrideListItem,
): VariableExpenseOverride {
  return {
    accountId: override.accountId,
    amountInCents: override.amountInCents,
    description: override.description,
    occurrenceDate: override.occurrenceDate,
  };
}

function buildTagLookup(tags: TagListItem[]) {
  return tags.reduce<Map<string, { id: string; name: string }>>((map, tag) => {
    map.set(tag.id, {
      id: tag.id,
      name: tag.name,
    });

    return map;
  }, new Map());
}

function mapRecordTags(
  tagIds: readonly string[] | undefined,
  tagLookup: Map<string, { id: string; name: string }>,
) {
  return (tagIds ?? []).reduce<Array<{ id: string; name: string }>>((tags, tagId) => {
    const tag = tagLookup.get(tagId);

    if (tag) {
      tags.push(tag);
    }

    return tags;
  }, []);
}

function mapTransactionToFinancialRecord(
  transaction: TransactionListItem,
  tagLookup: Map<string, { id: string; name: string }>,
): FinancialRecordListItem {
  return {
    accountId: transaction.accountId,
    accountName: transaction.accountName,
    amountInCents: transaction.amountInCents,
    category: transaction.category ?? DEFAULT_UNCATEGORIZED_CATEGORY,
    createdAt: transaction.createdAt,
    description: transaction.description,
    entityId: transaction.accountId,
    entityKind: 'account',
    entityName: transaction.accountName,
    id: transaction.id,
    occurrenceDate: transaction.transactionDate,
    recordKind: 'manualTransaction',
    signedAmountInCents: transaction.signedAmountInCents,
    tags: mapRecordTags(transaction.tagIds, tagLookup),
    type: transaction.type,
    updatedAt: transaction.updatedAt,
  };
}

function mapCreditCardPurchaseToFinancialRecord(
  purchase: CreditCardPurchaseListItem,
  tagLookup: Map<string, { id: string; name: string }>,
  creditCardName: string,
): FinancialRecordListItem {
  return {
    accountId: purchase.paymentAccountId,
    accountName: purchase.paymentAccountName,
    amountInCents: purchase.amountInCents,
    category: purchase.category ?? DEFAULT_UNCATEGORIZED_CATEGORY,
    createdAt: purchase.createdAt,
    description: purchase.description,
    entityId: purchase.creditCardId,
    entityKind: 'creditCard',
    entityName: creditCardName,
    id: purchase.id,
    occurrenceDate: purchase.purchaseDate,
    recordKind: 'creditCardPurchase',
    signedAmountInCents: -purchase.amountInCents,
    tags: mapRecordTags(purchase.tagIds, tagLookup),
    type: 'expense',
    updatedAt: purchase.updatedAt,
  };
}

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

  async getProvisionsSnapshot(
    userId: string,
  ): Promise<ProvisionsPlanningSnapshot> {
    const referenceDate = this.now().toISOString().slice(0, 10);
    const snapshot = await this.dataAccess.provisions.getSnapshot(userId);

    return {
      ...snapshot,
      projectedOccurrences: buildProjectedProvisionOccurrences(snapshot, {
        currentDate: referenceDate,
        totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
      }),
    };
  }

  async getVariableExpenseSnapshot(
    userId: string,
  ): Promise<VariableExpenseSnapshot> {
    const referenceDate = this.now().toISOString().slice(0, 10);
    const [accountsSnapshot, transactionsSnapshot, settings, overrides] =
      await Promise.all([
        this.getAccountsSnapshot(userId),
        this.listTransactions(userId),
        this.getHorizonSettings(userId),
        this.dataAccess.variableExpenseOverrides.listByUserId(userId),
      ]);

    return {
      overrides,
      projectedOccurrences: buildProjectedVariableExpenseOccurrences(
        accountsSnapshot,
        transactionsSnapshot,
        {
          currentDate: referenceDate,
          overrides: overrides.map(toVariableExpenseOverride),
          totalMonths: OFFICIAL_HORIZON_TOTAL_MONTHS,
          windowInMonths: settings.variableExpenseWindowInMonths,
        },
      ),
    };
  }

  async getTagsSnapshot(userId: string): Promise<TagsSnapshot> {
    return this.dataAccess.tags.getSnapshot(userId);
  }

  async listFinancialRecords(
    userId: string,
    filters: FinancialRecordFilter = {},
  ): Promise<FinancialRecordQuerySnapshot> {
    const records = await this.buildFinancialRecordsForUser(userId);

    return buildFinancialRecordQuerySnapshot(records, filters);
  }

  async getFinancialAnalytics(
    userId: string,
    filters: FinancialRecordFilter = {},
  ): Promise<FinancialAnalyticsSnapshot> {
    const records = await this.buildFinancialRecordsForUser(userId);

    return buildFinancialAnalyticsSnapshot(records, filters);
  }

  async createTag(
    userId: string,
    input: CreateTagInput,
    context: FinanceRequestContext,
  ): Promise<TagListItem> {
    const sanitizedInput = sanitizeTagInput(input);
    const issues = validateTagInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const tag = await this.database.runInTransaction(async (transaction) => {
      const createdTag = await this.dataAccess.tags.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );
      const tag = await this.dataAccess.tags.findListItemById(
        userId,
        createdTag.id,
        transaction,
      );

      if (!tag) {
        throw new AppError(500, 'FINANCE_TAG_CREATE_FAILED', 'Falha ao criar tag.');
      }

      await this.insertAuditEvent(
        transaction,
        userId,
        'tag',
        tag.id,
        'TAG_CREATED',
        context,
        {
          name: tag.name,
        },
      );

      return tag;
    });

    return tag;
  }

  async updateTag(
    userId: string,
    input: UpdateTagInput,
    context: FinanceRequestContext,
  ): Promise<TagListItem> {
    const sanitizedInput = sanitizeTagInput(input);
    const issues = validateTagInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    return this.database.runInTransaction(async (transaction) => {
      const tag = await this.dataAccess.tags.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'tag',
        tag.id,
        'TAG_UPDATED',
        context,
        {
          name: tag.name,
        },
      );

      return tag;
    });
  }

  async deleteTag(
    userId: string,
    tagId: string,
    context: FinanceRequestContext,
  ): Promise<TagListItem> {
    return this.database.runInTransaction(async (transaction) => {
      const tag = await this.dataAccess.tags.delete(userId, tagId, transaction);

      await this.insertAuditEvent(
        transaction,
        userId,
        'tag',
        tag.id,
        'TAG_DELETED',
        context,
        {
          name: tag.name,
        },
      );

      return tag;
    });
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

  async createProvision(
    userId: string,
    input: CreateProvisionInput,
    context: FinanceRequestContext,
  ): Promise<ProvisionListItem> {
    const sanitizedInput = sanitizeProvisionInput(input);
    const issues = validateProvisionInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const provision = await this.database.runInTransaction(async (transaction) => {
      const provision = await this.dataAccess.provisions.create(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'provision',
        provision.id,
        'PROVISION_CREATED',
        context,
        {
          accountId: provision.accountId,
          targetAmountInCents: provision.targetAmountInCents,
          targetDate: provision.targetDate,
        },
      );

      return provision;
    });

    this.invalidateHorizonCache(userId);

    return provision;
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

  async updateProvision(
    userId: string,
    input: UpdateProvisionInput,
    context: FinanceRequestContext,
  ): Promise<ProvisionListItem> {
    const sanitizedInput = sanitizeProvisionInput(input);
    const issues = validateProvisionInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const provision = await this.database.runInTransaction(async (transaction) => {
      const provision = await this.dataAccess.provisions.update(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'provision',
        provision.id,
        'PROVISION_UPDATED',
        context,
        {
          accountId: provision.accountId,
          targetAmountInCents: provision.targetAmountInCents,
          targetDate: provision.targetDate,
        },
      );

      return provision;
    });

    this.invalidateHorizonCache(userId);

    return provision;
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

  async redeemProvision(
    userId: string,
    input: RedeemProvisionInput,
    context: FinanceRequestContext,
  ): Promise<ProvisionListItem> {
    const issues = validateProvisionRedeemInput(input);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const provision = await this.database.runInTransaction(async (transaction) => {
      const provision = await this.dataAccess.provisions.redeem(
        userId,
        input,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'provision',
        provision.id,
        'PROVISION_REDEEMED',
        context,
        {
          accountId: provision.accountId,
          redeemedAt: provision.redeemedAt,
          targetAmountInCents: provision.targetAmountInCents,
        },
      );

      return provision;
    });

    this.invalidateHorizonCache(userId);

    return provision;
  }

  async upsertVariableExpenseOverride(
    userId: string,
    input: VariableExpenseOverride,
    context: FinanceRequestContext,
  ): Promise<VariableExpenseOverrideListItem> {
    const sanitizedInput = sanitizeVariableExpenseOverrideInput(input);
    const issues = validateVariableExpenseOverrideInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const override = await this.database.runInTransaction(async (transaction) => {
      const previousOverride =
        await this.dataAccess.variableExpenseOverrides.findByNaturalKey(
          userId,
          sanitizedInput,
          transaction,
        );
      const override = await this.dataAccess.variableExpenseOverrides.upsert(
        userId,
        sanitizedInput,
        this.now(),
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'variable_expense_override',
        override.id,
        previousOverride
          ? 'VARIABLE_EXPENSE_OVERRIDE_UPDATED'
          : 'VARIABLE_EXPENSE_OVERRIDE_CREATED',
        context,
        {
          accountId: override.accountId,
          amountInCents: override.amountInCents,
          description: override.description,
          occurrenceDate: override.occurrenceDate,
        },
      );

      return override;
    });

    this.invalidateHorizonCache(userId);

    return override;
  }

  async removeVariableExpenseOverride(
    userId: string,
    input: RemoveVariableExpenseOverrideInput,
    context: FinanceRequestContext,
  ): Promise<VariableExpenseOverrideListItem> {
    const sanitizedInput = sanitizeVariableExpenseOverrideInput(input);
    const issues = validateRemoveVariableExpenseOverrideInput(sanitizedInput);

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Dados invalidos.', issues);
    }

    const override = await this.database.runInTransaction(async (transaction) => {
      const override = await this.dataAccess.variableExpenseOverrides.remove(
        userId,
        sanitizedInput,
        transaction,
      );

      await this.insertAuditEvent(
        transaction,
        userId,
        'variable_expense_override',
        override.id,
        'VARIABLE_EXPENSE_OVERRIDE_REMOVED',
        context,
        {
          accountId: override.accountId,
          amountInCents: override.amountInCents,
          description: override.description,
          occurrenceDate: override.occurrenceDate,
        },
      );

      return override;
    });

    this.invalidateHorizonCache(userId);

    return override;
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
    const [
      accountsSnapshot,
      contractsSnapshot,
      creditCardsSnapshot,
      installmentsSnapshot,
      provisionsSnapshot,
      transactionsSnapshot,
      variableExpenseOverrides,
    ] = await Promise.all([
      this.getAccountsSnapshot(userId),
      this.getContractsSnapshot(userId),
      this.getCreditCardsSnapshot(userId),
      this.getInstallmentsSnapshot(userId),
      this.dataAccess.provisions.getSnapshot(userId),
      this.listTransactions(userId),
      this.dataAccess.variableExpenseOverrides.listByUserId(userId),
    ]);
    const snapshot = buildOfficialHorizonSnapshot({
      accountsSnapshot,
      contractsSnapshot,
      creditCardsSnapshot,
      generatedAt,
      installmentsSnapshot,
      provisionsSnapshot,
      referenceDate,
      settings,
      transactionsSnapshot,
      variableExpenseOverrides: variableExpenseOverrides.map(
        toVariableExpenseOverride,
      ),
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

  private async buildFinancialRecordsForUser(
    userId: string,
  ): Promise<FinancialRecordListItem[]> {
    const currentDate = this.now().toISOString().slice(0, 10);
    const [cards, purchases, tags, transactions] = await Promise.all([
      this.dataAccess.creditCards.listByUserId(userId, currentDate),
      this.dataAccess.creditCards.listPurchasesByUserId(userId),
      this.dataAccess.tags.listByUserId(userId),
      this.dataAccess.manualTransactions.listByUserId(userId),
    ]);
    const creditCardNameById = cards.reduce<Map<string, string>>((map, card) => {
      map.set(card.id, card.name);

      return map;
    }, new Map());
    const tagLookup = buildTagLookup(tags);

    return [
      ...transactions.map((transaction) =>
        mapTransactionToFinancialRecord(transaction, tagLookup),
      ),
      ...purchases.map((purchase) =>
        mapCreditCardPurchaseToFinancialRecord(
          purchase,
          tagLookup,
          creditCardNameById.get(purchase.creditCardId) ?? purchase.creditCardName,
        ),
      ),
    ];
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