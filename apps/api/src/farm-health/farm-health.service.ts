import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmDiseaseCaseStatus,
  FarmHealthEntityType,
  FarmHealthRecordKind,
  FarmMortalityCause,
  FinanceCategoryType,
  LivestockExitKind,
  Prisma
} from "@prisma/client";
import { AUDIT_ACTION } from "../common/audit.constants";
import { AuditService } from "../common/audit.service";
import { FarmAccessService } from "../common/farm-access.service";
import { ensureFarmFinanceBootstrap } from "../finance/finance-bootstrap";
import { FinanceService } from "../finance/finance.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateFarmHealthRecordDto } from "./dto/create-farm-health-record.dto";

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

@Injectable()
export class FarmHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly audit: AuditService,
    private readonly finance: FinanceService
  ) {}

  private async loadFarm(farmId: string) {
    const farm = await this.prisma.farm.findFirst({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException("Ferme introuvable");
    }
    return farm;
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

    const nextVet = await this.prisma.farmHealthRecord.findFirst({
      where: {
        farmId,
        kind: FarmHealthRecordKind.vet_visit,
        OR: [{ status: "planned" }, { occurredAt: { gte: now } }]
      },
      orderBy: { occurredAt: "asc" },
      include: { vetVisit: true }
    });

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

    const overdueVac = await this.prisma.healthVaccinationDetail.count({
      where: {
        healthRecord: { farmId },
        nextReminderAt: { lt: now }
      }
    });

    const alerts: string[] = [];
    if (overdueVac > 0) {
      alerts.push(`${overdueVac} rappel(s) vaccin en retard`);
    }

    const nextOpenVet = await this.prisma.vetConsultation.findFirst({
      where: {
        farmId,
        status: { in: ["open", "in_progress"] }
      },
      orderBy: { openedAt: "asc" },
      select: { id: true, subject: true, openedAt: true }
    });

    return {
      farmId,
      activeDiseaseCount,
      nextVaccine: nextVac
        ? {
            at: nextVac.nextReminderAt?.toISOString() ?? null,
            vaccineName: nextVac.vaccineName,
            healthRecordId: nextVac.healthRecord.id
          }
        : null,
      nextVetVisitModule: nextVet
        ? {
            at: nextVet.occurredAt.toISOString(),
            reason: nextVet.vetVisit?.reason ?? null,
            healthRecordId: nextVet.id
          }
        : null,
      nextVetConsultationLegacy: nextOpenVet
        ? {
            id: nextOpenVet.id,
            subject: nextOpenVet.subject,
            openedAt: nextOpenVet.openedAt.toISOString()
          }
        : null,
      mortalityRate30d,
      alerts
    };
  }

  async getUpcoming(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    const now = new Date();
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
      where: {
        farmId,
        kind: FarmHealthRecordKind.vet_visit,
        OR: [{ status: "planned" }, { occurredAt: { gte: now } }]
      },
      orderBy: { occurredAt: "asc" },
      take: 20,
      include: { vetVisit: true }
    });
    return { farmId, vaccines, vetVisits };
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
        const symptoms = d.symptoms;
        await tx.healthDiseaseDetail.create({
          data: {
            healthRecordId: rec.id,
            symptoms:
              symptoms != null && typeof symptoms === "object"
                ? (symptoms as Prisma.InputJsonValue)
                : undefined,
            diagnosis: str(d.diagnosis, 2000) ?? undefined,
            caseStatus: parseCaseStatus(d.caseStatus),
            linkedTreatmentRecordId: str(d.linkedTreatmentRecordId, 64) ?? undefined
          }
        });
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
}
