import { useQuery } from "@tanstack/react-query";
import { useSession } from "../context/SessionContext";
import {
  fetchCounterpartTrustScore,
  fetchMyTrustScore,
  fetchPublicTrustScore,
  type TrustScoreDto,
  type TrustScoreProfileType,
  type TrustScoreVisibility
} from "../lib/api";

type Options = {
  profileType: TrustScoreProfileType;
  userId?: string | null;
  visibility?: TrustScoreVisibility;
  enabled?: boolean;
};

/**
 * Charge un trust-score (me / counterpart / public) pour la sheet explicative.
 * Disponible aussi en mode ombre (v2Active=false) pour le profil soi-même.
 */
export function useTrustScore({
  profileType,
  userId,
  visibility = userId ? "public" : "self",
  enabled = true
}: Options) {
  const { accessToken, activeProfileId } = useSession();
  const canFetch = Boolean(accessToken) && enabled;
  const needsUser =
    visibility === "public" || visibility === "counterpart"
      ? Boolean(userId)
      : true;

  return useQuery({
    queryKey: [
      "trustScore",
      visibility,
      profileType,
      userId ?? "me",
      activeProfileId
    ],
    enabled: canFetch && needsUser,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrustScoreDto> => {
      const token = accessToken!;
      if (visibility === "self" || !userId) {
        return fetchMyTrustScore(token, profileType, activeProfileId);
      }
      if (visibility === "counterpart") {
        return fetchCounterpartTrustScore(
          token,
          userId,
          profileType,
          activeProfileId
        );
      }
      return fetchPublicTrustScore(
        token,
        userId,
        profileType,
        activeProfileId
      );
    }
  });
}
