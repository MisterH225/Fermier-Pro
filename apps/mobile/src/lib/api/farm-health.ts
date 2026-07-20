import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";

/** Santé ferme — aligné sur `FarmHealthController` (`/farms/:farmId/health/...`). */
export type FarmHealthRecordKind =
  | "vaccination"
  | "disease"
  | "vet_visit"
  | "treatment"
  | "mortality";

export type FarmHealthEntityType = "animal" | "group";

export type FarmHealthGlobalStatus = "good" | "warning" | "critical";

export type FarmHealthMonthPoint = { month: string; value: number };

export type FarmHealthOverviewDto = {
  farmId: string;
  activeDiseaseCount: number;
  overdueVaccineCount: number;
  activeTreatmentCount: number;
  globalHealthStatus: FarmHealthGlobalStatus;
  nextVaccine: {
    at: string | null;
    vaccineName: string;
    healthRecordId: string;
  } | null;
  nextVetVisitModule: {
    at: string;
    reason: string | null;
    healthRecordId: string | null;
    appointmentId: string | null;
    source: "health_record" | "vet_appointment";
    appointmentStatus: string | null;
    vetName: string | null;
  } | null;
  nextVetConsultationLegacy: {
    id: string;
    subject: string;
    openedAt: string;
  } | null;
  mortalityRate30d: string;
  charts: {
    mortalityHeadcount: FarmHealthMonthPoint[];
    diseaseNew: FarmHealthMonthPoint[];
    diseaseResolved: FarmHealthMonthPoint[];
    vaccinationsDone: FarmHealthMonthPoint[];
    vaccinationsPlanned: FarmHealthMonthPoint[];
    mortalityCauses: Array<{ cause: string; value: number }>;
  };
};

export type FarmHealthUpcomingDto = {
  farmId: string;
  vaccines: Array<{
    vaccineName: string;
    nextReminderAt: string | null;
    healthRecord: { id: string; entityType: FarmHealthEntityType; entityId: string };
  }>;
  vetVisits: Array<{
    id: string;
    occurredAt: string;
    status: string;
    vetVisit: { vetName: string; reason: string } | null;
  }>;
  vetAppointments: Array<{
    id: string;
    status: string;
    requestedAt: string;
    confirmedAt: string | null;
    reason: string;
    vetName: string | null;
  }>;
};

export type FarmHealthMortalityRateDto = {
  farmId: string;
  periodDays: number;
  headcountLost: number;
  rate: string;
};

export type FarmHealthRecorderPreview = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type FarmHealthRecordRowDto = {
  id: string;
  farmId: string;
  kind: FarmHealthRecordKind;
  entityType: FarmHealthEntityType;
  entityId: string;
  occurredAt: string;
  status: string;
  notes: string | null;
  attachmentUrl: string | null;
  vaccination?: {
    vaccineName: string;
    vaccineType: string | null;
    nextReminderAt: string | null;
  } | null;
  disease?: {
    diagnosis: string | null;
    caseStatus: string;
    severity?: "mild" | "moderate" | "severe" | null;
    durationEstimate?: string | null;
    inIsolation?: boolean;
    treatmentOngoing?: boolean;
    resolvedAt?: string | null;
    symptoms?: { tags?: string[] } | null;
    linkedTreatmentRecordId?: string | null;
  } | null;
  vetVisit?: {
    vetName: string;
    reason: string;
    cost: string | number | null;
    prescriptionUrl?: string | null;
  } | null;
  treatment?: {
    drugName: string;
    startDate: string;
    endDate: string | null;
    cost: string | number | null;
  } | null;
  mortality?: {
    cause: string;
    livestockExitId: string | null;
  } | null;
  recorder?: FarmHealthRecorderPreview | null;
};

export type CreateFarmHealthRecordBody = {
  kind: FarmHealthRecordKind;
  entityType: FarmHealthEntityType;
  entityId: string;
  occurredAt?: string;
  status?: string;
  notes?: string;
  attachmentUrl?: string;
  detail: Record<string, unknown>;
};

export function fetchFarmHealthOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmHealthOverviewDto> {
  return apiGetJson<FarmHealthOverviewDto>(
    `/farms/${farmId}/health/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthUpcoming(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmHealthUpcomingDto> {
  return apiGetJson<FarmHealthUpcomingDto>(
    `/farms/${farmId}/health/upcoming`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthMortalityRate(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  period?: "30" | "90"
): Promise<FarmHealthMortalityRateDto> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : "";
  return apiGetJson<FarmHealthMortalityRateDto>(
    `/farms/${farmId}/health/mortality-rate${qs}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmHealthEvents(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { kind?: FarmHealthRecordKind; status?: string; from?: string; to?: string }
): Promise<FarmHealthRecordRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.kind) {
    q.set("kind", filters.kind);
  }
  if (filters?.status) {
    q.set("status", filters.status);
  }
  if (filters?.from) {
    q.set("from", filters.from);
  }
  if (filters?.to) {
    q.set("to", filters.to);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmHealthRecordRowDto[]>(
    `/farms/${farmId}/health/events${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmHealthRecord(
  accessToken: string,
  farmId: string,
  body: CreateFarmHealthRecordBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events`,
    body,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmHealthRecord(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiDeleteJson<{ ok: true }>(
    `/farms/${farmId}/health/events/${encodeURIComponent(recordId)}`,
    accessToken,
    activeProfileId
  );
}

export function dismissFarmHealthVetVisit(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  return apiPostJson<{ ok: true }>(
    `/farms/${farmId}/health/events/${encodeURIComponent(recordId)}/dismiss-vet-visit`,
    {},
    accessToken,
    activeProfileId
  );
}

/** DELETE avec repli POST si l'API n'expose pas encore DELETE (404). */
export async function removeFarmHealthVetVisit(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<{ ok: true }> {
  try {
    return await deleteFarmHealthRecord(
      accessToken,
      farmId,
      recordId,
      activeProfileId
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/\b404\b|not found|introuvable|cannot delete/i.test(msg)) {
      throw err;
    }
    return dismissFarmHealthVetVisit(
      accessToken,
      farmId,
      recordId,
      activeProfileId
    );
  }
}

export type CreateDiseaseCaseBody = {
  entityType: FarmHealthEntityType;
  entityId: string;
  symptoms: string[];
  durationEstimate: string;
  estimatedOnsetDate: string;
  occurredAt?: string;
  diagnosis?: string;
  severity: "mild" | "moderate" | "severe";
  treatmentOngoing?: boolean;
  treatmentNotes?: string;
  inIsolation?: boolean;
  isolationPenId?: string;
  notes?: string;
};

export type FarmDiseasesOverviewDto = {
  farmId: string;
  kpis: {
    activeCases: number;
    resolvedThisMonth: number;
    diseaseRatePct: number;
    isolationCount: number;
  };
  pieChart: Array<{ label: string; count: number }>;
};

export type FarmDiseaseHistoryRowDto = FarmHealthRecordRowDto & {
  durationDays: number;
  treatmentLabel: string | null;
};

export function fetchFarmDiseaseHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { period?: string }
): Promise<FarmDiseaseHistoryRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.period) {
    q.set("period", filters.period);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmDiseaseHistoryRowDto[]>(
    `/farms/${farmId}/health/diseases/history${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmDiseasesOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmDiseasesOverviewDto> {
  return apiGetJson<FarmDiseasesOverviewDto>(
    `/farms/${farmId}/health/diseases/overview`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmActiveDiseaseCases(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  filters?: { severity?: string; isolation?: boolean }
): Promise<FarmHealthRecordRowDto[]> {
  const q = new URLSearchParams();
  if (filters?.severity) {
    q.set("severity", filters.severity);
  }
  if (filters?.isolation) {
    q.set("isolation", "true");
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<FarmHealthRecordRowDto[]>(
    `/farms/${farmId}/health/diseases/active${suffix}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  body: CreateDiseaseCaseBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/diseases`,
    body,
    accessToken,
    activeProfileId
  );
}

export function resolveFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPatchJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/resolve`,
    {},
    accessToken,
    activeProfileId
  );
}

export type UpdateDiseaseCaseBody = {
  symptoms?: string[];
  diagnosis?: string;
  severity?: "mild" | "moderate" | "severe";
  durationEstimate?: string;
  treatmentOngoing?: boolean;
  inIsolation?: boolean;
  notes?: string;
};

export function updateFarmDiseaseCase(
  accessToken: string,
  farmId: string,
  recordId: string,
  body: UpdateDiseaseCaseBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPatchJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/disease`,
    body,
    accessToken,
    activeProfileId
  );
}

export type AddDiseaseTreatmentBody = {
  drugName: string;
  dosage?: string;
  notes?: string;
};

export function addDiseaseTreatment(
  accessToken: string,
  farmId: string,
  recordId: string,
  body: AddDiseaseTreatmentBody,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/treatment`,
    body,
    accessToken,
    activeProfileId
  );
}

export function declareDiseaseDeath(
  accessToken: string,
  farmId: string,
  recordId: string,
  activeProfileId?: string | null
): Promise<FarmHealthRecordRowDto> {
  return apiPostJson<FarmHealthRecordRowDto>(
    `/farms/${farmId}/health/events/${recordId}/death`,
    {},
    accessToken,
    activeProfileId
  );
}

export function linkFarmHealthRecordExpense(
  accessToken: string,
  farmId: string,
  recordId: string,
  expenseId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiPostJson<{ ok: boolean }>(
    `/farms/${farmId}/health/events/${recordId}/link-transaction`,
    { expenseId },
    accessToken,
    activeProfileId
  );
}

export type VaccineCatalogType = "viral" | "bacterial" | "antiparasitic" | "other";

export type VaccineCatalogItemDto = {
  id: string;
  code: string | null;
  name: string;
  vaccineType: VaccineCatalogType;
  targetLabel: string;
  frequency: string;
  recommendedTiming: string;
  icon: string;
  isStandard: boolean;
};

export type VaccineCoverageItemDto = {
  vaccine: VaccineCatalogItemDto;
  stats: {
    totalSubjects: number;
    upToDate: number;
    overdue: number;
    upcoming: number;
    coverageRate: number;
  };
};

export type FarmVaccineCoverageDto = {
  farmId: string;
  items: VaccineCoverageItemDto[];
};

export type VaccineSubjectStatus = "unvaccinated" | "vaccinated" | "upcoming";

export type VaccineSubjectRowDto = {
  entityType: FarmHealthEntityType;
  entityId: string;
  label: string;
  categoryLabel: string;
  penLabel: string | null;
  headcount: number;
  status: VaccineSubjectStatus;
  lastVaccinationAt: string | null;
  nextDueAt: string | null;
};

export type FarmVaccineSubjectsDto = {
  farmId: string;
  vaccineId: string;
  status: VaccineSubjectStatus;
  subjects: VaccineSubjectRowDto[];
};

export type CreateVaccineRecordsBody = {
  vaccineId: string;
  subjects: Array<{ entityType: FarmHealthEntityType; entityId: string }>;
  administeredDate?: string;
  nextDueDate?: string;
  practitioner?: string;
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
};

export type CreateCustomVaccineBody = {
  name: string;
  vaccineType: VaccineCatalogType;
  targetCategories: string[];
  targetLabel: string;
  frequency: string;
  recommendedTiming: string;
  icon?: string;
  notes?: string;
};

export function fetchFarmVaccineCoverage(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<FarmVaccineCoverageDto> {
  return apiGetJson<FarmVaccineCoverageDto>(
    `/farms/${farmId}/vaccines/coverage`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmVaccineSubjects(
  accessToken: string,
  farmId: string,
  vaccineId: string,
  status: VaccineSubjectStatus,
  activeProfileId?: string | null
): Promise<FarmVaccineSubjectsDto> {
  return apiGetJson<FarmVaccineSubjectsDto>(
    `/farms/${farmId}/vaccines/${encodeURIComponent(vaccineId)}/subjects?status=${encodeURIComponent(status)}`,
    accessToken,
    activeProfileId
  );
}

export function createFarmVaccineRecords(
  accessToken: string,
  farmId: string,
  body: CreateVaccineRecordsBody,
  activeProfileId?: string | null
): Promise<{ farmId: string; vaccineId: string; createdCount: number; recordIds: string[] }> {
  return apiPostJson(
    `/farms/${farmId}/vaccines/records`,
    body,
    accessToken,
    activeProfileId
  );
}

export function createFarmCustomVaccine(
  accessToken: string,
  farmId: string,
  body: CreateCustomVaccineBody,
  activeProfileId?: string | null
): Promise<VaccineCatalogItemDto> {
  return apiPostJson<VaccineCatalogItemDto>(
    `/farms/${farmId}/vaccines/custom`,
    body,
    accessToken,
    activeProfileId
  );
}
