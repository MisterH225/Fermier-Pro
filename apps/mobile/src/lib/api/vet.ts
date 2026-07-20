import { apiGetJson, apiPatchJson, apiPostJson } from "./http";
import type { VetVerificationStatus } from "./auth";

export type VetSearchItemDto = {
  id: string;
  fullName: string;
  primarySpecialty: string;
  otherSpecialties?: string[];
  bio?: string | null;
  interventionRadiusKm?: number | null;
  completedAppointments?: number;
  locationCity?: string;
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
  orderNumber?: string;
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
  /** ISO date si vérifié, sinon null. */
  verifiedAt?: string | null;
  locationCity?: string;
  locationCountry?: string;
  ratingAvg: number | null;
  ratingCount: number;
  cancelledAppointmentsAsVet?: number;
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

export type PatchVetPublicProfileBody = {
  bio?: string;
  primarySpecialty?: string;
  otherSpecialties?: string[];
  locationCity?: string;
  availability?: boolean;
  interventionRadiusKm?: number;
  profilePhotoUrl?: string;
};

/** PATCH /api/v1/vet-profiles/me — profil public sans reset de vérification. */
export function patchVetPublicProfile(
  accessToken: string,
  body: PatchVetPublicProfileBody,
  activeProfileId?: string | null
): Promise<VetPublicProfileDto> {
  return apiPatchJson<VetPublicProfileDto>(
    "/vet-profiles/me",
    body,
    accessToken,
    activeProfileId
  );
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

/** GET /farms/:farmId/vet-summary — agrégat dossier élevage. */
export type VetFarmSummaryDto = {
  farmId: string;
  health: {
    activeDiseaseCount: number;
    overdueVaccineCount: number;
    activeTreatmentCount: number;
    globalHealthStatus: string;
    mortalityRate30d: string;
  };
  vaccineCoveragePercent: number | null;
  livestock: {
    activeHeadcount: number;
    activeBatchesCount: number;
    avgGmqGPerDay: number | null;
  };
  lastVisit: {
    id: string;
    at: string;
    label: string;
    source: "appointment" | "consultation" | "health_record";
  } | null;
};

export function fetchVetFarmSummary(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<VetFarmSummaryDto> {
  return apiGetJson<VetFarmSummaryDto>(
    `/farms/${encodeURIComponent(farmId)}/vet-summary`,
    accessToken,
    activeProfileId
  );
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
