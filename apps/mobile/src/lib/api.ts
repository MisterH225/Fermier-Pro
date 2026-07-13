/**
 * Client HTTP vers `/api/v1` (API Nest liée à ton projet **Supabase** : Auth côté app,
 * Postgres côté serveur). Convention : tout nouvel appel ajouté ici doit avoir un cas
 * dans `apps/api/test/mobile-api-contract.e2e-spec.ts` (GET/POST/PATCH selon le cas).
 */
export * from "./api/http";
export * from "./api/auth";
export * from "./api/community-feed";
export * from "./api/merchant";
export * from "./api/producer";
export * from "./api/config";
export * from "./api/chat";
export * from "./api/farm-members";
export * from "./api/invitations";
export * from "./api/feed-stock";
export * from "./api/farms";
export * from "./api/cheptel";
export * from "./api/tasks";
export * from "./api/vet-consultations";
export * from "./api/dashboard";
export * from "./api/farm-health";
export * from "./api/finance";
export * from "./api/housing";
export * from "./api/marketplace";
export * from "./api/vet";
export * from "./api/onboarding";
export * from "./api/reports";
export * from "./api/ai";
export * from "./api/gestation";

import {
  apiBaseUrl,
  apiDeleteJson,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  apiPutJson
} from "./api/http";

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

export type UserWalletEntryKind =
  | "credit_topup"
  | "debit_withdraw"
  | "credit_transfer"
  | "debit_transfer"
  | "credit_escrow_release"
  | "credit_refund"
  | "credit_adjustment"
  | "debit_escrow_hold"
  | "debit_adjustment";

export type BuyerWalletEntryDto = {
  id: string;
  kind: UserWalletEntryKind;
  amount: number;
  balanceAfter: number;
  currency: string;
  transactionId: string | null;
  counterpartyUserId?: string | null;
  providerRef?: string | null;
  note: string | null;
  createdAt: string;
};

export type BuyerWalletEntriesDto = {
  entries: BuyerWalletEntryDto[];
  nextCursor: string | null;
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
  favoriteId: string;
  favoritedAt: string;
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

/** GET /api/v1/users/me/wallet — route canonique portefeuille. */
export function fetchUserWallet(
  accessToken: string
): Promise<NonNullable<BuyerDashboardDto["wallet"]>> {
  return apiGetJson<NonNullable<BuyerDashboardDto["wallet"]>>(
    "/users/me/wallet",
    accessToken
  );
}

/**
 * GET /api/v1/buyers/me/wallet
 * @deprecated Alias rétrocompat — préférer `fetchUserWallet`. Conservé pour les builds
 * mobile antérieurs ; l'API maintient les deux routes jusqu'à dépréciation explicite.
 */
export function fetchBuyerWallet(
  accessToken: string,
  activeProfileId?: string | null
): Promise<NonNullable<BuyerDashboardDto["wallet"]>> {
  return apiGetJson<NonNullable<BuyerDashboardDto["wallet"]>>(
    "/buyers/me/wallet",
    accessToken,
    activeProfileId
  );
}

export type WalletTopUpInitDto = {
  providerRef?: string;
  amount: number;
  feeAmount?: number;
  netAmount?: number;
  totalDebit?: number;
  amountToReceive?: number;
  currency: string;
  paymentUrl?: string | null;
  phone?: string;
  requiresApproval?: boolean;
  withdrawalRequestId?: string;
  status?: string;
  message?: string;
};

export type WalletFeeQuoteDto = {
  transactionType: "deposit" | "withdrawal" | "transfer";
  amount: number;
  feeAmount: number;
  netAmount: number;
  totalDebit: number;
  isFree: boolean;
};

export type WalletOperationResultDto = {
  ok: boolean;
  balance: number;
  currency: string;
  feeAmount?: number;
  entry: BuyerWalletEntryDto;
};

export function initiateWalletTopUp(
  accessToken: string,
  amount: number
): Promise<WalletTopUpInitDto> {
  return apiPostJson("/users/me/wallet/top-up/initiate", { amount }, accessToken);
}

/** Confirme une recharge — le montant est vérifié côté API/prestataire (pas dans le body). */
export function confirmWalletTopUp(
  accessToken: string,
  providerRef: string
): Promise<WalletOperationResultDto> {
  return apiPostJson(
    "/users/me/wallet/top-up/confirm",
    { providerRef },
    accessToken
  );
}

export function fetchWalletFeeQuote(
  accessToken: string,
  type: "deposit" | "withdrawal" | "transfer",
  amount: number
): Promise<WalletFeeQuoteDto> {
  const params = new URLSearchParams({
    type,
    amount: String(amount)
  });
  return apiGetJson<WalletFeeQuoteDto>(
    `/users/me/wallet/fee-quote?${params.toString()}`,
    accessToken
  );
}

export function initiateWalletWithdraw(
  accessToken: string,
  amount: number,
  phone?: string,
  clientRequestId?: string
): Promise<WalletTopUpInitDto> {
  return apiPostJson(
    "/users/me/wallet/withdraw/initiate",
    { amount, phone, clientRequestId },
    accessToken
  );
}

export function confirmWalletWithdraw(
  accessToken: string,
  amount: number,
  providerRef: string,
  phone?: string,
  withdrawalRequestId?: string
): Promise<WalletOperationResultDto> {
  return apiPostJson(
    "/users/me/wallet/withdraw/confirm",
    { amount, providerRef, phone, withdrawalRequestId },
    accessToken
  );
}

export type WalletTransferRecipientDto = {
  userId: string;
  displayName: string;
  phoneMasked: string;
};

export function fetchWalletTransferRecipient(
  accessToken: string,
  phone: string
): Promise<WalletTransferRecipientDto> {
  const params = new URLSearchParams({ phone: phone.trim() });
  return apiGetJson<WalletTransferRecipientDto>(
    `/users/me/wallet/transfer-recipient?${params.toString()}`,
    accessToken
  );
}

export function transferWalletFunds(
  accessToken: string,
  amount: number,
  recipientPhone: string,
  note?: string
): Promise<{
  ok: boolean;
  balance: number;
  currency: string;
  debit: BuyerWalletEntryDto;
  credit: BuyerWalletEntryDto;
}> {
  return apiPostJson(
    "/users/me/wallet/transfer",
    { amount, recipientPhone, note },
    accessToken
  );
}

/** GET /api/v1/users/me/wallet/entries — route canonique. */
export function fetchUserWalletEntries(
  accessToken: string,
  opts?: { limit?: number; cursor?: string }
): Promise<BuyerWalletEntriesDto> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return apiGetJson<BuyerWalletEntriesDto>(
    `/users/me/wallet/entries${qs ? `?${qs}` : ""}`,
    accessToken
  );
}

/**
 * GET /api/v1/buyers/me/wallet/entries
 * @deprecated Alias rétrocompat — préférer `fetchUserWalletEntries`.
 */
export function fetchBuyerWalletEntries(
  accessToken: string,
  activeProfileId?: string | null,
  opts?: { limit?: number; cursor?: string }
): Promise<BuyerWalletEntriesDto> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return apiGetJson<BuyerWalletEntriesDto>(
    `/buyers/me/wallet/entries${qs ? `?${qs}` : ""}`,
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

// ─── Profil technicien (`/technicians/me`) ───────────────────────────────────

export type TechnicianFormationType =
  | "diplome"
  | "formation_courte"
  | "sur_le_tas"
  | "autodidacte";

export type TechnicianProfileDto = {
  id: string;
  userId: string;
  displayName?: string;
  experienceYearsCount: number | null;
  specializations: string[];
  formation: string | null;
  formationType: TechnicianFormationType | null;
  formationTypeLabel: string | null;
  formationDetails: string | null;
  graduationYear: number | null;
  pretensionSalarialeMensuelle: number | null;
  pretensionCurrency: string;
  locationCity: string | null;
  locationCountry: string | null;
  locationLabel: string | null;
  locationLat: number | null;
  locationLng: number | null;
  isAvailable: boolean;
  availabilityNote: string | null;
  bio: string | null;
  profilePhotoUrl: string | null;
  isPublic: boolean;
  onboardingComplete: boolean;
  isActive: boolean;
  distanceKm?: number | null;
  isSelf?: boolean;
};

export type UpsertTechnicianProfileBody = {
  experienceYears?: string;
  experienceYearsCount?: number;
  specializations?: string[];
  formation?: string;
  formationType?: TechnicianFormationType;
  formationDetails?: string;
  graduationYear?: number;
  pretensionSalarialeMensuelle?: number | null;
  pretensionCurrency?: string;
  locationCity?: string;
  locationCountry?: string;
  locationLat?: number;
  locationLng?: number;
  isAvailable?: boolean;
  availabilityNote?: string;
  bio?: string;
  profilePhotoUrl?: string;
  isPublic?: boolean;
  onboardingComplete?: boolean;
};

export type TechnicianDashboardDto = {
  farms: Array<{
    farmId: string;
    farmName: string;
    speciesFocus: string | null;
    role: string;
    scopes: string[];
  }>;
  activeFarmId: string | null;
  tasksTodayCount: number;
  alertsCount: number;
  kpis: {
    activeAlerts: number;
    overdueVaccines: number;
    gestationThisWeek: number;
    criticalStock: number;
  };
};

export type TechnicianActivityRowDto = {
  id: string;
  farmId: string;
  farmName: string;
  module: string;
  action: string;
  detail: string | null;
  createdAt: string;
};

/** GET /api/v1/technicians/me/profile */
export function fetchTechnicianProfile(
  accessToken: string,
  activeProfileId?: string | null
): Promise<TechnicianProfileDto> {
  return apiGetJson<TechnicianProfileDto>(
    "/technicians/me/profile",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/search */
export function searchTechnicians(
  accessToken: string,
  params: {
    q?: string;
    city?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
    availableOnly?: boolean;
    experienceMin?: number;
    specialization?: string;
    salaryMax?: number;
  },
  activeProfileId?: string | null
): Promise<{ items: TechnicianProfileDto[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.city) qs.set("city", params.city);
  if (params.nearLat != null) qs.set("nearLat", String(params.nearLat));
  if (params.nearLng != null) qs.set("nearLng", String(params.nearLng));
  if (params.radiusKm != null) qs.set("radiusKm", String(params.radiusKm));
  if (params.availableOnly != null) {
    qs.set("availableOnly", String(params.availableOnly));
  }
  if (params.experienceMin != null) {
    qs.set("experienceMin", String(params.experienceMin));
  }
  if (params.specialization) qs.set("specialization", params.specialization);
  if (params.salaryMax != null) qs.set("salaryMax", String(params.salaryMax));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<{ items: TechnicianProfileDto[] }>(
    `/technicians/search${suffix}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/:userId/public-profile */
export function fetchTechnicianPublicProfile(
  accessToken: string,
  userId: string,
  activeProfileId?: string | null
): Promise<TechnicianProfileDto> {
  return apiGetJson<TechnicianProfileDto>(
    `/technicians/${encodeURIComponent(userId)}/public-profile`,
    accessToken,
    activeProfileId
  );
}

/** POST /api/v1/farms/:farmId/collaborators/invite-from-chat */
export function inviteCollaboratorFromChat(
  accessToken: string,
  farmId: string,
  payload: {
    peerUserId: string;
    roomId?: string;
    recipientKind: InvitationRecipientKind;
    permissions: InvitationPermissions;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<{
  ok: boolean;
  invitationId: string;
  roomId: string;
  messageId: string;
}> {
  return apiPostJson(
    `/farms/${farmId}/collaborators/invite-from-chat`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** PATCH /api/v1/technicians/me/profile */
export function upsertTechnicianProfile(
  accessToken: string,
  activeProfileId: string | null | undefined,
  body: UpsertTechnicianProfileBody
): Promise<unknown> {
  return apiPatchJson(
    "/technicians/me/profile",
    body,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/me/dashboard */
export function fetchTechnicianDashboard(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string
): Promise<TechnicianDashboardDto> {
  const q = farmId ? `?farmId=${encodeURIComponent(farmId)}` : "";
  return apiGetJson<TechnicianDashboardDto>(
    `/technicians/me/dashboard${q}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/technicians/me/activity */
export function fetchTechnicianActivity(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string,
  limit?: number
): Promise<TechnicianActivityRowDto[]> {
  const q = new URLSearchParams();
  if (farmId) q.set("farmId", farmId);
  if (limit != null) q.set("limit", String(limit));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<TechnicianActivityRowDto[]>(
    `/technicians/me/activity${suffix}`,
    accessToken,
    activeProfileId
  );
}

// ─── Indice prix porc (`/market/pig-price-index`) ────────────────────────────

export type PigPriceIndexPeriod = "7d" | "30d" | "3m" | "12m";

export type PigPriceIndexPointDto = {
  date: string;
  avgPricePerKg: number;
  listingAvgPrice: number | null;
  transactionCount: number;
  variationPct: number | null;
  limitedData: boolean;
};

export type PigPriceIndexSeriesDto = {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  points: PigPriceIndexPointDto[];
};

export type PigPriceIndexChartDto = {
  period: PigPriceIndexPeriod;
  category: string;
  insufficientData: boolean;
  message: string | null;
  series: PigPriceIndexSeriesDto[];
  updatedAt: string;
};

export type PigPriceIndexTickerItemDto = {
  category: string;
  label: string;
  icon: string;
  pricePerKg: number | null;
  variationPct: number | null;
  color: string;
};

export type PigPriceIndexTickerDto = {
  items: PigPriceIndexTickerItemDto[];
  updatedAt: string;
};

export type PigPriceIndexStatsRowDto = {
  category: string;
  label: string;
  todayPrice: number | null;
  variation24h: number | null;
  variation7d: number | null;
  high30d: number | null;
  low30d: number | null;
  volume: number;
};

export type PigPriceIndexStatsDto = {
  rows: PigPriceIndexStatsRowDto[];
};

/** GET /api/v1/market/pig-price-index */
export function fetchPigPriceIndexChart(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d",
  category?: string
): Promise<PigPriceIndexChartDto> {
  const q = new URLSearchParams();
  q.set("period", period);
  if (category) q.set("category", category);
  return apiGetJson<PigPriceIndexChartDto>(
    `/market/pig-price-index?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/ticker */
export function fetchPigPriceIndexTicker(
  accessToken: string,
  activeProfileId?: string | null
): Promise<PigPriceIndexTickerDto> {
  return apiGetJson<PigPriceIndexTickerDto>(
    "/market/pig-price-index/ticker",
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/stats */
export function fetchPigPriceIndexStats(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d"
): Promise<PigPriceIndexStatsDto> {
  return apiGetJson<PigPriceIndexStatsDto>(
    `/market/pig-price-index/stats?period=${encodeURIComponent(period)}`,
    accessToken,
    activeProfileId
  );
}

export type HybridPigPriceIndexDto = {
  price_per_kg: number | null;
  trend: "up" | "down" | "stable";
  variation_7d_pct: number | null;
  calculated_at: string | null;
  data_points_count: number;
};

export type PigPriceIndexDashboardDto = {
  hybrid: HybridPigPriceIndexDto;
  ticker: PigPriceIndexTickerDto;
  chart: PigPriceIndexChartDto;
  stats: PigPriceIndexStatsDto;
};

/** GET /api/v1/market/pig-price-index/dashboard — agrégat marketplace (1 requête) */
export function fetchPigPriceIndexDashboard(
  accessToken: string,
  activeProfileId?: string | null,
  period: PigPriceIndexPeriod = "30d",
  category?: string
): Promise<PigPriceIndexDashboardDto> {
  const q = new URLSearchParams();
  q.set("period", period);
  if (category) {
    q.set("category", category);
  }
  return apiGetJson<PigPriceIndexDashboardDto>(
    `/market/pig-price-index/dashboard?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

/** GET /api/v1/market/pig-price-index/hybrid — indice hybride anti-manipulation */
export function fetchHybridPigPriceIndex(
  accessToken: string,
  activeProfileId?: string | null
): Promise<HybridPigPriceIndexDto> {
  return apiGetJson<HybridPigPriceIndexDto>(
    "/market/pig-price-index/hybrid",
    accessToken,
    activeProfileId
  );
}

/** GET /farms/:farmId/settings — paramètres agrégés (source unique). */
export type FarmSettingsDto = {
  farm: {
    id: string;
    name: string;
    speciesFocus: string;
    livestockMode: "individual" | "batch" | "hybrid";
    address: string | null;
    locationSector: string | null;
    locationCity: string | null;
    locationCountry: string | null;
    latitude: number | null;
    longitude: number | null;
    housingBuildingsCount: number | null;
    housingPensPerBuilding: number | null;
    housingMaxPigsPerPen: number | null;
  };
  app: {
    language: "fr" | "en";
    dateFormat: string;
    timezone: string;
    theme: "light" | "dark" | "system";
    budgetAutoSuggest: boolean;
    dailySummaryHour: string | null;
    notificationExtra: Record<string, unknown> | null;
  };
  finance: {
    currencyCode: string;
    currencySymbol: string;
    lowBalanceThreshold: number | null;
  };
  alerts: {
    mortalityRateThresholdPct: number | null;
    lowBalanceThreshold: number | null;
    stockWarningDays: number;
    stockCriticalDays: number;
    starterMaxAvgWeightKg: number | null;
    starterMaxAvgAgeWeeks: number | null;
    pushStock: boolean;
    pushHealth: boolean;
    pushFinance: boolean;
    pushGestation: boolean;
    pushCheptel: boolean;
    pushMarket: boolean;
  };
  gestation: {
    gestationDurationDays: number;
    weaningDurationDays: number;
    vaccineSchedule: unknown;
  };
  profitability: {
    marketPricePerKg: number | null;
    icTargetStarter: number | null;
    icTargetGrowth: number | null;
    icTargetFattening: number | null;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  };
  gmqTargets: {
    gmqTargetStarter: number | null;
    gmqTargetGrowth: number | null;
    gmqTargetFattening: number | null;
    targetSaleWeightKg: number | null;
  };
};

export type PatchFarmSettingsPayload = {
  app?: Partial<FarmSettingsDto["app"]>;
  finance?: Partial<FarmSettingsDto["finance"]>;
  alerts?: Partial<FarmSettingsDto["alerts"]>;
  profitability?: Partial<{
    marketPricePerKg: number | null;
    icTargetStarter: number;
    icTargetGrowth: number;
    icTargetFattening: number;
    gmqRefStarter: number;
    gmqRefGrowth: number;
    gmqRefFattening: number;
  }>;
  gmqTargets?: Partial<FarmSettingsDto["gmqTargets"]>;
  gestation?: { weaningDurationDays?: number };
  farm?: {
    name?: string;
    livestockMode?: "individual" | "batch" | "hybrid";
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
};

export function fetchFarmSettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmSettingsDto> {
  return apiGetJson<FarmSettingsDto>(
    `/farms/${farmId}/settings`,
    accessToken,
    activeProfileId
  );
}

export function patchFarmSettings(
  accessToken: string,
  farmId: string,
  payload: PatchFarmSettingsPayload,
  activeProfileId?: string | null
): Promise<FarmSettingsDto> {
  return apiPatchJson<FarmSettingsDto>(
    `/farms/${farmId}/settings`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type ProfitabilitySettingsDto = FarmSettingsDto["profitability"];

export function fetchProfitabilitySettings(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<ProfitabilitySettingsDto> {
  return fetchFarmSettings(accessToken, farmId, activeProfileId).then(
    (s) => s.profitability
  );
}

export type PatchProfitabilitySettingsPayload = NonNullable<
  PatchFarmSettingsPayload["profitability"]
>;

export function patchProfitabilitySettings(
  accessToken: string,
  farmId: string,
  payload: PatchProfitabilitySettingsPayload,
  activeProfileId?: string | null
): Promise<ProfitabilitySettingsDto> {
  return patchFarmSettings(
    accessToken,
    farmId,
    { profitability: payload },
    activeProfileId
  ).then((s) => s.profitability);
}

export * from "./api/predictions";
export * from "./api/profitability";
