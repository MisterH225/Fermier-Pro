import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmHealthRecordKind,
  VetAppointmentStatus,
  VetConsultationStatus
} from "@prisma/client";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { FarmHealthService } from "./farm-health.service";
import { FarmVaccineService } from "./farm-vaccine.service";

/**
 * Agrégat dossier élevage (vue vétérinaire) —
 * GET /farms/:farmId/vet-summary
 */
@Injectable()
export class VetFarmSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly farmHealth: FarmHealthService,
    private readonly farmVaccine: FarmVaccineService
  ) {}

  async getSummary(user: User, farmId: string) {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.healthRead,
      FARM_SCOPE.livestockRead,
      FARM_SCOPE.vetRead
    ]);

    const [
      health,
      vaccineCoverage,
      activeHeadcount,
      activeBatchesCount,
      lastAppointment,
      lastConsultation,
      lastHealthVetVisit
    ] = await Promise.all([
      this.farmHealth.getOverview(user, farmId),
      this.farmVaccine.getCoverage(user, farmId),
      this.prisma.animal.count({
        where: { farmId, status: "active" }
      }),
      this.prisma.livestockBatch.count({
        where: { farmId, status: "active" }
      }),
      this.prisma.vetAppointment.findFirst({
        where: {
          farmId,
          status: {
            in: [
              VetAppointmentStatus.APPOINTMENT_COMPLETED,
              VetAppointmentStatus.APPOINTMENT_RATED
            ]
          }
        },
        orderBy: { completedAt: "desc" },
        select: {
          id: true,
          reason: true,
          completedAt: true,
          status: true
        }
      }),
      this.prisma.vetConsultation.findFirst({
        where: {
          farmId,
          // Aligné sur lastAppointment : uniquement terminées (pas open/in_progress).
          status: VetConsultationStatus.resolved
        },
        orderBy: [{ closedAt: "desc" }, { openedAt: "desc" }],
        select: {
          id: true,
          subject: true,
          openedAt: true,
          closedAt: true,
          status: true
        }
      }),
      this.prisma.farmHealthRecord.findFirst({
        where: { farmId, kind: FarmHealthRecordKind.vet_visit },
        orderBy: { occurredAt: "desc" },
        select: {
          id: true,
          occurredAt: true,
          vetVisit: { select: { reason: true, vetName: true } }
        }
      })
    ]);

    const coverageRates = vaccineCoverage.items.map(
      (i) => i.stats.coverageRate
    );
    const vaccineCoveragePercent =
      coverageRates.length > 0
        ? Math.round(
            coverageRates.reduce((a, b) => a + b, 0) / coverageRates.length
          )
        : null;

    /**
     * TODO: brancher le calcul GMQ moyen via CheptelService.getGmqSummary
     * quand on voudra éviter le 2e appel mobile sur l'onglet Cheptel.
     */
    const avgGmqGPerDay: number | null = null;

    const lastVisitCandidates: Array<{
      at: string;
      label: string;
      source: "appointment" | "consultation" | "health_record";
      id: string;
    }> = [];
    if (lastAppointment?.completedAt) {
      lastVisitCandidates.push({
        id: lastAppointment.id,
        at: lastAppointment.completedAt.toISOString(),
        label: lastAppointment.reason,
        source: "appointment"
      });
    }
    if (lastConsultation) {
      lastVisitCandidates.push({
        id: lastConsultation.id,
        at: (
          lastConsultation.closedAt ?? lastConsultation.openedAt
        ).toISOString(),
        label: lastConsultation.subject,
        source: "consultation"
      });
    }
    if (lastHealthVetVisit) {
      lastVisitCandidates.push({
        id: lastHealthVetVisit.id,
        at: lastHealthVetVisit.occurredAt.toISOString(),
        label:
          lastHealthVetVisit.vetVisit?.reason ??
          lastHealthVetVisit.vetVisit?.vetName ??
          "Visite",
        source: "health_record"
      });
    }
    lastVisitCandidates.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
    );

    return {
      farmId,
      health: {
        activeDiseaseCount: health.activeDiseaseCount,
        overdueVaccineCount: health.overdueVaccineCount,
        activeTreatmentCount: health.activeTreatmentCount,
        globalHealthStatus: health.globalHealthStatus,
        mortalityRate30d: health.mortalityRate30d
      },
      vaccineCoveragePercent,
      livestock: {
        activeHeadcount,
        activeBatchesCount,
        avgGmqGPerDay
      },
      lastVisit: lastVisitCandidates[0] ?? null
    };
  }
}
