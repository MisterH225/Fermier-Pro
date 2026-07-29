import { useQuery } from "@tanstack/react-query";
import { useSession } from "../context/SessionContext";
import {
  fetchMyProducerScore,
  fetchMyTrustScore,
  type TrustScoreProfileType
} from "../lib/api";
import {
  profileHasMeteoScore,
  type MeteoProfileType
} from "../components/meteo/meteoHeaderModel";
import { getTrustLevelPresentation } from "../components/meteo/trustLevelPresentation";

export type MeteoScoreView = {
  numericScore: number;
  isNew: boolean;
  apiLabel: string | null;
  emoji: string | null;
  color: string | null;
  v2Active?: boolean;
};

/**
 * Source de données météo pour le header.
 * - v2Active=false : producteur reste sur score v1 numérique ; autres profils → null
 *   (le sheet peut quand même appeler trust-score/me via useTrustScore).
 * - v2Active=true : trust-score pour les 5 profils.
 */
export function useMeteoScore(profileType: MeteoProfileType) {
  const { accessToken, activeProfileId } = useSession();
  const enabled =
    Boolean(accessToken) && profileHasMeteoScore(profileType);

  return useQuery({
    queryKey: ["meteoScore", profileType, activeProfileId],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MeteoScoreView | null> => {
      const token = accessToken!;
      const trustType = profileType as TrustScoreProfileType;

      // Probe trust-score pour connaître v2Active (et servir le score si actif).
      let trust = null as Awaited<ReturnType<typeof fetchMyTrustScore>> | null;
      try {
        trust = await fetchMyTrustScore(token, trustType, activeProfileId);
      } catch {
        trust = null;
      }

      if (trust?.v2Active) {
        const presentation = getTrustLevelPresentation(trust.level);
        return {
          numericScore: trust.score,
          isNew: trust.isNew || trust.level === "nouvelle",
          apiLabel: trust.level,
          emoji: presentation.icon,
          color: presentation.tint,
          v2Active: true
        };
      }

      // Shadow / v1 : garder le score producteur v1 pour le header numérique.
      if (profileType === "producer") {
        const row = await fetchMyProducerScore(token, activeProfileId);
        return {
          numericScore: row.globalValue,
          isNew: row.score === "nouveau",
          apiLabel: row.label ?? null,
          emoji: row.emoji ?? null,
          color: row.color ?? null,
          v2Active: false
        };
      }

      return null;
    }
  });
}
