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

import {
  apiBaseUrl,
  apiDeleteJson,
  apiGetJson,
  apiPatchJson,
  apiPostJson,
  apiPutJson
} from "./api/http";
import type { VetVerificationStatus } from "./api/auth";

export type VetSearchItemDto = {
  id: string;
  fullName: string;
  primarySpecialty: string;
  locationLabel: string;
  profilePhotoUrl: string | null;
  availability: boolean;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  distanceKm: number | null;
};

export type VetSearchResponseDto = {
  items: VetSearchItemDto[];
};

export type VetPublicProfileDto = {
  id: string;
  /** userId de l'utilisateur vétérinaire (pour ouvrir un chat direct). */
  userId: string;
  fullName: string;
  primarySpecialty: string;
  otherSpecialties: string[];
  locationLabel: string;
  professionalPhone: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  profilePhotoUrl: string | null;
  bio: string | null;
  availability: boolean;
  interventionRadiusKm: number | null;
  verificationStatus: VetVerificationStatus;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  stats: {
    farmsFollowed: number;
    visitsCompleted: number;
    completedAppointments?: number;
  };
  servicePriceRange?: {
    min: number;
    max: number;
    currency: string;
  } | null;
  recentReviews: Array<{
    score: number;
    comment: string | null;
    authorName: string | null;
    createdAt: string;
    tags?: string[];
  }>;
  canContact: boolean;
  isSelf: boolean;
};

export type UpsertVetProfileBody = {
  fullName: string;
  orderNumber: string;
  primarySpecialty: string;
  otherSpecialties?: string[];
  locationCity: string;
  locationCountry: string;
  professionalPhone: string;
  schoolName: string;
  schoolCountry: string;
  graduationYear: number;
  diplomaPhotoUrl: string;
  profilePhotoUrl?: string;
  bio?: string;
  availability?: boolean;
  interventionRadiusKm?: number;
};

export function searchVets(
  accessToken: string,
  params: {
    q?: string;
    specialty?: string;
    rating?: string;
    available?: boolean;
    lat?: number;
    lng?: number;
  },
  activeProfileId?: string | null
): Promise<VetSearchResponseDto> {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.specialty) q.set("specialty", params.specialty);
  if (params.rating) q.set("rating", params.rating);
  if (params.available) q.set("available", "true");
  if (params.lat != null) q.set("lat", String(params.lat));
  if (params.lng != null) q.set("lng", String(params.lng));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<VetSearchResponseDto>(
    `/vets/search${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetPublicProfile(
  accessToken: string,
  vetId: string,
  activeProfileId?: string | null
): Promise<VetPublicProfileDto> {
  return apiGetJson<VetPublicProfileDto>(
    `/vets/${encodeURIComponent(vetId)}/profile`,
    accessToken,
    activeProfileId
  );
}

export function upsertVetProfile(
  accessToken: string,
  body: UpsertVetProfileBody,
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPostJson("/vet-profiles", body, accessToken, activeProfileId);
}

export type VetDashboardDto = {
  kpis: {
    farmsFollowed: number;
    visitsThisMonth: number;
    healthAlerts: number;
    pendingTasks: number;
  };
  upcomingVisits: Array<{
    id: string;
    farmId: string;
    farmName: string;
    producerName: string | null;
    producerPhone: string | null;
    scheduledAt: string;
    subject: string;
    location: string | null;
    status: string;
    kind?: "consultation" | "appointment";
    conflictStatus?: string | null;
    conflictLabel?: string | null;
    servicePrice?: number | null;
  }>;
  assignedFarms: Array<{
    id: string;
    name: string;
    address: string | null;
    producerName: string | null;
    producerPhone: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    kind: "consultation" | "vet_visit" | "vaccination" | "disease" | "treatment" | "alert";
    title: string;
    subtitle: string;
    occurredAt: string;
    farmId: string;
    farmName: string;
  }>;
  stats: {
    farmsFollowed: number;
    visitsCompleted: number;
    averageRating: number | null;
  };
};

export function fetchVetDashboard(
  accessToken: string,
  activeProfileId?: string | null
): Promise<VetDashboardDto> {
  return apiGetJson("/vet-profiles/me/dashboard", accessToken, activeProfileId);
}

export function fetchVetProfileMe(
  accessToken: string,
  activeProfileId?: string | null
): Promise<VetPublicProfileDto> {
  return apiGetJson("/vet-profiles/me", accessToken, activeProfileId);
}

export type VetVisitReason =
  | "routine"
  | "urgency"
  | "followup"
  | "vaccination"
  | "other";

export type ScheduleVetVisitPayload = {
  farmId: string;
  scheduledAt: string;
  reason: VetVisitReason;
  notes?: string;
  consultationPrice?: number;
};

export type ScheduleVetVisitResult = {
  id: string;
  farmId: string;
  farmName?: string | null;
  scheduledAt: string;
  requestedAt?: string;
  subject?: string;
  reason?: string;
  status: string;
  vetName?: string | null;
};

export function scheduleVetVisit(
  accessToken: string,
  activeProfileId: string | null | undefined,
  payload: ScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  const { farmId, ...body } = payload;
  return apiPostJson(
    `/farms/${encodeURIComponent(farmId)}/vet-appointments/schedule-from-vet`,
    body,
    accessToken,
    activeProfileId
  );
}

export type VetAvailabilitySlotDto = {
  time: string;
  status: "available" | "occupied" | "unavailable";
};

export type VetAvailabilityDto = {
  vetProfileId: string;
  date: string;
  vetAvailable: boolean;
  slots: VetAvailabilitySlotDto[];
};

export function fetchVetAvailability(
  accessToken: string,
  vetProfileId: string,
  dateIso: string,
  activeProfileId?: string | null
): Promise<VetAvailabilityDto> {
  const q = new URLSearchParams({ date: dateIso });
  return apiGetJson<VetAvailabilityDto>(
    `/vets/${encodeURIComponent(vetProfileId)}/availability?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type ProducerScheduleVetVisitPayload = {
  vetProfileId: string;
  scheduledAt: string;
  reason: VetVisitReason;
  notes?: string;
};

export function requestVetAppointment(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  payload: ProducerScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  return apiPostJson(
    `/farms/${encodeURIComponent(farmId)}/vet-appointments`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** @deprecated Préférer requestVetAppointment — alias conservé pour compatibilité. */
export function scheduleVetVisitFromProducer(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  payload: ProducerScheduleVetVisitPayload
): Promise<ScheduleVetVisitResult> {
  return requestVetAppointment(accessToken, farmId, activeProfileId, payload);
}

export type VetAppointmentDto = {
  id: string;
  farmId: string;
  farmName?: string | null;
  farmLocation?: string | null;
  producerUserId: string;
  producerName?: string | null;
  vetProfileId: string;
  vetUserId: string;
  vetName?: string | null;
  status: string;
  requestedAt: string;
  scheduledAt?: string;
  confirmedAt?: string | null;
  estimatedDurationHours: number;
  reason: string;
  notes?: string | null;
  refusalReason?: string | null;
  vetResponseNotes?: string | null;
  servicePrice?: number | null;
  blockedAmount?: number | null;
  paymentDeadline?: string | null;
  paymentConfirmedAt?: string | null;
  completedAt?: string | null;
  conflictStatus?: string | null;
  conflictLabel?: string | null;
  currency: string;
  rating?: { rating: number; comment?: string | null; tags?: string[] } | null;
  requiresRating?: boolean;
};

export type VetAppointmentFinanceSummaryDto = {
  role: "producer" | "vet";
  pendingEarnings: number;
  confirmedEarnings: number;
  blockedForAppointments: number;
  currency: string;
  pendingAppointments?: Array<{
    id: string;
    farmName: string;
    producerName: string | null;
    amount: number;
    status: string;
    confirmedAt: string | null;
  }>;
  blockedAppointments?: Array<{
    id: string;
    farmName: string;
    vetName: string;
    amount: number;
    status: string;
    confirmedAt: string | null;
  }>;
};

export function fetchVetAppointmentFinanceSummary(
  accessToken: string,
  role: "producer" | "vet",
  activeProfileId?: string | null
): Promise<VetAppointmentFinanceSummaryDto> {
  return apiGetJson(
    `/vet-appointments/summary?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetAppointments(
  accessToken: string,
  role: "producer" | "vet",
  activeProfileId?: string | null
): Promise<VetAppointmentDto[]> {
  return apiGetJson(
    `/vet-appointments/me?role=${role}`,
    accessToken,
    activeProfileId
  );
}

export function fetchVetAppointment(
  accessToken: string,
  appointmentId: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiGetJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}`,
    accessToken,
    activeProfileId
  );
}

export function vetAcceptAppointment(
  accessToken: string,
  appointmentId: string,
  payload: { servicePrice: number; confirmedAt?: string; notes?: string },
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/accept`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function vetRefuseAppointment(
  accessToken: string,
  appointmentId: string,
  refusalReason?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/refuse`,
    refusalReason ? { refusalReason } : {},
    accessToken,
    activeProfileId
  );
}

export function initiateVetAppointmentPayment(
  accessToken: string,
  appointmentId: string,
  activeProfileId: string | null | undefined,
  paymentMethod: "mobile_money" | "wallet"
): Promise<{
  providerRef: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  paymentUrl?: string | null;
}> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/payment/initiate`,
    { paymentMethod },
    accessToken,
    activeProfileId
  );
}

export function confirmVetAppointmentPayment(
  accessToken: string,
  appointmentId: string,
  providerRef?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/payment/confirm`,
    providerRef ? { providerRef } : {},
    accessToken,
    activeProfileId
  );
}

export function completeVetAppointmentService(
  accessToken: string,
  appointmentId: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto & { requiresRating?: boolean }> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/complete`,
    {},
    accessToken,
    activeProfileId
  );
}

export function submitVetAppointmentRating(
  accessToken: string,
  appointmentId: string,
  payload: { rating: number; comment?: string; tags?: string[] },
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/rating`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function cancelVetAppointment(
  accessToken: string,
  appointmentId: string,
  reason?: string,
  activeProfileId?: string | null
): Promise<VetAppointmentDto> {
  return apiPostJson(
    `/vet-appointments/${encodeURIComponent(appointmentId)}/cancel`,
    reason ? { reason } : {},
    accessToken,
    activeProfileId
  );
}

export type VetVisitQuoteDto = {
  id: string;
  scheduledAt: string;
  vetName: string;
  reason: unknown;
  visitQuoteStatus: string;
  consultationPrice: number | null;
  counterPrice: number | null;
  notes: string | null;
};

export function fetchVetVisitQuotes(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<VetVisitQuoteDto[]> {
  return apiGetJson(
    `/farms/${farmId}/vet-visit-quotes`,
    accessToken,
    activeProfileId
  );
}

export function respondVetVisitQuote(
  accessToken: string,
  farmId: string,
  consultationId: string,
  payload: { action: "accept" | "refuse" | "counter"; counterPrice?: number },
  activeProfileId?: string | null
): Promise<{ id: string; visitQuoteStatus: string }> {
  return apiPostJson(
    `/farms/${farmId}/vet-visit-quotes/${consultationId}/respond`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function createVetRating(
  accessToken: string,
  vetId: string,
  body: { score: number; comment?: string; ratedByFarmId?: string },
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson(
    `/vet-ratings/${encodeURIComponent(vetId)}`,
    body,
    accessToken,
    activeProfileId
  );
}

export type OnboardingStatusDto = {
  isOnboarded: boolean;
  onboardingSkipped: boolean;
};

export type CompleteOnboardingPayload = {
  farmName: string;
  speciesFocus?: string;
  locationSource: "gps" | "manual";
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  femaleBreeders: number;
  maleBreeders: number;
  starterHeadcount: number;
  fatteningHeadcount: number;
  buildingsCount: number;
  pensPerBuilding: number;
  maxPigsPerPen: number;
  productionEstimatedAgeWeeks?: number;
};

export type CompleteOnboardingResult = OnboardingStatusDto & {
  farm: { id: string; name: string };
};

export function fetchOnboardingStatus(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiGetJson<OnboardingStatusDto>(
    "/onboarding/status",
    accessToken,
    activeProfileId
  );
}

export function postOnboardingComplete(
  accessToken: string,
  payload: CompleteOnboardingPayload,
  activeProfileId?: string | null
): Promise<CompleteOnboardingResult> {
  return apiPostJson<CompleteOnboardingResult>(
    "/onboarding/complete",
    payload,
    accessToken,
    activeProfileId
  );
}

export function postOnboardingSkip(
  accessToken: string,
  activeProfileId?: string | null
): Promise<OnboardingStatusDto> {
  return apiPostJson<OnboardingStatusDto>(
    "/onboarding/skip",
    {},
    accessToken,
    activeProfileId
  );
}

/** Période rapport ferme (Prisma `ReportPeriodType`). */
export type FarmReportPeriodType = "monthly" | "quarterly" | "yearly";

export type FarmReportPreviewDto = {
  farmId: string;
  periodType: FarmReportPeriodType;
  period: { start: string; end: string };
  score: {
    global: number;
    band: string;
    breakdown: Record<string, { score: number; detail: string }>;
  };
  sections: Record<string, unknown>;
};

export function fetchFarmReportPreview(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params: {
    periodType: FarmReportPeriodType;
    year: number;
    month?: number;
    quarter?: number;
  }
): Promise<FarmReportPreviewDto> {
  const q = new URLSearchParams();
  q.set("periodType", params.periodType);
  q.set("year", String(params.year));
  if (params.month != null) {
    q.set("month", String(params.month));
  }
  if (params.quarter != null) {
    q.set("quarter", String(params.quarter));
  }
  return apiGetJson<FarmReportPreviewDto>(
    `/farms/${farmId}/reports/preview?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

export type FarmScoreDto = {
  farmId: string;
  scoreGlobal: number;
  scoreBreakdown: Record<string, { score: number; detail: string }>;
  band: string;
};

export function fetchFarmScore(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  params?: { year?: number; month?: number }
): Promise<FarmScoreDto> {
  const q = new URLSearchParams();
  if (params?.year != null) {
    q.set("year", String(params.year));
  }
  if (params?.month != null) {
    q.set("month", String(params.month));
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmScoreDto>(
    `/farms/${farmId}/score${suffix}`,
    accessToken,
    activeProfileId
  );
}

export type FarmReportListItemDto = {
  id: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  contentHash: string | null;
  pdfUrl?: string | null;
};

export function fetchFarmReportsList(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined
): Promise<FarmReportListItemDto[]> {
  return apiGetJson<FarmReportListItemDto[]>(
    `/farms/${farmId}/reports`,
    accessToken,
    activeProfileId
  );
}

export function generateFarmReport(
  accessToken: string,
  farmId: string,
  activeProfileId: string | null | undefined,
  body: {
    periodType: FarmReportPeriodType;
    anchor: { year: number; month?: number; quarter?: number };
  }
): Promise<{
  id: string;
  reportId?: string;
  scoreGlobal: number;
  contentHash: string;
  downloadUrl?: string | null;
}> {
  return apiPostJson(
    `/farms/${farmId}/reports/generate`,
    body,
    accessToken,
    activeProfileId
  );
}

export type FarmReportDetailDto = {
  id: string;
  farmId: string;
  periodType: FarmReportPeriodType;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  scoreGlobal: number;
  scoreBreakdown: unknown;
  dataSnapshot: unknown;
  contentHash: string | null;
};

export function fetchFarmReportById(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<FarmReportDetailDto> {
  return apiGetJson<FarmReportDetailDto>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}`,
    accessToken,
    activeProfileId
  );
}

export function farmReportPdfAbsoluteUrl(farmId: string, reportId: string): string {
  return `${apiBaseUrl()}/api/v1/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/pdf`;
}

export function fetchFarmReportDownloadUrl(
  accessToken: string,
  farmId: string,
  reportId: string,
  activeProfileId?: string | null
): Promise<{ downloadUrl: string }> {
  return apiGetJson<{ downloadUrl: string }>(
    `/farms/${encodeURIComponent(farmId)}/reports/${encodeURIComponent(reportId)}/download`,
    accessToken,
    activeProfileId
  );
}

export type AIInsightDto = {
  type: string;
  priority: "critical" | "warning" | "info";
  title: string;
  message: string;
  action_label?: string | null;
  action_route?: string | null;
};

export type AIRecommendationsResponseDto = {
  items: AIInsightDto[];
  generatedAt: string;
  insufficient?: boolean;
  unavailable?: boolean;
};

export function fetchAIRecommendations(
  accessToken: string,
  body: { farmId: string; module: string },
  activeProfileId?: string | null
): Promise<AIRecommendationsResponseDto> {
  return apiPostJson<AIRecommendationsResponseDto>(
    "/ai/recommendations",
    body,
    accessToken,
    activeProfileId
  );
}

/** Module Gestation — `/farms/:farmId/gestation/...` et `/gestations`. */
export type GestationOverviewDto = {
  kpis: {
    activeGestations: number;
    birthsDueIn7Days: number;
    birthsDueThisMonth: number;
    sowsAvailableForMating: number;
    avgDaysBetweenFarrowing: number | null;
    avgLitterSize: number | null;
    neonatalMortalityPct: number | null;
  };
  birthsPerMonth: Array<{ month: string; count: number }>;
  upcomingBirths: Array<{
    gestationId: string;
    sowId: string;
    sowLabel: string;
    photoUrl: string | null;
    expectedBirthDate: string;
    daysRemaining: number;
    urgency: "critical" | "soon" | "active";
  }>;
};

export type GestationListItemDto = {
  id: string;
  farmId: string;
  sowId: string;
  sowLabel: string;
  boarLabel: string | null;
  matingDate: string;
  expectedBirthDate: string;
  gestationNumber: number;
  status: string;
  matingType: string;
  progress: {
    daysRemaining: number;
    progressPct: number;
    weekCurrent: number;
    weekTotal: number;
    urgency: "critical" | "soon" | "active" | null;
  } | null;
  sow: {
    id: string;
    publicId: string;
    tagCode: string | null;
    photoUrl: string | null;
    breed?: { name: string } | null;
  };
  checklistCompletionPct: number;
  sowPen?: { id: string; name: string; code: string | null } | null;
};

export type GestationDetailDto = GestationListItemDto & {
  vaccines: Array<{
    id: string;
    vaccineName: string;
    scheduledDate: string;
    administeredDate: string | null;
    status: string;
  }>;
  checklistItems: Array<{
    id: string;
    itemLabel: string;
    isChecked: boolean;
  }>;
  litter?: unknown;
  notes?: string | null;
};

export function fetchGestationOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<GestationOverviewDto> {
  return apiGetJson(
    `/farms/${farmId}/gestation/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestations(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  params?: { status?: string; filter?: string; q?: string }
): Promise<{ items: GestationListItemDto[] }> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.filter) q.set("filter", params.filter);
  if (params?.q) q.set("q", params.q);
  const qs = q.toString();
  return apiGetJson(
    `/farms/${farmId}/gestation/gestations${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestationDetail(
  accessToken: string,
  farmId: string,
  gestationId: string,
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiGetJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}`,
    accessToken,
    activeProfileId
  );
}

export function createGestation(
  accessToken: string,
  farmId: string,
  body: {
    sowId: string;
    boarId?: string;
    matingType: "natural" | "artificial_insemination";
    matingDate: string;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPostJson(
    `/farms/${farmId}/gestation/gestations`,
    { ...body, farmId },
    accessToken,
    activeProfileId
  );
}

export function updateGestation(
  accessToken: string,
  farmId: string,
  gestationId: string,
  body: {
    boarId?: string | null;
    matingDate?: string;
    matingType?: "natural" | "artificial_insemination";
    notes?: string | null;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPutJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}`,
    body,
    accessToken,
    activeProfileId
  );
}

export function patchGestationStatus(
  accessToken: string,
  farmId: string,
  gestationId: string,
  status: "active" | "completed" | "aborted" | "lost",
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPatchJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}/status`,
    { status },
    accessToken,
    activeProfileId
  );
}

export function recordGestationLitter(
  accessToken: string,
  farmId: string,
  gestationId: string,
  body: {
    actualBirthDate: string;
    bornAlive: number;
    stillborn: number;
    mummified?: number;
    averageBirthWeightKg?: number;
    deliveryType: "normal" | "difficult" | "cesarean";
    vetAssistance?: boolean;
    notes?: string;
    penId?: string;
  },
  activeProfileId?: string | null
): Promise<GestationDetailDto> {
  return apiPostJson(
    `/farms/${farmId}/gestation/gestations/${gestationId}/litter`,
    body,
    accessToken,
    activeProfileId
  );
}

export function administerGestationVaccine(
  accessToken: string,
  farmId: string,
  vaccineId: string,
  activeProfileId?: string | null
): Promise<{ vaccineId: string; healthRecordId: string }> {
  return apiPatchJson(
    `/farms/${farmId}/gestation/vaccines/${vaccineId}/administer`,
    {},
    accessToken,
    activeProfileId
  );
}

export function toggleGestationChecklistItem(
  accessToken: string,
  farmId: string,
  itemId: string,
  isChecked: boolean,
  activeProfileId?: string | null
) {
  return apiPatchJson(
    `/farms/${farmId}/gestation/checklist/${itemId}`,
    { isChecked },
    accessToken,
    activeProfileId
  );
}

export function fetchGestationAvailableSows(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
) {
  return apiGetJson<{ items: Array<{
    sowId: string;
    label: string;
    photoUrl: string | null;
    lastFarrowingDate: string | null;
    gestationCount: number;
    daysSinceWeaning: number | null;
    availability: "now" | "soon";
    availableInDays: number;
  }> }>(
    `/farms/${farmId}/gestation/available-sows`,
    accessToken,
    activeProfileId
  );
}

export type GestationAiMatingRecommendation = {
  sowId: string;
  sowLabel: string;
  boarId: string | null;
  boarLabel: string | null;
  suggestedDate: string;
  expectedBirthDate: string | null;
  reason: string;
};

export function fetchGestationAiMatingPlan(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{
  recommendations: GestationAiMatingRecommendation[];
  aiPowered?: boolean;
}> {
  return apiGetJson(
    `/farms/${farmId}/gestation/ai-mating-plan`,
    accessToken,
    activeProfileId
  );
}

export function fetchGestationHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filter?: string
) {
  const q = filter ? `?filter=${encodeURIComponent(filter)}` : "";
  return apiGetJson<{
    events: Array<{
      id: string;
      type: string;
      sowLabel: string;
      sowId: string;
      date: string;
      result?: string;
      notes?: string | null;
    }>;
    stats: Record<string, unknown>;
  }>(
    `/farms/${farmId}/gestation/history${q}`,
    accessToken,
    activeProfileId
  );
}

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
