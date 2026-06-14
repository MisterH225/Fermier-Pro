import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  AnimalProductionCategory,
  FarmHealthEntityType,
  FarmHealthRecordKind,
  Prisma
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { CreateCustomVaccineDto } from "./dto/create-custom-vaccine.dto";
import { CreateVaccineRecordsDto } from "./dto/create-vaccine-records.dto";
import { calculateAnimalAgeWeeks } from "../cheptel/age-calculation.util";

export type VaccineSubjectStatus = "unvaccinated" | "vaccinated" | "upcoming";

type ApplicableEntity = {
  entityType: FarmHealthEntityType;
  entityId: string;
  label: string;
  categoryLabel: string;
  penLabel: string | null;
  headcount: number;
};

type LatestRecord = {
  administeredDate: Date;
  nextDueDate: Date | null;
};

function parseTargetCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

function inferNextDueDate(frequency: string, administered: Date): Date | null {
  const f = frequency.toLowerCase();
  if (f.includes("une fois") || f.includes("once")) {
    return null;
  }
  if (f.includes("bisannuel") || f.includes("6 mois")) {
    return addMonths(administered, 6);
  }
  if (f.includes("gestation")) {
    return addMonths(administered, 4);
  }
  if (f.includes("annuel")) {
    return addMonths(administered, 12);
  }
  return addMonths(administered, 12);
}

function batchMatchesTarget(
  categoryKey: string | null | undefined,
  targets: string[]
): boolean {
  if (targets.includes("all")) {
    return true;
  }
  const k = (categoryKey ?? "").toLowerCase();
  if (
    k.includes("nursery") ||
    k === "starter" ||
    k.includes("demarrage")
  ) {
    return targets.includes("starter");
  }
  if (
    k.includes("finish") ||
    k.includes("engrais") ||
    k === "fattening"
  ) {
    return targets.includes("fattening");
  }
  if (k.includes("breed") || k.includes("truie") || k.includes("sow")) {
    return targets.includes("breeding_female");
  }
  if (k.includes("verrat") || k.includes("boar")) {
    return targets.includes("breeding_male");
  }
  return (
    targets.includes("fattening") ||
    targets.includes("starter") ||
    targets.includes("all")
  );
}

function animalMatchesTarget(
  productionCategory: AnimalProductionCategory,
  targets: string[]
): boolean {
  if (targets.includes("all")) {
    return true;
  }
  return targets.includes(productionCategory);
}

function parseMinAgeWeeks(recommendedTiming: string, targetLabel: string): number {
  const combined = `${recommendedTiming} ${targetLabel}`.toLowerCase();
  const weekMatch = combined.match(
    /(?:>|≥|à partir de\s*)?(\d+)\s*(?:-\s*\d+\s*)?sem/i
  );
  if (weekMatch) {
    const n = Number.parseInt(weekMatch[1], 10);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  const dayMatch = combined.match(/j\s*(\d+)/i);
  if (dayMatch) {
    return Math.ceil(Number.parseInt(dayMatch[1], 10) / 7);
  }
  return 0;
}

@Injectable()
export class FarmVaccineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly smartAlerts: SmartAlertsService
  ) {}

  private async loadVaccineForFarm(farmId: string, vaccineId: string) {
    const vaccine = await this.prisma.standardVaccine.findFirst({
      where: {
        id: vaccineId,
        OR: [{ farmId: null }, { farmId }]
      }
    });
    if (!vaccine) {
      throw new NotFoundException("Vaccin introuvable");
    }
    return vaccine;
  }

  private async listApplicableEntities(
    farmId: string,
    livestockMode: string,
    targets: string[]
  ): Promise<ApplicableEntity[]> {
    const penNameByEntity = new Map<string, string>();

    const placements = await this.prisma.penPlacement.findMany({
      where: {
        endedAt: null,
        OR: [
          { animal: { farmId, status: "active" } },
          { batch: { farmId, status: "active" } }
        ]
      },
      include: {
        pen: { select: { name: true } },
        animal: { select: { id: true } },
        batch: { select: { id: true } }
      }
    });
    for (const pl of placements) {
      const key = pl.animalId
        ? `animal:${pl.animalId}`
        : pl.batchId
          ? `group:${pl.batchId}`
          : null;
      if (key && pl.pen?.name) {
        penNameByEntity.set(key, pl.pen.name);
      }
    }

    const out: ApplicableEntity[] = [];

    if (livestockMode === "batch") {
      const batches = await this.prisma.livestockBatch.findMany({
        where: { farmId, status: "active" },
        include: { breed: { select: { name: true } } }
      });
      for (const b of batches) {
        if (!batchMatchesTarget(b.categoryKey, targets)) {
          continue;
        }
        const key = `group:${b.id}`;
        out.push({
          entityType: FarmHealthEntityType.group,
          entityId: b.id,
          label: b.name,
          categoryLabel: b.categoryKey ?? "—",
          penLabel: penNameByEntity.get(key) ?? null,
          headcount: b.headcount
        });
      }
      return out;
    }

    const animals = await this.prisma.animal.findMany({
      where: { farmId, status: "active" },
      include: { breed: { select: { name: true } } }
    });
    for (const a of animals) {
      if (!animalMatchesTarget(a.productionCategory, targets)) {
        continue;
      }
      const key = `animal:${a.id}`;
      const tag = a.tagCode?.trim() || a.publicId.slice(0, 8);
      out.push({
        entityType: FarmHealthEntityType.animal,
        entityId: a.id,
        label: tag,
        categoryLabel: a.productionCategory,
        penLabel: penNameByEntity.get(key) ?? null,
        headcount: 1
      });
    }

    if (livestockMode === "hybrid") {
      const batches = await this.prisma.livestockBatch.findMany({
        where: { farmId, status: "active" }
      });
      for (const b of batches) {
        if (!batchMatchesTarget(b.categoryKey, targets)) {
          continue;
        }
        const key = `group:${b.id}`;
        if (out.some((e) => e.entityId === b.id)) {
          continue;
        }
        out.push({
          entityType: FarmHealthEntityType.group,
          entityId: b.id,
          label: b.name,
          categoryLabel: b.categoryKey ?? "—",
          penLabel: penNameByEntity.get(key) ?? null,
          headcount: b.headcount
        });
      }
    }

    return out;
  }

  private classifyStatus(
    latest: LatestRecord | undefined,
    now: Date
  ): VaccineSubjectStatus {
    if (!latest) {
      return "unvaccinated";
    }
    if (latest.nextDueDate) {
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (latest.nextDueDate < now) {
        return "unvaccinated";
      }
      if (latest.nextDueDate <= in30) {
        return "upcoming";
      }
      return "vaccinated";
    }
    return "vaccinated";
  }

  private isOverdueForStats(
    latest: LatestRecord | undefined,
    now: Date
  ): boolean {
    if (!latest) {
      return true;
    }
    if (latest.nextDueDate && latest.nextDueDate < now) {
      return true;
    }
    return false;
  }

  private async latestRecordsByEntity(
    farmId: string,
    vaccineId: string
  ): Promise<Map<string, LatestRecord>> {
    const rows = await this.prisma.vaccineRecord.findMany({
      where: { farmId, vaccineId },
      orderBy: { administeredDate: "desc" }
    });
    const map = new Map<string, LatestRecord>();
    for (const r of rows) {
      const key = `${r.entityType}:${r.entityId}`;
      if (!map.has(key)) {
        map.set(key, {
          administeredDate: r.administeredDate,
          nextDueDate: r.nextDueDate
        });
      }
    }
    return map;
  }

  async listCatalog(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.prisma.standardVaccine.findMany({
      where: { OR: [{ farmId: null }, { farmId }] },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async getCoverage(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }

    const vaccines = await this.listCatalog(user, farmId);
    const now = new Date();
    const items = [];

    for (const vaccine of vaccines) {
      const targets = parseTargetCategories(vaccine.targetCategories);
      const entities = await this.listApplicableEntities(
        farmId,
        farm.livestockMode,
        targets
      );
      const latestMap = await this.latestRecordsByEntity(farmId, vaccine.id);

      let upToDate = 0;
      let overdue = 0;
      let upcoming = 0;

      for (const ent of entities) {
        const key = `${ent.entityType}:${ent.entityId}`;
        const latest = latestMap.get(key);
        const status = this.classifyStatus(latest, now);
        if (status === "vaccinated") {
          upToDate += 1;
        } else if (status === "upcoming") {
          upcoming += 1;
        }
        if (this.isOverdueForStats(latest, now)) {
          overdue += 1;
        }
      }

      const total = entities.length;
      const coverageRate =
        total > 0 ? Math.round((upToDate / total) * 100) : 100;

      items.push({
        vaccine: {
          id: vaccine.id,
          code: vaccine.code,
          name: vaccine.name,
          vaccineType: vaccine.vaccineType,
          targetLabel: vaccine.targetLabel,
          frequency: vaccine.frequency,
          recommendedTiming: vaccine.recommendedTiming,
          icon: vaccine.icon,
          isStandard: vaccine.isStandard
        },
        stats: {
          totalSubjects: total,
          upToDate,
          overdue,
          upcoming,
          coverageRate
        }
      });
    }

    return { farmId, items };
  }

  /** Administrations manquantes ou rappels dépassés (KPI Santé). */
  async countOverdueAdministrations(user: User, farmId: string): Promise<number> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      return 0;
    }

    const vaccines = await this.listCatalog(user, farmId);
    const now = new Date();
    let total = 0;

    for (const vaccine of vaccines) {
      const minAgeWeeks = parseMinAgeWeeks(
        vaccine.recommendedTiming,
        vaccine.targetLabel
      );
      const targets = parseTargetCategories(vaccine.targetCategories);
      const latestMap = await this.latestRecordsByEntity(farmId, vaccine.id);

      if (farm.livestockMode === "batch" || farm.livestockMode === "hybrid") {
        const entities = await this.listApplicableEntities(
          farmId,
          farm.livestockMode,
          targets
        );
        for (const ent of entities) {
          const key = `${ent.entityType}:${ent.entityId}`;
          const latest = latestMap.get(key);
          if (this.isOverdueForStats(latest, now)) {
            total += ent.headcount;
          }
        }
        continue;
      }

      const animals = await this.prisma.animal.findMany({
        where: { farmId, status: "active" },
        select: {
          id: true,
          productionCategory: true,
          birthDate: true,
          ageWeeksAtEntry: true,
          entryDate: true
        }
      });

      for (const a of animals) {
        if (!animalMatchesTarget(a.productionCategory, targets)) {
          continue;
        }
        const ageWeeks = calculateAnimalAgeWeeks(
          {
            birthDate: a.birthDate,
            ageWeeksAtEntry: a.ageWeeksAtEntry,
            entryDate: a.entryDate
          },
          now
        );
        const key = `${FarmHealthEntityType.animal}:${a.id}`;
        const latest = latestMap.get(key);
        const reminderOverdue =
          latest?.nextDueDate != null && latest.nextDueDate < now;

        if (!latest) {
          if (ageWeeks == null || ageWeeks >= minAgeWeeks) {
            total += 1;
          }
        } else if (reminderOverdue) {
          total += 1;
        }
      }
    }

    return total;
  }

  async listSubjects(
    user: User,
    farmId: string,
    vaccineId: string,
    statusFilter: VaccineSubjectStatus
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    const vaccine = await this.loadVaccineForFarm(farmId, vaccineId);
    const targets = parseTargetCategories(vaccine.targetCategories);
    const entities = await this.listApplicableEntities(
      farmId,
      farm.livestockMode,
      targets
    );
    const latestMap = await this.latestRecordsByEntity(farmId, vaccineId);
    const now = new Date();

    const rows = entities
      .map((ent) => {
        const key = `${ent.entityType}:${ent.entityId}`;
        const latest = latestMap.get(key);
        const status = this.classifyStatus(latest, now);
        return {
          entityType: ent.entityType,
          entityId: ent.entityId,
          label: ent.label,
          categoryLabel: ent.categoryLabel,
          penLabel: ent.penLabel,
          headcount: ent.headcount,
          status,
          lastVaccinationAt: latest?.administeredDate?.toISOString() ?? null,
          nextDueAt: latest?.nextDueDate?.toISOString() ?? null
        };
      })
      .filter((r) => r.status === statusFilter);

    return {
      farmId,
      vaccineId,
      status: statusFilter,
      subjects: rows
    };
  }

  async createCustomVaccine(
    user: User,
    farmId: string,
    dto: CreateCustomVaccineDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const row = await this.prisma.standardVaccine.create({
      data: {
        farmId,
        name: dto.name.trim(),
        vaccineType: dto.vaccineType,
        targetCategories: dto.targetCategories as Prisma.InputJsonValue,
        targetLabel: dto.targetLabel.trim(),
        frequency: dto.frequency.trim(),
        recommendedTiming: dto.recommendedTiming.trim(),
        icon: dto.icon?.trim() || "💉",
        isStandard: false,
        sortOrder: dto.sortOrder ?? 100,
        notes: dto.notes?.trim() ?? null
      }
    });
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordCreated,
      resourceType: "StandardVaccine",
      resourceId: row.id,
      metadata: { custom: true }
    });
    return row;
  }

  async createRecords(
    user: User,
    farmId: string,
    dto: CreateVaccineRecordsDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    const vaccine = await this.loadVaccineForFarm(farmId, dto.vaccineId);

    const administered = dto.administeredDate
      ? new Date(dto.administeredDate)
      : new Date();
    if (Number.isNaN(administered.getTime())) {
      throw new BadRequestException("Date d'administration invalide");
    }

    const nextDue = dto.nextDueDate
      ? new Date(dto.nextDueDate)
      : inferNextDueDate(vaccine.frequency, administered);
    if (dto.nextDueDate && Number.isNaN(nextDue!.getTime())) {
      throw new BadRequestException("Date de rappel invalide");
    }

    const expiry = dto.expiryDate ? new Date(dto.expiryDate) : null;
    if (expiry && Number.isNaN(expiry.getTime())) {
      throw new BadRequestException("Date de péremption invalide");
    }

    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const sub of dto.subjects) {
        if (farm.livestockMode === "individual") {
          if (sub.entityType !== FarmHealthEntityType.animal) {
            throw new BadRequestException(
              "Mode individuel : sujet animal requis"
            );
          }
        } else if (farm.livestockMode === "batch") {
          if (sub.entityType !== FarmHealthEntityType.group) {
            throw new BadRequestException(
              "Mode bande : sujet bande requis"
            );
          }
        }

        if (sub.entityType === FarmHealthEntityType.animal) {
          const a = await tx.animal.findFirst({
            where: { id: sub.entityId, farmId, status: "active" }
          });
          if (!a) {
            throw new BadRequestException("Animal introuvable");
          }
        } else {
          const b = await tx.livestockBatch.findFirst({
            where: { id: sub.entityId, farmId, status: "active" }
          });
          if (!b) {
            throw new BadRequestException("Bande introuvable");
          }
        }

        const healthRec = await tx.farmHealthRecord.create({
          data: {
            farmId,
            kind: FarmHealthRecordKind.vaccination,
            entityType: sub.entityType,
            entityId: sub.entityId,
            occurredAt: administered,
            status: "completed",
            notes: dto.notes?.trim() ?? null,
            recordedByUserId: user.id
          }
        });

        await tx.healthVaccinationDetail.create({
          data: {
            healthRecordId: healthRec.id,
            vaccineName: vaccine.name,
            vaccineType: vaccine.vaccineType,
            practitioner: dto.practitioner?.trim() ?? null,
            nextReminderAt: nextDue
          }
        });

        const record = await tx.vaccineRecord.create({
          data: {
            farmId,
            vaccineId: vaccine.id,
            entityType: sub.entityType,
            entityId: sub.entityId,
            administeredDate: administered,
            nextDueDate: nextDue,
            administeredByUserId: user.id,
            batchNumber: dto.batchNumber?.trim() ?? null,
            expiryDate: expiry,
            notes: dto.notes?.trim() ?? null,
            healthRecordId: healthRec.id
          }
        });
        createdIds.push(record.id);
      }
    });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordCreated,
      resourceType: "VaccineRecord",
      resourceId: createdIds[0] ?? dto.vaccineId,
      metadata: { count: createdIds.length, vaccineId: dto.vaccineId }
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return {
      farmId,
      vaccineId: dto.vaccineId,
      createdCount: createdIds.length,
      recordIds: createdIds
    };
  }
}
