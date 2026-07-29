import { apiGetJson } from "./http";

export type TrustScoreProfileType =
  | "producer"
  | "buyer"
  | "merchant"
  | "vet"
  | "technician";

export type TrustScoreLevel =
  | "ensoleille"
  | "eclaircies"
  | "nuageux"
  | "orageux"
  | "nouvelle";

export type TrustScoreVisibility = "self" | "counterpart" | "public";

export type PillarEvidence =
  | { kind: "ratio"; good: number; total: number }
  | { kind: "duration"; averageMinutes: number }
  | { kind: "count"; value: number }
  | { kind: "rating"; average: number; count: number }
  | null;

export type TrustScorePillarDto = {
  key: string;
  score: number;
  weight: number;
  sampleSize: number;
  hintKey: string;
  evidence: PillarEvidence;
};

export type TrustScoreRatingsSummaryDto = {
  average: number | null;
  count: number;
};

export type TrustScoreDto = {
  score: number;
  level: TrustScoreLevel;
  pillars: TrustScorePillarDto[];
  isNew: boolean;
  profileType: TrustScoreProfileType;
  scoreVersion: number;
  v2Active: boolean;
  sampleSizes: Record<string, number>;
  computedAt: string;
  ratingsSummary: TrustScoreRatingsSummaryDto;
  visibility: TrustScoreVisibility;
};

function profileTypeQuery(profileType: TrustScoreProfileType): string {
  return `profileType=${encodeURIComponent(profileType)}`;
}

/** GET /api/v1/trust-score/me?profileType= */
export function fetchMyTrustScore(
  accessToken: string,
  profileType: TrustScoreProfileType,
  activeProfileId?: string | null
): Promise<TrustScoreDto> {
  return apiGetJson<TrustScoreDto>(
    `/trust-score/me?${profileTypeQuery(profileType)}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/trust-score/counterpart/:userId?profileType= */
export function fetchCounterpartTrustScore(
  accessToken: string,
  userId: string,
  profileType: TrustScoreProfileType,
  activeProfileId?: string | null
): Promise<TrustScoreDto> {
  return apiGetJson<TrustScoreDto>(
    `/trust-score/counterpart/${encodeURIComponent(userId)}?${profileTypeQuery(profileType)}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/trust-score/public/:userId?profileType= */
export function fetchPublicTrustScore(
  accessToken: string,
  userId: string,
  profileType: TrustScoreProfileType,
  activeProfileId?: string | null
): Promise<TrustScoreDto> {
  return apiGetJson<TrustScoreDto>(
    `/trust-score/public/${encodeURIComponent(userId)}?${profileTypeQuery(profileType)}`,
    accessToken,
    activeProfileId
  );
}
