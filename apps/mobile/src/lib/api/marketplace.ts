import { apiBaseUrl, apiGetJson, apiPostJson, apiPatchJson } from "./http";

/** GET /marketplace/listings — JWT ; sans `mine` = catalogue publié. */
export type MarketplaceListingListItem = {
  id: string;
  kind?: "listing" | "merchant";
  sellerUserId?: string;
  title: string;
  description: string | null;
  unitPrice: string | number | null;
  quantity: number | null;
  stock?: number | null;
  currency: string;
  locationLabel: string | null;
  status: string;
  publishedAt: string | null;
  pickupAt?: string | null;
  pickupNote?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: string | null;
  categoryLabel?: string | null;
  photoUrls?: string[] | null;
  /** Photo cheptel si photoUrls vide (API). */
  fallbackPhotoUrl?: string | null;
  animalIds?: string[] | null;
  totalWeightKg?: string | number | null;
  weightBasis?: "live" | "carcass" | null;
  pricePerKg?: string | number | null;
  totalPrice?: string | number | null;
  breedLabel?: string | null;
  viewsCount?: number;
  consultationsCount?: number;
  expiresAt?: string | null;
  activeOfferCount?: number;
  /** Vendeur accepte les offres à crédit (charcutier). */
  creditEnabled?: boolean;
  /**
   * Date ISO de la dernière consultation véto complétée (< 30 j), sinon null.
   * Le badge carte s'affiche uniquement si cette date est présente et récente.
   */
  healthVerifiedAt?: string | null;
  /**
   * Dernière visite verified (jusqu'à 45 j) — pour CTA « expiré récemment ».
   * Présent même si `healthVerifiedAt` est null (badge expiré).
   */
  healthVerifiedLastCompletedAt?: string | null;
  /** @deprecated préférer healthVerifiedAt — conservé pour le détail. */
  healthVerified?: boolean;
  /** Véto ayant réalisé la dernière visite vérifiée (détail / CTA). */
  healthVerifiedBy?: {
    vetProfileId: string;
    vetName: string;
    completedAt: string;
  } | null;
  farm: { id: string; name: string } | null;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    photoUrl?: string | null;
  } | null;
  seller?: { id: string; fullName: string | null };
};

export function fetchMarketplaceListings(
  accessToken: string,
  activeProfileId?: string | null,
  opts?: { mine?: boolean; status?: string; category?: string; q?: string }
): Promise<MarketplaceListingListItem[]> {
  const qs = new URLSearchParams();
  if (opts?.mine) {
    qs.set("mine", "true");
  }
  if (opts?.status) {
    qs.set("status", opts.status);
  }
  if (opts?.category) {
    qs.set("category", opts.category);
  }
  if (opts?.q?.trim()) {
    qs.set("q", opts.q.trim());
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiGetJson<MarketplaceListingListItem[]>(
    `/marketplace/listings${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type MarketplaceListingCategoryGroup = {
  pig: Array<{ id: string; label: string }>;
  merchant: Array<{ id: string; label: string }>;
};

export function fetchMarketplaceListingCategories(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingCategoryGroup> {
  return apiGetJson<MarketplaceListingCategoryGroup>(
    "/marketplace/listings/categories",
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferBrief = {
  id: string;
  listingId: string;
  buyerUserId: string;
  offeredPrice: string | number;
  proposedPricePerKg?: string | number | null;
  counterPricePerKg?: string | number | null;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  buyer?: { id: string; fullName: string | null; email: string | null };
};

export type MarketplaceListingHealthVaccine = {
  vaccineName: string;
  administeredDate: string;
  nextDueDate: string | null;
  status: "done" | "upcoming" | "overdue";
  animalId: string;
  animalLabel: string;
};

export type MarketplaceListingPastDisease = {
  diagnosis: string | null;
  symptomsSummary: string;
  onsetDate: string;
  resolvedDate: string;
  durationDays: number;
  finalStatus: "recovered" | "resolved";
  animalId: string;
  animalLabel: string;
};

export type MarketplaceListingHealthData = {
  vaccines: MarketplaceListingHealthVaccine[];
  pastDiseases: MarketplaceListingPastDisease[];
  activeCasesCount: number;
  vaccinesStatus: "up_to_date" | "overdue" | "none";
};

export type MarketplaceListingFarmInfo = {
  farmId: string;
  farmName: string;
  farmLocation: string | null;
  producerDisplayName: string;
  farmRating: number | null;
  farmRatingCount: number;
  farmTotalSales: number;
  activeListingsCount: number;
};

export type MarketplaceListingDetail = MarketplaceListingListItem & {
  sellerUserId: string;
  seller: {
    id: string;
    fullName: string | null;
    email?: string | null;
    sellerDisplayName?: string;
  };
  myOffers?: MarketplaceOfferBrief[];
  offers?: MarketplaceOfferBrief[];
  healthData?: MarketplaceListingHealthData | null;
  farmInfo?: MarketplaceListingFarmInfo | null;
  farmRatingSummary?: { avg: number | null; count: number } | null;
  sellerProducerScore?: ProducerScoreDto | null;
};

/** @deprecated Utiliser `healthData` sur le détail annonce. */
export type MarketplaceListingHealthSnapshot = {
  vaccinesUpToDate: boolean;
  lastVaccinationAt: string | null;
  lastVetVisitAt: string | null;
  lastVetReason: string | null;
  recentDiseaseSummary: string | null;
  mortalityRate30dPct: string;
};

export function fetchMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingDetail> {
  return apiGetJson<MarketplaceListingDetail>(
    `/marketplace/listings/${listingId}`,
    accessToken,
    activeProfileId
  );
}

/** POST — incrémente les vues (hors vendeur). */
export function postMarketplaceListingView(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean; viewsCount: number }> {
  return apiPostJson<{ ok: boolean; viewsCount: number }>(
    `/marketplace/listings/${listingId}/view`,
    {},
    accessToken,
    activeProfileId
  );
}

/** POST — incrémente les consultations (hors vendeur). */
export function postMarketplaceListingConsult(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean; consultationsCount: number }> {
  return apiPostJson<{ ok: boolean; consultationsCount: number }>(
    `/marketplace/listings/${listingId}/consult`,
    {},
    accessToken,
    activeProfileId
  );
}

export type PatchMarketplacePickupPayload = {
  pickupAt?: string | null;
  pickupNote?: string | null;
};

/** PATCH — vendeur ou acheteur retenu : rendez-vous de retrait (sans paiement in-app). */
export function patchMarketplacePickup(
  accessToken: string,
  listingId: string,
  payload: PatchMarketplacePickupPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPatchJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/pickup`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST — vendeur : conclut la vente (Cheptel + Finance atomiques). */
export type CompleteMarketplaceHandoverPayload = {
  offerId: string;
  soldWeightKg: number;
  totalPrice: number;
  soldAt?: string;
  notes?: string;
};

export function completeMarketplaceHandover(
  accessToken: string,
  listingId: string,
  payload: CompleteMarketplaceHandoverPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/complete-handover`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type PostMarketplaceOfferPayload = {
  offeredPrice?: number;
  proposedPricePerKg?: number;
  quantity?: number;
  message?: string;
  buyerFarmId?: string;
};

/** POST /marketplace/listings/:listingId/offers — acheteur / même JWT. */
export function postMarketplaceOffer(
  accessToken: string,
  listingId: string,
  payload: PostMarketplaceOfferPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/marketplace/listings/${listingId}/offers`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type BuyerCreditScoreDto = {
  score: string;
  emoji: string;
  label: string;
  color: string;
  blocked: boolean;
  creditTransactionsCount: number;
  creditOnTimeCount: number;
  /** Présents uniquement sur /buyers/me/credit-score — jamais sur buyerMeteo producteur. */
  creditLateCount?: number;
  creditDefaultCount?: number;
};

/** Météo Acheteur exposée aux producteurs (propositions reçues). */
export type BuyerMeteoDto = {
  creditScore: string;
  meteoLevel: string;
  creditTransactionsCount: number;
  creditOnTimeCount: number;
  creditBlocked: boolean;
};

export type ReliabilityScoreBadgeDto = Pick<
  BuyerCreditScoreDto,
  "score" | "emoji" | "label" | "color"
>;

export type ProducerScoreDto = ReliabilityScoreBadgeDto & {
  globalValue: number;
  dataRegularityScore: number;
  platformUsageScore: number;
  responsivenessScore: number;
  dataEntryDaysLast30: number;
  platformActiveDaysLast30: number;
  offersReceivedCount: number;
  offersRespondedWithin48h: number;
  creditBalancesOnTime: number;
  creditBalancesTotal: number;
  chatBuyerMessagesCount: number;
  chatRepliedWithin24h: number;
  creditSalesAllowed: boolean;
  creditSalesLimited: boolean;
  creditBlocked: boolean;
  creditBlockedReason: string | null;
  scoreUpdatedAt: string | null;
};

export type MarketplaceCreditOfferDto = {
  id: string;
  listingId: string;
  listingTitle: string;
  currency: string;
  offerType: string;
  status: string;
  offeredPrice: number;
  advancePercentage: number | null;
  advanceAmount: number | null;
  balanceAmount: number | null;
  balanceDueDays: number | null;
  balanceDueAt: string | null;
  deadlineAt?: string | null;
  timeoutOutcomeKey?: string | null;
  message: string | null;
  buyerMeteo?: BuyerMeteoDto | null;
  buyerCreditScore: BuyerCreditScoreDto | null;
  transactionId?: string | null;
};

export function fetchMyCreditScore(
  accessToken: string,
  activeProfileId?: string | null
): Promise<BuyerCreditScoreDto> {
  return apiGetJson<BuyerCreditScoreDto>(
    "/marketplace/buyers/me/credit-score",
    accessToken,
    activeProfileId
  );
}

export function fetchMyProducerScore(
  accessToken: string,
  activeProfileId?: string | null
): Promise<ProducerScoreDto> {
  return apiGetJson<ProducerScoreDto>(
    "/producers/me/score",
    accessToken,
    activeProfileId
  );
}

export function postRecomputeProducerScore(
  accessToken: string,
  activeProfileId?: string | null
): Promise<ProducerScoreDto> {
  return apiPostJson<ProducerScoreDto>(
    "/producers/me/score/recompute",
    {},
    accessToken,
    activeProfileId
  );
}

export function postMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  payload: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
    message?: string;
    buyerFarmId?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPostJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/credit`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function agreeMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/${offerId}/agree-credit`,
    {},
    accessToken,
    activeProfileId
  );
}

export function counterMarketplaceCreditOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  payload: {
    offeredPrice: number;
    advancePercentage: number;
    balanceDueDays: number;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/listings/${listingId}/offers/${offerId}/counter-credit`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function initiateMarketplaceCreditBalancePayment(
  accessToken: string,
  offerId: string,
  activeProfileId: string | null | undefined,
  paymentMethod: "mobile_money" | "wallet"
): Promise<{
  providerRef: string;
  amount: number;
  currency: string;
  transactionId: string;
  paymentMethod?: string;
  paymentUrl?: string | null;
}> {
  return apiPostJson(
    `/marketplace/offers/${offerId}/balance-payment/initiate`,
    { paymentMethod },
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceCreditBalancePayment(
  accessToken: string,
  offerId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/balance-payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceAdvancePaid(
  accessToken: string,
  offerId: string,
  payload: { paymentMode: string; paymentRef?: string },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-advance-paid`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceAdvanceReceived(
  accessToken: string,
  offerId: string,
  received: boolean,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-advance-received`,
    { received },
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceBalancePaid(
  accessToken: string,
  offerId: string,
  payload: { amount: number; paymentMode: string; paymentRef?: string },
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-balance-paid`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceBalanceReceived(
  accessToken: string,
  offerId: string,
  received: boolean,
  activeProfileId?: string | null
): Promise<MarketplaceCreditOfferDto> {
  return apiPatchJson<MarketplaceCreditOfferDto>(
    `/marketplace/offers/${offerId}/confirm-balance-received`,
    { received },
    accessToken,
    activeProfileId
  );
}

export type CreditPendingRow = {
  id: string;
  listingId: string;
  listingTitle: string;
  currency: string;
  balanceAmount: number;
  balanceDueAt: string | null;
  deadlineAt?: string | null;
  timeoutOutcomeKey?: string | null;
  status: string;
  buyerName: string | null;
};

export function fetchCreditPendingOffers(
  accessToken: string,
  farmId?: string | null,
  activeProfileId?: string | null
): Promise<CreditPendingRow[]> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<CreditPendingRow[]>(
    `/marketplace/offers/credit-pending${qs}`,
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferCreditFields = {
  offerType?: string | null;
  advancePercentage?: number | null;
  advanceAmount?: string | number | null;
  balanceAmount?: string | number | null;
  balanceDueDays?: number | null;
  balanceDueAt?: string | null;
  advancePaidDeclaredAt?: string | null;
  advanceConfirmedAt?: string | null;
  balancePaidDeclaredAt?: string | null;
  balanceConfirmedAt?: string | null;
  deliveredAt?: string | null;
  buyerMeteo?: BuyerMeteoDto | null;
  buyerCreditScore?: BuyerCreditScoreDto | null;
};

export type MarketplaceOfferMineRow = MarketplaceOfferCreditFields & {
  id: string;
  offeredPrice: string | number;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  transaction?: { id: string; status: string } | null;
  listing: {
    id: string;
    title: string;
    status: string;
    currency: string;
    farm: { id: string; name: string } | null;
    seller: { id: string; fullName: string | null };
    animal: { id: string; publicId: string; tagCode: string | null } | null;
  };
};

/** GET /marketplace/offers — offres où je suis acheteur. */
export function fetchMyMarketplaceOffers(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceOfferMineRow[]> {
  return apiGetJson<MarketplaceOfferMineRow[]>(
    "/marketplace/offers",
    accessToken,
    activeProfileId
  );
}

export type MarketplaceOfferReceivedRow = MarketplaceOfferCreditFields & {
  id: string;
  offeredPrice: string | number;
  proposedPricePerKg?: string | number | null;
  counterPricePerKg?: string | number | null;
  quantity: number | null;
  message: string | null;
  status: string;
  createdAt: string;
  transaction?: { id: string; status: string } | null;
  buyer: { id: string; fullName: string | null; email: string | null };
  listing: {
    id: string;
    title: string;
    status: string;
    currency: string;
    category: string | null;
    totalWeightKg: string | number | null;
    pricePerKg?: string | number | null;
    totalPrice?: string | number | null;
    farm: { id: string; name: string } | null;
    animal: { id: string; publicId: string; tagCode: string | null } | null;
  };
};

export type MarketplaceOfferCounts = {
  receivedPending: number;
  sentPending: number;
  total: number;
};

/** GET /marketplace/offers/received — propositions sur mes annonces. */
export function fetchReceivedMarketplaceOffers(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string | null
): Promise<MarketplaceOfferReceivedRow[]> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<MarketplaceOfferReceivedRow[]>(
    `/marketplace/offers/received${qs}`,
    accessToken,
    activeProfileId
  );
}

/** GET /marketplace/offers/counts — badges propositions. */
export function fetchMarketplaceOfferCounts(
  accessToken: string,
  activeProfileId?: string | null,
  farmId?: string | null
): Promise<MarketplaceOfferCounts> {
  const qs = farmId?.trim() ? `?farmId=${encodeURIComponent(farmId.trim())}` : "";
  return apiGetJson<MarketplaceOfferCounts>(
    `/marketplace/offers/counts${qs}`,
    accessToken,
    activeProfileId
  );
}

/** Réponse acceptation offre (vendeur ou acheteur contre-proposition). */
export type MarketplaceAcceptOfferResponse = {
  transactionId: string;
};

/** Vendeur : accepter une offre (crée la transaction escrow). */
export function acceptMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceAcceptOfferResponse> {
  return apiPostJson<MarketplaceAcceptOfferResponse>(
    `/marketplace/listings/${listingId}/offers/${offerId}/accept`,
    {},
    accessToken,
    activeProfileId
  );
}

/** Vendeur : refuser une offre. */
export function rejectMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/listings/${listingId}/offers/${offerId}/reject`,
    {},
    accessToken,
    activeProfileId
  );
}

/** Vendeur : contre-proposition (prix/kg). */
export function counterMarketplaceOffer(
  accessToken: string,
  listingId: string,
  offerId: string,
  payload: {
    counterPricePerKg?: number;
    counterOfferedPrice?: number;
    message?: string;
  },
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/listings/${listingId}/offers/${offerId}/counter`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** Acheteur : accepte une contre-proposition. */
export function acceptMarketplaceOfferCounter(
  accessToken: string,
  listingId: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<MarketplaceAcceptOfferResponse> {
  return apiPostJson<MarketplaceAcceptOfferResponse>(
    `/marketplace/listings/${listingId}/offers/${offerId}/accept-counter`,
    {},
    accessToken,
    activeProfileId
  );
}

export type MarketplacePendingTransferDto = {
  id: string;
  transactionId: string;
  buyerFarmId: string | null;
  animalIds: string[];
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type MarketplaceTransactionDto = {
  id: string;
  listingId: string;
  offerId: string;
  buyerUserId: string;
  sellerUserId: string;
  status: string;
  priceType: string;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  estimatedWeightKg: number | null;
  blockedAmount: number;
  finalAmount: number | null;
  realWeightKg: number | null;
  sellerDeclaredWeightKg?: number | null;
  sellerWeightDeclaredAt?: string | null;
  buyerAnimalWeights?: Array<{
    animalId: string;
    weightKg: number;
    photoUrl?: string | null;
  }>;
  weightDiffKg?: number | null;
  canRequestWeightArbitration?: boolean;
  weightArbitrationThresholds?: {
    minDiffKg: number;
    cumulativeMinDiffKg: number;
    /** Tolérance relative (%) combinée avec minDiffKg via max(). */
    tolerancePercent: number;
  };
  pickupDate: string | null;
  pickupLocation: string | null;
  sellerShippedAt?: string | null;
  shipmentMethod?: string | null;
  shipmentNotes?: string | null;
  buyerReceivedAt?: string | null;
  receiptCondition?: string | null;
  receiptNotes?: string | null;
  receivedAnimalIds?: string[];
  listingStatus?: string | null;
  listingAnimalIds?: string[];
  currency: string;
  offerExpiresAt: string;
  deadlineAt?: string | null;
  timeoutOutcomeKey?: string | null;
  listingTitle: string | null;
  receiptGenerationStatus?: string;
  receipt?: {
    id: string;
    receiptNumber: string;
    generatedAt: string;
  } | null;
  pendingTransfer?: MarketplacePendingTransferDto | null;
  isCredit?: boolean;
  /** L'acheteur paye les frais de plateforme en plus du prix convenu. */
  buyerPaysCommission?: boolean;
  /** Taux de commission (acheteur) de la plateforme (ex. 0.05 = 5 %). */
  commissionRate?: number;
  /** Frais de plateforme estimés côté acheteur. */
  platformFeeEstimate?: number;
  /** Taux de commission (vendeur) de la plateforme. */
  sellerCommissionRate?: number;
  /** Frais de plateforme estimés côté vendeur. */
  sellerPlatformFeeEstimate?: number;
  /** Montant de commission vendeur prélevé (null avant clôture). */
  sellerCommissionAmount?: number | null;
  /** Montant net reçu par le vendeur après clôture (null tant que non clôturée). */
  sellerReceivedAmount?: number | null;
};

export type MarketplaceReceiptDto = {
  receiptNumber: string | null;
  generatedAt: string | null;
  downloadUrl: string | null;
  status: string;
};

export type MarketplaceFinanceSummaryDto = {
  blockedFunds: number;
  pendingRevenue: number;
  totalSpent: number;
  confirmedRevenue: number;
  currency: string;
  blockedTransactions: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    agreedAmount: number;
    blockedAmount: number;
    status: string;
    sellerName: string | null;
  }>;
  pendingTransactions: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    agreedAmount: number;
    blockedAmount: number;
    status: string;
    buyerName: string | null;
  }>;
  monthlySeries: Array<{
    month: string;
    confirmedRevenue: number;
    pendingRevenue: number;
    confirmedSpent: number;
    blockedFunds: number;
  }>;
};

export type MarketplacePartnerDto = {
  partnerKey: string;
  userId: string | null;
  displayName: string;
  subtitle: string | null;
  transactionCount: number;
  closedCount: number;
  marketplaceCount: number;
  directSaleCount: number;
  lastTransactionAt: string;
};

export function fetchMarketplacePartners(
  accessToken: string,
  role: "seller" | "buyer",
  activeProfileId?: string | null
): Promise<MarketplacePartnerDto[]> {
  return apiGetJson<MarketplacePartnerDto[]>(
    `/marketplace/transactions/partners?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransactions(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto[]> {
  return apiGetJson<MarketplaceTransactionDto[]>(
    "/marketplace/transactions",
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransactionSummary(
  accessToken: string,
  activeProfileId?: string | null
): Promise<MarketplaceFinanceSummaryDto> {
  return apiGetJson<MarketplaceFinanceSummaryDto>(
    "/marketplace/transactions/summary",
    accessToken,
    activeProfileId
  );
}

export function fetchMarketplaceTransaction(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiGetJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}`,
    accessToken,
    activeProfileId
  );
}

export function initiateMarketplacePayment(
  accessToken: string,
  transactionId: string,
  activeProfileId: string | null | undefined,
  paymentMethod: "mobile_money" | "wallet"
): Promise<{
  providerRef: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentUrl?: string | null;
}> {
  return apiPostJson<{
    providerRef: string;
    amount: number;
    currency: string;
    paymentMethod?: string;
    paymentUrl?: string | null;
  }>(
    `/marketplace/transactions/${transactionId}/payment/initiate`,
    { paymentMethod },
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplacePayment(
  accessToken: string,
  transactionId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function syncMarketplacePayment(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/payment/sync`,
    {},
    accessToken,
    activeProfileId
  );
}

export function scheduleMarketplacePickup(
  accessToken: string,
  transactionId: string,
  payload: { pickupDate: string; pickupLocation: string; notes?: string },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/pickup`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplacePickup(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/pickup/confirm`,
    {},
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceShipment(
  accessToken: string,
  transactionId: string,
  payload: {
    shippedAt: string;
    method?: "handover" | "third_party" | "seller_delivery";
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/confirm-shipment`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function confirmMarketplaceReceipt(
  accessToken: string,
  transactionId: string,
  payload: {
    receivedAt: string;
    condition: "conform" | "minor_issue" | "major_issue";
    receivedAnimalIds: string[];
    realWeightKg?: number;
    animalWeights?: { animalId: string; weightKg: number }[];
    receivedHeadcount?: number;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/confirm-receipt`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function declareMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  payload: {
    realWeightKg?: number;
    animalWeights?: Array<{
      animalId: string;
      weightKg: number;
      photoUrl?: string;
    }>;
    photoUrl?: string;
  },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/declare`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function declareSellerMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  payload: { sellerDeclaredWeightKg: number; photoUrl?: string },
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/seller-declare`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function requestMarketplaceWeightArbitration(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/request-arbitration`,
    {},
    accessToken,
    activeProfileId
  );
}

export function validateMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/validate`,
    {},
    accessToken,
    activeProfileId
  );
}

export function disputeMarketplaceWeight(
  accessToken: string,
  transactionId: string,
  reason: string | undefined,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/weight/dispute`,
    reason ? { reason } : {},
    accessToken,
    activeProfileId
  );
}

export function cancelMarketplaceTransaction(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceTransactionDto> {
  return apiPostJson<MarketplaceTransactionDto>(
    `/marketplace/transactions/${transactionId}/cancel`,
    {},
    accessToken,
    activeProfileId
  );
}

export function completeMarketplacePendingTransfer(
  accessToken: string,
  transactionId: string,
  payload: { buyerFarmId: string; penId?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean; animalIds: string[] }> {
  return apiPostJson<{ ok: boolean; animalIds: string[] }>(
    `/marketplace/transactions/${transactionId}/pending-transfer/complete`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function marketplaceReceiptPdfAbsoluteUrl(transactionId: string): string {
  return `${apiBaseUrl()}/api/v1/marketplace/transactions/${encodeURIComponent(transactionId)}/receipt/pdf`;
}

export function fetchMarketplaceReceipt(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<MarketplaceReceiptDto> {
  return apiGetJson<MarketplaceReceiptDto>(
    `/marketplace/transactions/${transactionId}/receipt`,
    accessToken,
    activeProfileId
  );
}

export function regenerateMarketplaceReceipt(
  accessToken: string,
  transactionId: string,
  activeProfileId?: string | null
): Promise<{ receiptNumber: string | null; status: string }> {
  return apiPostJson<{ receiptNumber: string | null; status: string }>(
    `/marketplace/transactions/${transactionId}/receipt/generate`,
    {},
    accessToken,
    activeProfileId
  );
}

/** Acheteur : retirer une offre encore en attente. */
export function withdrawMarketplaceOffer(
  accessToken: string,
  offerId: string,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson<unknown>(
    `/marketplace/offers/${offerId}/withdraw`,
    {},
    accessToken,
    activeProfileId
  );
}

export type CreateMarketplaceListingPayload = {
  farmId?: string;
  animalId?: string;
  title: string;
  description?: string;
  unitPrice?: number;
  quantity?: number;
  currency?: string;
  locationLabel?: string;
  category?: string;
  photoUrls?: string[];
  animalIds?: string[];
  totalWeightKg?: number;
  weightBasis?: "live" | "carcass";
  pricePerKg?: number;
  totalPrice?: number;
  breedLabel?: string;
  creditEnabled?: boolean;
};

/** POST /marketplace/listings — brouillon ; publication séparée. */
export function createMarketplaceListing(
  accessToken: string,
  payload: CreateMarketplaceListingPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    "/marketplace/listings",
    payload,
    accessToken,
    activeProfileId
  );
}

export type UpdateMarketplaceListingPayload = {
  title?: string;
  description?: string | null;
  unitPrice?: number | null;
  quantity?: number | null;
  currency?: string;
  locationLabel?: string | null;
  category?: string | null;
  photoUrls?: string[];
  animalIds?: string[];
  totalWeightKg?: number | null;
  weightBasis?: "live" | "carcass" | null;
  pricePerKg?: number | null;
  totalPrice?: number | null;
  breedLabel?: string | null;
  creditEnabled?: boolean;
};

/** PATCH /marketplace/listings/:id — vendeur, annonce non vendue / non annulée. */
export function updateMarketplaceListing(
  accessToken: string,
  listingId: string,
  payload: UpdateMarketplaceListingPayload,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPatchJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** POST .../publish — passage en publié. */
export function publishMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null,
  durationDays?: 7 | 14 | 30
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/publish`,
    durationDays ? { durationDays } : {},
    accessToken,
    activeProfileId
  );
}

export function renewMarketplaceListing(
  accessToken: string,
  listingId: string,
  durationDays: 7 | 14 | 30,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem> {
  return apiPostJson<MarketplaceListingListItem>(
    `/marketplace/listings/${listingId}/renew`,
    { durationDays },
    accessToken,
    activeProfileId
  );
}

/** POST .../cancel — annulation et offres en attente refusées. */
export function cancelMarketplaceListing(
  accessToken: string,
  listingId: string,
  activeProfileId?: string | null
): Promise<MarketplaceListingListItem | null> {
  return apiPostJson<MarketplaceListingListItem | null>(
    `/marketplace/listings/${listingId}/cancel`,
    {},
    accessToken,
    activeProfileId
  );
}

