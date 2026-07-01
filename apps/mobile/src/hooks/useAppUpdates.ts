import * as Updates from "expo-updates";
import { useEffect } from "react";

/**
 * Applique une mise à jour EAS une fois téléchargée par le moteur natif (ON_LOAD).
 * Ne pas appeler checkForUpdateAsync/fetchUpdateAsync ici : cela entre en conflit
 * avec la vérification native au lancement et peut faire crasher iOS (expo/expo#21347).
 */
export function useAppUpdates() {
  const { isUpdatePending } = Updates.useUpdates();

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || !isUpdatePending) {
      return;
    }

    void Updates.reloadAsync().catch(() => {
      // Réseau ou timing — l'OTA sera appliquée au prochain lancement.
    });
  }, [isUpdatePending]);
}
