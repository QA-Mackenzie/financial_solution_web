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
  CreateTransactionInput,
  EndContractInput,
  RedeemProvisionInput,
  RemoveVariableExpenseOverrideInput,
  UpdateHorizonSettingsInput,
  UpdateContractInput,
  UpdateAccountInput,
  UpdateCreditCardInput,
  UpdateCreditCardPurchaseInput,
  UpdateInstallmentPlanInput,
  UpdateProvisionInput,
  UpdateTransactionInput,
  VariableExpenseOverride,
} from '@shf/contracts';

import { financeApi } from '../../lib/api';

export const accountsSnapshotQueryKey = ['finance', 'accounts', 'snapshot'];
export const creditCardsSnapshotQueryKey = ['finance', 'credit-cards', 'snapshot'];
export const contractsSnapshotQueryKey = ['finance', 'contracts', 'snapshot'];
export const horizonSnapshotQueryKey = ['finance', 'horizon', 'snapshot'];
export const installmentsSnapshotQueryKey = ['finance', 'installments', 'snapshot'];
export const provisionsSnapshotQueryKey = ['finance', 'provisions', 'snapshot'];
export const transactionsSnapshotQueryKey = ['finance', 'transactions', 'snapshot'];
export const variableExpenseSnapshotQueryKey = [
  'finance',
  'variable-expense',
  'snapshot',
];

async function invalidateFinancialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: creditCardsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: contractsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: horizonSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: installmentsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: provisionsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: transactionsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: variableExpenseSnapshotQueryKey }),
  ]);
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
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAccountInput) => financeApi.updateAccount(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useArchiveAccountMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeApi.archiveAccount(id),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTransactionInput) => financeApi.createTransaction(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContractInput) => financeApi.createContract(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateCreditCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCreditCardInput) => financeApi.createCreditCard(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateCreditCardMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCreditCardInput) => financeApi.updateCreditCard(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateCreditCardPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCreditCardPurchaseInput) =>
      financeApi.createCreditCardPurchase(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateCreditCardPurchaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateCreditCardPurchaseInput) =>
      financeApi.updateCreditCardPurchase(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateContractInput) => financeApi.updateContract(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateContractAdjustmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateContractAdjustmentInput) =>
      financeApi.createContractAdjustment(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useEndContractMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EndContractInput) => financeApi.endContract(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => financeApi.updateTransaction(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => financeApi.deleteTransaction(id),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateHorizonSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHorizonSettingsInput) =>
      financeApi.updateHorizonSettings(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateInstallmentPlanInput) =>
      financeApi.createInstallmentPlan(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInstallmentPlanInput) =>
      financeApi.updateInstallmentPlan(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useAnticipateInstallmentPlanMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AnticipateInstallmentPlanInput) =>
      financeApi.anticipateInstallmentPlan(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useCreateProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProvisionInput) => financeApi.createProvision(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpdateProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProvisionInput) => financeApi.updateProvision(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useRedeemProvisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RedeemProvisionInput) => financeApi.redeemProvision(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useUpsertVariableExpenseOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VariableExpenseOverride) =>
      financeApi.upsertVariableExpenseOverride(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}

export function useRemoveVariableExpenseOverrideMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RemoveVariableExpenseOverrideInput) =>
      financeApi.removeVariableExpenseOverride(input),
    onSuccess: async () => invalidateFinancialQueries(queryClient),
  });
}