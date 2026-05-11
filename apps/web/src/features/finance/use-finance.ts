import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnticipateInstallmentPlanInput,
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
  FinancialRecordFilter,
  RedeemProvisionInput,
  RemoveVariableExpenseOverrideInput,
  UpdateHorizonSettingsInput,
  UpdateContractInput,
  UpdateAccountInput,
  UpdateCreditCardInput,
  UpdateCreditCardPurchaseInput,
  UpdateInstallmentPlanInput,
  UpdateProvisionInput,
  UpdateTagInput,
  UpdateTransactionInput,
  VariableExpenseOverride,
} from '@economy-cash/contracts';

import { financeApi } from '../../lib/api';

export const accountsSnapshotQueryKey = ['finance', 'accounts', 'snapshot'];
export const creditCardsSnapshotQueryKey = ['finance', 'credit-cards', 'snapshot'];
export const contractsSnapshotQueryKey = ['finance', 'contracts', 'snapshot'];
export const horizonSnapshotQueryKey = ['finance', 'horizon', 'snapshot'];
export const installmentsSnapshotQueryKey = ['finance', 'installments', 'snapshot'];
export const financialAnalyticsQueryKey = ['finance', 'analytics'];
export const financialRecordsQueryKey = ['finance', 'records'];
export const provisionsSnapshotQueryKey = ['finance', 'provisions', 'snapshot'];
export const tagsSnapshotQueryKey = ['finance', 'tags', 'snapshot'];
export const transactionsSnapshotQueryKey = ['finance', 'transactions', 'snapshot'];
export const variableExpenseSnapshotQueryKey = [
  'finance',
  'variable-expense',
  'snapshot',
];

const accountMutationQueryKeys = [
  accountsSnapshotQueryKey,
  creditCardsSnapshotQueryKey,
  contractsSnapshotQueryKey,
  financialAnalyticsQueryKey,
  financialRecordsQueryKey,
  horizonSnapshotQueryKey,
  installmentsSnapshotQueryKey,
  provisionsSnapshotQueryKey,
  transactionsSnapshotQueryKey,
  variableExpenseSnapshotQueryKey,
];

const transactionMutationQueryKeys = [
  accountsSnapshotQueryKey,
  financialAnalyticsQueryKey,
  financialRecordsQueryKey,
  horizonSnapshotQueryKey,
  tagsSnapshotQueryKey,
  transactionsSnapshotQueryKey,
  variableExpenseSnapshotQueryKey,
];

const tagMutationQueryKeys = [
  creditCardsSnapshotQueryKey,
  financialAnalyticsQueryKey,
  financialRecordsQueryKey,
  tagsSnapshotQueryKey,
  transactionsSnapshotQueryKey,
];

const contractMutationQueryKeys = [
  contractsSnapshotQueryKey,
  horizonSnapshotQueryKey,
];

const creditCardMutationQueryKeys = [
  creditCardsSnapshotQueryKey,
  financialAnalyticsQueryKey,
  financialRecordsQueryKey,
  horizonSnapshotQueryKey,
  installmentsSnapshotQueryKey,
];

const creditCardPurchaseMutationQueryKeys = [
  creditCardsSnapshotQueryKey,
  financialAnalyticsQueryKey,
  financialRecordsQueryKey,
  horizonSnapshotQueryKey,
  tagsSnapshotQueryKey,
];

const horizonSettingsMutationQueryKeys = [
  horizonSnapshotQueryKey,
  variableExpenseSnapshotQueryKey,
];

const installmentMutationQueryKeys = [
  creditCardsSnapshotQueryKey,
  horizonSnapshotQueryKey,
  installmentsSnapshotQueryKey,
];

const provisionMutationQueryKeys = [
  horizonSnapshotQueryKey,
  provisionsSnapshotQueryKey,
];

const variableExpenseMutationQueryKeys = [
  horizonSnapshotQueryKey,
  variableExpenseSnapshotQueryKey,
];

async function invalidateFinancialQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKeys: ReadonlyArray<ReadonlyArray<unknown>>,
) {
  await Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useAccountsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getAccountsSnapshot,
    queryKey: accountsSnapshotQueryKey,
  });
}

export function useTransactionsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getTransactionsSnapshot,
    queryKey: transactionsSnapshotQueryKey,
  });
}

export function useTagsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getTagsSnapshot,
    queryKey: tagsSnapshotQueryKey,
  });
}

export function useFinancialRecordsQuery(filters: FinancialRecordFilter) {
  return useQuery({
    queryFn: () => financeApi.getFinancialRecords(filters),
    queryKey: [...financialRecordsQueryKey, filters],
  });
}

export function useFinancialAnalyticsQuery(filters: FinancialRecordFilter) {
  return useQuery({
    queryFn: () => financeApi.getFinancialAnalytics(filters),
    queryKey: [...financialAnalyticsQueryKey, filters],
  });
}

export function useContractsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getContractsSnapshot,
    queryKey: contractsSnapshotQueryKey,
  });
}

export function useCreditCardsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getCreditCardsSnapshot,
    queryKey: creditCardsSnapshotQueryKey,
  });
}

export function useInstallmentsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getInstallmentsSnapshot,
    queryKey: installmentsSnapshotQueryKey,
  });
}

export function useProvisionsSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getProvisionsSnapshot,
    queryKey: provisionsSnapshotQueryKey,
  });
}

export function useVariableExpenseSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getVariableExpenseSnapshot,
    queryKey: variableExpenseSnapshotQueryKey,
  });
}

export function useHorizonSnapshotQuery() {
  return useQuery({
    queryFn: financeApi.getHorizonSnapshot,
    queryKey: horizonSnapshotQueryKey,
  });
}

export function useCreateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAccountInput) => financeApi.createAccount(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, accountMutationQueryKeys),
  });
}

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAccountInput) => financeApi.updateAccount(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, accountMutationQueryKeys),
  });
}

export function useArchiveAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeApi.archiveAccount(id),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, accountMutationQueryKeys),
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => financeApi.createTransaction(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, transactionMutationQueryKeys),
  });
}

export function useCreateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => financeApi.createTag(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, tagMutationQueryKeys),
  });
}

export function useCreateContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContractInput) => financeApi.createContract(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, contractMutationQueryKeys),
  });
}

export function useCreateCreditCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCreditCardInput) => financeApi.createCreditCard(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, creditCardMutationQueryKeys),
  });
}

export function useUpdateCreditCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCreditCardInput) => financeApi.updateCreditCard(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, creditCardMutationQueryKeys),
  });
}

export function useCreateCreditCardPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCreditCardPurchaseInput) =>
      financeApi.createCreditCardPurchase(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, creditCardPurchaseMutationQueryKeys),
  });
}

export function useUpdateCreditCardPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCreditCardPurchaseInput) =>
      financeApi.updateCreditCardPurchase(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, creditCardPurchaseMutationQueryKeys),
  });
}

export function useUpdateContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateContractInput) => financeApi.updateContract(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, contractMutationQueryKeys),
  });
}

export function useCreateContractAdjustmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContractAdjustmentInput) =>
      financeApi.createContractAdjustment(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, contractMutationQueryKeys),
  });
}

export function useEndContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EndContractInput) => financeApi.endContract(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, contractMutationQueryKeys),
  });
}

export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => financeApi.updateTransaction(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, transactionMutationQueryKeys),
  });
}

export function useUpdateTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTagInput) => financeApi.updateTag(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, tagMutationQueryKeys),
  });
}

export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, transactionMutationQueryKeys),
  });
}

export function useDeleteTagMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeApi.deleteTag(id),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, tagMutationQueryKeys),
  });
}

export function useUpdateHorizonSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHorizonSettingsInput) =>
      financeApi.updateHorizonSettings(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, horizonSettingsMutationQueryKeys),
  });
}

export function useCreateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInstallmentPlanInput) =>
      financeApi.createInstallmentPlan(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, installmentMutationQueryKeys),
  });
}

export function useUpdateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInstallmentPlanInput) =>
      financeApi.updateInstallmentPlan(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, installmentMutationQueryKeys),
  });
}

export function useAnticipateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnticipateInstallmentPlanInput) =>
      financeApi.anticipateInstallmentPlan(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, installmentMutationQueryKeys),
  });
}

export function useCreateProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProvisionInput) => financeApi.createProvision(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, provisionMutationQueryKeys),
  });
}

export function useUpdateProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProvisionInput) => financeApi.updateProvision(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, provisionMutationQueryKeys),
  });
}

export function useRedeemProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RedeemProvisionInput) => financeApi.redeemProvision(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, provisionMutationQueryKeys),
  });
}

export function useUpsertVariableExpenseOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VariableExpenseOverride) =>
      financeApi.upsertVariableExpenseOverride(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, variableExpenseMutationQueryKeys),
  });
}

export function useRemoveVariableExpenseOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RemoveVariableExpenseOverrideInput) =>
      financeApi.removeVariableExpenseOverride(input),
    onSuccess: async () =>
      invalidateFinancialQueries(queryClient, variableExpenseMutationQueryKeys),
  });
}