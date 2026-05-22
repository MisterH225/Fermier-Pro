import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAIInsights,
  refreshAIInsightsInBackground,
  type FetchAIInsightsResult
} from "../services/ai/AIRecommendationService";
import { canRequestAIInsights } from "../services/ai/DataAggregator";
import type { AIInsight, AIModuleKey } from "../services/ai/aiTypes";

type Options = {
  farmId: string | null | undefined;
  module: AIModuleKey;
  accessToken: string | null | undefined;
  activeProfileId?: string | null;
  enabled?: boolean;
  hasMinimalData?: boolean;
};

export function useAIInsights({
  farmId,
  module,
  accessToken,
  activeProfileId,
  enabled = true,
  hasMinimalData = true
}: Options) {
  const [items, setItems] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const mounted = useRef(true);

  const canRun =
    enabled &&
    canRequestAIInsights(module, {
      hasFarmId: Boolean(farmId),
      hasMinimalData
    }) &&
    Boolean(accessToken);

  const applyResult = useCallback((res: FetchAIInsightsResult) => {
    if (!mounted.current) {
      return;
    }
    setItems(res.items);
    setFromCache(res.fromCache);
    setLoading(false);
  }, []);

  const run = useCallback(
    async (forceRefresh?: boolean) => {
      if (!canRun || !farmId || !accessToken) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      if (!forceRefresh) {
        const cached = await loadAIInsights({
          farmId,
          module,
          accessToken,
          activeProfileId,
          forceRefresh: false
        });
        if (cached.items.length) {
          applyResult(cached);
          void refreshAIInsightsInBackground({
            farmId,
            module,
            accessToken,
            activeProfileId,
            onUpdate: (next) => {
              if (mounted.current) {
                setItems(next);
                setFromCache(false);
              }
            }
          });
          return;
        }
      }
      const res = await loadAIInsights({
        farmId,
        module,
        accessToken,
        activeProfileId,
        forceRefresh: Boolean(forceRefresh)
      });
      applyResult(res);
    },
    [canRun, farmId, module, accessToken, activeProfileId, applyResult]
  );

  useEffect(() => {
    mounted.current = true;
    void run(false);
    return () => {
      mounted.current = false;
    };
  }, [run]);

  const refresh = useCallback(() => {
    void run(true);
  }, [run]);

  return {
    items,
    primary: items[0] ?? null,
    loading: loading && items.length === 0,
    fromCache,
    refresh,
    visible: items.length > 0 || loading
  };
}
