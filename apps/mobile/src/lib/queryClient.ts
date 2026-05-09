import NetInfo from "@react-native-community/netinfo";
import { QueryClient, onlineManager } from "@tanstack/react-query";

/**
 * TanStack Query sait quand le téléphone est hors ligne (pause / reprise des fetch).
 * @see https://tanstack.com/query/latest/docs/framework/react/react-native
 */
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      /** Conservé assez longtemps pour la réhydratation cache offline (persist). */
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount) => {
        if (!onlineManager.isOnline()) {
          return false;
        }
        return failureCount < 1;
      }
    }
  }
});
