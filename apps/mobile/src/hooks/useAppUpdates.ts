import * as Updates from "expo-updates";
import { useEffect } from "react";

/**
 * Télécharge et applique une mise à jour EAS au lancement (builds TestFlight / prod).
 * Sans reload explicite, l'OTA peut rester en cache et ne jamais s'afficher (fallback 5 s).
 */
export function useAppUpdates() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (cancelled || !result.isAvailable) {
          return;
        }
        await Updates.fetchUpdateAsync();
        if (!cancelled) {
          await Updates.reloadAsync();
        }
      } catch {
        // Réseau lent ou serveur indisponible — l'app démarre avec le bundle embarqué.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
