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
  supportPhone: string | null;
  supportTelegramUrl: string | null;
  /** Valeurs réellement servies au mobile (DB + fallback env). */
  supportEffective: SupportContactDto;
};

export type HealthMapDto = {
  periodDays: number;
  regions: Array<{
    country: string;
    activeCases: number;
    totalCases: number;
    farmCount: number;
    topDiseases: Array<{ name: string; count: number }>;
  }>;
  points: Array<{
    farmId: string;
    lat: number;
    lng: number;
    diagnosis: string;
    severity: string | null;
  }>;
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

export function fetchAdminStats(
  token: string,
  period: StatsDto["period"] = "month"
) {
  return apiFetch<StatsDto>(`/admin/stats?period=${period}`, token);
}

export function fetchHealthMap(token: string, periodDays: number) {
  return apiFetch<HealthMapDto>(
    `/admin/health-map?periodDays=${periodDays}`,
    token
  );
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

export function sendAdminMessage(
  token: string,
  body: {
    userId: string;
    subject: string;
    type: "notification" | "warning" | "info";
    message: string;
    sendPush?: boolean;
  }
) {
  return apiFetch(`/admin/messages`, token, {
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
