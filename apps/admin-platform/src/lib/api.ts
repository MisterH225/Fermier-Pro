import { API_BASE } from "./utils";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(init?.headers ?? {})
      },
      cache: "no-store"
    });
  } catch (e) {
    const hint =
      e instanceof TypeError && /fetch/i.test(e.message)
        ? `API injoignable (${API_BASE}). Lancez l’API : npm run dev:api depuis la racine du monorepo.`
        : e instanceof Error
          ? e.message
          : String(e);
    throw new ApiError(hint, 0);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

export type { AdminMeDto } from "./admin-auth";

export type OverviewDto = {
  kpis: {
    activeFarms: number;
    totalUsers: number;
    verifiedVets: number;
    pendingVets: number;
    activeAnimals: number;
    activeDiseases: number;
    monthTransactions: number;
    countriesCovered: number;
  };
  charts: {
    signups30d: Array<{ day: string; count: number }>;
    farmsByCountry: Array<{ country: string; count: number }>;
    profileDistribution: Array<{ profile: string; count: number }>;
  };
  recentActivity: {
    signups: Array<{ id: string; name: string; createdAt: string }>;
    vetRequests: Array<{ id: string; name: string; country: string; createdAt: string }>;
    sanitaryAlerts: Array<{ id: string; zoneName: string; level: string; message: string }>;
  };
};

export type VetProfileRow = {
  id: string;
  fullName: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  locationCity: string;
  locationCountry: string;
  primarySpecialty: string;
  verificationStatus: string;
  diplomaPhotoUrl: string;
  profilePhotoUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    createdAt: string;
  };
};

export type UserListItem = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  accountStatus?: "active" | "suspended" | "banned";
  suspendedUntil?: string | null;
  createdAt: string;
  profiles: Array<{
    id: string;
    type: string;
    displayName: string | null;
    profileStatus?: string;
    createdAt?: string;
  }>;
  vetProfile?: { id: string; verificationStatus: string } | null;
  primaryFarm: { id: string; name: string } | null;
};

export type UsersListDto = {
  total: number;
  items: UserListItem[];
};

export type UserDetailDto = {
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
    isActive: boolean;
    accountStatus?: "active" | "suspended" | "banned";
    suspendedAt?: string | null;
    suspendedReason?: string | null;
    suspendedUntil?: string | null;
    bannedAt?: string | null;
    bannedReason?: string | null;
    createdAt: string;
    homeLocationLabel: string | null;
  };
  profiles: Array<{
    id: string;
    type: string;
    displayName: string | null;
    isDefault: boolean;
    profileStatus?: string;
    profileSuspendedReason?: string | null;
    profileSuspendedAt?: string | null;
    createdAt?: string;
  }>;
  vetProfile: VetProfileRow | null;
  farms: Array<{
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    activeAnimals: number;
    healthRecords: number;
  }>;
  memberships: Array<{ id: string; farm: { id: string; name: string } }>;
  healthSummary: {
    activeDiseases: number;
    mortalityRate30d: number;
    overdueVaccines: number;
  };
  livestockSummary: {
    totalActive: number;
    byCategory: Array<{ category: string; count: number }>;
  };
  financeSummary: {
    expenses3m: number;
    revenues3m: number;
    netMargin3m: number;
  };
  gestationSummary: {
    active: number;
    upcomingFarrowings: number;
  };
};

export type StatsDto = {
  period: "month" | "quarter" | "year";
  since: string;
  topDiseases: Array<{ label: string; count: number }>;
  mortalityHeadcount: number;
  newUsers: number;
  activeAnimals: number;
};

export type SupportContactDto = {
  phone: string | null;
  telegramUrl: string | null;
};

export type PlatformSettingsDto = {
  id: string;
  mapGeographicScope: string;
  mapCountryCodes: string[] | null;
  alertCaseThreshold: number;
  alertPeriodDays: number;
  alertDefaultLevel: string;
  adminNotifyEmail: string | null;
  reportFrequencyDays: number;
  marketplaceCommissionRate: number;
  sellerMarketplaceCommissionRate: number;
  vetCommissionRate: number;
  supportPhone: string | null;
  supportTelegramUrl: string | null;
  withdrawalAutoApproveThreshold?: number;
  marketplaceWeightArbitrationMinDiffKg?: number;
  marketplaceWeightArbitrationCumulativeMinDiffKg?: number;
  merchantPremiumPriceXof?: number;
  merchantPremiumMaxShops?: number;
  merchantPremiumBillingUnit?: "hour" | "day" | "month";
  merchantPremiumBillingInterval?: number;
  merchantPremiumGraceDays?: number;
  merchantPremiumTrialEnabled?: boolean;
  merchantPremiumTrialUnits?: number;
  merchantPremiumPromoEnabled?: boolean;
  merchantPremiumPromoPercentOff?: number;
  merchantPremiumPromoEndsAt?: string | null;
  producerPremiumPriceXof?: number;
  producerPremiumBillingUnit?: "hour" | "day" | "month";
  producerPremiumBillingInterval?: number;
  producerPremiumGraceDays?: number;
  producerPremiumTrialEnabled?: boolean;
  producerPremiumTrialUnits?: number;
  producerPremiumPromoEnabled?: boolean;
  producerPremiumPromoPercentOff?: number;
  producerPremiumPromoEndsAt?: string | null;
  /** Valeurs réellement servies au mobile (DB + fallback env). */
  supportEffective: SupportContactDto;
};

export type WalletFeeConfigDto = {
  transactionType: "deposit" | "withdrawal" | "transfer";
  feePercentage: number;
  feeFixed: number;
  minFee: number;
  maxFee: number | null;
  isActive: boolean;
};

export type WithdrawalRequestAdminDto = {
  id: string;
  status: string;
  amountRequested: number;
  feeAmount: number;
  totalDebit: number;
  amountToReceive: number;
  phoneNumber: string;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  user: {
    id: string;
    displayName: string;
    phone: string | null;
  };
};

export type HealthMapGranularity = "country" | "city" | "sector" | "department";

export type HealthMapZone = {
  id: string;
  label: string;
  level: HealthMapGranularity;
  parentLabel?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  masked?: boolean;
  activeCases?: number;
  totalCasesInPeriod?: number;
  farmCount?: number;
  topDiseases?: Array<{ name: string; count: number }>;
};

export type HealthMapDto = {
  mode?: "aggregated";
  periodDays: number;
  granularity: HealthMapGranularity;
  truncated?: boolean;
  zones: HealthMapZone[];
  regions?: Array<{
    country: string;
    activeCases: number;
    totalCases: number;
    farmCount: number;
    topDiseases: Array<{ name: string; count: number }>;
  }>;
  points?: Array<{
    recordId: string;
    farmId: string;
    farmName: string;
    lat: number;
    lng: number;
    diagnosis: string;
    severity: string | null;
    zoneId: string;
    city: string | null;
    sectorLabel: string | null;
  }>;
};

export type RegionalStatsCoverage = {
  farmCount: number;
  animalCount: number;
  departmentsCovered: number;
};

export type RegionalStatsDepartmentRow = {
  departmentCode: string;
  farmCount: number;
  masked?: true;
  mortalityHeadcount?: number;
  mortalityByCause?: Record<string, number>;
  zScore?: number | null;
  overmortality?: boolean;
  animalCountByCategory?: Record<string, number>;
  exitsSaleHeadcount?: number;
  exitsSlaughterHeadcount?: number;
  littersCount?: number;
  bornAlive?: number;
  stillborn?: number;
  weanedEstimate?: number;
  avgGmqByCategory?: Record<string, number>;
  exitsSaleAvgPricePerKg?: number | null;
  vetConsultationsCount?: number;
  tauxMiseBas?: number | null;
  tauxMortNes?: number | null;
  tauxPertesGestation?: number | null;
  partIA?: number | null;
  totalSuspicionsDeclared?: number;
  incidencePerThousand?: number | null;
  letaliteApparenteDeclarative?: number | null;
  tauxVenteCheptel?: number | null;
  avgAgeAtSaleDays?: number | null;
  activeFarmsCount?: number;
  activeUsersByRole?: Record<string, number>;
};

export type RegionalStatsResponse = {
  from: string;
  to: string;
  coverage: RegionalStatsCoverage;
  departments: RegionalStatsDepartmentRow[];
  national?: Record<string, unknown>;
};

export type RegionalStatsSectionsDto = {
  sections: string[];
  isSuperadmin?: boolean;
};

export type RegionalStatsQuery = {
  from?: string;
  to?: string;
  regionCode?: string;
  departmentCode?: string;
};

export type SanitaryAlertRow = {
  id: string;
  zoneName: string;
  countryCode: string | null;
  level: string;
  alertType: string;
  diseaseName: string | null;
  caseCount: number | null;
  message: string;
  isActive: boolean;
  createdAt: string;
};

export type AdminEpidemicAnalysis = {
  summary: string;
  emergingDiseases: string[];
  riskZones: string[];
  trends: string[];
  recommendations: string[];
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminAiAskResult = {
  answer: string;
  generatedAt: string;
  unavailable?: boolean;
};

export type AdminVetAssistResult = {
  readableDiploma: "yes" | "no" | "manual_check";
  infoConsistent: boolean;
  confidenceScore: number;
  recommendation: "approve" | "review" | "reject";
  notes: string;
  generatedAt: string;
  unavailable?: boolean;
  diplomaImageAnalyzed?: boolean;
};

export type AdminPigPriceChartDto = {
  period: string;
  category: string;
  insufficientData: boolean;
  message: string | null;
  series: Array<{
    key: string;
    label: string;
    color: string;
    dashed?: boolean;
    points: Array<{
      date: string;
      avgPricePerKg: number;
      listingAvgPrice: number | null;
      transactionCount: number;
      variationPct: number | null;
      limitedData: boolean;
    }>;
  }>;
  updatedAt: string;
};

export type AdminPigPriceStatsDto = {
  rows: Array<{
    category: string;
    label: string;
    todayPrice: number | null;
    variation24h: number | null;
    variation7d: number | null;
    high30d: number | null;
    low30d: number | null;
    volume: number;
  }>;
};

export function fetchAdminPigPriceChart(
  token: string,
  period = "30d",
  category = "all"
): Promise<AdminPigPriceChartDto> {
  const q = new URLSearchParams({ period });
  if (category !== "all") q.set("category", category);
  return apiFetch(`/admin/pig-price-index?${q.toString()}`, token);
}

export function fetchAdminPigPriceStats(
  token: string,
  period = "30d"
): Promise<AdminPigPriceStatsDto> {
  return apiFetch(`/admin/pig-price-index/stats?period=${period}`, token);
}

export function fetchAdminPigPriceTicker(token: string) {
  return apiFetch<{ items: Array<{ category: string; label: string; icon: string; pricePerKg: number | null; variationPct: number | null; color: string }> }>(
    "/admin/pig-price-index/ticker",
    token
  );
}

export type AdminHybridPigPriceDto = {
  current: {
    price_per_kg: number;
    trend: "up" | "down" | "stable";
    variation_7d_pct: number | null;
    calculated_at: string;
    data_points_count: number;
  } | null;
  isFrozen: boolean;
  freezeReason: string | null;
  snapshots: Array<{
    id: string;
    calculatedAt: string;
    indexValue: number;
    confirmedCount: number;
    listingCount: number;
    totalWeightKg: number;
    isFrozen: boolean;
    freezeReason: string | null;
  }>;
  flaggedListings: Array<{
    id: string;
    listingId: string;
    sellerUserId: string;
    pricePerKg: number;
    deviationPct: number;
    flaggedAt: string;
  }>;
  topContributors: Array<{
    sellerUserId: string;
    sellerName: string;
    volumeKg: number;
    transactionCount: number;
  }>;
};

export function fetchAdminHybridPigPrice(token: string) {
  return apiFetch<AdminHybridPigPriceDto>("/admin/pig-price-index/hybrid", token);
}

export function adminUnfreezeHybridPigPrice(token: string) {
  return apiFetch<{ ok: true; recalculated: boolean }>(
    "/admin/pig-price-index/hybrid/unfreeze",
    token,
    { method: "POST" }
  );
}

export function adminRecalculateHybridPigPrice(token: string) {
  return apiFetch<unknown>("/admin/pig-price-index/hybrid/recalculate", token, {
    method: "POST"
  });
}

export type AdminMarketplaceOverviewDto = {
  listings: {
    total: number;
    published: number;
    byStatus: Record<string, number>;
  };
  transactions: {
    active: number;
    openDisputes: number;
    byStatus: Record<string, number>;
  };
  totalViews: number;
};

export type AdminMarketplaceListingRow = {
  id: string;
  title: string;
  status: string;
  category: string | null;
  totalPrice: number | null;
  pricePerKg: number | null;
  totalWeightKg: number | null;
  currency: string;
  locationLabel: string | null;
  viewsCount: number;
  activeOfferCount: number;
  publishedAt: string | null;
  updatedAt: string;
  seller: { id: string; fullName: string | null; email: string | null };
  farm: { id: string; name: string } | null;
  transactionCount: number;
  offerCount: number;
};

export type AdminMarketplaceTransactionRow = {
  id: string;
  status: string;
  blockedAmount: string | number;
  finalAmount?: string | number | null;
  realWeightKg?: string | number | null;
  arbitrationWeightKg?: string | number | null;
  currency: string;
  updatedAt: string;
  weightDisputeOpenedAt?: string | null;
  weightDeclaredByBuyerAt?: string | null;
  listing: { id: string; title: string };
  buyer: { id: string; fullName: string | null; email: string | null };
  seller: { id: string; fullName: string | null; email: string | null };
};

export function fetchAdminMarketplaceOverview(token: string) {
  return apiFetch<AdminMarketplaceOverviewDto>("/admin/marketplace/overview", token);
}

export function fetchAdminMarketplaceListings(token: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<AdminMarketplaceListingRow[]>(
    `/admin/marketplace/listings${q}`,
    token
  );
}

export type AdminMarketplaceListingDetailDto = AdminMarketplaceListingRow & {
  description: string | null;
  breedLabel: string | null;
  pricePerKg: number | null;
  totalWeightKg: number | null;
  unitPrice: number | null;
  quantity: number | null;
  photoUrls: string[];
  animalIds: string[];
  fallbackPhotoUrl: string | null;
  consultationsCount: number;
  publishedAt: string | null;
  expiresAt: string | null;
  pickupAt: string | null;
  pickupNote: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  disputedAt: string | null;
  createdAt: string;
  archived: boolean;
  animal: {
    id: string;
    publicId: string;
    tagCode: string | null;
    sex: string | null;
    status: string;
    photoUrl: string | null;
  } | null;
  reservedForBuyer: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
  healthData: unknown;
  farmInfo: unknown;
  farmRatingSummary: { avg: number | null; count: number } | null;
  offers: Array<{
    id: string;
    status: string;
    offerType: string;
    offeredPrice: number;
    message: string | null;
    createdAt: string;
    buyer: { id: string; fullName: string | null; email: string | null };
    transaction: { id: string; status: string } | null;
  }>;
  transactions: Array<{
    id: string;
    status: string;
    blockedAmount: number;
    finalAmount: number | null;
    currency: string;
    updatedAt: string;
    buyer: { id: string; fullName: string | null; email: string | null };
    seller: { id: string; fullName: string | null; email: string | null };
  }>;
};

export function fetchAdminMarketplaceListingDetail(token: string, id: string) {
  return apiFetch<AdminMarketplaceListingDetailDto>(
    `/admin/marketplace/listings/${id}`,
    token
  );
}

export function deleteAdminMarketplaceListing(token: string, listingId: string) {
  return apiFetch<{ ok: true; listingId: string; title: string }>(
    `/admin/marketplace/listings/${listingId}`,
    token,
    { method: "DELETE" }
  );
}

export function fetchAdminMarketplaceTransactions(
  token: string,
  status?: string
) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<AdminMarketplaceTransactionRow[]>(
    `/admin/marketplace/transactions${q}`,
    token
  );
}

export function fetchAdminMarketplaceDisputes(token: string) {
  return apiFetch<AdminMarketplaceTransactionRow[]>(
    "/admin/marketplace/disputes",
    token
  );
}

export type AdminMarketplaceReceiptRow = {
  transactionId: string;
  listingTitle: string;
  sellerName: string | null;
  buyerName: string | null;
  closedAt: string | null;
  receiptGenerationStatus: string;
  receipt: {
    id: string;
    receiptNumber: string;
    generatedAt: string;
    pdfSizeBytes: number;
  } | null;
};

export function fetchAdminMarketplaceReceipts(token: string) {
  return apiFetch<AdminMarketplaceReceiptRow[]>(
    "/admin/marketplace/receipts",
    token
  );
}

export function adminRegenerateReceipt(token: string, transactionId: string) {
  return apiFetch<{ receiptNumber: string } | null>(
    `/admin/marketplace/receipts/regenerate/${transactionId}`,
    token,
    { method: "POST" }
  );
}

export function adminDownloadReceipt(token: string, receiptId: string) {
  return apiFetch<{ receiptNumber: string; downloadUrl: string }>(
    `/admin/marketplace/receipts/${receiptId}/download`,
    token
  );
}

export function adminArbitrateMarketplaceWeight(
  token: string,
  transactionId: string,
  arbitrationWeightKg: number
) {
  return apiFetch<unknown>(
    `/admin/marketplace/transactions/${transactionId}/arbitrate`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ arbitrationWeightKg })
    }
  );
}

export type AdminPlatformRevenueDto = {
  period: string;
  totalCommission: number;
  totalGross: number;
  transactionCount: number;
  series: Array<{ date: string; commission: number }>;
  recent: Array<{
    id: string;
    transactionId: string;
    listingTitle: string;
    commissionAmount: number;
    grossAmount: number;
    commissionRate: number;
    collectedAt: string;
  }>;
};

export function fetchAdminPlatformRevenue(
  token: string,
  period = "30d"
) {
  return apiFetch<AdminPlatformRevenueDto>(
    `/admin/marketplace/revenue?period=${encodeURIComponent(period)}`,
    token
  );
}

export type AdminVetAppointmentRow = {
  id: string;
  status: string;
  farmName?: string | null;
  vetName?: string | null;
  producerName?: string | null;
  servicePrice?: number | null;
  blockedAmount?: number | null;
  currency: string;
  requestedAt: string;
  confirmedAt?: string | null;
  conflictStatus?: string | null;
};

export function fetchAdminVetAppointments(token: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<AdminVetAppointmentRow[]>(
    `/admin/vet-appointments${q}`,
    token
  );
}

export function adminRefundVetAppointment(
  token: string,
  appointmentId: string,
  amount?: number
) {
  return apiFetch<{ ok: boolean; refundAmount: number }>(
    `/admin/vet-appointments/${appointmentId}/refund`,
    token,
    {
      method: "POST",
      body: JSON.stringify(amount != null ? { amount } : {})
    }
  );
}

export type AdminVetAppointmentRevenueDto = {
  period: string;
  totalCommission: number;
  totalGross: number;
  appointmentCount: number;
  recent: Array<{
    id: string;
    appointmentId: string | null;
    farmName: string;
    vetName: string;
    commissionAmount: number;
    grossAmount: number;
    collectedAt: string;
  }>;
  lowRatedVets: Array<{
    id: string;
    fullName: string;
    ratingAvg: number | null;
    ratingCount: number;
    completedAppointments: number;
  }>;
};

export function fetchAdminVetAppointmentRevenue(
  token: string,
  period?: string
) {
  const q = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiFetch<AdminVetAppointmentRevenueDto>(
    `/admin/vet-appointments/revenue${q}`,
    token
  );
}

export function fetchPlatformOverview(token: string) {
  return apiFetch<OverviewDto>("/admin/platform/overview", token);
}

export function fetchSanitaryAlerts(token: string) {
  return apiFetch<SanitaryAlertRow[]>("/admin/sanitary-alerts", token);
}

export function createSanitaryAlert(
  token: string,
  body: Record<string, unknown>
) {
  return apiFetch<SanitaryAlertRow>("/admin/sanitary-alerts", token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function fetchPlatformSettings(token: string) {
  return apiFetch<PlatformSettingsDto>("/admin/settings", token);
}

export function patchPlatformSettings(
  token: string,
  body: Partial<PlatformSettingsDto>
) {
  return apiFetch<PlatformSettingsDto>("/admin/settings", token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export type AdminMerchantSubscriptionRow = {
  profileId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  shopCount: number;
  subscriptionTier: "free" | "premium" | null;
  subscriptionStatus:
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "trialing"
    | null;
  nextBillingAt: string | null;
  trialEndsAt: string | null;
  promoPercentOffApplied: number | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  cancelledAt: string | null;
  premiumPaidAt: string | null;
};

export type AdminMerchantSubscriptionsListDto = {
  billing: {
    fullPriceXof: number;
    effectivePriceXof: number;
    billingUnit: "hour" | "day" | "month";
    billingInterval: number;
    graceDays: number;
    trialEnabled: boolean;
    trialUnits: number;
    promoEnabled: boolean;
    promoPercentOff: number;
  };
  items: AdminMerchantSubscriptionRow[];
};

export function fetchAdminMerchantSubscriptions(
  token: string,
  params?: { status?: string; q?: string }
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<AdminMerchantSubscriptionsListDto>(
    `/admin/merchant-subscriptions${suffix}`,
    token
  );
}

export function adminSuspendMerchantSubscription(
  token: string,
  profileId: string,
  reason?: string
) {
  return apiFetch<AdminMerchantSubscriptionRow>(
    `/admin/merchant-subscriptions/${profileId}/suspend`,
    token,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

export function adminResumeMerchantSubscription(
  token: string,
  profileId: string
) {
  return apiFetch<AdminMerchantSubscriptionRow>(
    `/admin/merchant-subscriptions/${profileId}/resume`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function adminCancelMerchantSubscription(
  token: string,
  profileId: string,
  reason?: string
) {
  return apiFetch<AdminMerchantSubscriptionRow>(
    `/admin/merchant-subscriptions/${profileId}/cancel`,
    token,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

export function adminGrantMerchantTrial(
  token: string,
  profileId: string,
  units?: number
) {
  return apiFetch<AdminMerchantSubscriptionRow>(
    `/admin/merchant-subscriptions/${profileId}/grant-trial`,
    token,
    { method: "POST", body: JSON.stringify({ units }) }
  );
}

export function adminApplyMerchantPromo(
  token: string,
  profileId: string,
  percentOff: number
) {
  return apiFetch<AdminMerchantSubscriptionRow>(
    `/admin/merchant-subscriptions/${profileId}/apply-promo`,
    token,
    { method: "POST", body: JSON.stringify({ percentOff }) }
  );
}

export type AdminMerchantPromoCodeRow = {
  id: string;
  code: string;
  type: "trial" | "discount" | "promo";
  label: string | null;
  percentOff: number | null;
  trialUnits: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AdminTriggerRenewalResult = {
  profileId: string;
  subscriptionStatus: string | null;
  nextBillingAt: string | null;
  graceEndsAt: string | null;
  pendingInvoice: {
    id: string;
    amount: number;
    paymentUrl: string | null;
    providerRef: string | null;
  } | null;
};

export function adminTriggerMerchantRenewal(token: string, profileId: string) {
  return apiFetch<AdminTriggerRenewalResult>(
    `/admin/merchant-subscriptions/${profileId}/trigger-renewal`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export type AdminMerchantSubscriptionInvoiceRow = {
  invoiceId: string;
  profileId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "expired";
  providerRef: string | null;
  paymentUrl: string | null;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  profileSubscriptionTier: "free" | "premium" | null;
  profileSubscriptionStatus:
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "trialing"
    | null;
};

export type AdminMerchantSubscriptionInvoiceSyncInsight =
  | "aligned_completed"
  | "provider_completed_invoice_pending"
  | "invoice_paid_provider_not_found"
  | "invoice_paid_provider_pending"
  | "amount_mismatch"
  | "provider_not_completed"
  | "no_provider_ref"
  | "internal_wallet_ref"
  | "lookup_unavailable";

export type AdminMerchantSubscriptionInvoiceInspection = {
  checkedAt: string;
  providerRef: string | null;
  lookupAttempted: boolean;
  lookupFound: boolean;
  providerStatus?: string;
  providerAmount?: number;
  providerCurrency?: string;
  amountMatches?: boolean;
  lookupError?: string;
  syncInsight: AdminMerchantSubscriptionInvoiceSyncInsight;
  geniusPayCheckoutUrl: string | null;
};

export type AdminMerchantSubscriptionInvoiceDetailDto =
  AdminMerchantSubscriptionInvoiceRow & {
    providerInspection?: AdminMerchantSubscriptionInvoiceInspection;
  };

export function fetchAdminMerchantSubscriptionInvoices(
  token: string,
  params?: { status?: string; q?: string; profileId?: string }
) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.profileId) search.set("profileId", params.profileId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: AdminMerchantSubscriptionInvoiceRow[] }>(
    `/admin/merchant-subscription-invoices${suffix}`,
    token
  );
}

export function fetchAdminMerchantSubscriptionInvoice(
  token: string,
  invoiceId: string,
  verify = false
) {
  const suffix = verify ? "?verify=true" : "";
  return apiFetch<AdminMerchantSubscriptionInvoiceDetailDto>(
    `/admin/merchant-subscription-invoices/${invoiceId}${suffix}`,
    token
  );
}

export type AdminProducerSubscriptionRow = {
  profileId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  farmCount: number;
  subscriptionTier: "free" | "premium" | null;
  subscriptionStatus:
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "trialing"
    | null;
  nextBillingAt: string | null;
  trialEndsAt: string | null;
  promoPercentOffApplied: number | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  cancelledAt: string | null;
  premiumPaidAt: string | null;
};

export type AdminProducerSubscriptionsListDto = {
  billing: AdminMerchantSubscriptionsListDto["billing"];
  items: AdminProducerSubscriptionRow[];
};

export function fetchAdminProducerSubscriptions(
  token: string,
  params?: { status?: string; q?: string }
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<AdminProducerSubscriptionsListDto>(
    `/admin/producer-subscriptions${suffix}`,
    token
  );
}

export function adminSuspendProducerSubscription(
  token: string,
  profileId: string,
  reason?: string
) {
  return apiFetch<AdminProducerSubscriptionRow>(
    `/admin/producer-subscriptions/${profileId}/suspend`,
    token,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

export function adminResumeProducerSubscription(
  token: string,
  profileId: string
) {
  return apiFetch<AdminProducerSubscriptionRow>(
    `/admin/producer-subscriptions/${profileId}/resume`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function adminCancelProducerSubscription(
  token: string,
  profileId: string,
  reason?: string
) {
  return apiFetch<AdminProducerSubscriptionRow>(
    `/admin/producer-subscriptions/${profileId}/cancel`,
    token,
    { method: "POST", body: JSON.stringify({ reason }) }
  );
}

export function adminGrantProducerTrial(
  token: string,
  profileId: string,
  units?: number
) {
  return apiFetch<AdminProducerSubscriptionRow>(
    `/admin/producer-subscriptions/${profileId}/grant-trial`,
    token,
    { method: "POST", body: JSON.stringify({ units }) }
  );
}

export function adminApplyProducerPromo(
  token: string,
  profileId: string,
  percentOff: number
) {
  return apiFetch<AdminProducerSubscriptionRow>(
    `/admin/producer-subscriptions/${profileId}/apply-promo`,
    token,
    { method: "POST", body: JSON.stringify({ percentOff }) }
  );
}

export function adminTriggerProducerRenewal(token: string, profileId: string) {
  return apiFetch<AdminTriggerRenewalResult>(
    `/admin/producer-subscriptions/${profileId}/trigger-renewal`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export type AdminProducerSubscriptionInvoiceRow = AdminMerchantSubscriptionInvoiceRow;
export type AdminProducerSubscriptionInvoiceInspection =
  AdminMerchantSubscriptionInvoiceInspection;
export type AdminProducerSubscriptionInvoiceDetailDto =
  AdminProducerSubscriptionInvoiceRow & {
    providerInspection?: AdminProducerSubscriptionInvoiceInspection;
  };

export function fetchAdminProducerSubscriptionInvoices(
  token: string,
  params?: { status?: string; q?: string; profileId?: string }
) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.q) search.set("q", params.q);
  if (params?.profileId) search.set("profileId", params.profileId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<{ items: AdminProducerSubscriptionInvoiceRow[] }>(
    `/admin/producer-subscription-invoices${suffix}`,
    token
  );
}

export function fetchAdminProducerSubscriptionInvoice(
  token: string,
  invoiceId: string,
  verify = false
) {
  const suffix = verify ? "?verify=true" : "";
  return apiFetch<AdminProducerSubscriptionInvoiceDetailDto>(
    `/admin/producer-subscription-invoices/${invoiceId}${suffix}`,
    token
  );
}

export function fetchAdminMerchantPromoCodes(
  token: string,
  activeOnly?: boolean
) {
  const qs = activeOnly ? "?activeOnly=true" : "";
  return apiFetch<AdminMerchantPromoCodeRow[]>(
    `/admin/merchant-subscription-promo-codes${qs}`,
    token
  );
}

export function adminCreateMerchantPromoCode(
  token: string,
  body: {
    type: "trial" | "discount" | "promo";
    label?: string;
    code?: string;
    percentOff?: number;
    trialUnits?: number;
    maxRedemptions?: number;
    expiresAt?: string;
  }
) {
  return apiFetch<AdminMerchantPromoCodeRow>(
    "/admin/merchant-subscription-promo-codes",
    token,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function adminDeactivateMerchantPromoCode(token: string, id: string) {
  return apiFetch<AdminMerchantPromoCodeRow>(
    `/admin/merchant-subscription-promo-codes/${id}/deactivate`,
    token,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export type AdminMerchantCategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdminMerchantProductRow = {
  id: string;
  name: string;
  status: string;
  price: number;
  stock: number;
  categoryName: string;
  shopId?: string;
  shopName: string;
  shopArchivedAt?: string | null;
  merchantUserId: string;
  merchantEmail: string | null;
  merchantName: string | null;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  resubmissionCount?: number;
  resubmittedAt?: string | null;
  publishedAt: string | null;
  updatedAt: string;
  orderCount?: number;
};

export type AdminMerchantShopRow = {
  id: string;
  name: string;
  description: string | null;
  locationLabel: string | null;
  archivedAt: string | null;
  productCount: number;
  publishedProductCount: number;
  orderCount: number;
  hasOrderHistory: boolean;
  merchantProfileId: string;
  merchantUserId: string;
  merchantEmail: string | null;
  merchantName: string | null;
  createdAt: string;
  updatedAt: string;
};

export function fetchAdminMerchantCategories(token: string) {
  return apiFetch<AdminMerchantCategoryRow[]>("/admin/merchant/categories", token);
}

export function createAdminMerchantCategory(
  token: string,
  body: { name: string; slug?: string; sortOrder?: number }
) {
  return apiFetch<AdminMerchantCategoryRow>("/admin/merchant/categories", token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function patchAdminMerchantCategory(
  token: string,
  id: string,
  body: Partial<{ name: string; slug: string; sortOrder: number; isActive: boolean }>
) {
  return apiFetch<AdminMerchantCategoryRow>(
    `/admin/merchant/categories/${id}`,
    token,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function deleteAdminMerchantCategory(token: string, id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/merchant/categories/${id}`, token, {
    method: "DELETE"
  });
}

export function fetchAdminMerchantProducts(
  token: string,
  params?: { status?: string }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  const qs = q.toString();
  return apiFetch<AdminMerchantProductRow[]>(
    `/admin/merchant/products${qs ? `?${qs}` : ""}`,
    token
  );
}

export function fetchAdminMerchantShops(token: string) {
  return apiFetch<AdminMerchantShopRow[]>("/admin/merchant-shops", token);
}

export function archiveAdminMerchantShop(
  token: string,
  id: string,
  reason: string
) {
  return apiFetch<{ ok: boolean }>(
    `/admin/merchant-shops/${id}/archive`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ reason })
    }
  );
}

export function hardDeleteAdminMerchantShop(
  token: string,
  id: string,
  reason: string
) {
  return apiFetch<{ ok: boolean }>(`/admin/merchant-shops/${id}`, token, {
    method: "DELETE",
    body: JSON.stringify({ reason })
  });
}

export type AdminMerchantOrderRow = {
  id: string;
  productId: string;
  productName: string | null;
  productPhotoUrls: string[];
  productCurrency: string;
  buyerUserId: string;
  buyerName: string | null;
  buyerPhone?: string | null;
  sellerUserId: string;
  sellerName: string | null;
  sellerPhone?: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerCommission: number;
  sellerCommission: number;
  sellerNet: number;
  paymentMethod: string;
  providerRef: string | null;
  status: string;
  escrowHeld?: boolean;
  paidAt: string | null;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt: string | null;
  rejectedAt?: string | null;
  disputeOpenedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  timeoutAt?: string | null;
  createdAt: string;
  timeline?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  dispute: {
    id: string;
    reason: string;
    sellerNote: string | null;
    buyerNote: string | null;
    status: string;
    openedByUserId: string;
    createdAt: string;
    resolvedAt: string | null;
    resolutionNote?: string | null;
  } | null;
};

export function fetchAdminMerchantOrders(
  token: string,
  params?: { status?: string; take?: number }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.take != null) q.set("take", String(params.take));
  const qs = q.toString();
  return apiFetch<AdminMerchantOrderRow[]>(
    `/admin/merchant/orders${qs ? `?${qs}` : ""}`,
    token
  );
}

export function resolveAdminMerchantOrderDispute(
  token: string,
  orderId: string,
  body: { decision: "buyer" | "seller"; note?: string }
) {
  return apiFetch<AdminMerchantOrderRow>(
    `/admin/merchant/orders/${orderId}/resolve`,
    token,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function deleteAdminMerchantProduct(
  token: string,
  id: string,
  reason: string
) {
  return apiFetch<{ ok: boolean }>(`/admin/merchant/products/${id}`, token, {
    method: "DELETE",
    body: JSON.stringify({ reason })
  });
}

export function approveAdminMerchantProductResubmission(
  token: string,
  id: string
) {
  return apiFetch<{ ok: boolean; id: string; status: string }>(
    `/admin/merchant/products/${id}/approve-resubmission`,
    token,
    { method: "POST" }
  );
}

export function rejectAdminMerchantProductResubmission(
  token: string,
  id: string,
  reason: string
) {
  return apiFetch<{ ok: boolean; id: string }>(
    `/admin/merchant/products/${id}/reject-resubmission`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ reason })
    }
  );
}

export type SuperAdminRowDto = {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  createdBy: string | null;
};

export function fetchSuperAdmins(token: string) {
  return apiFetch<SuperAdminRowDto[]>("/admin/superadmins", token);
}

export function createSuperAdmin(
  token: string,
  body: { email: string; password: string; fullName?: string }
) {
  return apiFetch<SuperAdminRowDto>("/admin/superadmins", token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function removeSuperAdmin(token: string, userId: string) {
  return apiFetch<{ ok: boolean; removed: SuperAdminRowDto }>(
    `/admin/superadmins/${encodeURIComponent(userId)}`,
    token,
    { method: "DELETE" }
  );
}

export type InstitutionScheduledReportsConfig = {
  isActive: boolean;
  cadence: "monthly" | "weekly";
  format: "pdf" | "csv";
  sections: string[];
  lastRunAt?: string;
};

export type InstitutionConsoleUserDto = {
  id: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  institutionLabel: string | null;
  menuPermissions: Record<string, "read" | "write">;
  statSectionPermissions?: Record<string, boolean>;
  scheduledReports?: InstitutionScheduledReportsConfig;
  isActive: boolean;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export function fetchInstitutionConsoleUsers(token: string) {
  return apiFetch<InstitutionConsoleUserDto[]>("/admin/institution-users", token);
}

export function fetchInstitutionConsoleUser(token: string, id: string) {
  return apiFetch<InstitutionConsoleUserDto>(
    `/admin/institution-users/${encodeURIComponent(id)}`,
    token
  );
}

export function createInstitutionConsoleUser(
  token: string,
  body: {
    email: string;
    fullName?: string;
    institutionLabel?: string;
    inviteRedirectTo?: string;
    menuPermissions: Record<string, "read" | "write">;
    statSectionPermissions?: Record<string, boolean>;
    scheduledReports?: InstitutionScheduledReportsConfig;
  }
) {
  return apiFetch<InstitutionConsoleUserDto>("/admin/institution-users", token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updateInstitutionConsoleUser(
  token: string,
  id: string,
  body: {
    institutionLabel?: string;
    isActive?: boolean;
    menuPermissions?: Record<string, "read" | "write">;
    statSectionPermissions?: Record<string, boolean>;
    scheduledReports?: InstitutionScheduledReportsConfig;
  }
) {
  return apiFetch<InstitutionConsoleUserDto>(
    `/admin/institution-users/${encodeURIComponent(id)}`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify(body)
    }
  );
}

export function removeInstitutionConsoleUser(token: string, id: string) {
  return apiFetch<{ ok: boolean; removed: InstitutionConsoleUserDto }>(
    `/admin/institution-users/${encodeURIComponent(id)}`,
    token,
    { method: "DELETE" }
  );
}

export function resendInstitutionConsoleInvite(
  token: string,
  id: string,
  redirectTo?: string
) {
  return apiFetch<{ ok: boolean }>(
    `/admin/institution-users/${encodeURIComponent(id)}/resend-invite`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ redirectTo })
    }
  );
}

export function fetchWalletFeeConfigs(token: string) {
  return apiFetch<WalletFeeConfigDto[]>("/admin/wallet/fees", token);
}

export function patchWalletFeeConfig(
  token: string,
  transactionType: WalletFeeConfigDto["transactionType"],
  body: Partial<WalletFeeConfigDto>
) {
  return apiFetch<WalletFeeConfigDto>(
    `/admin/wallet/fees/${transactionType}`,
    token,
    { method: "PATCH", body: JSON.stringify(body) }
  );
}

export function fetchPendingWithdrawals(token: string) {
  return apiFetch<WithdrawalRequestAdminDto[]>(
    "/admin/wallet/withdrawals?status=pending_review",
    token
  );
}

export function approveWithdrawalRequest(token: string, id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/wallet/withdrawals/${id}/approve`, token, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function rejectWithdrawalRequest(
  token: string,
  id: string,
  reason: string
) {
  return apiFetch<{ ok: boolean }>(`/admin/wallet/withdrawals/${id}/reject`, token, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
}

export function fetchAdminStats(
  token: string,
  period: StatsDto["period"] = "month"
) {
  return apiFetch<StatsDto>(`/admin/stats?period=${period}`, token);
}

function appendViewAsInstitutionId(
  params: URLSearchParams,
  viewAsInstitutionId?: string | null
) {
  if (viewAsInstitutionId?.trim()) {
    params.set("viewAsInstitutionId", viewAsInstitutionId.trim());
  }
}

function normalizeHealthMapZone(
  raw: Record<string, unknown>
): HealthMapZone {
  const id = String(raw.zoneId ?? raw.id ?? "");
  const masked = raw.masked === true;
  return {
    id,
    label: String(raw.label ?? id),
    level: (raw.level as HealthMapGranularity) ?? "sector",
    parentLabel:
      typeof raw.parentLabel === "string" ? raw.parentLabel : null,
    centerLat:
      typeof raw.centerLat === "number" ? raw.centerLat : null,
    centerLng:
      typeof raw.centerLng === "number" ? raw.centerLng : null,
    masked,
    activeCases:
      typeof raw.activeCasesCount === "number"
        ? raw.activeCasesCount
        : typeof raw.activeCases === "number"
          ? raw.activeCases
          : undefined,
    totalCasesInPeriod:
      typeof raw.casesCount === "number"
        ? raw.casesCount
        : typeof raw.totalCasesInPeriod === "number"
          ? raw.totalCasesInPeriod
          : undefined,
    farmCount:
      typeof raw.farmsAffectedCount === "number"
        ? raw.farmsAffectedCount
        : typeof raw.farmCount === "number"
          ? raw.farmCount
          : undefined,
    topDiseases: Array.isArray(raw.dominantDiagnoses)
      ? (raw.dominantDiagnoses as Array<{ name: string; count: number }>)
      : Array.isArray(raw.topDiseases)
        ? (raw.topDiseases as Array<{ name: string; count: number }>)
        : []
  };
}

export async function fetchHealthMap(
  token: string,
  periodDays: number,
  granularity: HealthMapGranularity = "sector",
  options?: {
    mode?: "aggregated" | "detailed";
    viewAsInstitutionId?: string | null;
    /** Filtre une suspicion déclarée (diagnostic normalisé). Vide = toutes. */
    diagnosis?: string | null;
  }
): Promise<HealthMapDto> {
  const params = new URLSearchParams({
    periodDays: String(periodDays),
    granularity
  });
  if (options?.mode === "aggregated") {
    params.set("mode", "aggregated");
  }
  if (options?.diagnosis?.trim()) {
    params.set("diagnosis", options.diagnosis.trim());
  }
  appendViewAsInstitutionId(params, options?.viewAsInstitutionId);
  const raw = await apiFetch<Record<string, unknown>>(
    `/admin/health-map?${params}`,
    token
  );
  const zones = Array.isArray(raw.zones)
    ? raw.zones.map((zone) =>
        normalizeHealthMapZone(zone as Record<string, unknown>)
      )
    : [];
  return {
    mode: raw.mode === "aggregated" ? "aggregated" : undefined,
    periodDays: Number(raw.periodDays ?? periodDays),
    granularity: (raw.granularity as HealthMapGranularity) ?? granularity,
    truncated: raw.truncated === true,
    zones,
    regions: Array.isArray(raw.regions)
      ? (raw.regions as HealthMapDto["regions"])
      : undefined,
    points: Array.isArray(raw.points)
      ? (raw.points as NonNullable<HealthMapDto["points"]>)
      : undefined
  };
}

export function fetchRegionalStatSections(
  token: string,
  viewAsInstitutionId?: string | null
) {
  const params = new URLSearchParams();
  appendViewAsInstitutionId(params, viewAsInstitutionId);
  const qs = params.toString();
  return apiFetch<RegionalStatsSectionsDto>(
    `/admin/stats/regional/sections${qs ? `?${qs}` : ""}`,
    token
  );
}

function regionalStatsPath(
  section: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.regionCode) params.set("regionCode", query.regionCode);
  if (query.departmentCode) params.set("departmentCode", query.departmentCode);
  appendViewAsInstitutionId(params, viewAsInstitutionId);
  const qs = params.toString();
  return `/admin/stats/regional/${section}${qs ? `?${qs}` : ""}`;
}

export function fetchRegionalMortality(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("mortality", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalHerd(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("herd", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalReproduction(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("reproduction", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalGrowth(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("growth", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalVetCoverage(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("vet-coverage", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalEconomy(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("economy", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalHealth(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("health", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalLifecycle(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("lifecycle", query, viewAsInstitutionId),
    token
  );
}

export function fetchRegionalAdoption(
  token: string,
  query: RegionalStatsQuery,
  viewAsInstitutionId?: string | null
) {
  return apiFetch<RegionalStatsResponse>(
    regionalStatsPath("adoption", query, viewAsInstitutionId),
    token
  );
}

export type InstitutionStatsReportFormat = "pdf" | "csv";

export type GenerateInstitutionStatsReportBody = {
  sections: string[];
  from: string;
  to: string;
  regionCode?: string;
  format: InstitutionStatsReportFormat;
  viewAsInstitutionId?: string;
};

export type InstitutionStatsReportDownload =
  | { kind: "blob"; blob: Blob; filename: string; contentType: string }
  | { kind: "url"; downloadUrl: string; filename: string; contentType: string };

export async function generateInstitutionStatsReport(
  token: string,
  body: GenerateInstitutionStatsReportBody,
  viewAsInstitutionId?: string | null
): Promise<InstitutionStatsReportDownload> {
  const payload: GenerateInstitutionStatsReportBody = {
    ...body,
    viewAsInstitutionId:
      body.viewAsInstitutionId ?? viewAsInstitutionId?.trim() ?? undefined
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/admin/stats/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  } catch (e) {
    const hint =
      e instanceof TypeError && /fetch/i.test(e.message)
        ? `API injoignable (${API_BASE}). Lancez l’API : npm run dev:api depuis la racine du monorepo.`
        : e instanceof Error
          ? e.message
          : String(e);
    throw new ApiError(hint, 0);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText, res.status);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as {
      downloadUrl?: string | null;
      filename?: string;
      contentType?: string;
    };
    if (!json.downloadUrl) {
      throw new ApiError("URL de téléchargement manquante", 500);
    }
    return {
      kind: "url",
      downloadUrl: json.downloadUrl,
      filename: json.filename ?? `rapport-stats.${body.format === "pdf" ? "pdf" : "zip"}`,
      contentType:
        json.contentType ??
        (body.format === "pdf" ? "application/pdf" : "application/zip")
    };
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fallbackExt = body.format === "pdf" ? "pdf" : "zip";
  const filename = match?.[1] ?? `rapport-stats.${fallbackExt}`;
  const blob = await res.blob();
  return { kind: "blob", blob, filename, contentType };
}

export function triggerInstitutionStatsReportDownload(
  result: InstitutionStatsReportDownload
) {
  if (result.kind === "url") {
    window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function fetchVetProfiles(
  token: string,
  query?: { status?: string }
) {
  const q = query?.status
    ? `?status=${encodeURIComponent(query.status)}`
    : "";
  return apiFetch<VetProfileRow[]>(`/admin/vet-profiles${q}`, token);
}

export function fetchVetProfile(token: string, vetProfileId: string) {
  return apiFetch<VetProfileRow>(`/admin/vet-profiles/${vetProfileId}`, token);
}

export function verifyVetProfile(token: string, vetProfileId: string) {
  return apiFetch<unknown>(`/admin/vet-profiles/${vetProfileId}/verify`, token, {
    method: "POST"
  });
}

export function rejectVetProfile(
  token: string,
  vetProfileId: string,
  body: { reason: string }
) {
  return apiFetch<unknown>(`/admin/vet-profiles/${vetProfileId}/reject`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export type UsersListQuery = {
  search?: string;
  profileType?: string;
  accountStatus?: string;
  isActive?: boolean;
  skip?: number;
  take?: number;
};

export function fetchUsersList(token: string, query: UsersListQuery = {}) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.profileType) params.set("profileType", query.profileType);
  if (query.accountStatus) params.set("accountStatus", query.accountStatus);
  if (query.isActive === false) params.set("isActive", "false");
  if (query.skip != null) params.set("skip", String(query.skip));
  if (query.take != null) params.set("take", String(query.take));
  const qs = params.toString();
  return apiFetch<UsersListDto>(`/admin/users${qs ? `?${qs}` : ""}`, token);
}

export function fetchUserDetail(token: string, userId: string) {
  return apiFetch<UserDetailDto>(`/admin/users/${userId}`, token);
}

export type AdminAiStatusDto = {
  configured: boolean;
};

export function fetchAdminAiStatus(token: string) {
  return apiFetch<AdminAiStatusDto>("/admin/ai/status", token);
}

export function fetchAdminEpidemicAnalysis(
  token: string,
  locale: string
) {
  return apiFetch<AdminEpidemicAnalysis>("/admin/ai/epidemic-analysis", token, {
    method: "POST",
    body: JSON.stringify({ locale })
  });
}

export function adminAiAsk(
  token: string,
  question: string,
  locale: string
) {
  return apiFetch<AdminAiAskResult>("/admin/ai/ask", token, {
    method: "POST",
    body: JSON.stringify({ question, locale })
  });
}

export function adminVetAssist(
  token: string,
  vetProfileId: string,
  locale: string
) {
  return apiFetch<AdminVetAssistResult>(
    `/admin/ai/vet-assist/${vetProfileId}`,
    token,
    { method: "POST", body: JSON.stringify({ locale }) }
  );
}

export type AdminPlatformModuleDto = {
  moduleId: string;
  moduleName: string;
  icon: string | null;
  isActive: boolean;
  canDisable: boolean;
  userMessageFr: string | null;
  userMessageEn: string | null;
  scheduledReactivation: string | null;
  disabledAt: string | null;
  disableReason: string | null;
  reactivatedAt: string | null;
  waitlistCount: number;
};

export type FeatureFlagDisablePreviewDto = {
  moduleId: string;
  cascade: string[];
  previews: Array<{
    moduleId: string;
    tables: Array<{ tableName: string; count: number }>;
  }>;
};

export function fetchAdminFeatureFlags(token: string) {
  return apiFetch<AdminPlatformModuleDto[]>("/admin/feature-flags", token);
}

export function previewDisableFeatureFlag(token: string, moduleId: string) {
  return apiFetch<FeatureFlagDisablePreviewDto>(
    `/admin/feature-flags/${moduleId}/preview-disable`,
    token
  );
}

export function disableFeatureFlag(
  token: string,
  moduleId: string,
  body: { reason: string; userMessageFr?: string }
) {
  return apiFetch<AdminPlatformModuleDto[]>(
    `/admin/feature-flags/${moduleId}/disable`,
    token,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function reactivateFeatureFlag(
  token: string,
  moduleId: string,
  body?: { reason?: string }
) {
  return apiFetch<AdminPlatformModuleDto[]>(
    `/admin/feature-flags/${moduleId}/reactivate`,
    token,
    { method: "POST", body: JSON.stringify(body ?? {}) }
  );
}

export type ModerationScope =
  | "account"
  | "veterinarian"
  | "producer"
  | "technician"
  | "buyer";

export type AccountStatus = "active" | "suspended" | "banned";

export function suspendUser(
  token: string,
  userId: string,
  body: {
    scope: ModerationScope;
    reason: string;
    details?: string;
    duration: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/suspend`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function unsuspendUser(
  token: string,
  userId: string,
  body: { scope: ModerationScope; note?: string; notifyUser?: boolean }
) {
  return apiFetch(`/admin/users/${userId}/unsuspend`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function banUser(
  token: string,
  userId: string,
  body: {
    scope: ModerationScope;
    reason: string;
    details: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/ban`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function unbanUser(
  token: string,
  userId: string,
  body: { scope: ModerationScope; note?: string; notifyUser?: boolean }
) {
  return apiFetch(`/admin/users/${userId}/unban`, token, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function warnUser(
  token: string,
  userId: string,
  body: {
    motive: string;
    message: string;
    warningLevel: string;
    notifyUser?: boolean;
  }
) {
  return apiFetch(`/admin/users/${userId}/warn`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export type AdminMessagePayload = {
  subject: string;
  type: "notification" | "warning" | "info";
  message: string;
  sendPush?: boolean;
};

export function sendAdminMessage(
  token: string,
  body: AdminMessagePayload & { userId: string }
) {
  return apiFetch(`/admin/messages`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export type BulkAdminMessageResult = {
  ok: boolean;
  count: number;
  results: Array<{ userId: string; messageId: string }>;
};

export function sendBulkAdminMessage(
  token: string,
  body: AdminMessagePayload & { userIds: string[] }
) {
  return apiFetch<BulkAdminMessageResult>(`/admin/messages/bulk`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function deleteUserAccount(
  token: string,
  userId: string,
  body: { reason: string; notifyUser?: boolean }
) {
  return apiFetch(`/admin/users/${userId}/account`, token, {
    method: "DELETE",
    body: JSON.stringify(body)
  });
}

export type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  targetProfileType: string;
  targetProfileId: string | null;
  reason: string | null;
  admin: { id: string; fullName: string | null; email: string | null };
  target: { id: string; fullName: string | null; email: string | null };
};

export function fetchAuditLogs(
  token: string,
  params: { userId?: string; skip?: number; take?: number }
) {
  const q = new URLSearchParams();
  if (params.userId) q.set("userId", params.userId);
  if (params.skip != null) q.set("skip", String(params.skip));
  if (params.take != null) q.set("take", String(params.take));
  return apiFetch<{ total: number; items: AuditLogItem[] }>(
    `/admin/audit-logs?${q}`,
    token
  );
}

export type FeedModerationEventDto = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  postId: string | null;
  commentId: string | null;
  violationType: string;
  severity: string;
  actionTaken: string;
  contentSnapshot: string;
  aiConfidence: number | null;
  reviewedByAdmin: boolean;
  createdAt: string;
};

export type FeedSanctionedUserDto = {
  id: string;
  email: string | null;
  fullName: string | null;
  feedStatus: string;
  feedSuspensionUntil: string | null;
  feedViolationCount: number;
};

export type FeedAppealDto = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  feedStatus: string;
  sanctionLevel: number;
  appealMessage: string;
  status: string;
  adminResponse: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

export function fetchFeedModerationEvents(token: string, limit = 50) {
  return apiFetch<FeedModerationEventDto[]>(
    `/admin/feed/moderation-events?limit=${limit}`,
    token
  );
}

export function fetchFeedSanctionedUsers(token: string) {
  return apiFetch<FeedSanctionedUserDto[]>(`/admin/feed/sanctioned-users`, token);
}

export function fetchFeedAppeals(token: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<FeedAppealDto[]>(`/admin/feed/appeals${q}`, token);
}

export function adminUnsanctionFeedUser(token: string, userId: string) {
  return apiFetch(`/admin/feed/users/${userId}/unsanction`, token, {
    method: "PATCH"
  });
}

export function resolveFeedAppeal(
  token: string,
  appealId: string,
  body: { accepted: boolean; adminResponse: string }
) {
  return apiFetch(`/admin/feed/appeals/${appealId}/resolve`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export type FeedAdminCommentDto = {
  id: string;
  parentCommentId: string | null;
  authorUserId: string;
  authorEmail: string | null;
  authorName: string | null;
  authorProfileType: string;
  authorDisplayName: string | null;
  authorRegion: string | null;
  body: string;
  isAnonymous: boolean;
  isRemoved: boolean;
  removedReason: string | null;
  likeCount: number;
  createdAt: string;
  replies: FeedAdminCommentDto[];
};

export type FeedAdminPostDto = {
  id: string;
  authorUserId: string;
  authorEmail: string | null;
  authorName: string | null;
  authorProfileType: string;
  authorDisplayName: string | null;
  authorRegion: string | null;
  postType: string;
  body: string;
  isAnonymous: boolean;
  isRemoved: boolean;
  removedReason: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  comments: FeedAdminCommentDto[];
};

export function fetchFeedAdminPosts(
  token: string,
  page = 1,
  includeRemoved = false
) {
  const q = new URLSearchParams({
    page: String(page),
    limit: "20",
    includeRemoved: includeRemoved ? "true" : "false"
  });
  return apiFetch<{ page: number; limit: number; total: number; items: FeedAdminPostDto[] }>(
    `/admin/feed/posts?${q}`,
    token
  );
}

export function adminDeleteFeedPost(token: string, postId: string) {
  return apiFetch(`/admin/feed/posts/${postId}`, token, { method: "DELETE" });
}

export function adminDeleteFeedComment(token: string, commentId: string) {
  return apiFetch(`/admin/feed/comments/${commentId}`, token, { method: "DELETE" });
}

export type ChatAdminRoomDto = {
  id: string;
  kind: string;
  title: string | null;
  farmId: string | null;
  farmName: string | null;
  directKey: string | null;
  marketplaceListingId: string | null;
  marketplaceListingTitle: string | null;
  memberCount: number;
  messageCount: number;
  members: Array<{
    userId: string;
    email: string | null;
    fullName: string | null;
  }>;
  lastMessage: {
    id: string;
    body: string;
    createdAt: string;
    senderName: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export function fetchChatAdminRooms(token: string, page = 1) {
  const q = new URLSearchParams({ page: String(page), limit: "50" });
  return apiFetch<{ page: number; limit: number; total: number; items: ChatAdminRoomDto[] }>(
    `/admin/chat/rooms?${q}`,
    token
  );
}

export function adminDeleteChatRoom(token: string, roomId: string, reason?: string) {
  return apiFetch(`/admin/chat/rooms/${roomId}`, token, {
    method: "DELETE",
    body: JSON.stringify({ reason: reason ?? "admin_removal" })
  });
}

export type AdminProducerScoreDto = {
  userId: string;
  score: string;
  emoji: string;
  label: string;
  color: string;
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
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    reputationScore: number;
  };
};

export function fetchAdminProducerScores(token: string, score?: string) {
  const q = score ? `?score=${encodeURIComponent(score)}` : "";
  return apiFetch<AdminProducerScoreDto[]>(`/admin/producers/scores${q}`, token);
}

export function adminSetProducerCreditBlocked(
  token: string,
  userId: string,
  blocked: boolean,
  reason?: string
) {
  return apiFetch<AdminProducerScoreDto>(
    `/admin/producers/${userId}/credit-blocked`,
    token,
    {
      method: "PATCH",
      body: JSON.stringify({ blocked, reason: reason ?? null })
    }
  );
}

export function adminRecomputeProducerScore(token: string, userId: string) {
  return apiFetch<AdminProducerScoreDto>(
    `/admin/producers/${userId}/score/recompute`,
    token,
    { method: "POST", body: "{}" }
  );
}
