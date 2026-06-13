import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  FarmHealthEntityType,
  FarmHealthRecordKind,
  FarmMortalityCause,
  GestationStatus,
  GestationVaccineStatus,
  LivestockExitKind,
  Prisma,
  type User
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { HousingService } from "../housing/housing.service";
import { PenAllocationService } from "../housing/pen-allocation.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { PredictionsService } from "../predictions/predictions.service";
import { MemberActivityLogsService } from "../member-activity-logs/member-activity-logs.service";
import {
  DEFAULT_GESTATION_DAYS,
  DEFAULT_PRE_BIRTH_CHECKLIST,
  DEFAULT_VACCINE_SCHEDULE,
  DEFAULT_WEANING_DAYS,
  addUtcDays,
  startOfUtcDay,
  type VaccineScheduleEntry
} from "./gestation.constants";
import type { CreateGestationDto } from "./dto/create-gestation.dto";
import type { UpdateGestationDto } from "./dto/update-gestation.dto";
import type { PatchGestationStatusDto } from "./dto/patch-gestation-status.dto";
import type { RecordLitterDto } from "./dto/record-litter.dto";
import type { UpdateGestationSettingsDto } from "./dto/update-gestation-settings.dto";
import { createLitterPigletsInTransaction } from "./litter-individuals.util";
import { maintainLitterBatches } from "./litter-weaning.util";

const MS_DAY = 86_400_000;
const SOW_INCLUDE = {
  id: true,
  publicId: true,
  tagCode: true,
  photoUrl: true,
  sex: true,
  status: true,
  speciesId: true,
  breed: { select: { id: true, name: true } },
  penPlacements: {
    where: { endedAt: null },
    orderBy: { startedAt: "desc" as const },
    take: 1,
    include: { pen: { select: { id: true, name: true, code: true } } }
  }
};

function animalLabel(a: {
  tagCode: string | null;
  publicId: string;
}): string {
  return a.tagCode?.trim() || a.publicId.slice(0, 8);
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / MS_DAY);
}

function gestationProgress(
  matingDate: Date,
  expectedBirthDate: Date,
  now = new Date()
): {
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  progressPct: number;
  weekCurrent: number;
  weekTotal: number;
  urgency: "critical" | "soon" | "active" | null;
} {
  const daysTotal = Math.max(
    1,
    daysBetween(matingDate, expectedBirthDate)
  );
  const daysElapsed = Math.max(0, daysBetween(matingDate, now));
  const daysRemaining = Math.max(0, daysBetween(now, expectedBirthDate));
  const progressPct = Math.min(
    100,
    Math.round((daysElapsed / daysTotal) * 100)
  );
  const weekCurrent = Math.min(16, Math.max(1, Math.ceil(daysElapsed / 7)));
  const weekTotal = 16;
  let urgency: "critical" | "soon" | "active" | null = "active";
  if (daysRemaining <= 3) {
    urgency = "critical";
  } else if (daysRemaining <= 7) {
    urgency = "soon";
  }
  return {
    daysElapsed,
    daysTotal,
    daysRemaining,
    progressPct,
    weekCurrent,
    weekTotal,
    urgency
  };
}

@Injectable()
export class GestationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly housing: HousingService,
    private readonly penAllocation: PenAllocationService,
    private readonly smartAlerts: SmartAlertsService,
    private readonly gemini: AiGeminiService,
    private readonly predictions: PredictionsService,
    private readonly activityLogs: MemberActivityLogsService
  ) {}

  private async ensureSettings(farmId: string) {
    const existing = await this.prisma.gestationSettings.findUnique({
      where: { farmId }
    });
    if (existing) {
      return existing;
    }
    return this.prisma.gestationSettings.create({
      data: {
        farmId,
        gestationDurationDays: DEFAULT_GESTATION_DAYS,
        weaningDurationDays: DEFAULT_WEANING_DAYS,
        vaccineSchedule: DEFAULT_VACCINE_SCHEDULE as Prisma.InputJsonValue
      }
    });
  }

  private vaccineScheduleFromSettings(
    raw: unknown
  ): VaccineScheduleEntry[] {
    if (!Array.isArray(raw)) {
      return DEFAULT_VACCINE_SCHEDULE;
    }
    return raw
      .filter((e): e is VaccineScheduleEntry => {
        if (!e || typeof e !== "object") {
          return false;
        }
        const o = e as Record<string, unknown>;
        return (
          typeof o.name === "string" &&
          typeof o.daysAfterMating === "number"
        );
      })
      .map((e) => ({
        name: e.name,
        daysAfterMating: e.daysAfterMating,
        enabled: e.enabled !== false
      }));
  }

  private mapGestation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g: any,
    durationDays: number
  ) {
    const now = new Date();
    const prog =
      g.status === "active"
        ? gestationProgress(g.matingDate, g.expectedBirthDate, now)
        : null;
    const vaccines = (g.vaccines as Array<{
      id: string;
      vaccineName: string;
      scheduledDate: Date;
      administeredDate: Date | null;
      status: GestationVaccineStatus;
    }>).map((v) => {
      let status = v.status;
      if (
        status === GestationVaccineStatus.pending &&
        v.scheduledDate < startOfUtcDay(now)
      ) {
        status = GestationVaccineStatus.overdue;
      }
      return { ...v, status };
    });
    const checklistDone = (g.checklistItems as Array<{ isChecked: boolean }>).filter(
      (c) => c.isChecked
    ).length;
    const pen = g.sow.penPlacements[0]?.pen;
    return {
      ...g,
      sowLabel: animalLabel(g.sow),
      boarLabel: g.boar ? animalLabel(g.boar) : null,
      sowPen: pen ? { id: pen.id, name: pen.name, code: pen.code } : null,
      progress: prog,
      vaccines,
      checklistCompletionPct:
        g.checklistItems.length > 0
          ? Math.round((checklistDone / g.checklistItems.length) * 100)
          : 0,
      gestationDurationDays: durationDays
    };
  }

  private async syncSowExpectedFarrowing(
    sowId: string,
    expected: Date | null
  ) {
    await this.prisma.animal.update({
      where: { id: sowId },
      data: { expectedFarrowingAt: expected }
    });
  }

  private async refreshAlerts(farmId: string) {
    await this.smartAlerts.refreshInternal(farmId);
  }

  async getOverview(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const settings = await this.ensureSettings(farmId);
    const now = new Date();
    const in7 = addUtcDays(startOfUtcDay(now), 7);
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)
    );

    const active = await this.prisma.gestation.findMany({
      where: { farmId, status: GestationStatus.active },
      include: { sow: { select: SOW_INCLUDE }, litter: true }
    });

    const activeCount = active.length;
    const dueIn7 = active.filter(
      (g) => g.expectedBirthDate <= in7 && g.expectedBirthDate >= now
    ).length;
    const dueThisMonth = active.filter(
      (g) =>
        g.expectedBirthDate >= now && g.expectedBirthDate <= monthEnd
    ).length;

    const availableSowsRes = await this.listAvailableSows(user, farmId);
    const stats = await this.getStats(user, farmId);

    const sixMonthsAgo = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)
    );
    const litters = await this.prisma.litter.findMany({
      where: {
        farmId,
        recordedAt: { gte: sixMonthsAgo }
      },
      select: { recordedAt: true, bornAlive: true }
    });
    const chartByMonth = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      chartByMonth.set(key, 0);
    }
    for (const l of litters) {
      const d = l.recordedAt;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (chartByMonth.has(key)) {
        chartByMonth.set(key, (chartByMonth.get(key) ?? 0) + 1);
      }
    }
    const birthsPerMonth = [...chartByMonth.entries()].map(
      ([month, count]) => ({ month, count })
    );

    const upcoming = active
      .map((g) => ({
        gestationId: g.id,
        sowId: g.sowId,
        sowLabel: animalLabel(g.sow),
        photoUrl: g.sow.photoUrl,
        expectedBirthDate: g.expectedBirthDate.toISOString(),
        daysRemaining: Math.max(0, daysBetween(now, g.expectedBirthDate)),
        urgency:
          daysBetween(now, g.expectedBirthDate) <= 3
            ? "critical"
            : daysBetween(now, g.expectedBirthDate) <= 7
              ? "soon"
              : "active"
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    return {
      kpis: {
        activeGestations: activeCount,
        birthsDueIn7Days: dueIn7,
        birthsDueThisMonth: dueThisMonth,
        sowsAvailableForMating: availableSowsRes.items.filter(
          (s: { availability: string }) => s.availability === "now"
        ).length,
        avgDaysBetweenFarrowing: stats.avgDaysBetweenFarrowing,
        avgLitterSize: stats.avgLitterSize,
        neonatalMortalityPct: stats.neonatalMortalityPct
      },
      birthsPerMonth,
      upcomingBirths: upcoming
    };
  }

  async list(
    user: User,
    farmId: string,
    opts: { status?: GestationStatus; filter?: string; q?: string }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const settings = await this.ensureSettings(farmId);
    const now = new Date();
    const where: Prisma.GestationWhereInput = { farmId, archived: false };
    if (opts.status) {
      where.status = opts.status;
    } else {
      where.status = GestationStatus.active;
    }

    const rows = await this.prisma.gestation.findMany({
      where,
      include: {
        sow: { select: SOW_INCLUDE },
        boar: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            photoUrl: true
          }
        },
        vaccines: true,
        checklistItems: true,
        litter: true
      },
      orderBy: { expectedBirthDate: "asc" }
    });

    let mapped = rows.map((g) =>
      this.mapGestation(g, settings.gestationDurationDays)
    );

    const q = opts.q?.trim().toLowerCase();
    if (q) {
      mapped = mapped.filter(
        (g) =>
          g.sowLabel.toLowerCase().includes(q) ||
          g.sow.publicId.toLowerCase().includes(q)
      );
    }

    const filter = opts.filter ?? "all";
    if (filter === "due7") {
      mapped = mapped.filter((g) => (g.progress?.daysRemaining ?? 99) <= 7);
    } else if (filter === "due30") {
      mapped = mapped.filter((g) => (g.progress?.daysRemaining ?? 99) <= 30);
    } else if (filter === "t1") {
      mapped = mapped.filter((g) => (g.progress?.weekCurrent ?? 0) <= 5);
    } else if (filter === "t2") {
      mapped = mapped.filter(
        (g) =>
          (g.progress?.weekCurrent ?? 0) >= 6 &&
          (g.progress?.weekCurrent ?? 0) <= 11
      );
    } else if (filter === "t3") {
      mapped = mapped.filter((g) => (g.progress?.weekCurrent ?? 0) >= 12);
    }

    return { items: mapped };
  }

  async getOne(user: User, gestationId: string) {
    const g = await this.prisma.gestation.findUnique({
      where: { id: gestationId },
      include: {
        sow: { select: SOW_INCLUDE },
        boar: {
          select: {
            id: true,
            publicId: true,
            tagCode: true,
            photoUrl: true
          }
        },
        vaccines: { orderBy: { scheduledDate: "asc" } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
        litter: true
      }
    });
    if (!g) {
      throw new NotFoundException("Gestation introuvable");
    }
    await this.farmAccess.requireFarmAccess(user.id, g.farmId);
    const settings = await this.ensureSettings(g.farmId);
    return this.mapGestation(g, settings.gestationDurationDays);
  }

  async create(user: User, dto: CreateGestationDto) {
    await this.farmAccess.requireFarmAccess(user.id, dto.farmId);
    const settings = await this.ensureSettings(dto.farmId);
    const matingDate = startOfUtcDay(new Date(dto.matingDate));

    const sow = await this.prisma.animal.findFirst({
      where: {
        id: dto.sowId,
        farmId: dto.farmId,
        sex: "female",
        status: "active"
      }
    });
    if (!sow) {
      throw new BadRequestException("Truie invalide ou inactive");
    }

    const activeOther = await this.prisma.gestation.findFirst({
      where: {
        farmId: dto.farmId,
        sowId: dto.sowId,
        status: GestationStatus.active
      }
    });
    if (activeOther) {
      throw new BadRequestException(
        "Cette truie a déjà une gestation active"
      );
    }

    if (dto.boarId) {
      const boar = await this.prisma.animal.findFirst({
        where: {
          id: dto.boarId,
          farmId: dto.farmId,
          sex: "male",
          status: "active"
        }
      });
      if (!boar) {
        throw new BadRequestException("Verrat invalide");
      }
    }

    const priorCount = await this.prisma.gestation.count({
      where: { farmId: dto.farmId, sowId: dto.sowId }
    });
    const expectedBirthDate = addUtcDays(
      matingDate,
      settings.gestationDurationDays
    );
    const schedule = this.vaccineScheduleFromSettings(
      settings.vaccineSchedule
    );

    const created = await this.prisma.$transaction(async (tx) => {
      const gestation = await tx.gestation.create({
        data: {
          farmId: dto.farmId,
          sowId: dto.sowId,
          boarId: dto.boarId ?? null,
          matingType: dto.matingType,
          matingDate,
          expectedBirthDate,
          gestationNumber: priorCount + 1,
          notes: dto.notes?.trim() || null
        }
      });

      for (const v of schedule.filter((e) => e.enabled !== false)) {
        await tx.gestationVaccine.create({
          data: {
            gestationId: gestation.id,
            vaccineName: v.name,
            scheduledDate: addUtcDays(matingDate, v.daysAfterMating)
          }
        });
      }

      for (let i = 0; i < DEFAULT_PRE_BIRTH_CHECKLIST.length; i++) {
        await tx.gestationChecklistItem.create({
          data: {
            gestationId: gestation.id,
            itemLabel: DEFAULT_PRE_BIRTH_CHECKLIST[i]!,
            sortOrder: i
          }
        });
      }

      await tx.animal.update({
        where: { id: dto.sowId },
        data: { expectedFarrowingAt: expectedBirthDate }
      });

      return gestation;
    });

    await this.refreshAlerts(dto.farmId);
    void this.activityLogs.logForUserOnFarm(user.id, dto.farmId, "gestation", "gestation_created", {
      gestationId: created.id
    });
    return this.getOne(user, created.id);
  }

  async update(user: User, gestationId: string, dto: UpdateGestationDto) {
    const existing = await this.prisma.gestation.findUnique({
      where: { id: gestationId }
    });
    if (!existing) {
      throw new NotFoundException();
    }
    await this.farmAccess.requireFarmAccess(user.id, existing.farmId);
    if (existing.status !== GestationStatus.active) {
      throw new BadRequestException("Gestation non modifiable");
    }

    const settings = await this.ensureSettings(existing.farmId);
    const matingDate = dto.matingDate
      ? startOfUtcDay(new Date(dto.matingDate))
      : existing.matingDate;
    const expectedBirthDate = addUtcDays(
      matingDate,
      settings.gestationDurationDays
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.gestation.update({
        where: { id: gestationId },
        data: {
          boarId: dto.boarId === null ? null : dto.boarId ?? undefined,
          matingType: dto.matingType,
          matingDate: dto.matingDate ? matingDate : undefined,
          expectedBirthDate: dto.matingDate ? expectedBirthDate : undefined,
          notes: dto.notes === null ? null : dto.notes?.trim()
        }
      });

      if (dto.matingDate) {
        const schedule = this.vaccineScheduleFromSettings(
          settings.vaccineSchedule
        );
        await tx.gestationVaccine.deleteMany({
          where: {
            gestationId,
            status: { in: ["pending", "overdue"] }
          }
        });
        for (const v of schedule.filter((e) => e.enabled !== false)) {
          await tx.gestationVaccine.create({
            data: {
              gestationId,
              vaccineName: v.name,
              scheduledDate: addUtcDays(matingDate, v.daysAfterMating)
            }
          });
        }
      }

      await tx.animal.update({
        where: { id: existing.sowId },
        data: { expectedFarrowingAt: expectedBirthDate }
      });
    });

    await this.refreshAlerts(existing.farmId);
    return this.getOne(user, gestationId);
  }

  async patchStatus(
    user: User,
    gestationId: string,
    dto: PatchGestationStatusDto
  ) {
    const existing = await this.prisma.gestation.findUnique({
      where: { id: gestationId }
    });
    if (!existing) {
      throw new NotFoundException();
    }
    await this.farmAccess.requireFarmAccess(user.id, existing.farmId);

    await this.prisma.gestation.update({
      where: { id: gestationId },
      data: { status: dto.status }
    });

    if (dto.status !== GestationStatus.active) {
      await this.syncSowExpectedFarrowing(existing.sowId, null);
    }

    await this.refreshAlerts(existing.farmId);
    return this.getOne(user, gestationId);
  }

  /** Loge vide ou avec assez de places pour une portée. */
  private async findPenForLitter(
    farmId: string,
    headcount: number,
    preferredPenId?: string | null
  ): Promise<string | null> {
    if (preferredPenId) {
      const pen = await this.prisma.pen.findFirst({
        where: { id: preferredPenId, barn: { farmId } }
      });
      if (pen) {
        return pen.id;
      }
    }

    const pens = await this.prisma.pen.findMany({
      where: { barn: { farmId } },
      include: {
        placements: {
          where: { endedAt: null },
          include: { batch: { select: { headcount: true } } }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });

    const scored = pens.map((pen) => {
      let occupancy = 0;
      for (const pl of pen.placements) {
        if (pl.animalId) {
          occupancy += 1;
        } else if (pl.batch) {
          occupancy += pl.batch.headcount;
        }
      }
      const capacity = pen.capacity ?? 0;
      const free =
        capacity > 0 ? Math.max(0, capacity - occupancy) : Number.MAX_SAFE_INTEGER;
      const fits = capacity <= 0 || free >= headcount;
      return { id: pen.id, occupancy, fits, free };
    });

    const emptyFit = scored.find((p) => p.occupancy === 0 && p.fits);
    if (emptyFit) {
      return emptyFit.id;
    }
    const anyFit = scored.find((p) => p.fits);
    return anyFit?.id ?? null;
  }

  async recordLitter(
    user: User,
    gestationId: string,
    dto: RecordLitterDto
  ) {
    const g = await this.prisma.gestation.findUnique({
      where: { id: gestationId },
      include: { sow: true, litter: true }
    });
    if (!g) {
      throw new NotFoundException();
    }
    await this.farmAccess.requireFarmAccess(user.id, g.farmId);
    await maintainLitterBatches(this.prisma, g.farmId);
    if (g.status !== GestationStatus.active) {
      throw new BadRequestException("Gestation déjà clôturée");
    }
    if (g.litter) {
      throw new BadRequestException("Mise bas déjà enregistrée");
    }

    const settings = await this.ensureSettings(g.farmId);
    const actualBirthDate = new Date(dto.actualBirthDate);
    const weaningDate = addUtcDays(
      startOfUtcDay(actualBirthDate),
      settings.weaningDurationDays
    );
    const stillborn = dto.stillborn ?? 0;
    const mummified = dto.mummified ?? 0;
    const neonatalDeaths = stillborn + mummified;

    const batchName = `Portée ${animalLabel(g.sow)} ${actualBirthDate.toISOString().slice(0, 10)}`;

    const penId =
      dto.bornAlive > 0
        ? await this.findPenForLitter(g.farmId, dto.bornAlive, dto.penId)
        : null;
    const pensToRecalculate = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
      const batch = await tx.livestockBatch.create({
        data: {
          farmId: g.farmId,
          speciesId: g.sow.speciesId,
          breedId: g.sow.breedId,
          name: batchName,
          categoryKey: "sous_mere",
          headcount: 0,
          avgBirthDate: actualBirthDate,
          sourceTag: `gestation:${gestationId}`,
          notes: dto.notes?.trim() || null
        }
      });

      const litter = await tx.litter.create({
        data: {
          gestationId,
          farmId: g.farmId,
          bornAlive: dto.bornAlive,
          stillborn,
          mummified,
          averageBirthWeightKg:
            dto.averageBirthWeightKg != null
              ? new Prisma.Decimal(dto.averageBirthWeightKg)
              : null,
          deliveryType: dto.deliveryType,
          vetAssistance: dto.vetAssistance ?? false,
          weaningDate,
          starterBatchId: batch.id,
          notes: dto.notes?.trim() || null,
          recordedAt: actualBirthDate
        }
      });

      await tx.gestation.update({
        where: { id: gestationId },
        data: {
          status: GestationStatus.completed,
          actualBirthDate
        }
      });

      await tx.animal.update({
        where: { id: g.sowId },
        data: { expectedFarrowingAt: null }
      });

      if (neonatalDeaths > 0) {
        const rec = await tx.farmHealthRecord.create({
          data: {
            farmId: g.farmId,
            kind: FarmHealthRecordKind.mortality,
            entityType: FarmHealthEntityType.group,
            entityId: batch.id,
            occurredAt: actualBirthDate,
            recordedByUserId: user.id,
            notes: `Mort-nés / momifiés — mise bas ${animalLabel(g.sow)}`
          }
        });
        const exit = await tx.livestockExit.create({
          data: {
            farmId: g.farmId,
            batchId: batch.id,
            kind: LivestockExitKind.mortality,
            occurredAt: actualBirthDate,
            recordedByUserId: user.id,
            headcountAffected: neonatalDeaths,
            deathCause: "unknown",
            note: `Néonatal: ${stillborn} mort-nés, ${mummified} momifiés`
          }
        });
        await tx.healthMortalityDetail.create({
          data: {
            healthRecordId: rec.id,
            cause: FarmMortalityCause.unknown,
            livestockExitId: exit.id
          }
        });
      }

      if (dto.bornAlive > 0 && penId) {
        const placed = await createLitterPigletsInTransaction(tx, {
          farmId: g.farmId,
          userId: user.id,
          batchId: batch.id,
          speciesId: g.sow.speciesId,
          breedId: g.sow.breedId,
          count: dto.bornAlive,
          birthDate: actualBirthDate,
          averageBirthWeightKg: dto.averageBirthWeightKg,
          penId,
          sowId: g.sowId,
          sireId: g.boarId,
          transferSowWithLitter: dto.transferSowWithLitter ?? true
        });
        for (const pid of placed.pensToRecalculate) {
          pensToRecalculate.add(pid);
        }
      }

      void litter;
    });

    if (pensToRecalculate.size > 0) {
      await this.prisma.$transaction(async (tx) => {
        for (const pid of pensToRecalculate) {
          await this.penAllocation.recalculatePenCategory(tx, pid);
          await this.penAllocation.recalculatePenAverageWeight(tx, pid);
        }
      });
    }

    await this.refreshAlerts(g.farmId);
    this.predictions.invalidateAndRegenerateAsync(g.farmId);
    return this.getOne(user, gestationId);
  }

  async administerVaccine(user: User, vaccineId: string) {
    const v = await this.prisma.gestationVaccine.findUnique({
      where: { id: vaccineId },
      include: { gestation: { include: { sow: true } } }
    });
    if (!v) {
      throw new NotFoundException();
    }
    await this.farmAccess.requireFarmAccess(user.id, v.gestation.farmId);
    const now = new Date();

    const healthRec = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.farmHealthRecord.create({
        data: {
          farmId: v.gestation.farmId,
          kind: FarmHealthRecordKind.vaccination,
          entityType: FarmHealthEntityType.animal,
          entityId: v.gestation.sowId,
          occurredAt: now,
          recordedByUserId: user.id,
          notes: `Gestation — ${v.vaccineName}`
        }
      });
      await tx.healthVaccinationDetail.create({
        data: {
          healthRecordId: rec.id,
          vaccineName: v.vaccineName
        }
      });
      await tx.gestationVaccine.update({
        where: { id: vaccineId },
        data: {
          status: GestationVaccineStatus.done,
          administeredDate: now,
          linkedHealthRecordId: rec.id
        }
      });
      return rec;
    });

    await this.refreshAlerts(v.gestation.farmId);
    return { vaccineId, healthRecordId: healthRec.id };
  }

  async toggleChecklist(
    user: User,
    itemId: string,
    isChecked: boolean
  ) {
    const item = await this.prisma.gestationChecklistItem.findUnique({
      where: { id: itemId },
      include: { gestation: true }
    });
    if (!item) {
      throw new NotFoundException();
    }
    await this.farmAccess.requireFarmAccess(user.id, item.gestation.farmId);
    return this.prisma.gestationChecklistItem.update({
      where: { id: itemId },
      data: {
        isChecked,
        checkedAt: isChecked ? new Date() : null
      }
    });
  }

  async listAvailableSows(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const settings = await this.ensureSettings(farmId);
    const sows = await this.prisma.animal.findMany({
      where: { farmId, sex: "female", status: "active" },
      select: {
        id: true,
        publicId: true,
        tagCode: true,
        photoUrl: true,
        expectedFarrowingAt: true,
        gestationsAsSow: {
          orderBy: { matingDate: "desc" },
          take: 5,
          include: { litter: true }
        }
      }
    });

    const items = [];
    for (const s of sows) {
      const activeG = s.gestationsAsSow.find(
        (g) => g.status === GestationStatus.active
      );
      if (activeG) {
        continue;
      }
      const last = s.gestationsAsSow.find(
        (g) => g.status === GestationStatus.completed
      );
      const lastBirth = last?.actualBirthDate ?? null;
      const weaningDate = last?.litter?.weaningDate ?? null;
      let daysSinceWeaning: number | null = null;
      let availability: "now" | "soon" = "now";
      let availableInDays = 0;

      if (weaningDate && weaningDate > new Date()) {
        availability = "soon";
        availableInDays = daysBetween(new Date(), weaningDate);
        if (availableInDays > 0) {
          continue;
        }
      }
      if (weaningDate) {
        daysSinceWeaning = daysBetween(weaningDate, new Date());
      }

      const gestationCount = await this.prisma.gestation.count({
        where: { farmId, sowId: s.id }
      });

      items.push({
        sowId: s.id,
        label: animalLabel(s),
        photoUrl: s.photoUrl,
        lastFarrowingDate: lastBirth?.toISOString() ?? null,
        gestationCount,
        daysSinceWeaning,
        availability,
        availableInDays
      });
    }

    void settings;
    return { items };
  }

  async getHistory(
    user: User,
    farmId: string,
    filter?: string
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const events: Array<{
      id: string;
      type: string;
      sowLabel: string;
      sowId: string;
      date: string;
      result?: string;
      notes?: string | null;
    }> = [];

    const gestations = await this.prisma.gestation.findMany({
      where: { farmId },
      include: {
        sow: { select: SOW_INCLUDE },
        litter: true,
        vaccines: true
      },
      orderBy: { matingDate: "desc" },
      take: 200
    });

    for (const g of gestations) {
      const label = animalLabel(g.sow);
      if (!filter || filter === "all" || filter === "mating") {
        events.push({
          id: `mating-${g.id}`,
          type: "mating",
          sowLabel: label,
          sowId: g.sowId,
          date: g.matingDate.toISOString(),
          result: g.matingType,
          notes: g.notes
        });
      }
      if (g.litter && (!filter || filter === "all" || filter === "farrowing")) {
        events.push({
          id: `farrowing-${g.id}`,
          type: "farrowing",
          sowLabel: label,
          sowId: g.sowId,
          date: (g.actualBirthDate ?? g.litter.recordedAt).toISOString(),
          result: `${g.litter.bornAlive} vivants`,
          notes: g.litter.notes
        });
      }
      if (
        (g.status === "aborted" || g.status === "lost") &&
        (!filter || filter === "all" || filter === "abortion")
      ) {
        events.push({
          id: `abort-${g.id}`,
          type: "abortion",
          sowLabel: label,
          sowId: g.sowId,
          date: g.updatedAt.toISOString(),
          result: g.status,
          notes: g.notes
        });
      }
      for (const v of g.vaccines.filter((x) => x.administeredDate)) {
        if (!filter || filter === "all" || filter === "vaccine") {
          events.push({
            id: `vac-${v.id}`,
            type: "vaccine",
            sowLabel: label,
            sowId: g.sowId,
            date: v.administeredDate!.toISOString(),
            result: v.vaccineName,
            notes: null
          });
        }
      }
    }

    events.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const stats = await this.getStats(user, farmId);
    return { events, stats };
  }

  async getStats(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);

    const totalGestations = await this.prisma.gestation.count({
      where: { farmId }
    });
    const litters = await this.prisma.litter.findMany({
      where: { farmId },
      select: {
        bornAlive: true,
        stillborn: true,
        mummified: true,
        gestation: { select: { sowId: true, sow: { select: SOW_INCLUDE } } }
      }
    });

    let sumAlive = 0;
    let sumDead = 0;
    let bestSow: { label: string; bornAlive: number } | null = null;

    for (const l of litters) {
      sumAlive += l.bornAlive;
      sumDead += l.stillborn + l.mummified;
      if (!bestSow || l.bornAlive > bestSow.bornAlive) {
        bestSow = {
          label: animalLabel(l.gestation.sow),
          bornAlive: l.bornAlive
        };
      }
    }

    const avgLitterSize =
      litters.length > 0 ? Math.round((sumAlive / litters.length) * 10) / 10 : null;
    const neonatalMortalityPct =
      sumAlive + sumDead > 0
        ? Math.round((sumDead / (sumAlive + sumDead)) * 1000) / 10
        : null;

    const completed = await this.prisma.gestation.findMany({
      where: { farmId, status: GestationStatus.completed },
      select: { sowId: true, actualBirthDate: true },
      orderBy: { actualBirthDate: "asc" }
    });
    const intervals: number[] = [];
    const bySow = new Map<string, Date[]>();
    for (const g of completed) {
      if (!g.actualBirthDate) {
        continue;
      }
      const arr = bySow.get(g.sowId) ?? [];
      arr.push(g.actualBirthDate);
      bySow.set(g.sowId, arr);
    }
    for (const dates of bySow.values()) {
      for (let i = 1; i < dates.length; i++) {
        intervals.push(daysBetween(dates[i - 1]!, dates[i]!));
      }
    }
    const avgDaysBetweenFarrowing =
      intervals.length > 0
        ? Math.round(
            intervals.reduce((a, b) => a + b, 0) / intervals.length
          )
        : null;

    const activeCount = await this.prisma.gestation.count({
      where: { farmId, status: GestationStatus.active }
    });
    const successPct =
      totalGestations > 0
        ? Math.round(
            ((await this.prisma.gestation.count({
              where: { farmId, status: GestationStatus.completed }
            })) /
              totalGestations) *
              1000
          ) / 10
        : null;

    return {
      totalGestations,
      activeGestations: activeCount,
      avgLitterSize,
      bestSow,
      matingSuccessPct: successPct,
      neonatalMortalityPct,
      avgDaysBetweenFarrowing
    };
  }

  async getSettings(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    return this.ensureSettings(farmId);
  }

  async updateSettings(
    user: User,
    farmId: string,
    dto: UpdateGestationSettingsDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.ensureSettings(farmId);
    return this.prisma.gestationSettings.update({
      where: { farmId },
      data: {
        gestationDurationDays: dto.gestationDurationDays,
        weaningDurationDays: dto.weaningDurationDays,
        vaccineSchedule:
          dto.vaccineSchedule != null
            ? (dto.vaccineSchedule as Prisma.InputJsonValue)
            : undefined
      }
    });
  }

  async getAiMatingPlan(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const { items: sows } = await this.listAvailableSows(user, farmId);
    const boars = await this.prisma.animal.findMany({
      where: { farmId, sex: "male", status: "active" },
      select: { id: true, tagCode: true, publicId: true }
    });
    const boarUsage = await Promise.all(
      boars.map(async (b) => {
        const count = await this.prisma.gestation.count({
          where: {
            farmId,
            boarId: b.id,
            matingDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        });
        return {
          id: b.id,
          label: b.tagCode ?? b.publicId.slice(0, 8),
          matingsLast30Days: count
        };
      })
    );

    const fallback = {
      recommendations: sows.slice(0, 5).map((s, i) => {
        const boar = boarUsage[i % Math.max(1, boarUsage.length)];
        const date = new Date();
        date.setDate(date.getDate() + i * 3);
        const birth = addUtcDays(date, DEFAULT_GESTATION_DAYS);
        return {
          sowId: s.sowId,
          sowLabel: s.label,
          boarId: boar?.id ?? null,
          boarLabel: boar?.label ?? null,
          suggestedDate: date.toISOString().slice(0, 10),
          expectedBirthDate: birth.toISOString().slice(0, 10),
          reason:
            s.availability === "now"
              ? "Truie disponible — prioriser le rythme de reproduction"
              : "Truie bientôt disponible"
        };
      }),
      aiPowered: false
    };

    if (!this.gemini.isConfigured() || sows.length === 0) {
      return fallback;
    }

    const prompt = `Tu es un expert en reproduction porcine. Propose un planning de saillie optimal. JSON uniquement :
{"recommendations":[{"sow_id":"uuid","boar_id":"uuid","suggested_date":"YYYY-MM-DD","reason":"string","expected_birth_date":"YYYY-MM-DD"}]}
Truies disponibles : ${JSON.stringify(sows.slice(0, 12))}
Verrats : ${JSON.stringify(boarUsage)}`;

    const raw = await this.gemini.generateText(prompt);
    if (!raw) {
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as {
        recommendations: Array<{
          sow_id: string;
          boar_id?: string;
          suggested_date: string;
          reason: string;
          expected_birth_date?: string;
        }>;
      };
      return {
        aiPowered: true,
        recommendations: (parsed.recommendations ?? []).map((r) => {
          const sow = sows.find((s) => s.sowId === r.sow_id);
          const boar = boarUsage.find((b) => b.id === r.boar_id);
          return {
            sowId: r.sow_id,
            sowLabel: sow?.label ?? r.sow_id.slice(0, 8),
            boarId: r.boar_id ?? null,
            boarLabel: boar?.label ?? null,
            suggestedDate: r.suggested_date,
            expectedBirthDate: r.expected_birth_date ?? null,
            reason: r.reason
          };
        })
      };
    } catch {
      return fallback;
    }
  }
}