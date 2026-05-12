import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@fermier_pro/app_locale";

export type AppLocaleCode = "fr" | "en";

export const DEFAULT_APP_LOCALE: AppLocaleCode = "fr";

export async function getStoredAppLocale(): Promise<AppLocaleCode> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === "en" || raw === "fr") {
    return raw;
  }
  return DEFAULT_APP_LOCALE;
}

export async function setStoredAppLocale(code: AppLocaleCode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, code);
}
