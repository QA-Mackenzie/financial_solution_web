import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateAccountInput,
  CreateTransactionInput,
  UpdateAccountInput,
  UpdateTransactionInput,
} from '@shf/contracts';

import { financeApi } from '../../lib/api';

export const accountsSnapshotQueryKey = ['finance', 'accounts', 'snapshot'];
export const transactionsSnapshotQueryKey = ['finance', 'transactions', 'snapshot'];

async function invalidateFinancialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: accountsSnapshotQueryKey }),
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