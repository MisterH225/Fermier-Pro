import { apiGetJson, apiPostJson } from "./http";

export type CrossRatingSummaryDto = {
  avg: number | null;
  count: number;
};

export type CreateBuyerCrossRatingBody = {
  marketplaceTransactionId?: string;
  merchantOrderId?: string;
  score: number;
  comment?: string;
};

export type CreateMerchantCrossRatingBody = {
  merchantOrderId: string;
  score: number;
  comment?: string;
};

export type CreateTechnicianCrossRatingBody = {
  technicianUserId: string;
  farmId: string;
  score: number;
  comment?: string;
};

export type CreateFarmMarketRatingBody = {
  farmId: string;
  score: number;
  comment?: string;
};

export type PendingCrossRatingsDto = {
  marketplaceBuyer?: Array<{
    marketplaceTransactionId: string;
    buyerUserId: string;
    closedAt: string | null;
  }>;
  merchantBuyer?: Array<{
    merchantOrderId: string;
    buyerUserId: string;
    completedAt: string | null;
  }>;
  merchantSeller?: Array<{
    merchantOrderId: string;
    sellerUserId: string;
    completedAt: string | null;
  }>;
  technicians?: Array<{
    farmId: string;
    farmName: string;
    technicianUserId: string;
    technicianName: string | null;
    periodYearMonth: string;
  }>;
};

/** POST /api/v1/cross-ratings/buyer */
export function createBuyerCrossRating(
  accessToken: string,
  body: CreateBuyerCrossRatingBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson("/cross-ratings/buyer", body, accessToken, activeProfileId);
}

/** POST /api/v1/cross-ratings/merchant */
export function createMerchantCrossRating(
  accessToken: string,
  body: CreateMerchantCrossRatingBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson(
    "/cross-ratings/merchant",
    body,
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/cross-ratings/technician */
export function createTechnicianCrossRating(
  accessToken: string,
  body: CreateTechnicianCrossRatingBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson(
    "/cross-ratings/technician",
    body,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/cross-ratings/pending */
export function fetchPendingCrossRatings(
  accessToken: string,
  activeProfileId?: string | null
): Promise<PendingCrossRatingsDto> {
  return apiGetJson<PendingCrossRatingsDto>(
    "/cross-ratings/pending",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/cross-ratings/{buyer|merchant|technician}/:userId/summary */
export function fetchCrossRatingSummary(
  accessToken: string,
  kind: "buyer" | "merchant" | "technician",
  userId: string,
  activeProfileId?: string | null
): Promise<CrossRatingSummaryDto> {
  return apiGetJson<CrossRatingSummaryDto>(
    `/cross-ratings/${kind}/${encodeURIComponent(userId)}/summary`,
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/marketplace/farm-ratings */
export function createFarmMarketRating(
  accessToken: string,
  body: CreateFarmMarketRatingBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson(
    "/marketplace/farm-ratings",
    body,
    accessToken,
    activeProfileId
  );
}
