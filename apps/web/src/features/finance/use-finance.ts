import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAccountInput,
  CreateContractAdjustmentInput,
  CreateContractInput,
  CreateTransactionInput,
  EndContractInput,
  UpdateHorizonSettingsInput,
  UpdateContractInput,
  UpdateAccountInput,
  UpdateTransactionInput,
} from '@shf/contracts';

import { financeApi } from '../../lib/api';

export const accountsSnapshotQueryKey = ['finance', 'accounts', 'snapshot'];
export const contractsSnapshotQueryKey = ['finance', 'contracts', 'snapshot'];
export const horizonSnapshotQueryKey = ['finance', 'horizon', 'snapshot'];
export const transactionsSnapshotQueryKey = ['finance', 'transactions', 'snapshot'];

async function invalidateFinancialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: contractsSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: horizonSnapshotQueryKey }),
    queryClient.invalidateQueries({ queryKey: transactionsSnapshotQueryKey }),
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