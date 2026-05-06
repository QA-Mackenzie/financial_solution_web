import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, SessionPayload } from '@shf/contracts';

import { authApi } from '../../lib/api';

export const sessionQueryKey = ['session'];

export function useSessionQuery() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: authApi.getSession,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: (session: SessionPayload) => {
      queryClient.setQueryData(sessionQueryKey, session);
    },
  });
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (session: SessionPayload) => {
      queryClient.setQueryData(sessionQueryKey, session);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.setQueryData(sessionQueryKey, null);
    },
  });
}
