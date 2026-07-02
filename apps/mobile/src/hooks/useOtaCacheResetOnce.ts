import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { useEffect } from "react";

const OTA_CACHE_RESET_KEY = "ota_cache_reset_v19";

/**
 * Au premier lancement build 19+, purge le cache OTA hérité (runtime exposdk:54.0.0)
 * qui pouvait charger un bundle JS corrompu et crasher avant React.
 */
export function useOtaCacheResetOnce() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    void (async () => {
      try {
        const done = await AsyncStorage.getItem(OTA_CACHE_RESET_KEY);
        if (done === "1") {
          return;
        }
        await Updates.clearUpdateCacheExperimentalAsync();
        await AsyncStorage.setItem(OTA_CACHE_RESET_KEY, "1");
      } catch {
        // Cache non disponible — le nouveau runtimeVersion isole déjà le binaire.
      }
    })();
  }, []);
}
