import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AIInsight, AIModuleKey } from "./aiTypes";
import { AI_CACHE_TTL_MS } from "./aiTypes";

type CachedPayload = {
  items: AIInsight[];
  generatedAt: string;
  cachedAt: number;
};

function cacheKey(farmId: string, module: AIModuleKey): string {
  return `@fermier_pro/ai_insights/${farmId}/${module}`;
}

export async function readAICache(
  farmId: string,
  module: AIModuleKey,
  options?: { allowExpired?: boolean }
): Promise<CachedPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(farmId, module));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedPayload;
    const ttl = AI_CACHE_TTL_MS[module];
    if (
      !options?.allowExpired &&
      Date.now() - parsed.cachedAt > ttl
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeAICache(
  farmId: string,
  module: AIModuleKey,
  items: AIInsight[],
  generatedAt: string
): Promise<void> {
  try {
    const payload: CachedPayload = {
      items,
      generatedAt,
      cachedAt: Date.now()
    };
    await AsyncStorage.setItem(
      cacheKey(farmId, module),
      JSON.stringify(payload)
    );
  } catch {
    /* silencieux */
  }
}

export async function invalidateAICache(
  farmId: string,
  module?: AIModuleKey
): Promise<void> {
  try {
    if (module) {
      await AsyncStorage.removeItem(cacheKey(farmId, module));
      return;
    }
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `@fermier_pro/ai_insights/${farmId}/`;
    const toRemove = keys.filter((k) => k.startsWith(prefix));
    if (toRemove.length) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    /* silencieux */
  }
}
