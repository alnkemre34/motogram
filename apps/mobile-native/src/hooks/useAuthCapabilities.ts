import { useQuery } from '@tanstack/react-query';

import { fetchAuthCapabilities } from '../api/auth.api';

export function useAuthCapabilities() {
  return useQuery({
    queryKey: ['auth', 'capabilities'] as const,
    queryFn: fetchAuthCapabilities,
    staleTime: 5 * 60_000,
  });
}
