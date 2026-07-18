import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  fetchAfterFarrowingInsight,
  fetchAfterSaleInsight,
  fetchAfterWeighingInsight,
  safeInsightFetch,
  type InsightDto
} from "../lib/api/insights";
import { formatInsightMessage } from "../lib/insightsI18n";

type Auth = {
  accessToken: string;
  farmId: string;
  activeProfileId?: string | null;
};

/**
 * Charge un insight post-saisie (timeout 2 s). Échec / 204 → null.
 * Ne pas appeler après une mutation offline (file).
 */
export function usePostSaveInsight() {
  const { t } = useTranslation();

  const resolveDetail = useCallback(
    (insight: InsightDto | null): string | undefined => {
      if (!insight) return undefined;
      return formatInsightMessage(t, insight).message;
    },
    [t]
  );

  const afterWeighing = useCallback(
    async (auth: Auth, animalId: string) =>
      resolveDetail(
        await safeInsightFetch(() =>
          fetchAfterWeighingInsight(
            auth.accessToken,
            auth.farmId,
            { animalId },
            auth.activeProfileId
          )
        )
      ),
    [resolveDetail]
  );

  const afterSale = useCallback(
    async (auth: Auth, exitId: string) =>
      resolveDetail(
        await safeInsightFetch(() =>
          fetchAfterSaleInsight(
            auth.accessToken,
            auth.farmId,
            exitId,
            auth.activeProfileId
          )
        )
      ),
    [resolveDetail]
  );

  const afterFarrowing = useCallback(
    async (auth: Auth, litterId: string) =>
      resolveDetail(
        await safeInsightFetch(() =>
          fetchAfterFarrowingInsight(
            auth.accessToken,
            auth.farmId,
            litterId,
            auth.activeProfileId
          )
        )
      ),
    [resolveDetail]
  );

  return { afterWeighing, afterSale, afterFarrowing };
}
