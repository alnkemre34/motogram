import { QueryClient } from '@tanstack/react-query';

// Spec 3.1 / .cursorrules madde 3 - react-query ZORUNLU
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
