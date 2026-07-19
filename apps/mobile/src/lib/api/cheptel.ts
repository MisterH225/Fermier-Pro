import { apiGetJson, apiPostJson, apiPatchJson, apiDeleteJson } from "./http";
import type { PenMutationDto } from "./housing";

export type CheptelCategoryBreakdownRow = {
  key: string;
  count: number;
};

export type CheptelHeadcountTrendPoint = {
  month: string;
  total: number;
};

export type CheptelOverviewDto = {
  farm: {
    id: string;
    name: string;
    livestockMode: string;
    housingBuildingsCount: number | null;
    housingPensPerBuilding: number | null;
    housingMaxPigsPerPen: number | null;
  };
  kpis: {
    totalAnimals: number;
    totalHeadcount: number;
    maleAnimals: number;
    femaleAnimals: number;
    unknownSexAnimals: number;
    gestatingFemales: number;
    totalBatchHeadcount: number;
    activeBatchesCount: number;
    closedBatchesCount: number;
    penCapacityTotal: number;
    penOccupancyHeadcount: number;
    occupancyRate: number | null;
    barnCount: number;
    availablePensCount: number;
    unassignedAnimalsCount: number;
    sickAnimalsCount?: number;
    fatteningCount?: number;
    starterCount?: number;
    nursingCount: number;
    breedingFemalesCount?: number;
    breedingFemalesGestating?: number;
  };
  categoryBreakdown: CheptelCategoryBreakdownRow[];
  headcountTrend: CheptelHeadcountTrendPoint[];
  miniWidgets?: {
    categoryDonut: Array<{ label: string; count: number }>;
    breedingDonut: Array<{ label: string; count: number }>;
    fatteningTrend: number[];
    starterTrend: number[];
    occupancyDonut: Array<{ label: string; count: number }>;
  };
};

export function fetchFarmCheptelOverview(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<CheptelOverviewDto> {
  return apiGetJson<CheptelOverviewDto>(
    `/farms/${farmId}/cheptel`,
    accessToken,
    activeProfileId
  );
}

export type PenCategoryKey =
  | "starter"
  | "fattening"
  | "maternity"
  | "quarantine"
  | "mixed"
  | "empty";

export type PenUsageTag =
  | "empty"
  | "sows"
  | "boar"
  | "boars"
  | "nursing"
  | "starter"
  | "fattening"
  | "mixed";

export type PenAgeDataDto = {
  averageAgeWeeksCalculated: number | null;
  averageAgeWeeksManual: number | null;
  animalsWithAgeCount: number;
  animalsWithoutAgeCount: number;
  displayAgeWeeks: number | null;
  isManual: boolean;
};

export type CheptelPenRowDto = {
  id: string;
  name: string;
  code: string | null;
  barnId: string;
  barnName: string;
  sortOrder: number;
  capacity: number;
  occupancy: number;
  occupancyRate: number | null;
  borderStatus: "healthy" | "warning" | "critical" | "empty";
  batchTypeTag: "sous_mere" | "starter" | "fattening" | null;
  sanitaryTag: "healthy" | "alert" | "critical" | "overcrowded" | "empty";
  category: PenCategoryKey;
  categoryForced: boolean;
  usageTag: PenUsageTag;
  maleCount: number;
  femaleCount: number;
  isActive: boolean;
  averageWeightKg: number | null;
  /** Présent si l’API cheptel est à jour ; absent sur cache / ancienne réponse. */
  ageData?: PenAgeDataDto;
  vaccineOverdueCount: number;
  gestationImminent: boolean;
  activeDiseaseCount: number;
};

export type CheptelPensResponseDto = {
  barns: Array<{ id: string; name: string; code?: string | null; sortOrder?: number }>;
  pens: CheptelPenRowDto[];
  totalPens?: number;
};

export type PenAnimalRowDto = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: "male" | "female" | "unknown";
  productionCategory?:
    | "breeding_female"
    | "breeding_male"
    | "fattening"
    | "starter"
    | "unknown";
  status: string;
  healthStatus?: "healthy" | "sick" | "recovering";
  photoUrl: string | null;
  birthDate?: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  currentAgeWeeks?: number | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{ weightKg: number; measuredAt: string }>;
  currentWeightKg: number | null;
  vaccineOverdue: boolean;
  activeGestation: {
    id: string;
    expectedFarrowingAt: string | null;
  } | null;
};

export type PenBatchRowDto = {
  id: string;
  publicId: string;
  name: string;
  headcount: number;
  activeMemberCount?: number;
  categoryKey: string | null;
  status: string;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  avgWeightKg: number | null;
};

export type PenContentsDto = {
  ageData: PenAgeDataDto;
  animals: PenAnimalRowDto[];
  batches: PenBatchRowDto[];
};

export function fetchCheptelPens(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  barnId?: string
): Promise<CheptelPensResponseDto> {
  const q = barnId ? `?barnId=${encodeURIComponent(barnId)}` : "";
  return apiGetJson<CheptelPensResponseDto>(
    `/farms/${farmId}/cheptel/pens${q}`,
    accessToken,
    activeProfileId
  );
}

export function fetchPenContents(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<PenContentsDto> {
  return apiGetJson<PenContentsDto>(
    `/farms/${farmId}/cheptel/pens/${penId}/animals`,
    accessToken,
    activeProfileId
  );
}

export function patchPenToggleActive(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<{ id: string; status: string }> {
  return apiPatchJson(
    `/farms/${farmId}/cheptel/pens/${penId}/toggle-active`,
    {},
    accessToken,
    activeProfileId
  );
}

export function patchPenAverages(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: {
    averageWeightKg?: number | null;
    averageAgeWeeksManual?: number | null;
  },
  activeProfileId?: string | null
): Promise<unknown> {
  return apiPatchJson(
    `/farms/${farmId}/cheptel/pens/${penId}/averages`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function deleteCheptelPen(
  accessToken: string,
  farmId: string,
  penId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson(
    `/farms/${farmId}/cheptel/pens/${penId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchPenPayload = {
  name?: string;
  capacity?: number | null;
  status?: string;
  category?: PenCategoryKey;
  categoryForced?: boolean;
  averageWeightKg?: number | null;
  averageAgeWeeksManual?: number | null;
  zoneLabel?: string | null;
};

export function patchPen(
  accessToken: string,
  farmId: string,
  penId: string,
  payload: PatchPenPayload,
  activeProfileId?: string | null
): Promise<PenMutationDto> {
  return apiPatchJson<PenMutationDto>(
    `/farms/${farmId}/pens/${penId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type CheptelHistoryItemDto = {
  id: string;
  type: "status" | "weight" | "transfer" | "creation" | "pen_created" | "sold";
  occurredAt: string;
  title: string;
  subtitle: string | null;
  entityType: string | null;
  entityId: string | null;
  meta?: unknown;
};

export function fetchCheptelHistory(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  query?: { type?: string; limit?: number }
): Promise<CheptelHistoryItemDto[]> {
  const q = new URLSearchParams();
  if (query?.type) {
    q.set("type", query.type);
  }
  if (query?.limit != null) {
    q.set("limit", String(query.limit));
  }
  const qs = q.toString();
  return apiGetJson<CheptelHistoryItemDto[]>(
    `/farms/${farmId}/cheptel/history${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export type GmqAnimalSummaryDto = {
  animalId: string;
  label: string;
  entryWeight: number | null;
  currentWeight: number | null;
  totalGainKg: number | null;
  latestGmq: number | null;
  avgGmq: number | null;
  targetGmqGPerDay: number | null;
  targetSaleWeightKg: number | null;
  status: "ok" | "warn" | "critical";
};

export type CheptelGmqSummaryDto = {
  animals: GmqAnimalSummaryDto[];
  settings: Array<{
    id: string;
    categoryKey: string;
    targetGmqGPerDay: string | number | null;
    targetSaleWeightKg: string | number | null;
    alertThresholdGmq: string | number | null;
  }>;
};

export function fetchCheptelGmqSummary(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<CheptelGmqSummaryDto> {
  return apiGetJson<CheptelGmqSummaryDto>(
    `/farms/${farmId}/cheptel/gmq/summary`,
    accessToken,
    activeProfileId
  );
}

export type DetectedBatchAnimalDto = {
  id: string;
  label: string;
  ageWeeks: number | null;
  weightKg: number | null;
  birthDate: string | null;
  generationKey: string;
  generationLabel: string;
  penName: string | null;
};

export type DetectedBatchDto = {
  id: string;
  name: string;
  category: string;
  generationKey?: string;
  generationLabel?: string;
  headcount: number;
  avgAgeWeeks: number | null;
  avgWeightKg: number | null;
  penNames: string[];
  animalIds: string[];
  animals?: DetectedBatchAnimalDto[];
};

export function fetchDetectedBatches(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<{ farmId: string; batches: DetectedBatchDto[] }> {
  return apiGetJson(
    `/farms/${farmId}/cheptel/detected-batches`,
    accessToken,
    activeProfileId
  );
}

export function confirmDetectedBatch(
  accessToken: string,
  farmId: string,
  payload: {
    name: string;
    category: "starter" | "fattening";
    animalIds: string[];
    avgBirthDate?: string;
    notes?: string;
  },
  activeProfileId?: string | null
): Promise<{ batch: { id: string; name: string }; animalIds: string[] }> {
  return apiPostJson(
    `/farms/${farmId}/cheptel/detected-batches/confirm`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type WeightSeriesPointDto = {
  id: string;
  animalId: string;
  animalLabel: string;
  weightKg: number;
  measuredAt: string;
  note: string | null;
};

export function fetchCheptelWeightSeries(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null,
  query?: { animalId?: string; months?: number }
): Promise<WeightSeriesPointDto[]> {
  const q = new URLSearchParams();
  if (query?.animalId) {
    q.set("animalId", query.animalId);
  }
  if (query?.months != null) {
    q.set("months", String(query.months));
  }
  const qs = q.toString();
  return apiGetJson<WeightSeriesPointDto[]>(
    `/farms/${farmId}/cheptel/weight-series${qs ? `?${qs}` : ""}`,
    accessToken,
    activeProfileId
  );
}

export type PatchCheptelAnimalStatusPayload = PatchAnimalStatusPayload & {
  deathCause?: string;
};

export function patchCheptelAnimalStatus(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: PatchCheptelAnimalStatusPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPatchJson<AnimalDetail>(
    `/farms/${farmId}/cheptel/animals/${animalId}/status`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type SellCheptelAnimalPayload = {
  soldWeightKg: number;
  pricePerKg?: number;
  totalPrice: number;
  buyerName?: string;
  soldAt: string;
  notes?: string;
};

export type AnimalSaleTransactionDto = {
  id: string;
  amount: string | number;
  currency: string;
  label: string;
  occurredAt: string;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  isAutoGenerated?: boolean;
};

export type AnimalSaleResultDto = {
  animal: AnimalDetail;
  transaction: AnimalSaleTransactionDto;
  /** Identifiant LivestockExit pour insight post-vente. */
  exitId?: string;
};

export function sellCheptelAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: SellCheptelAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalSaleResultDto> {
  return apiPatchJson<AnimalSaleResultDto>(
    `/farms/${farmId}/cheptel/animals/${animalId}/sell`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** Réponses GET .../animals et .../batches (Prisma + includes). */
export type AnimalPenSummary = {
  placementId: string;
  penId: string;
  penName: string;
  barnId: string;
  barnName: string;
};

export type AnimalListItem = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  status: string;
  healthStatus?: "healthy" | "sick" | "recovering";
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{ weightKg: string | number; measuredAt: string }>;
  currentPen: AnimalPenSummary | null;
  photoUrl?: string | null;
};

export type TaxonomyBreedDto = { id: string; name: string };
export type TaxonomySpeciesDto = {
  id: string;
  code: string;
  name: string;
  breeds: TaxonomyBreedDto[];
};

export function fetchTaxonomy(
  accessToken: string,
  activeProfileId?: string | null
): Promise<TaxonomySpeciesDto[]> {
  return apiGetJson<TaxonomySpeciesDto[]>("/taxonomy", accessToken, activeProfileId);
}

export type CreateAnimalPayload = {
  tagCode?: string;
  breedId?: string;
  sex?: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate?: string;
  ageWeeksAtEntry?: number;
  notes?: string;
  speciesId?: string;
};

export function createAnimal(
  accessToken: string,
  farmId: string,
  payload: CreateAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPostJson<AnimalDetail>(
    `/farms/${farmId}/animals`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type AnimalTagPrefixDto = "Trui" | "Ver" | "Eng" | "Dem" | "All";

export type AnimalProductionCategoryDto =
  | "breeding_female"
  | "breeding_male"
  | "fattening"
  | "starter"
  | "nursing"
  | "unknown";

export function fetchNextAnimalNumber(
  accessToken: string,
  farmId: string,
  prefix: AnimalTagPrefixDto,
  activeProfileId?: string | null
): Promise<{
  prefix: AnimalTagPrefixDto;
  tagCode: string;
  productionCategory: AnimalProductionCategoryDto;
}> {
  return apiGetJson(
    `/farms/${farmId}/next-animal-number?prefix=${encodeURIComponent(prefix)}`,
    accessToken,
    activeProfileId
  );
}


export function fetchTagCodePreview(
  accessToken: string,
  farmId: string,
  prefix: AnimalTagPrefixDto,
  count: number,
  activeProfileId?: string | null
): Promise<{
  prefix: AnimalTagPrefixDto;
  firstTagCode: string;
  lastTagCode: string;
  count: number;
  productionCategory: AnimalProductionCategoryDto;
}> {
  return apiGetJson(
    `/farms/${farmId}/next-animal-number?prefix=${encodeURIComponent(prefix)}&count=${count}`,
    accessToken,
    activeProfileId
  );
}

export type BulkCreateAnimalsPayload = {
  penId?: string;
  productionCategory: Exclude<AnimalProductionCategoryDto, "unknown">;
  count: number;
  sex?: "male" | "female" | "unknown";
  breedId?: string;
  entryWeightKg?: number;
  ageWeeksAtEntry?: number;
  entryDate: string;
  origin: AnimalOriginDto;
  supplier?: string;
  notes?: string;
};

export type BulkCreateAnimalsResult = {
  animalsCreated: Array<{ id: string; tagCode: string | null }>;
  firstNumber: string;
  lastNumber: string;
  count: number;
  placedInPenCount: number;
  unplacedCount: number;
};

export function createBulkAnimals(
  accessToken: string,
  farmId: string,
  payload: BulkCreateAnimalsPayload,
  activeProfileId?: string | null
): Promise<BulkCreateAnimalsResult> {
  return apiPostJson<BulkCreateAnimalsResult>(
    `/farms/${farmId}/animals/bulk`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type AnimalOriginDto = "farm_born" | "purchased";

export type AnimalPedigreeRef = {
  id: string;
  tagCode: string | null;
  publicId: string;
};

export type UpdateAnimalPayload = {
  tagCode?: string;
  breedId?: string | null;
  sex?: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate?: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  origin?: AnimalOriginDto | null;
  supplier?: string | null;
  photoUrl?: string | null;
  damId?: string | null;
  sireId?: string | null;
  notes?: string | null;
};

export function updateAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: UpdateAnimalPayload,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiPatchJson<AnimalDetail>(
    `/farms/${farmId}/animals/${animalId}`,
    payload,
    accessToken,
    activeProfileId
  );
}

export type BatchListItem = {
  id: string;
  name: string;
  headcount: number;
  activeMemberCount?: number;
  status: string;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights?: Array<{ avgWeightKg: string | number; measuredAt: string }>;
  expectedExitAt?: string | null;
  closedAt?: string | null;
};

export function fetchFarmAnimals(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<AnimalListItem[]> {
  return apiGetJson<AnimalListItem[]>(
    `/farms/${farmId}/animals`,
    accessToken,
    activeProfileId
  );
}

export function fetchFarmBatches(
  accessToken: string,
  farmId: string,
  activeProfileId?: string | null
): Promise<BatchListItem[]> {
  return apiGetJson<BatchListItem[]>(
    `/farms/${farmId}/batches`,
    accessToken,
    activeProfileId
  );
}

export type AnimalDetail = {
  id: string;
  publicId: string;
  tagCode: string | null;
  sex: "male" | "female" | "unknown";
  productionCategory?: AnimalProductionCategoryDto;
  birthDate: string | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: string | null;
  currentAgeWeeks?: number | null;
  origin?: AnimalOriginDto | null;
  supplier?: string | null;
  photoUrl?: string | null;
  damId?: string | null;
  sireId?: string | null;
  dam?: AnimalPedigreeRef | null;
  sire?: AnimalPedigreeRef | null;
  status: string;
  notes: string | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{
    id: string;
    weightKg: string | number;
    measuredAt: string;
    note: string | null;
  }>;
};

export type BatchDetail = {
  id: string;
  name: string;
  headcount: number;
  status: string;
  notes: string | null;
  expectedExitAt?: string | null;
  closedAt?: string | null;
  species: { id: string; code: string; name: string };
  breed: { id: string; name: string } | null;
  weights: Array<{
    id: string;
    avgWeightKg: string | number;
    headcountSnapshot: number | null;
    measuredAt: string;
    note: string | null;
  }>;
};

export function fetchFarmAnimal(
  accessToken: string,
  farmId: string,
  animalId: string,
  activeProfileId?: string | null
): Promise<AnimalDetail> {
  return apiGetJson<AnimalDetail>(
    `/farms/${farmId}/animals/${animalId}`,
    accessToken,
    activeProfileId
  );
}

export type PatchAnimalStatusPayload = {
  status: "active" | "dead" | "sold" | "exited" | "transferred";
  note?: string | null;
};

export function fetchFarmBatch(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<BatchDetail> {
  return apiGetJson<BatchDetail>(
    `/farms/${farmId}/batches/${batchId}`,
    accessToken,
    activeProfileId
  );
}

export function deleteFarmBatch(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<{ ok: boolean }> {
  return apiDeleteJson<{ ok: boolean }>(
    `/farms/${farmId}/batches/${batchId}`,
    accessToken,
    activeProfileId
  );
}

export type PostAnimalWeightPayload = {
  weightKg: number;
  measuredAt?: string;
  note?: string;
};

export type PostBatchWeightPayload = {
  avgWeightKg: number;
  headcountSnapshot?: number;
  note?: string;
};

export function postAnimalWeight(
  accessToken: string,
  farmId: string,
  animalId: string,
  payload: PostAnimalWeightPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/farms/${farmId}/animals/${animalId}/weights`,
    payload,
    accessToken,
    activeProfileId
  );
}

export function postBatchWeight(
  accessToken: string,
  farmId: string,
  batchId: string,
  payload: PostBatchWeightPayload,
  activeProfileId?: string | null
): Promise<{ id: string }> {
  return apiPostJson<{ id: string }>(
    `/farms/${farmId}/batches/${batchId}/weights`,
    payload,
    accessToken,
    activeProfileId
  );
}

/** GET /farms/:farmId/batches/:batchId/health-events — scopes healthRead. */
export type BatchHealthEventRow = {
  id: string;
  batchId: string;
  severity: "info" | "watch" | "urgent";
  title: string;
  body: string | null;
  recordedAt: string;
  recordedByUserId: string;
  recorder: {
    id: string;
    fullName: string | null;
    email: string | null;
  };
};

export function fetchBatchHealthEvents(
  accessToken: string,
  farmId: string,
  batchId: string,
  activeProfileId?: string | null
): Promise<BatchHealthEventRow[]> {
  return apiGetJson<BatchHealthEventRow[]>(
    `/farms/${farmId}/batches/${batchId}/health-events`,
    accessToken,
    activeProfileId
  );
}

export type PostBatchHealthEventPayload = {
  severity: "info" | "watch" | "urgent";
  title: string;
  body?: string;
  recordedAt?: string;
};

export function postBatchHealthEvent(
  accessToken: string,
  farmId: string,
  batchId: string,
  payload: PostBatchHealthEventPayload,
  activeProfileId?: string | null
): Promise<BatchHealthEventRow> {
  return apiPostJson<BatchHealthEventRow>(
    `/farms/${farmId}/batches/${batchId}/health-events`,
    payload,
    accessToken,
    activeProfileId
  );
}

