import {
  FarmDiseaseCaseStatus,
  FarmHealthEntityType,
  FarmHealthRecordKind
} from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

export type ListingVaccineRowStatus = "done" | "upcoming" | "overdue";
export type ListingVaccinesGlobalStatus = "up_to_date" | "overdue" | "none";

export type ListingHealthVaccineDto = {
  vaccineName: string;
  administeredDate: string;
  nextDueDate: string | null;
  status: ListingVaccineRowStatus;
  animalId: string;
  animalLabel: string;
};

export type ListingPastDiseaseDto = {
  diagnosis: string | null;
  symptomsSummary: string;
  onsetDate: string;
  resolvedDate: string;
  durationDays: number;
  finalStatus: "recovered" | "resolved";
  animalId: string;
  animalLabel: string;
};

export type ListingHealthDataDto = {
  vaccines: ListingHealthVaccineDto[];
  pastDiseases: ListingPastDiseaseDto[];
  activeCasesCount: number;
  vaccinesStatus: ListingVaccinesGlobalStatus;
};

function classifyVaccineStatus(
  nextDueDate: Date | null,
  now: Date
): ListingVaccineRowStatus {
  if (!nextDueDate) {
    return "done";
  }
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (nextDueDate < now) {
    return "overdue";
  }
  if (nextDueDate <= in30) {
    return "upcoming";
  }
  return "done";
}

function symptomsSummary(raw: unknown): string {
  if (raw && typeof raw === "object" && "tags" in raw) {
    const tags = (raw as { tags?: unknown }).tags;
    if (Array.isArray(tags)) {
      const parts = tags.filter((t): t is string => typeof t === "string");
      if (parts.length > 0) {
        return parts.join(", ");
      }
    }
  }
  return "Symptômes non précisés";
}

function safeLocationLabel(
  locationLabel: string | null | undefined,
  address: string | null | undefined
): string | null {
  const fromListing = locationLabel?.trim();
  if (fromListing) {
    return fromListing;
  }
  const addr = address?.trim();
  if (!addr) {
    return null;
  }
  const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 1]!;
  }
  if (addr.length > 48) {
    return null;
  }
  return addr;
}

export function mapFinalDiseaseStatus(
  caseStatus: FarmDiseaseCaseStatus
): "recovered" | "resolved" | null {
  if (caseStatus === FarmDiseaseCaseStatus.recovered) {
    return "recovered";
  }
  if (
    caseStatus === FarmDiseaseCaseStatus.dead ||
    caseStatus === FarmDiseaseCaseStatus.slaughtered
  ) {
    return "resolved";
  }
  return null;
}

export async function buildListingHealthData(
  prisma: PrismaService,
  farmId: string,
  animalIds: string[]
): Promise<ListingHealthDataDto> {
  if (animalIds.length === 0) {
    return {
      vaccines: [],
      pastDiseases: [],
      activeCasesCount: 0,
      vaccinesStatus: "none"
    };
  }

  const animals = await prisma.animal.findMany({
    where: { id: { in: animalIds }, farmId },
    select: { id: true, tagCode: true, publicId: true }
  });
  const labelById = new Map(
    animals.map((a) => [
      a.id,
      a.tagCode?.trim() || a.publicId?.trim() || "Sujet"
    ])
  );

  const now = new Date();
  const vaccineRows = await prisma.vaccineRecord.findMany({
    where: {
      farmId,
      entityType: FarmHealthEntityType.animal,
      entityId: { in: animalIds }
    },
    include: { vaccine: { select: { name: true } } },
    orderBy: [{ administeredDate: "desc" }]
  });

  const vaccines: ListingHealthVaccineDto[] = vaccineRows.map((row) => ({
    vaccineName: row.vaccine.name,
    administeredDate: row.administeredDate.toISOString(),
    nextDueDate: row.nextDueDate?.toISOString() ?? null,
    status: classifyVaccineStatus(row.nextDueDate, now),
    animalId: row.entityId,
    animalLabel: labelById.get(row.entityId) ?? "Sujet"
  }));

  let vaccinesStatus: ListingVaccinesGlobalStatus = "none";
  if (vaccines.length > 0) {
    vaccinesStatus = vaccines.some((v) => v.status === "overdue")
      ? "overdue"
      : "up_to_date";
  }

  const diseaseRecords = await prisma.farmHealthRecord.findMany({
    where: {
      farmId,
      kind: FarmHealthRecordKind.disease,
      entityType: FarmHealthEntityType.animal,
      entityId: { in: animalIds }
    },
    include: { disease: true },
    orderBy: { occurredAt: "desc" }
  });

  let activeCasesCount = 0;
  const pastDiseases: ListingPastDiseaseDto[] = [];

  for (const rec of diseaseRecords) {
    const disease = rec.disease;
    if (!disease) {
      continue;
    }
    if (disease.caseStatus === FarmDiseaseCaseStatus.active) {
      activeCasesCount += 1;
      continue;
    }
    const finalStatus = mapFinalDiseaseStatus(disease.caseStatus);
    if (!finalStatus) {
      continue;
    }
    const resolvedAt = disease.resolvedAt ?? rec.occurredAt;
    const durationMs = resolvedAt.getTime() - rec.occurredAt.getTime();
    const durationDays = Math.max(
      1,
      Math.round(durationMs / (24 * 60 * 60 * 1000))
    );
    pastDiseases.push({
      diagnosis: disease.diagnosis?.trim() || null,
      symptomsSummary: symptomsSummary(disease.symptoms),
      onsetDate: rec.occurredAt.toISOString(),
      resolvedDate: resolvedAt.toISOString(),
      durationDays,
      finalStatus,
      animalId: rec.entityId,
      animalLabel: labelById.get(rec.entityId) ?? "Sujet"
    });
  }

  return {
    vaccines,
    pastDiseases,
    activeCasesCount,
    vaccinesStatus
  };
}

export type ListingFarmInfoDto = {
  farmId: string;
  farmName: string;
  farmLocation: string | null;
  producerDisplayName: string;
  farmRating: number | null;
  farmRatingCount: number;
  farmTotalSales: number;
  activeListingsCount: number;
};

export async function buildListingFarmInfo(
  prisma: PrismaService,
  farmId: string,
  producerDisplayName: string,
  locationLabel: string | null | undefined,
  farmRating: { avg: number | null; count: number }
): Promise<ListingFarmInfoDto> {
  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: { id: true, name: true, address: true }
  });
  if (!farm) {
    throw new Error("Farm not found");
  }

  const [farmTotalSales, activeListingsCount] = await Promise.all([
    prisma.marketplaceListing.count({
      where: { farmId, status: "sold" }
    }),
    prisma.marketplaceListing.count({
      where: { farmId, status: "published" }
    })
  ]);

  return {
    farmId: farm.id,
    farmName: farm.name,
    farmLocation: safeLocationLabel(locationLabel, farm.address),
    producerDisplayName,
    farmRating: farmRating.avg,
    farmRatingCount: farmRating.count,
    farmTotalSales,
    activeListingsCount
  };
}
