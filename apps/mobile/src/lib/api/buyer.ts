import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";

// ─── Profil acheteur (`/buyers/me`) ─────────────────────────────────────────

export type UpsertBuyerProfileBody = {
  buyerType?: string;
  businessName?: string;
  locationLabel?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  searchRadiusKm?: number;
  preferredCategories?: string[];
  priceRangeMin?: number;
  priceRangeMax?: number;
  typicalVolume?: string;
  profilePhotoUrl?: string;
  onboardingComplete?: boolean;
};

export type BuyerDashboardDto = {
  profile: {
    buyerType: string;
    onboardingComplete: boolean;
    preferredCategories: string[];
    priceRangeMin: string | null;
    priceRangeMax: string | null;
  } | null;
  kpis: {
    pendingProposals: number;
    purchasesCount: number;
    favoritesCount: number;
    activeAlerts: number;
  };
  wallet?: {
    balance: number;
    currency: string;
    monthCredits: number;
    monthDebits: number;
  };
};
export type BuyerProposalDto = {
  id: string;
  status: string;
  offeredPrice: string;
  proposedPricePerKg: string | null;
  quantity: number | null;
  message: string | null;
  counterPricePerKg: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    category: string;
    status: string;
    pricePerKg: string | null;
    farmName: string | null;
    sellerName: string | null;
  };
};

export type BuyerListingPreviewDto = {
  id: string;
  title: string;
  category: string;
  pricePerKg: string | null;
  totalPrice: string | null;
  weightKg: string | null;
  farmName: string | null;
  publishedAt: string | null;
  photoUrls: unknown;
};

export type BuyerFavoriteListingDto = BuyerListingPreviewDto & {
  /** Discriminant : annonce ferme ou produit boutique. */
  kind?: "listing" | "merchant";
  favoriteId: string;
  favoritedAt: string;
  currency?: string | null;
  stock?: number | null;
};

export type BuyerPriceAlertDto = {
  id: string;
  animalCategory: string;
  maxPricePerKg: string;
  minWeightKg: string | null;
  radiusKm: number | null;
  notificationFrequency: string;
  isActive: boolean;
  createdAt: string;
  matchingListingsCount: number;
};

export type CreateBuyerPriceAlertBody = {
  animalCategory: string;
  maxPricePerKg: number;
  minWeightKg?: number;
  radiusKm?: number;
  notificationFrequency?: string;
  isActive?: boolean;
};

export type UpdateBuyerPriceAlertBody = Partial<CreateBuyerPriceAlertBody>;

/** PATCH /api/v1/buyers/me/profile */
export function upsertBuyerProfile(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: UpsertBuyerProfileBody
): Promise<unknown> {
  return apiPatchJson("/buyers/me/profile", body, accessToken, activeProfileId);
}

/** GET /api/v1/buyers/me/dashboard */
export function fetchBuyerDashboard(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerDashboardDto> {
  return apiGetJson<BuyerDashboardDto>(
    "/buyers/me/dashboard",
    accessToken,
    activeProfileId
  );
}
/** GET /api/v1/buyers/me/personalized-listings */
export function fetchBuyerPersonalizedListings(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerListingPreviewDto[]> {
  return apiGetJson<BuyerListingPreviewDto[]>(
    "/buyers/me/personalized-listings",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/proposals */
export function fetchBuyerProposals(
  accessToken: string,
  activeProfileId?: string | null,
  status?: string
): Promise<BuyerProposalDto[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiGetJson<BuyerProposalDto[]>(
    `/buyers/me/proposals${q}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/purchases */
export function fetchBuyerPurchases(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerProposalDto[]> {
  return apiGetJson<BuyerProposalDto[]>(
    "/buyers/me/purchases",
    accessToken,
    activeProfileId
  );
}

export type BuyerReviewDto = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  farmId: string;
  farmName: string;
};

/** GET /api/v1/buyers/me/reviews */
export function fetchBuyerReviews(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerReviewDto[]> {
  return apiGetJson<BuyerReviewDto[]>(
    "/buyers/me/reviews",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/price-alerts */
export function fetchBuyerPriceAlerts(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerPriceAlertDto[]> {
  return apiGetJson<BuyerPriceAlertDto[]>(
    "/buyers/me/price-alerts",
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/buyers/me/price-alerts */
export function createBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: CreateBuyerPriceAlertBody
): Promise<BuyerPriceAlertDto> {
  return apiPostJson<BuyerPriceAlertDto>(
    "/buyers/me/price-alerts",
    body,
    accessToken,
    activeProfileId
  );
}

/** PATCH /api/v1/buyers/me/price-alerts/:id */
export function updateBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  alertId: string,
  body: UpdateBuyerPriceAlertBody
): Promise<BuyerPriceAlertDto> {
  return apiPatchJson<BuyerPriceAlertDto>(
    `/buyers/me/price-alerts/${encodeURIComponent(alertId)}`,
    body,
    accessToken,
    activeProfileId
  );
}

/** DELETE /api/v1/buyers/me/price-alerts/:id */
export function deleteBuyerPriceAlert(
  accessToken: string,
  activeProfileId: string | null | undefined,
  alertId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/buyers/me/price-alerts/${encodeURIComponent(alertId)}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/favorites */
export function fetchBuyerFavorites(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerFavoriteListingDto[]> {
  return apiGetJson<BuyerFavoriteListingDto[]>(
    "/buyers/me/favorites",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/buyers/me/favorites/ids */
export function fetchBuyerFavoriteIds(
  accessToken: string,
  activeProfileId?: string | null
): Promise<{ listingIds: string[]; productIds: string[] }> {
  return apiGetJson<{ listingIds: string[]; productIds: string[] }>(
    "/buyers/me/favorites/ids",
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/buyers/me/favorites */
export function addBuyerFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  listingId: string
): Promise<{ ok: boolean; listingId: string; favoriteId: string }> {
  return apiPostJson(
    "/buyers/me/favorites",
    { listingId },
    accessToken,
    activeProfileId
  );
}

/** DELETE /api/v1/buyers/me/favorites/:listingId */
export function removeBuyerFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  listingId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/buyers/me/favorites/${listingId}`,
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/buyers/me/favorites/products */
export function addBuyerMerchantFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  productId: string
): Promise<{ ok: boolean; productId: string; favoriteId: string }> {
  return apiPostJson(
    "/buyers/me/favorites/products",
    { productId },
    accessToken,
    activeProfileId
  );
}

/** DELETE /api/v1/buyers/me/favorites/products/:productId */
export function removeBuyerMerchantFavorite(
  accessToken: string,
  activeProfileId: string | null | undefined,
  productId: string
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/buyers/me/favorites/products/${productId}`,
    accessToken,
    activeProfileId
  );
}
