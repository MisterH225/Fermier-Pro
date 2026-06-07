import {
  AnimalHealthStatus,
  FarmDiseaseCaseStatus,
  FarmDiseaseSeverity,
  FarmHealthEntityType,
  FarmHealthRecordKind,
  HealthSeverity,
  Prisma
} from "@prisma/client";

export function parseDiseaseSeverity(raw: unknown): FarmDiseaseSeverity | null {
  const s = raw == null ? null : String(raw).trim().toLowerCase();
  if (s && (Object.values(FarmDiseaseSeverity) as string[]).includes(s)) {
    return s as FarmDiseaseSeverity;
  }
  return null;
}

export function legacySeverityFromDisease(
  severity: FarmDiseaseSeverity | null | undefined
): HealthSeverity {
  if (severity === FarmDiseaseSeverity.severe) {
    return HealthSeverity.urgent;
  }
  if (severity === FarmDiseaseSeverity.moderate) {
    return HealthSeverity.watch;
  }
  return HealthSeverity.info;
}

export function diseaseSeverityFromLegacy(
  severity: HealthSeverity
): FarmDiseaseSeverity {
  if (severity === HealthSeverity.urgent) {
    return FarmDiseaseSeverity.severe;
  }
  if (severity === HealthSeverity.watch) {
    return FarmDiseaseSeverity.moderate;
  }
  return FarmDiseaseSeverity.mild;
}

export function legacyCaseStatusFromSeverity(
  severity: HealthSeverity
): FarmDiseaseCaseStatus {
  if (severity === HealthSeverity.info) {
    return FarmDiseaseCaseStatus.recovered;
  }
  return FarmDiseaseCaseStatus.active;
}

export function shouldMarkAnimalSickFromLegacy(
  severity: HealthSeverity
): boolean {
  return (
    severity === HealthSeverity.watch || severity === HealthSeverity.urgent
  );
}

type DiseaseDetailInput = {
  symptoms?: Prisma.InputJsonValue;
  diagnosis?: string | null;
  caseStatus: FarmDiseaseCaseStatus;
  severity?: FarmDiseaseSeverity | null;
  durationEstimate?: string | null;
  inIsolation?: boolean;
  treatmentOngoing?: boolean;
  resolvedAt?: Date | null;
  linkedTreatmentRecordId?: string | null;
};

export function buildDiseaseDetailData(
  d: Record<string, unknown>,
  parseCaseStatus: (raw: unknown) => FarmDiseaseCaseStatus
): DiseaseDetailInput {
  const caseStatus = parseCaseStatus(d.caseStatus);
  const resolvedAtRaw = d.resolvedAt;
  const resolvedAt =
    resolvedAtRaw != null && String(resolvedAtRaw).trim()
      ? new Date(String(resolvedAtRaw))
      : caseStatus === FarmDiseaseCaseStatus.recovered
        ? new Date()
        : null;

  return {
    symptoms:
      d.symptoms != null && typeof d.symptoms === "object"
        ? (d.symptoms as Prisma.InputJsonValue)
        : undefined,
    diagnosis:
      d.diagnosis != null ? String(d.diagnosis).trim().slice(0, 2000) : undefined,
    caseStatus,
    severity: parseDiseaseSeverity(d.severity),
    durationEstimate:
      d.durationEstimate != null
        ? String(d.durationEstimate).trim().slice(0, 120)
        : undefined,
    inIsolation: d.inIsolation === true,
    treatmentOngoing: d.treatmentOngoing === true,
    resolvedAt,
    linkedTreatmentRecordId:
      d.linkedTreatmentRecordId != null
        ? String(d.linkedTreatmentRecordId).trim().slice(0, 64)
        : undefined
  };
}

/** Recalcule healthStatus à partir des cas maladie actifs (entityType=animal). */
export async function syncAnimalHealthStatus(
  tx: Prisma.TransactionClient,
  animalId: string
): Promise<void> {
  const animal = await tx.animal.findUnique({
    where: { id: animalId },
    select: { status: true, healthStatus: true }
  });
  if (!animal || animal.status !== "active") {
    return;
  }

  const activeCount = await tx.farmHealthRecord.count({
    where: {
      entityType: FarmHealthEntityType.animal,
      entityId: animalId,
      kind: FarmHealthRecordKind.disease,
      disease: { caseStatus: FarmDiseaseCaseStatus.active }
    }
  });

  const next: AnimalHealthStatus =
    activeCount > 0 ? AnimalHealthStatus.sick : AnimalHealthStatus.healthy;

  if (animal.healthStatus !== next) {
    await tx.animal.update({
      where: { id: animalId },
      data: { healthStatus: next }
    });
  }
}

export type LegacyAnimalHealthEventRow = {
  id: string;
  animalId: string;
  severity: HealthSeverity;
  title: string;
  body: string | null;
  recordedAt: Date;
  recorder: { id: string; fullName: string | null; email: string | null };
};

export function mapFarmDiseaseRecordToLegacyEvent(
  rec: {
    id: string;
    entityId: string;
    occurredAt: Date;
    notes: string | null;
    disease: {
      diagnosis: string | null;
      severity: FarmDiseaseSeverity | null;
    } | null;
    recorder: { id: string; fullName: string | null; email: string | null };
  }
): LegacyAnimalHealthEventRow {
  return {
    id: rec.id,
    animalId: rec.entityId,
    severity: legacySeverityFromDisease(rec.disease?.severity),
    title: rec.disease?.diagnosis?.trim() || "Sans titre",
    body: rec.notes,
    recordedAt: rec.occurredAt,
    recorder: rec.recorder
  };
}
