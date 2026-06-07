import { fetchAIRecommendations } from "../../lib/api";
import { invalidateAICache, readAICache, writeAICache } from "./AICache";
import { parseAIInsights } from "./ResponseParser";
import type { AIInsight, AIModuleKey } from "./aiTypes";

export type FetchAIInsightsResult = {
  items: AIInsight[];
  fromCache: boolean;
  loading: boolean;
  unavailable: boolean;
  insufficient: boolean;
};

export async function loadAIInsights(options: {
  farmId: string;
  module: AIModuleKey;
  accessToken: string;
  activeProfileId?: string | null;
  forceRefresh?: boolean;
}): Promise<FetchAIInsightsResult> {
  const { farmId, module, accessToken, activeProfileId, forceRefresh } = options;

  if (!forceRefresh) {
    const cached = await readAICache(farmId, module);
    if (cached?.items.length) {
      return {
        items: cached.items,
        fromCache: true,
        loading: false,
        unavailable: false,
        insufficient: false
      };
    }
  }

  try {
    const res = await fetchAIRecommendations(
      accessToken,
      { farmId, module },
      activeProfileId
    );

    if (res.insufficient || res.unavailable || !res.items?.length) {
      const stale = await readAICache(farmId, module, {
        allowExpired: true
      });
      if (stale?.items.length) {
        return {
          items: stale.items,
          fromCache: true,
          loading: false,
          unavailable: Boolean(res.unavailable),
          insufficient: Boolean(res.insufficient)
        };
      }
      return {
        items: [],
        fromCache: false,
        loading: false,
        unavailable: Boolean(res.unavailable),
        insufficient: Boolean(res.insufficient)
      };
    }

    const items = parseAIInsights(res.items, module);
    if (items.length) {
      await writeAICache(farmId, module, items, res.generatedAt);
    }

    return {
      items,
      fromCache: false,
      loading: false,
      unavailable: false,
      insufficient: false
    };
  } catch {
    const stale = await readAICache(farmId, module, { allowExpired: true });
    if (stale?.items.length) {
      return {
        items: stale.items,
        fromCache: true,
        loading: false,
        unavailable: true,
        insufficient: false
      };
    }
    return {
      items: [],
      fromCache: false,
      loading: false,
      unavailable: true,
      insufficient: false
    };
  }
}

export async function refreshAIInsightsInBackground(options: {
  farmId: string;
  module: AIModuleKey;
  accessToken: string;
  activeProfileId?: string | null;
  onUpdate?: (items: AIInsight[]) => void;
}): Promise<void> {
  const result = await loadAIInsights({
    ...options,
    forceRefresh: true
  });
  if (result.items.length) {
    options.onUpdate?.(result.items);
  }
}

export { invalidateAICache as invalidateAIInsights };
