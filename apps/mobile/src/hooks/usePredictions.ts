import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadPredictions,
  refreshPredictionsInBackground
} from "../services/ai/PredictiveAgent";
import type {
  FarmPredictionsResult,
  PredictionMenuKey
} from "../services/ai/predictionTypes";

type Options = {
  farmId: string | null | undefined;
  menu: PredictionMenuKey;
  accessToken: string | null | undefined;
  activeProfileId?: string | null;
  enabled?: boolean;
};

export function usePredictions({
  farmId,
  menu,
  accessToken,
  activeProfileId,
  enabled = true
}: Options) {
  const [data, setData] = useState<FarmPredictionsResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const canRun = enabled && Boolean(farmId && accessToken);

  const run = useCallback(
    async (force?: boolean) => {
      if (!canRun || !farmId || !accessToken) {
        return;
      }
      if (force) {
        setRefreshing(true);
      }
      try {
        const res = await loadPredictions({
          farmId,
          menu,
          accessToken,
          activeProfileId,
          forceRefresh: force
        });
        if (mounted.current) {
          setData(res);
        }
        if (!force) {
          void refreshPredictionsInBackground({
            farmId,
            menu,
            accessToken,
            activeProfileId,
            onUpdate: (next) => {
              if (mounted.current) {
                setData(next);
              }
            }
          });
        }
      } catch {
        /* affichage discret — pas de crash */
      } finally {
        if (mounted.current) {
          setRefreshing(false);
        }
      }
    },
    [canRun, farmId, menu, accessToken, activeProfileId]
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
    data,
    refreshing,
    refresh,
    visible: data != null
  };
}
