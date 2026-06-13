import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmDiseaseSeverity,
  FarmHealthEntityType,
  FarmHealthRecordKind,
  FarmMortalityCause,
  FinanceCategoryType,
  LivestockExitKind,
  Prisma,
  VetAppointmentStatus
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { FinanceService } from "../finance/finance.service";
import { PrismaService } from "../prisma/prisma.service";
import { SmartAlertsService } from "../smart-alerts/smart-alerts.service";
import { CreateFarmHealthRecordDto } from "./dto/create-farm-health-record.dto";
import { CreateDiseaseCaseDto } from "./dto/create-disease-case.dto";
import { AddDiseaseTreatmentDto } from "./dto/add-disease-treatment.dto";
import { UpdateDiseaseCaseDto } from "./dto/update-disease-case.dto";
import { FarmVaccineService } from "./farm-vaccine.service";
import {
  buildDiseaseDetailData,
  syncAnimalHealthStatus
} from "./disease-health.helper";

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown, max = 2000): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
}

function parseCaseStatus(raw: unknown): FarmDiseaseCaseStatus {
  const s = str(raw, 32);
  if (s && (Object.values(FarmDiseaseCaseStatus) as string[]).includes(s)) {
    return s as FarmDiseaseCaseStatus;
  }
  return FarmDiseaseCaseStatus.active;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

function emptyMonthSeries(keys: string[]): Record<string, number> {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

const ACTIVE_VET_APPOINTMENT_STATUSES: VetAppointmentStatus[] = [
  VetAppointmentStatus.APPOINTMENT_REQUESTED,
  VetAppointmentStatus.AWAITING_PAYMENT,
  VetAppointmentStatus.APPOINTMENT_CONFIRMED,
  VetAppointmentStatus.APPOINTMENT_IN_PROGRESS
];

function upcomingPlannedVetVisitWhere(farmId: string, now: Date) {
  return {
    farmId,
    kind: FarmHealthRecordKind.vet_visit,
    status: "planned",
    occurredAt: { gte: now }
  };
}

type NextVetVisitPayload = {
  at: string;
  reason: string | null;
  healthRecordId: string | null;
  appointmentId: string | null;
  source: "health_record" | "vet_appointment";
  appointmentStatus: string | null;
  vetName: string | null;
};

@Injectable()
export class FarmHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService,
    private readonly smartAlerts: SmartAlertsService,
    private readonly farmVaccine: FarmVaccineService
  ) {}

  private async loadFarm(farmId: string) {
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    return farm;
  }

  private async expirePastPlannedVetVisits(farmId: string, now: Date) {
    await this.prisma.farmHealthRecord.updateMany({
      where: {
        farmId,
        kind: FarmHealthRecordKind.vet_visit,
        status: "planned",
        occurredAt: { lt: now }
      },
      data: { status: "missed" }
    });
  }

  private async resolveNextVetVisit(
    farmId: string,
    now: Date
  ): Promise<NextVetVisitPayload | null> {
    await this.expirePastPlannedVetVisits(farmId, now);
    const [healthNext, apptNext] = await Promise.all([
      this.prisma.farmHealthRecord.findFirst({
        where: upcomingPlannedVetVisitWhere(farmId, now),
        orderBy: { occurredAt: "asc" },
        include: { vetVisit: true }
      }),
      this.prisma.vetAppointment.findFirst({
        where: {
          farmId,
          status: { in: ACTIVE_VET_APPOINTMENT_STATUSES }
        },
        orderBy: [{ confirmedAt: "asc" }, { requestedAt: "asc" }],
        include: {
          vetProfile: { select: { fullName: true } }
        }
      })
    ]);

    type Candidate = {
      at: Date;
      reason: string | null;
      healthRecordId: string | null;
      appointmentId: string | null;
      source: "health_record" | "vet_appointment";
      appointmentStatus: string | null;
      vetName: string | null;
    };

    const candidates: Candidate[] = [];
    if (healthNext) {
      candidates.push({
        at: healthNext.occurredAt,
        reason: healthNext.vetVisit?.reason ?? null,
        healthRecordId: healthNext.id,
        appointmentId: null,
        source: "health_record",
        appointmentStatus: null,
        vetName: healthNext.vetVisit?.vetName ?? null
      });
    }
    if (apptNext) {
      candidates.push({
        at: apptNext.confirmedAt ?? apptNext.requestedAt,
        reason: apptNext.reason,
        healthRecordId: null,
        appointmentId: apptNext.id,
        source: "vet_appointment",
        appointmentStatus: apptNext.status,
        vetName: apptNext.vetProfile.fullName ?? null
      });
    }

    if (!candidates.length) {
      return null;
    }

    candidates.sort((a, b) => a.at.getTime() - b.at.getTime());
    const best = candidates[0]!;
    return {
      at: best.at.toISOString(),
      reason: best.reason,
      healthRecordId: best.healthRecordId,
      appointmentId: best.appointmentId,
      source: best.source,
      appointmentStatus: best.appointmentStatus,
      vetName: best.vetName
    };
  }

  private async assertEntityOnFarm(
    farmId: string,
    mode: string,
    entityType: FarmHealthEntityType,
    entityId: string
  ) {
    if (mode === "individual") {
      if (entityType !== FarmHealthEntityType.animal) {
        throw new BadRequestException(
          "Mode individuel : le sujet doit etre un animal"
        );
      }
      const a = await this.prisma.animal.findFirst({
        where: { id: entityId, farmId }
      });
      if (!a) {
        throw new BadRequestException("Animal introuvable sur cette ferme");
      }
      return;
    }
    if (mode === "batch") {
      if (entityType !== FarmHealthEntityType.group) {
        throw new BadRequestException(
          "Mode bande : le sujet doit etre une bande (groupe)"
        );
      }
      const b = await this.prisma.livestockBatch.findFirst({
        where: { id: entityId, farmId }
      });
      if (!b) {
        throw new BadRequestException("Bande introuvable sur cette ferme");
      }
      return;
    }
    if (entityType === FarmHealthEntityType.animal) {
      const a = await this.prisma.animal.findFirst({
        where: { id: entityId, farmId }
      });
      if (!a) {
        throw new BadRequestException("Animal introuvable sur cette ferme");
      }
    } else {
      const b = await this.prisma.livestockBatch.findFirst({
        where: { id: entityId, farmId }
      });
      if (!b) {
        throw new BadRequestException("Bande introuvable sur cette ferme");
      }
    }
  }

  async listEvents(
    user: User,
    farmId: string,
    q: {
      kind?: FarmHealthRecordKind;
      status?: string;
      from?: string;
      to?: string;
    }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const where: Prisma.FarmHealthRecordWhereInput = { farmId };
    if (q.kind) {
      where.kind = q.kind;
    }
    if (q.status) {
      where.status = q.status;
    }
    if (q.from || q.to) {
      where.occurredAt = {};
      if (q.from) {
        where.occurredAt.gte = new Date(q.from);
      }
      if (q.to) {
        where.occurredAt.lte = new Date(q.to);
      }
    }
    return this.prisma.farmHealthRecord.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      include: {
        vaccination: true,
        disease: true,
        vetVisit: true,
        treatment: true,
        mortality: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      },
      take: 200
    });
  }

  async getOverview(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeDiseaseCount = await this.prisma.farmHealthRecord.count({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        disease: { caseStatus: FarmDiseaseCaseStatus.active }
      }
    });

    const nextVac = await this.prisma.healthVaccinationDetail.findFirst({
      where: {
        healthRecord: { farmId },
        nextReminderAt: { gte: now }
      },
      orderBy: { nextReminderAt: "asc" },
      include: {
        healthRecord: {
          select: {
            id: true,
            entityType: true,
            entityId: true,
            occurredAt: true
          }
        }
      }
    });

    const nextVet = await this.resolveNextVetVisit(farmId, now);

    const mortalAgg = await this.prisma.livestockExit.aggregate({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since30 }
      },
      _sum: { headcountAffected: true }
    });
    const dead = mortalAgg._sum.headcountAffected ?? 0;
    const activeHead = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });
    const mortalityRate30d =
      activeHead + dead > 0
        ? (dead / Math.max(1, activeHead + dead)).toFixed(4)
        : "0";

    const nextOpenVet = await this.prisma.vetConsultation.findFirst({
      where: {
        farmId,
        status: { in: ["open", "in_progress"] }
      },
      orderBy: { openedAt: "asc" },
      select: { id: true, subject: true, openedAt: true }
    });

    const overdueVaccineCount =
      await this.farmVaccine.countOverdueAdministrations(user, farmId);

    const activeTreatmentCount = await this.prisma.healthTreatmentDetail.count({
      where: {
        healthRecord: { farmId },
        OR: [{ endDate: null }, { endDate: { gte: now } }]
      }
    });

    const months = lastMonthKeys(6);
    const since6m = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const mortalityExits = await this.prisma.livestockExit.findMany({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since6m }
      },
      select: { occurredAt: true, headcountAffected: true }
    });

    const healthRecords6m = await this.prisma.farmHealthRecord.findMany({
      where: { farmId, occurredAt: { gte: since6m } },
      select: {
        kind: true,
        occurredAt: true,
        disease: { select: { caseStatus: true } },
        mortality: { select: { cause: true } },
        vaccination: { select: { nextReminderAt: true } }
      }
    });

    const mortalityByMonth = emptyMonthSeries(months);
    for (const ex of mortalityExits) {
      const k = monthKey(ex.occurredAt);
      if (k in mortalityByMonth) {
        mortalityByMonth[k] += ex.headcountAffected ?? 1;
      }
    }

    const diseaseNewByMonth = emptyMonthSeries(months);
    const diseaseResolvedByMonth = emptyMonthSeries(months);
    const vaccinationsDoneByMonth = emptyMonthSeries(months);
    const vaccinationsPlannedByMonth = emptyMonthSeries(months);
    const mortalityCauseCounts: Record<string, number> = {
      disease: 0,
      accident: 0,
      unknown: 0,
      other: 0
    };

    for (const rec of healthRecords6m) {
      const k = monthKey(rec.occurredAt);
      if (!(k in diseaseNewByMonth)) {
        continue;
      }
      if (rec.kind === FarmHealthRecordKind.disease) {
        diseaseNewByMonth[k] += 1;
        if (rec.disease?.caseStatus === FarmDiseaseCaseStatus.recovered) {
          diseaseResolvedByMonth[k] += 1;
        }
      }
      if (rec.kind === FarmHealthRecordKind.vaccination) {
        vaccinationsDoneByMonth[k] += 1;
        if (rec.vaccination?.nextReminderAt) {
          const pk = monthKey(rec.vaccination.nextReminderAt);
          if (pk in vaccinationsPlannedByMonth) {
            vaccinationsPlannedByMonth[pk] += 1;
          }
        }
      }
      if (rec.kind === FarmHealthRecordKind.mortality && rec.mortality) {
        const cause = rec.mortality.cause;
        if (cause in mortalityCauseCounts) {
          mortalityCauseCounts[cause] += 1;
        }
      }
    }

    const activeHeadForRate = activeHead + dead;
    const mortalityPct30 =
      activeHeadForRate > 0 ? (dead / activeHeadForRate) * 100 : 0;

    let globalHealthStatus: "good" | "warning" | "critical" = "good";
    if (
      overdueVaccineCount > 0 ||
      activeDiseaseCount > 0 ||
      activeTreatmentCount > 0
    ) {
      globalHealthStatus = "warning";
    }
    if (
      mortalityPct30 > 5 ||
      activeDiseaseCount >= 3 ||
      overdueVaccineCount >= 5
    ) {
      globalHealthStatus = "critical";
    }

    const toSeries = (map: Record<string, number>) =>
      months.map((month) => ({ month, value: map[month] ?? 0 }));

    return {
      farmId,
      activeDiseaseCount,
      overdueVaccineCount,
      activeTreatmentCount,
      globalHealthStatus,
      nextVaccine: nextVac
        ? {
            at: nextVac.nextReminderAt?.toISOString() ?? null,
            vaccineName: nextVac.vaccineName,
            healthRecordId: nextVac.healthRecord.id
          }
        : null,
      nextVetVisitModule: nextVet,
      nextVetConsultationLegacy: nextOpenVet
        ? {
            id: nextOpenVet.id,
            subject: nextOpenVet.subject,
            openedAt: nextOpenVet.openedAt.toISOString()
          }
        : null,
      mortalityRate30d,
      charts: {
        mortalityHeadcount: toSeries(mortalityByMonth),
        diseaseNew: toSeries(diseaseNewByMonth),
        diseaseResolved: toSeries(diseaseResolvedByMonth),
        vaccinationsDone: toSeries(vaccinationsDoneByMonth),
        vaccinationsPlanned: toSeries(vaccinationsPlannedByMonth),
        mortalityCauses: Object.entries(mortalityCauseCounts).map(
          ([cause, value]) => ({ cause, value })
        )
      }
    };
  }

  async getUpcoming(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
    await this.expirePastPlannedVetVisits(farmId, now);
    const vaccines = await this.prisma.healthVaccinationDetail.findMany({
      where: {
        healthRecord: { farmId },
        nextReminderAt: { gte: now }
      },
      orderBy: { nextReminderAt: "asc" },
      take: 30,
      include: {
        healthRecord: {
          select: { id: true, entityType: true, entityId: true }
        }
      }
    });
    const vetVisits = await this.prisma.farmHealthRecord.findMany({
      where: upcomingPlannedVetVisitWhere(farmId, now),
      orderBy: { occurredAt: "asc" },
      take: 20,
      include: { vetVisit: true }
    });
    const vetAppointments = await this.prisma.vetAppointment.findMany({
      where: {
        farmId,
        status: { in: ACTIVE_VET_APPOINTMENT_STATUSES }
      },
      orderBy: [{ confirmedAt: "asc" }, { requestedAt: "asc" }],
      take: 20,
      include: {
        vetProfile: { select: { fullName: true } }
      }
    });
    return {
      farmId,
      vaccines,
      vetVisits,
      vetAppointments: vetAppointments.map((a) => ({
        id: a.id,
        status: a.status,
        requestedAt: a.requestedAt.toISOString(),
        confirmedAt: a.confirmedAt?.toISOString() ?? null,
        reason: a.reason,
        vetName: a.vetProfile.fullName ?? null
      }))
    };
  }

  async getMortalityRate(user: User, farmId: string, period?: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const days = period === "90" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const mortalAgg = await this.prisma.livestockExit.aggregate({
      where: {
        farmId,
        kind: LivestockExitKind.mortality,
        occurredAt: { gte: since }
      },
      _sum: { headcountAffected: true }
    });
    const dead = mortalAgg._sum.headcountAffected ?? 0;
    const activeHead = await this.prisma.animal.count({
      where: { farmId, status: "active" }
    });
    const rate =
      activeHead + dead > 0
        ? (dead / Math.max(1, activeHead + dead)).toFixed(4)
        : "0";
    return { farmId, periodDays: days, headcountLost: dead, rate };
  }

  private async healthExpenseCategoryId(farmId: string) {
    await ensureFarmFinanceBootstrap(this.prisma, farmId);
    const c = await this.prisma.financeCategory.findFirst({
      where: {
        farmId,
        type: FinanceCategoryType.expense,
        key: "health"
      }
    });
    return c?.id ?? null;
  }

  async createRecord(user: User, farmId: string, dto: CreateFarmHealthRecordDto) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const farm = await this.loadFarm(farmId);
    await this.assertEntityOnFarm(
      farmId,
      farm.livestockMode,
      dto.entityType,
      dto.entityId
    );

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const d = dto.detail;

    const base: Prisma.FarmHealthRecordUncheckedCreateInput = {
      farmId,
      kind: dto.kind,
      entityType: dto.entityType,
      entityId: dto.entityId,
      occurredAt,
      status: dto.status?.trim() || "completed",
      notes: dto.notes?.trim() ?? null,
      attachmentUrl: dto.attachmentUrl?.trim() ?? null,
      recordedByUserId: user.id
    };

    const row = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.farmHealthRecord.create({ data: base });

      if (dto.kind === FarmHealthRecordKind.vaccination) {
        const vaccineName = str(d.vaccineName, 200);
        if (!vaccineName) {
          throw new BadRequestException("vaccineName requis");
        }
        const nextReminderAt = str(d.nextReminderAt, 40)
          ? new Date(String(d.nextReminderAt))
          : null;
        await tx.healthVaccinationDetail.create({
          data: {
            healthRecordId: rec.id,
            vaccineName,
            vaccineType: str(d.vaccineType, 120),
            dose:
              num(d.dose) != null
                ? new Prisma.Decimal(num(d.dose)!)
                : null,
            doseUnit: str(d.doseUnit, 32),
            practitioner: str(d.practitioner, 200),
            nextReminderAt,
            reminderDays: num(d.reminderDays) ?? null
          }
        });
      } else if (dto.kind === FarmHealthRecordKind.disease) {
        const detail = buildDiseaseDetailData(d, parseCaseStatus);
        await tx.healthDiseaseDetail.create({
          data: {
            healthRecordId: rec.id,
            symptoms: detail.symptoms,
            diagnosis: detail.diagnosis ?? undefined,
            caseStatus: detail.caseStatus,
            severity: detail.severity ?? undefined,
            durationEstimate: detail.durationEstimate ?? undefined,
            inIsolation: detail.inIsolation ?? false,
            treatmentOngoing: detail.treatmentOngoing ?? false,
            resolvedAt: detail.resolvedAt ?? undefined,
            linkedTreatmentRecordId:
              detail.linkedTreatmentRecordId ?? undefined
          }
        });
        if (dto.entityType === FarmHealthEntityType.animal) {
          await syncAnimalHealthStatus(tx, dto.entityId);
        }
      } else if (dto.kind === FarmHealthRecordKind.vet_visit) {
        const vetName = str(d.vetName, 200);
        const reason = str(d.reason, 500);
        if (!vetName || !reason) {
          throw new BadRequestException("vetName et reason requis");
        }
        await tx.healthVetVisitDetail.create({
          data: {
            healthRecordId: rec.id,
            vetName,
            vetContact: str(d.vetContact, 200) ?? undefined,
            reason,
            report: str(d.report, 8000) ?? undefined,
            prescriptionUrl: str(d.prescriptionUrl, 2000) ?? undefined,
            cost:
              num(d.cost) != null
                ? new Prisma.Decimal(num(d.cost)!)
                : undefined
          }
        });
      } else if (dto.kind === FarmHealthRecordKind.treatment) {
        const drugName = str(d.drugName, 200);
        if (!drugName) {
          throw new BadRequestException("drugName requis");
        }
        const startDate = str(d.startDate, 40)
          ? new Date(String(d.startDate))
          : occurredAt;
        await tx.healthTreatmentDetail.create({
          data: {
            healthRecordId: rec.id,
            drugName,
            dosage: str(d.dosage, 120) ?? undefined,
            unit: str(d.unit, 32) ?? undefined,
            frequency: str(d.frequency, 120) ?? undefined,
            startDate,
            endDate: str(d.endDate, 40)
              ? new Date(String(d.endDate))
              : undefined,
            cost:
              num(d.cost) != null
                ? new Prisma.Decimal(num(d.cost)!)
                : undefined
          }
        });
      } else if (dto.kind === FarmHealthRecordKind.mortality) {
        const causeRaw = str(d.cause, 32)?.toLowerCase();
        const cause = (Object.values(FarmMortalityCause) as string[]).includes(
          causeRaw ?? ""
        )
          ? (causeRaw as FarmMortalityCause)
          : FarmMortalityCause.unknown;
        const headcount = num(d.headcountAffected) ?? 1;

        const exit = await tx.livestockExit.create({
          data: {
            farmId,
            animalId:
              dto.entityType === FarmHealthEntityType.animal
                ? dto.entityId
                : null,
            batchId:
              dto.entityType === FarmHealthEntityType.group
                ? dto.entityId
                : null,
            kind: LivestockExitKind.mortality,
            occurredAt,
            recordedByUserId: user.id,
            headcountAffected:
              dto.entityType === FarmHealthEntityType.group
                ? Math.max(1, Math.round(headcount))
                : 1,
            deathCause: cause,
            note: dto.notes?.trim() || null
          }
        });

        await tx.healthMortalityDetail.create({
          data: {
            healthRecordId: rec.id,
            cause,
            linkedDiseaseRecordId: str(d.linkedDiseaseRecordId, 64) ?? undefined,
            livestockExitId: exit.id
          }
        });

        if (dto.entityType === FarmHealthEntityType.animal) {
          await tx.animal.update({
            where: { id: dto.entityId },
            data: { status: "dead" }
          });
        }
      } else {
        throw new BadRequestException("Type inconnu");
      }

      return rec;
    });

    if (dto.kind === FarmHealthRecordKind.vet_visit) {
      const cost = num(d.cost);
      if (cost != null && cost > 0) {
        const catId = await this.healthExpenseCategoryId(farmId);
        const exp = await this.finance.createExpense(user, farmId, {
          amount: cost,
          label: `Honoraires véto — ${str(d.vetName, 200) ?? "Visite"}`,
          note: `Santé record ${row.id}`,
          financeCategoryId: catId ?? undefined,
          linkedEntityType: "health_record",
          linkedEntityId: row.id
        });
        await this.prisma.healthVetVisitDetail.update({
          where: { healthRecordId: row.id },
          data: { financeExpenseId: exp.id }
        });
      }
    }

    if (dto.kind === FarmHealthRecordKind.treatment) {
      const cost = num(d.cost);
      if (cost != null && cost > 0) {
        const catId = await this.healthExpenseCategoryId(farmId);
        const exp = await this.finance.createExpense(user, farmId, {
          amount: cost,
          label: `Médicaments — ${str(d.drugName, 200) ?? "Traitement"}`,
          note: `Santé record ${row.id}`,
          financeCategoryId: catId ?? undefined,
          linkedEntityType: "health_record",
          linkedEntityId: row.id
        });
        await this.prisma.healthTreatmentDetail.update({
          where: { healthRecordId: row.id },
          data: { financeExpenseId: exp.id }
        });
      }
    }

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordCreated,
      resourceType: "FarmHealthRecord",
      resourceId: row.id,
      metadata: { kind: dto.kind, entityType: dto.entityType }
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return this.prisma.farmHealthRecord.findUniqueOrThrow({
      where: { id: row.id },
      include: {
        vaccination: true,
        disease: true,
        vetVisit: true,
        treatment: true,
        mortality: true
      }
    });
  }

  async linkExpense(user: User, farmId: string, recordId: string, expenseId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: { id: recordId, farmId },
      include: { vetVisit: true, treatment: true }
    });
    if (!rec) {
      throw new NotFoundException("Dossier introuvable");
    }
    const exp = await this.prisma.farmExpense.findFirst({
      where: { id: expenseId, farmId }
    });
    if (!exp) {
      throw new NotFoundException("Depense introuvable");
    }
    if (rec.kind === FarmHealthRecordKind.vet_visit && rec.vetVisit) {
      await this.prisma.healthVetVisitDetail.update({
        where: { healthRecordId: recordId },
        data: { financeExpenseId: expenseId }
      });
    } else if (rec.kind === FarmHealthRecordKind.treatment && rec.treatment) {
      await this.prisma.healthTreatmentDetail.update({
        where: { healthRecordId: recordId },
        data: { financeExpenseId: expenseId }
      });
    } else {
      throw new BadRequestException(
        "Liaison reservee aux visites véto ou traitements"
      );
    }
    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordLinkedFinance,
      resourceType: "FarmHealthRecord",
      resourceId: recordId,
      metadata: { expenseId }
    });
    return { ok: true };
  }

  async deleteRecord(user: User, farmId: string, recordId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: { id: recordId, farmId },
      include: { mortality: true, vetVisit: true }
    });
    if (!rec) {
      throw new NotFoundException("Dossier introuvable");
    }
    if (rec.kind !== FarmHealthRecordKind.vet_visit) {
      throw new BadRequestException(
        "Seules les visites vétérinaires peuvent être supprimées"
      );
    }
    if (rec.mortality) {
      throw new BadRequestException("Dossier lié à une mortalité");
    }
    if (rec.vetVisit?.financeExpenseId) {
      throw new BadRequestException(
        "Visite liée à une dépense — retirez le lien finance avant suppression"
      );
    }
    const deletableStatuses = new Set(["planned", "missed"]);
    if (!deletableStatuses.has(rec.status)) {
      throw new BadRequestException(
        "Seules les visites planifiées ou manquées peuvent être supprimées"
      );
    }

    await this.prisma.farmHealthRecord.delete({ where: { id: recordId } });

    await this.audit.record({
      actorUserId: user.id,
      farmId,
      action: AUDIT_ACTION.farmHealthRecordDeleted,
      resourceType: "FarmHealthRecord",
      resourceId: recordId,
      metadata: { kind: rec.kind }
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);
    return { ok: true };
  }

  /** Alias POST pour clients / proxies qui bloquent DELETE. */
  async dismissPlannedVetVisit(user: User, farmId: string, recordId: string) {
    return this.deleteRecord(user, farmId, recordId);
  }

  async createDiseaseCase(
    user: User,
    farmId: string,
    dto: CreateDiseaseCaseDto
  ) {
    if (!dto.symptoms?.length) {
      throw new BadRequestException("symptoms requis");
    }
    const noteParts = [
      dto.notes?.trim(),
      dto.treatmentOngoing && dto.treatmentNotes?.trim()
        ? `Traitement: ${dto.treatmentNotes.trim()}`
        : null,
      dto.isolationPenId?.trim()
        ? `Isolement loge: ${dto.isolationPenId.trim()}`
        : null
    ].filter(Boolean);

    return this.createRecord(user, farmId, {
      kind: FarmHealthRecordKind.disease,
      entityType: dto.entityType,
      entityId: dto.entityId,
      occurredAt: dto.occurredAt ?? `${dto.estimatedOnsetDate.slice(0, 10)}T12:00:00.000Z`,
      notes: noteParts.length ? noteParts.join("\n") : undefined,
      detail: {
        symptoms: { tags: dto.symptoms },
        diagnosis: dto.diagnosis?.trim() || undefined,
        caseStatus: FarmDiseaseCaseStatus.active,
        severity: dto.severity,
        durationEstimate: dto.durationEstimate,
        inIsolation: dto.inIsolation === true,
        treatmentOngoing: dto.treatmentOngoing === true
      }
    });
  }

  async resolveDiseaseCase(user: User, farmId: string, recordId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: {
        id: recordId,
        farmId,
        kind: FarmHealthRecordKind.disease
      },
      include: { disease: true }
    });
    if (!rec?.disease) {
      throw new NotFoundException("Cas maladie introuvable");
    }
    if (rec.disease.caseStatus !== FarmDiseaseCaseStatus.active) {
      throw new BadRequestException("Ce cas est déjà clos");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.healthDiseaseDetail.update({
        where: { healthRecordId: recordId },
        data: {
          caseStatus: FarmDiseaseCaseStatus.recovered,
          resolvedAt: now
        }
      });
      if (rec.entityType === FarmHealthEntityType.animal) {
        await syncAnimalHealthStatus(tx, rec.entityId);
      }
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return this.prisma.farmHealthRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: {
        disease: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async getDiseasesOverview(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    );

    const [activeCases, resolvedThisMonth, isolationCount, activeHead, rows] =
      await Promise.all([
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            disease: { caseStatus: FarmDiseaseCaseStatus.active }
          }
        }),
        this.prisma.farmHealthRecord.count({
          where: {
            farmId,
            kind: FarmHealthRecordKind.disease,
            disease: {
              caseStatus: FarmDiseaseCaseStatus.recovered,
              resolvedAt: { gte: monthStart }
            }
          }
        }),
        this.prisma.healthDiseaseDetail.count({
          where: {
            caseStatus: FarmDiseaseCaseStatus.active,
            inIsolation: true,
            healthRecord: { farmId, kind: FarmHealthRecordKind.disease }
          }
        }),
        this.prisma.animal.count({
          where: { farmId, status: "active" }
        }),
        this.prisma.healthDiseaseDetail.findMany({
          where: {
            caseStatus: FarmDiseaseCaseStatus.active,
            healthRecord: { farmId, kind: FarmHealthRecordKind.disease }
          },
          select: { diagnosis: true, symptoms: true, severity: true }
        })
      ]);

    const labelCounts = new Map<string, number>();
    for (const row of rows) {
      const tags = (row.symptoms as { tags?: string[] } | null)?.tags;
      const label =
        row.diagnosis?.trim() ||
        (Array.isArray(tags) && tags[0]?.trim()) ||
        "Autre";
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }

    const pieChart = [...labelCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

    const diseaseRatePct =
      activeHead > 0
        ? Math.round((activeCases / activeHead) * 1000) / 10
        : 0;

    return {
      farmId,
      kpis: {
        activeCases,
        resolvedThisMonth,
        diseaseRatePct,
        isolationCount
      },
      pieChart
    };
  }

  private diseaseHistoryCutoff(period?: string): Date | null {
    const now = new Date();
    const p = period?.trim().toLowerCase();
    if (!p || p === "all") {
      return null;
    }
    if (p === "month") {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (p === "3m") {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }
    if (p === "6m") {
      return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    }
    return null;
  }

  async getDiseaseHistory(
    user: User,
    farmId: string,
    query: { period?: string }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const cutoff = this.diseaseHistoryCutoff(query.period);

    const records = await this.prisma.farmHealthRecord.findMany({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        disease: {
          caseStatus: {
            in: [
              FarmDiseaseCaseStatus.recovered,
              FarmDiseaseCaseStatus.dead,
              FarmDiseaseCaseStatus.slaughtered
            ]
          },
          ...(cutoff ? { resolvedAt: { gte: cutoff } } : {})
        }
      },
      orderBy: { occurredAt: "desc" },
      include: {
        disease: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      },
      take: 200
    });

    const treatmentIds = records
      .map((r) => r.disease?.linkedTreatmentRecordId)
      .filter((id): id is string => Boolean(id));

    const treatments =
      treatmentIds.length > 0
        ? await this.prisma.farmHealthRecord.findMany({
            where: { id: { in: treatmentIds } },
            include: { treatment: true }
          })
        : [];
    const treatmentById = new Map(treatments.map((t) => [t.id, t]));

    return records.map((rec) => {
      const disease = rec.disease!;
      const resolvedAt = disease.resolvedAt ?? rec.occurredAt;
      const durationMs = resolvedAt.getTime() - rec.occurredAt.getTime();
      const durationDays = Math.max(
        1,
        Math.ceil(durationMs / (24 * 60 * 60 * 1000))
      );
      const linked = disease.linkedTreatmentRecordId
        ? treatmentById.get(disease.linkedTreatmentRecordId)
        : null;
      return {
        id: rec.id,
        farmId: rec.farmId,
        kind: rec.kind,
        entityType: rec.entityType,
        entityId: rec.entityId,
        occurredAt: rec.occurredAt.toISOString(),
        status: rec.status,
        notes: rec.notes,
        attachmentUrl: rec.attachmentUrl,
        disease: {
          diagnosis: disease.diagnosis,
          caseStatus: disease.caseStatus,
          severity: disease.severity,
          durationEstimate: disease.durationEstimate,
          inIsolation: disease.inIsolation,
          treatmentOngoing: disease.treatmentOngoing,
          resolvedAt: resolvedAt.toISOString(),
          symptoms: disease.symptoms,
          linkedTreatmentRecordId: disease.linkedTreatmentRecordId
        },
        recorder: rec.recorder,
        durationDays,
        treatmentLabel: linked?.treatment?.drugName ?? null
      };
    });
  }

  async getActiveDiseaseCases(
    user: User,
    farmId: string,
    query: { severity?: string; isolation?: string }
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const sev = query.severity?.trim().toLowerCase();
    const severityFilter =
      sev &&
      (Object.values(FarmDiseaseSeverity) as string[]).includes(sev)
        ? (sev as FarmDiseaseSeverity)
        : undefined;
    const isolationOnly = query.isolation === "true" || query.isolation === "1";

    return this.prisma.farmHealthRecord.findMany({
      where: {
        farmId,
        kind: FarmHealthRecordKind.disease,
        disease: {
          caseStatus: FarmDiseaseCaseStatus.active,
          ...(severityFilter ? { severity: severityFilter } : {}),
          ...(isolationOnly ? { inIsolation: true } : {})
        }
      },
      orderBy: { occurredAt: "desc" },
      include: {
        disease: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      },
      take: 200
    });
  }

  async updateDiseaseCase(
    user: User,
    farmId: string,
    recordId: string,
    dto: UpdateDiseaseCaseDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: {
        id: recordId,
        farmId,
        kind: FarmHealthRecordKind.disease
      },
      include: { disease: true }
    });
    if (!rec?.disease) {
      throw new NotFoundException("Cas maladie introuvable");
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.notes !== undefined) {
        await tx.farmHealthRecord.update({
          where: { id: recordId },
          data: { notes: dto.notes?.trim() || null }
        });
      }
      await tx.healthDiseaseDetail.update({
        where: { healthRecordId: recordId },
        data: {
          ...(dto.symptoms?.length
            ? { symptoms: { tags: dto.symptoms } as Prisma.InputJsonValue }
            : {}),
          ...(dto.diagnosis !== undefined
            ? { diagnosis: dto.diagnosis.trim() || null }
            : {}),
          ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
          ...(dto.durationEstimate !== undefined
            ? { durationEstimate: dto.durationEstimate.trim() || null }
            : {}),
          ...(dto.treatmentOngoing !== undefined
            ? { treatmentOngoing: dto.treatmentOngoing }
            : {}),
          ...(dto.inIsolation !== undefined
            ? { inIsolation: dto.inIsolation }
            : {})
        }
      });
      if (
        rec.entityType === FarmHealthEntityType.animal &&
        rec.disease?.caseStatus === "active"
      ) {
        await syncAnimalHealthStatus(tx, rec.entityId);
      }
    });

    return this.prisma.farmHealthRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: {
        disease: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async addTreatmentToDiseaseCase(
    user: User,
    farmId: string,
    recordId: string,
    dto: AddDiseaseTreatmentDto
  ) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: {
        id: recordId,
        farmId,
        kind: FarmHealthRecordKind.disease,
        disease: { caseStatus: FarmDiseaseCaseStatus.active }
      },
      include: { disease: true }
    });
    if (!rec?.disease) {
      throw new NotFoundException("Cas maladie actif introuvable");
    }

    const drugName = dto.drugName.trim();
    if (!drugName) {
      throw new BadRequestException("drugName requis");
    }

    const now = new Date();
    const treatmentRec = await this.prisma.$transaction(async (tx) => {
      const treatment = await tx.farmHealthRecord.create({
        data: {
          farmId,
          kind: FarmHealthRecordKind.treatment,
          entityType: rec.entityType,
          entityId: rec.entityId,
          occurredAt: now,
          status: "completed",
          notes: dto.notes?.trim() || null,
          recordedByUserId: user.id
        }
      });
      await tx.healthTreatmentDetail.create({
        data: {
          healthRecordId: treatment.id,
          drugName,
          dosage: dto.dosage?.trim() || null,
          startDate: now
        }
      });
      await tx.healthDiseaseDetail.update({
        where: { healthRecordId: recordId },
        data: {
          treatmentOngoing: true,
          linkedTreatmentRecordId: treatment.id
        }
      });
      return treatment;
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return this.prisma.farmHealthRecord.findUniqueOrThrow({
      where: { id: treatmentRec.id },
      include: {
        treatment: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }

  async declareDiseaseDeath(user: User, farmId: string, recordId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const rec = await this.prisma.farmHealthRecord.findFirst({
      where: {
        id: recordId,
        farmId,
        kind: FarmHealthRecordKind.disease
      },
      include: { disease: true }
    });
    if (!rec?.disease) {
      throw new NotFoundException("Cas maladie introuvable");
    }
    if (rec.disease.caseStatus !== FarmDiseaseCaseStatus.active) {
      throw new BadRequestException("Ce cas est déjà clos");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.healthDiseaseDetail.update({
        where: { healthRecordId: recordId },
        data: {
          caseStatus: FarmDiseaseCaseStatus.dead,
          resolvedAt: now,
          treatmentOngoing: false
        }
      });

      const mortRec = await tx.farmHealthRecord.create({
        data: {
          farmId,
          kind: FarmHealthRecordKind.mortality,
          entityType: rec.entityType,
          entityId: rec.entityId,
          occurredAt: now,
          status: "completed",
          recordedByUserId: user.id
        }
      });

      const exit = await tx.livestockExit.create({
        data: {
          farmId,
          animalId:
            rec.entityType === FarmHealthEntityType.animal ? rec.entityId : null,
          batchId:
            rec.entityType === FarmHealthEntityType.group ? rec.entityId : null,
          kind: LivestockExitKind.mortality,
          occurredAt: now,
          recordedByUserId: user.id,
          headcountAffected: 1,
          deathCause: FarmMortalityCause.disease,
          note: `Décès lié au cas maladie ${recordId}`
        }
      });

      await tx.healthMortalityDetail.create({
        data: {
          healthRecordId: mortRec.id,
          cause: FarmMortalityCause.disease,
          linkedDiseaseRecordId: recordId,
          livestockExitId: exit.id
        }
      });

      if (rec.entityType === FarmHealthEntityType.animal) {
        await tx.animal.update({
          where: { id: rec.entityId },
          data: { status: "dead", healthStatus: "healthy" }
        });
      }
    });

    void this.smartAlerts.refreshInternal(farmId).catch(() => undefined);

    return this.prisma.farmHealthRecord.findUniqueOrThrow({
      where: { id: recordId },
      include: {
        disease: true,
        recorder: { select: { id: true, fullName: true, email: true } }
      }
    });
  }
}
