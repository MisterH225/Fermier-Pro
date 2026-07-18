import { useQuery } from "@tanstack/react-query";
import { useSession } from "../context/SessionContext";
import { fetchMyProducerScore } from "../lib/api";
import {
  profileHasMeteoScore,
  type MeteoProfileType
} from "../components/meteo/meteoHeaderModel";

export type MeteoScoreView = {
  numericScore: number;
  isNew: boolean;
  apiLabel: string | null;
  emoji: string | null;
  color: string | null;
};

/**
 * Source de données météo pour le header — consomme le score v1 actuel.
 * Agnostique de la version : quand TRUST_SCORE_V2_ACTIVE passera à true,
 * on branchera ici l'endpoint trust-score sans changer MeteoHeaderButton.
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
      if (profileType !== "producer") {
        return null;
      }
      const row = await fetchMyProducerScore(accessToken!, activeProfileId);
      return {
        numericScore: row.globalValue,
        isNew: row.score === "nouveau",
        apiLabel: row.label ?? null,
        emoji: row.emoji ?? null,
        color: row.color ?? null
      };
    }
  });
}
