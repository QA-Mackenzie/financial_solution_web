import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePrivacyRequestInput } from '@economy-cash/contracts';

import { authApi } from '../../lib/api';

export const privacyRequestsQueryKey = ['auth', 'privacy', 'requests'];

export function usePrivacyRequestsQuery() {
  return useQuery({
    queryFn: authApi.getPrivacyRequests,
    queryKey: privacyRequestsQueryKey,
  });
}

export function useCreatePrivacyRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePrivacyRequestInput) =>
      authApi.createPrivacyRequest(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: privacyRequestsQueryKey,
      });
    },
  });
}