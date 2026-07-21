import { Injectable, Logger } from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  FarmHealthRecordKind,
  GestationStatus,
  LivestockExitKind,
  PenCategory,
  VetAppointmentStatus,
  VetConsultationStatus
} from "@prisma/client";
import { CheptelService } from "../cheptel/cheptel.service";
import { decimalToNum } from "../cheptel/cheptel-gmq.util";
import { FarmAccessService } from "../common/farm-access.service";
import { FARM_SCOPE } from "../common/farm-scopes.constants";
import { PrismaService } from "../prisma/prisma.service";
import { FarmHealthService } from "./farm-health.service";
import { FarmVaccineService } from "./farm-vaccine.service";
import {
  ageWeeksFromAvgBirth,
  buildBiosecurityBarns,
  buildGmqWeekly,
  buildHealthTimeline,
  buildMortalityMonthly,
  buildQuarantineCompliance,
  buildVetReadings,
  filterUpcomingFarrowings,
  resolveBatchStatus,
  resolveTargetGmq
} from "./vet-farm-summary.compute";
import type {
  VetBatchSummary,
  VetFarmSummaryResponse
} from "./vet-farm-summary.types";

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Seuil au-delà duquel on active le cache court (commentaire + mesure). */
const CACHE_PERF_THRESHOLD_MS = 300;

type CacheEntry = {
  expiresAt: number;
  value: VetFarmSummaryResponse;
};

/**
 * Agrégat dossier élevage (vue vétérinaire) —
 * GET /farms/:farmId/vet-summary
 *
 * Réutilise les données producteur existantes (health, cheptel, exits,
 * gestation, housing/pens, feed) — aucune nouvelle saisie.
 */
@Injectable()
export class VetFarmSummaryService {
  private readonly logger = new Logger(VetFarmSummaryService.name);
  /** Cache mémoire court (5 min) — activé seulement si le calcul dépasse ~300 ms. */
  private readonly cache = new Map<string, CacheEntry>();
  private cacheEnabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmAccess: FarmAccessService,
    private readonly farmHealth: FarmHealthService,
    private readonly farmVaccine: FarmVaccineService,
    private readonly cheptel: CheptelService
  ) {}

  async getSummary(user: User, farmId: string): Promise<VetFarmSummaryResponse> {
    await this.farmAccess.requireFarmAccess(user.id, farmId);
    await this.farmAccess.requireFarmScopes(user.id, farmId, [
      FARM_SCOPE.healthRead,
      FARM_SCOPE.livestockRead,
      FARM_SCOPE.vetRead
    ]);

    if (this.cacheEnabled) {
      const hit = this.cache.get(farmId);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.value;
      }
    }

    const started = Date.now();
    const value = await this.computeSummary(user, farmId);
    const elapsed = Date.now() - started;

    // Mesure avant d'optimiser : activer le cache seulement si > ~300 ms.
    if (elapsed > CACHE_PERF_THRESHOLD_MS) {
      if (!this.cacheEnabled) {
        this.logger.log(
          `vet-summary farm=${farmId} took ${elapsed}ms (>${CACHE_PERF_THRESHOLD_MS}ms) — enabling 5min cache`
        );
        this.cacheEnabled = true;
      }
      this.cache.set(farmId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value
      });
    } else {
      this.logger.debug(`vet-summary farm=${farmId} took ${elapsed}ms`);
    }

    return value;
  }

  /** Invalide le cache d'une ferme (tests / hooks futurs). */
  invalidateCache(farmId: string): void {
    this.cache.delete(farmId);
  }

  private async computeSummary(
    user: User,
    farmId: string
  ): Promise<VetFarmSummaryResponse> {
    const now = new Date();
    const since6m = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)
    );
    const since9w = new Date(now.getTime() - 9 * 7 * 86_400_000);
    const since30d = new Date(now.getTime() - 30 * 24 * 60_000 * 60);
    const farrowingHorizon = new Date(now.getTime() + 21 * 86_400_000);

    const [
      health,
      vaccineCoverage,
      activeHeadcount,
      activeBatchesCount,
      lastAppointment,
      lastConsultation,
      lastHealthVetVisit,
      gmqSummary,
      healthRecords,
      recentBatches,
      mortalityExits,
      weightRows,
      activeBatches,
      gmqSettings,
      diseaseByEntity,
      activeSows,
      activeGestations,
      littersForAvg,
      sucklingDeaths,
      sucklingBorn,
      barnsWithPens,
      quarantinePlacement,
      feedChecks30d,
      weightGainKg30d
    ] = await Promise.all([
      this.farmHealth.getOverview(user, farmId),
      this.farmVaccine.getCoverage(user, farmId),
      this.prisma.animal.count({ where: { farmId, status: "active" } }),
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
        where: { farmId, status: VetConsultationStatus.resolved },
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
      }),
      this.cheptel.getGmqSummary(user, farmId),
      this.prisma.farmHealthRecord.findMany({
        where: { farmId, occurredAt: { gte: since6m } },
        orderBy: { occurredAt: "desc" },
        take: 80,
        select: {
          occurredAt: true,
          kind: true,
          entityType: true,
          entityId: true,
          disease: {
            select: {
              diagnosis: true,
              severity: true,
              caseStatus: true
            }
          },
          vaccination: { select: { vaccineName: true } },
          vetVisit: { select: { reason: true, vetName: true } },
          treatment: { select: { drugName: true, endDate: true } },
          mortality: { select: { cause: true } }
        }
      }),
      this.prisma.livestockBatch.findMany({
        where: { farmId, createdAt: { gte: since6m } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, name: true, createdAt: true }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId,
          kind: LivestockExitKind.mortality,
          occurredAt: { gte: since6m }
        },
        select: { occurredAt: true, headcountAffected: true }
      }),
      this.prisma.animalWeight.findMany({
        where: {
          animal: { farmId, status: "active" },
          measuredAt: { gte: since9w }
        },
        orderBy: { measuredAt: "asc" },
        select: {
          animalId: true,
          weightKg: true,
          measuredAt: true
        }
      }),
      this.prisma.livestockBatch.findMany({
        where: { farmId, status: "active" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          categoryKey: true,
          headcount: true,
          avgBirthDate: true,
          members: {
            where: { status: "active" },
            select: { id: true }
          }
        }
      }),
      this.prisma.farmGmqSettings.findMany({
        where: { farmId },
        select: { categoryKey: true, targetGmqGPerDay: true }
      }),
      this.prisma.farmHealthRecord.findMany({
        where: {
          farmId,
          kind: FarmHealthRecordKind.disease,
          disease: { caseStatus: "active" }
        },
        select: { entityType: true, entityId: true }
      }),
      this.prisma.animal.count({
        where: {
          farmId,
          status: "active",
          OR: [
            { productionCategory: "breeding_female" },
            { expectedFarrowingAt: { not: null } }
          ]
        }
      }),
      this.prisma.gestation.findMany({
        where: { farmId, status: GestationStatus.active },
        select: {
          id: true,
          expectedBirthDate: true,
          sow: {
            select: { tagCode: true, publicId: true }
          }
        }
      }),
      this.prisma.litter.findMany({
        where: { farmId },
        select: { bornAlive: true },
        take: 200,
        orderBy: { recordedAt: "desc" }
      }),
      // Mortalité sous mère (approximée via sorties mortalité liées lots sous_mere)
      this.prisma.livestockExit.aggregate({
        where: {
          farmId,
          kind: LivestockExitKind.mortality,
          occurredAt: { gte: since6m },
          batch: {
            categoryKey: {
              in: ["sous_mere", "nursing", "lactation"]
            }
          }
        },
        _sum: { headcountAffected: true }
      }),
      this.prisma.litter.aggregate({
        where: { farmId, recordedAt: { gte: since6m } },
        _sum: { bornAlive: true }
      }),
      this.prisma.barn.findMany({
        where: { farmId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          pens: {
            where: { status: { not: "inactive" } },
            select: {
              id: true,
              capacity: true,
              category: true,
              placements: {
                where: { endedAt: null },
                select: {
                  animalId: true,
                  batchId: true,
                  batch: { select: { headcount: true, id: true } }
                }
              }
            }
          }
        }
      }),
      this.prisma.penPlacement.findFirst({
        where: {
          pen: {
            barn: { farmId },
            category: PenCategory.quarantine
          }
        },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          endedAt: true,
          pen: { select: { name: true } }
        }
      }),
      this.prisma.feedStockMovement.findMany({
        where: {
          farmId,
          kind: "stock_check",
          occurredAt: { gte: since30d }
        },
        select: {
          bagsConsumed: true,
          dailyConsumptionKg: true,
          daysSinceLastCheck: true,
          feedType: { select: { weightPerBagKg: true } }
        }
      }),
      this.prisma.animalWeight.findMany({
        where: {
          animal: { farmId, status: "active" },
          measuredAt: { gte: since30d }
        },
        orderBy: { measuredAt: "asc" },
        select: { animalId: true, weightKg: true, measuredAt: true }
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

    const gmqValues = gmqSummary.animals
      .map((a) => a.latestGmq ?? a.avgGmq)
      .filter((n): n is number => n != null && Number.isFinite(n));
    const avgGmqGPerDay =
      gmqValues.length > 0
        ? Math.round(gmqValues.reduce((a, b) => a + b, 0) / gmqValues.length)
        : null;

    // GMQ 30j : moyenne des GMQ entre première et dernière pesée sur 30 j
    const byAnimal30 = new Map<
      string,
      Array<{ kg: number; at: Date }>
    >();
    for (const w of weightGainKg30d) {
      const arr = byAnimal30.get(w.animalId) ?? [];
      arr.push({ kg: decimalToNum(w.weightKg), at: w.measuredAt });
      byAnimal30.set(w.animalId, arr);
    }
    const gmq30s: number[] = [];
    for (const arr of byAnimal30.values()) {
      if (arr.length < 2) {
        continue;
      }
      const first = arr[0]!;
      const last = arr[arr.length - 1]!;
      const days = (last.at.getTime() - first.at.getTime()) / 86_400_000;
      if (days <= 0) {
        continue;
      }
      gmq30s.push(((last.kg - first.kg) / days) * 1000);
    }
    const avgGmq30d =
      gmq30s.length > 0
        ? Math.round(gmq30s.reduce((a, b) => a + b, 0) / gmq30s.length)
        : null;

    // IC (FCR) = kg aliment consommé / kg gain — null si indisponible
    let totalGain = 0;
    let gainOk = false;
    for (const arr of byAnimal30.values()) {
      if (arr.length < 2) {
        continue;
      }
      const delta = arr[arr.length - 1]!.kg - arr[0]!.kg;
      if (delta > 0) {
        totalGain += delta;
        gainOk = true;
      }
    }
    let feedKg = 0;
    let feedOk = false;
    for (const c of feedChecks30d) {
      const bagW =
        c.feedType.weightPerBagKg != null
          ? decimalToNum(c.feedType.weightPerBagKg)
          : null;
      if (c.bagsConsumed != null && bagW != null && bagW > 0) {
        feedKg += decimalToNum(c.bagsConsumed) * bagW;
        feedOk = true;
      } else if (
        c.dailyConsumptionKg != null &&
        c.daysSinceLastCheck != null &&
        c.daysSinceLastCheck > 0
      ) {
        feedKg +=
          decimalToNum(c.dailyConsumptionKg) * c.daysSinceLastCheck;
        feedOk = true;
      }
    }
    const feedConversionIndex =
      feedOk && feedKg > 0 && gainOk && totalGain > 0
        ? Math.round((feedKg / totalGain) * 100) / 100
        : null;

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

    const healthTimeline = buildHealthTimeline(
      healthRecords,
      recentBatches,
      15
    );

    const mortalityMonthly = buildMortalityMonthly(
      mortalityExits,
      activeHeadcount,
      6,
      now
    );

    const gmqWeekSeries = buildGmqWeekly(
      weightRows.map((w) => ({
        animalId: w.animalId,
        weightKg: decimalToNum(w.weightKg),
        measuredAt: w.measuredAt
      })),
      8,
      now
    );

    const settingsNum = gmqSettings.map((s) => ({
      categoryKey: s.categoryKey,
      targetGmqGPerDay:
        s.targetGmqGPerDay != null ? decimalToNum(s.targetGmqGPerDay) : null
    }));
    const farmTargetGmq = resolveTargetGmq("finishing", settingsNum);

    const gmqByAnimal = new Map(
      gmqSummary.animals.map((a) => [
        a.animalId,
        a.latestGmq ?? a.avgGmq
      ])
    );

    // Cas actifs par lot (entity group) ou via animaux du lot
    const casesByBatch = new Map<string, number>();
    const animalToBatch = new Map<string, string>();
    for (const b of activeBatches) {
      for (const a of b.members) {
        animalToBatch.set(a.id, b.id);
      }
    }
    for (const d of diseaseByEntity) {
      if (d.entityType === "group" && d.entityId) {
        casesByBatch.set(
          d.entityId,
          (casesByBatch.get(d.entityId) ?? 0) + 1
        );
      } else if (d.entityType === "animal" && d.entityId) {
        const bid = animalToBatch.get(d.entityId);
        if (bid) {
          casesByBatch.set(bid, (casesByBatch.get(bid) ?? 0) + 1);
        }
      }
    }

    const peakCount =
      mortalityMonthly && mortalityMonthly.length > 0
        ? Math.max(...mortalityMonthly.map((m) => m.count))
        : 0;

    const batches: VetBatchSummary[] | null =
      activeBatches.length === 0
        ? null
        : activeBatches.map((b) => {
            const headcount = Math.max(b.headcount, b.members.length);
            const animalGmqs = b.members
              .map((a) => gmqByAnimal.get(a.id))
              .filter((n): n is number => n != null && Number.isFinite(n));
            const avgGmq =
              animalGmqs.length > 0
                ? Math.round(
                    animalGmqs.reduce((x, y) => x + y, 0) / animalGmqs.length
                  )
                : null;
            const targetGmq = resolveTargetGmq(b.categoryKey, settingsNum);
            const activeCases = casesByBatch.get(b.id) ?? 0;
            return {
              id: b.id,
              name: b.name,
              stage: b.categoryKey,
              headcount,
              ageWeeks: ageWeeksFromAvgBirth(b.avgBirthDate, now),
              avgGmq,
              targetGmq,
              activeCases,
              status: resolveBatchStatus({
                avgGmq,
                targetGmq,
                activeCases,
                mortalityPeak: peakCount > 0 && activeCases > 0
              })
            };
          });

    const avgBornAlive =
      littersForAvg.length > 0
        ? Math.round(
            (littersForAvg.reduce((a, l) => a + l.bornAlive, 0) /
              littersForAvg.length) *
              10
          ) / 10
        : null;

    const sucklingDead = sucklingDeaths._sum.headcountAffected ?? null;
    const sucklingBornSum = sucklingBorn._sum.bornAlive ?? null;
    const sucklingMortalityPercent =
      sucklingDead != null &&
      sucklingBornSum != null &&
      sucklingBornSum > 0
        ? Math.round((sucklingDead / sucklingBornSum) * 1000) / 10
        : null;

    const upcomingFarrowings = filterUpcomingFarrowings(
      activeGestations
        .filter((g) => g.expectedBirthDate <= farrowingHorizon)
        .map((g) => ({
          gestationId: g.id,
          sowLabel:
            g.sow.tagCode?.trim() || g.sow.publicId.slice(0, 10),
          expectedBirthDate: g.expectedBirthDate
        })),
      21,
      now
    );

    const reproduction =
      activeSows === 0 &&
      activeGestations.length === 0 &&
      avgBornAlive == null
        ? null
        : {
            activeSows: activeSows > 0 ? activeSows : null,
            ongoingGestations:
              activeGestations.length > 0 ? activeGestations.length : null,
            avgBornAlive,
            sucklingMortalityPercent,
            upcomingFarrowings
          };

    // Biosécurité bâtiments + occupation
    const barnBatchIds = new Map<string, string[]>();
    const biosecurityBarns = buildBiosecurityBarns(
      barnsWithPens.map((barn) => {
        const batchIds = new Set<string>();
        const pens = barn.pens.map((pen) => {
          let occupancy = 0;
          for (const pl of pen.placements) {
            if (pl.animalId) {
              occupancy += 1;
            } else if (pl.batchId) {
              occupancy += pl.batch?.headcount ?? 1;
              batchIds.add(pl.batchId);
            }
          }
          return { occupancy, capacity: pen.capacity };
        });
        barnBatchIds.set(barn.name, [...batchIds]);
        return { name: barn.name, pens };
      })
    );

    const quarantineCompliance = buildQuarantineCompliance(
      quarantinePlacement
        ? {
            startedAt: quarantinePlacement.startedAt,
            endedAt: quarantinePlacement.endedAt,
            penName: quarantinePlacement.pen.name
          }
        : null,
      undefined,
      now
    );

    const biosecurity =
      biosecurityBarns == null && quarantineCompliance == null
        ? null
        : {
            barns: biosecurityBarns,
            quarantineCompliance
          };

    const readings = buildVetReadings({
      batches: batches ?? [],
      mortalityMonthly,
      barns: biosecurityBarns,
      barnBatchIds,
      vaccineCoveragePercent,
      activeDiseaseCount: health.activeDiseaseCount
    });

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
        avgGmqGPerDay,
        avgGmq30d,
        feedConversionIndex
      },
      lastVisit: lastVisitCandidates[0] ?? null,
      healthTimeline,
      mortalityMonthly,
      gmqWeekly:
        gmqWeekSeries == null && farmTargetGmq == null
          ? null
          : { weeks: gmqWeekSeries, targetGmq: farmTargetGmq },
      batches,
      reproduction,
      biosecurity,
      readings
    };
  }
}
