import { Injectable, Logger } from "@nestjs/common";
import {
  GestationStatus,
  LivestockExitKind,
  MatingType,
  Prisma
} from "@prisma/client";
import { gmqBetween } from "../cheptel/cheptel-gmq.util";
import { PrismaService } from "../prisma/prisma.service";
import { addUtcDays, startOfUtcDay } from "./region-stats-date.util";
import {
  daysBetween,
  normalizeDiagnosis,
  type ExitKindAgg
} from "./region-stats-p28.util";

type JsonRecord = Record<string, number>;

function emptyRecord(): JsonRecord {
  return {};
}

function incRecord(rec: JsonRecord, key: string, delta = 1): void {
  rec[key] = (rec[key] ?? 0) + delta;
}

function avgRecord(sums: Map<string, { total: number; count: number }>): JsonRecord {
  const out: JsonRecord = {};
  for (const [key, { total, count }] of sums) {
    if (count > 0) {
      out[key] = Math.round((total / count) * 100) / 100;
    }
  }
  return out;
}

function decimalToNum(v: Prisma.Decimal | null | undefined): number | null {
  if (v == null) {
    return null;
  }
  return typeof v === "object" && "toNumber" in v
    ? (v as Prisma.Decimal).toNumber()
    : Number(v);
}

function emptyExitKind(): ExitKindAgg {
  return { headcount: 0, totalWeightKg: 0, totalPriceXof: 0 };
}

function ensureExitKind(
  map: Record<string, ExitKindAgg>,
  kind: string
): ExitKindAgg {
  if (!map[kind]) {
    map[kind] = emptyExitKind();
  }
  return map[kind];
}

function weightedAvgFromSum(
  sumDays: number,
  count: number
): number | null {
  if (count <= 0) return null;
  return Math.round((sumDays / count) * 100) / 100;
}

export type RegionStatsDailyPayload = {
  date: Date;
  departmentCode: string;
  farmCount: number;
  animalCountByCategory: JsonRecord;
  mortalityHeadcount: number;
  mortalityByCause: JsonRecord;
  littersCount: number;
  bornAlive: number;
  stillborn: number;
  mummifiedTotal: number;
  weanedEstimate: number;
  avgGmqByCategory: JsonRecord;
  exitsSaleHeadcount: number;
  exitsSaleAvgPricePerKg: number | null;
  exitsSlaughterHeadcount: number;
  vetConsultationsCount: number;
  gestationsCompleted: number;
  gestationsAborted: number;
  gestationsLost: number;
  matingsNatural: number;
  matingsAI: number;
  activeSowsCount: number;
  farrowingIntervalSumDays: number;
  farrowingIntervalCount: number;
  gestationNumberSum: number;
  gestationNumberCount: number;
  diseaseSuspicionsByDiagnosis: JsonRecord;
  animalsByHealthStatus: JsonRecord;
  herdCountForIncidence: number;
  exitsByKind: Record<string, ExitKindAgg>;
  avgAgeAtSaleDays: number | null;
  exitsSaleForAgeCount: number;
  avgAgeAtSlaughterDays: number | null;
  exitsSlaughterForAgeCount: number;
  avgAgeAtDeathDays: number | null;
  exitsDeathForAgeCount: number;
  avgFatteningDurationDays: number | null;
  fatteningDurationCount: number;
  sowCullsCount: number;
  activeFarmsCount: number;
  activeUsersByRole: JsonRecord;
};

/**
 * Snapshot RegionStatsDaily (P-11 + P-28).
 *
 * Proxy dates / exclusions documentés :
 * - Fausses couches (aborted/lost) : filtre sur Gestation.updatedAt du jour
 *   (pas de champ de date de fin dédié dans le schéma).
 * - Âges à la sortie : uniquement sorties avec animalId individuel ;
 *   les sorties bande (batch) comptent dans exitsByKind mais sont exclues
 *   des moyennes d'âge / durée d'engraissement.
 */
@Injectable()
export class RegionStatsSnapshotService {
  private readonly log = new Logger(RegionStatsSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Agrège la veille (UTC). */
  async snapshotYesterday(): Promise<void> {
    const yesterday = addUtcDays(startOfUtcDay(new Date()), -1);
    await this.snapshotForDate(yesterday);
  }

  /** Backfill idempotent sur une plage [from, to] inclusive (dates UTC). */
  async backfillRange(from: Date, to: Date): Promise<void> {
    let cursor = startOfUtcDay(from);
    const end = startOfUtcDay(to);
    while (cursor.getTime() <= end.getTime()) {
      await this.snapshotForDate(cursor);
      cursor = addUtcDays(cursor, 1);
    }
  }

  async snapshotForDate(date: Date): Promise<void> {
    const dayStart = startOfUtcDay(date);
    const dayEnd = addUtcDays(dayStart, 1);
    const payloads = await this.aggregateDay(dayStart, dayEnd);

    for (const row of payloads) {
      await this.prisma.regionStatsDaily.upsert({
        where: {
          date_departmentCode: {
            date: row.date,
            departmentCode: row.departmentCode
          }
        },
        create: this.toPrismaCreate(row),
        update: this.toPrismaUpdate(row)
      });
    }

    this.log.log(
      `RegionStatsDaily — ${payloads.length} département(s) pour ${dayStart.toISOString().slice(0, 10)}`
    );
  }

  private toPrismaCreate(row: RegionStatsDailyPayload): Prisma.RegionStatsDailyCreateInput {
    return {
      date: row.date,
      departmentCode: row.departmentCode,
      farmCount: row.farmCount,
      animalCountByCategory: row.animalCountByCategory,
      mortalityHeadcount: row.mortalityHeadcount,
      mortalityByCause: row.mortalityByCause,
      littersCount: row.littersCount,
      bornAlive: row.bornAlive,
      stillborn: row.stillborn,
      mummifiedTotal: row.mummifiedTotal,
      weanedEstimate: row.weanedEstimate,
      avgGmqByCategory: row.avgGmqByCategory,
      exitsSaleHeadcount: row.exitsSaleHeadcount,
      exitsSaleAvgPricePerKg:
        row.exitsSaleAvgPricePerKg != null
          ? new Prisma.Decimal(row.exitsSaleAvgPricePerKg)
          : null,
      exitsSlaughterHeadcount: row.exitsSlaughterHeadcount,
      vetConsultationsCount: row.vetConsultationsCount,
      gestationsCompleted: row.gestationsCompleted,
      gestationsAborted: row.gestationsAborted,
      gestationsLost: row.gestationsLost,
      matingsNatural: row.matingsNatural,
      matingsAI: row.matingsAI,
      activeSowsCount: row.activeSowsCount,
      farrowingIntervalSumDays: row.farrowingIntervalSumDays,
      farrowingIntervalCount: row.farrowingIntervalCount,
      gestationNumberSum: row.gestationNumberSum,
      gestationNumberCount: row.gestationNumberCount,
      diseaseSuspicionsByDiagnosis: row.diseaseSuspicionsByDiagnosis,
      animalsByHealthStatus: row.animalsByHealthStatus,
      herdCountForIncidence: row.herdCountForIncidence,
      exitsByKind: row.exitsByKind,
      avgAgeAtSaleDays: row.avgAgeAtSaleDays,
      exitsSaleForAgeCount: row.exitsSaleForAgeCount,
      avgAgeAtSlaughterDays: row.avgAgeAtSlaughterDays,
      exitsSlaughterForAgeCount: row.exitsSlaughterForAgeCount,
      avgAgeAtDeathDays: row.avgAgeAtDeathDays,
      exitsDeathForAgeCount: row.exitsDeathForAgeCount,
      avgFatteningDurationDays: row.avgFatteningDurationDays,
      fatteningDurationCount: row.fatteningDurationCount,
      sowCullsCount: row.sowCullsCount,
      activeFarmsCount: row.activeFarmsCount,
      activeUsersByRole: row.activeUsersByRole
    };
  }

  private toPrismaUpdate(row: RegionStatsDailyPayload): Prisma.RegionStatsDailyUpdateInput {
    const create = this.toPrismaCreate(row);
    const { date: _d, departmentCode: _c, ...update } = create;
    return update;
  }

  private async aggregateDay(
    dayStart: Date,
    dayEnd: Date
  ): Promise<RegionStatsDailyPayload[]> {
    const farms = await this.prisma.farm.findMany({
      where: {
        departmentCode: { not: null },
        status: "active"
      },
      select: { id: true, departmentCode: true }
    });

    const farmDept = new Map<string, string>();
    const deptFarmIds = new Map<string, Set<string>>();
    for (const farm of farms) {
      if (!farm.departmentCode) {
        continue;
      }
      farmDept.set(farm.id, farm.departmentCode);
      if (!deptFarmIds.has(farm.departmentCode)) {
        deptFarmIds.set(farm.departmentCode, new Set());
      }
      deptFarmIds.get(farm.departmentCode)!.add(farm.id);
    }

    const farmIds = [...farmDept.keys()];
    if (farmIds.length === 0) {
      return [];
    }

    const activeWindowStart = addUtcDays(dayEnd, -30);

    const [
      animals,
      dayExits,
      littersBorn,
      littersWeaned,
      vetConsultations,
      animalWeights,
      batchWeights,
      gestationsEnded,
      matingsDay,
      completedBirths,
      diseaseRecords,
      mortalityHealth,
      activeExitFarms,
      activeLitterFarms,
      activeGestationFarms,
      activeHealthFarms,
      activeWeightFarms,
      activeExpenseFarms
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId: { in: farmIds }, status: "active" },
        select: {
          farmId: true,
          productionCategory: true,
          healthStatus: true
        }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId: { in: farmIds },
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          animalId: true,
          kind: true,
          headcountAffected: true,
          deathCause: true,
          price: true,
          weightKg: true,
          occurredAt: true,
          animal: {
            select: {
              birthDate: true,
              entryDate: true,
              productionCategory: true
            }
          }
        }
      }),
      this.prisma.litter.findMany({
        where: {
          farmId: { in: farmIds },
          recordedAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          bornAlive: true,
          stillborn: true,
          mummified: true
        }
      }),
      this.prisma.litter.findMany({
        where: {
          farmId: { in: farmIds },
          weaningDate: { gte: dayStart, lt: dayEnd }
        },
        select: { farmId: true, bornAlive: true }
      }),
      this.prisma.vetConsultation.findMany({
        where: {
          farmId: { in: farmIds },
          openedAt: { gte: dayStart, lt: dayEnd }
        },
        select: { farmId: true }
      }),
      this.prisma.animalWeight.findMany({
        where: {
          measuredAt: { gte: dayStart, lt: dayEnd },
          animal: { farmId: { in: farmIds } }
        },
        select: {
          weightKg: true,
          measuredAt: true,
          animal: {
            select: {
              farmId: true,
              productionCategory: true,
              weights: {
                where: { measuredAt: { lt: dayEnd } },
                orderBy: { measuredAt: "asc" },
                select: { weightKg: true, measuredAt: true }
              }
            }
          }
        }
      }),
      this.prisma.livestockBatchWeight.findMany({
        where: {
          measuredAt: { gte: dayStart, lt: dayEnd },
          batch: { farmId: { in: farmIds } }
        },
        select: {
          avgWeightKg: true,
          measuredAt: true,
          batch: {
            select: {
              farmId: true,
              categoryKey: true,
              weights: {
                where: { measuredAt: { lt: dayEnd } },
                orderBy: { measuredAt: "asc" },
                select: { avgWeightKg: true, measuredAt: true }
              }
            }
          }
        }
      }),
      /**
       * Proxy date de fin : updatedAt du jour pour gestations terminées
       * (completed / aborted / lost). Pas de endedAt dédié.
       */
      this.prisma.gestation.findMany({
        where: {
          farmId: { in: farmIds },
          status: {
            in: [
              GestationStatus.completed,
              GestationStatus.aborted,
              GestationStatus.lost
            ]
          },
          updatedAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          status: true,
          gestationNumber: true,
          sowId: true,
          actualBirthDate: true
        }
      }),
      this.prisma.gestation.findMany({
        where: {
          farmId: { in: farmIds },
          matingDate: { gte: dayStart, lt: dayEnd }
        },
        select: { farmId: true, matingType: true }
      }),
      this.prisma.gestation.findMany({
        where: {
          farmId: { in: farmIds },
          status: GestationStatus.completed,
          actualBirthDate: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          sowId: true,
          actualBirthDate: true
        }
      }),
      this.prisma.farmHealthRecord.findMany({
        where: {
          farmId: { in: farmIds },
          kind: "disease",
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          disease: { select: { diagnosis: true } }
        }
      }),
      this.prisma.farmHealthRecord.findMany({
        where: {
          farmId: { in: farmIds },
          kind: "mortality",
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          mortality: { select: { cause: true } }
        }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId: { in: farmIds },
          occurredAt: { gte: activeWindowStart, lt: dayEnd }
        },
        select: { farmId: true },
        distinct: ["farmId"]
      }),
      this.prisma.litter.findMany({
        where: {
          farmId: { in: farmIds },
          recordedAt: { gte: activeWindowStart, lt: dayEnd }
        },
        select: { farmId: true },
        distinct: ["farmId"]
      }),
      this.prisma.gestation.findMany({
        where: {
          farmId: { in: farmIds },
          OR: [
            { createdAt: { gte: activeWindowStart, lt: dayEnd } },
            { updatedAt: { gte: activeWindowStart, lt: dayEnd } }
          ]
        },
        select: { farmId: true },
        distinct: ["farmId"]
      }),
      this.prisma.farmHealthRecord.findMany({
        where: {
          farmId: { in: farmIds },
          occurredAt: { gte: activeWindowStart, lt: dayEnd }
        },
        select: { farmId: true },
        distinct: ["farmId"]
      }),
      this.prisma.animalWeight.findMany({
        where: {
          measuredAt: { gte: activeWindowStart, lt: dayEnd },
          animal: { farmId: { in: farmIds } }
        },
        select: { animal: { select: { farmId: true } } }
      }),
      this.prisma.farmExpense.findMany({
        where: {
          farmId: { in: farmIds },
          occurredAt: { gte: activeWindowStart, lt: dayEnd }
        },
        select: { farmId: true },
        distinct: ["farmId"]
      })
    ]);

    const activeOwners = await this.prisma.user.findMany({
      where: {
        lastActiveAt: { gte: activeWindowStart, lt: dayEnd },
        ownedFarms: { some: { id: { in: farmIds } } }
      },
      select: {
        id: true,
        profiles: { select: { type: true } },
        ownedFarms: {
          where: { id: { in: farmIds } },
          select: { id: true, departmentCode: true }
        }
      }
    });

    type AgeAcc = { sumDays: number; count: number };
    type DeptAcc = {
      farmCount: number;
      animalCountByCategory: JsonRecord;
      mortalityHeadcount: number;
      mortalityByCause: JsonRecord;
      littersCount: number;
      bornAlive: number;
      stillborn: number;
      mummifiedTotal: number;
      weanedEstimate: number;
      gmqSums: Map<string, { total: number; count: number }>;
      exitsSaleHeadcount: number;
      salePriceKgSum: number;
      saleWeightKgSum: number;
      exitsSlaughterHeadcount: number;
      vetConsultationsCount: number;
      gestationsCompleted: number;
      gestationsAborted: number;
      gestationsLost: number;
      matingsNatural: number;
      matingsAI: number;
      activeSowsCount: number;
      farrowingIntervalSumDays: number;
      farrowingIntervalCount: number;
      gestationNumberSum: number;
      gestationNumberCount: number;
      diseaseSuspicionsByDiagnosis: JsonRecord;
      animalsByHealthStatus: JsonRecord;
      herdCountForIncidence: number;
      exitsByKind: Record<string, ExitKindAgg>;
      ageSale: AgeAcc;
      ageSlaughter: AgeAcc;
      ageDeath: AgeAcc;
      fattening: AgeAcc;
      sowCullsCount: number;
      activeFarmIds: Set<string>;
      activeUsersByRole: JsonRecord;
      activeUserKeys: Set<string>;
    };

    const acc = new Map<string, DeptAcc>();

    const ensure = (departmentCode: string): DeptAcc => {
      let row = acc.get(departmentCode);
      if (!row) {
        row = {
          farmCount: deptFarmIds.get(departmentCode)?.size ?? 0,
          animalCountByCategory: emptyRecord(),
          mortalityHeadcount: 0,
          mortalityByCause: emptyRecord(),
          littersCount: 0,
          bornAlive: 0,
          stillborn: 0,
          mummifiedTotal: 0,
          weanedEstimate: 0,
          gmqSums: new Map(),
          exitsSaleHeadcount: 0,
          salePriceKgSum: 0,
          saleWeightKgSum: 0,
          exitsSlaughterHeadcount: 0,
          vetConsultationsCount: 0,
          gestationsCompleted: 0,
          gestationsAborted: 0,
          gestationsLost: 0,
          matingsNatural: 0,
          matingsAI: 0,
          activeSowsCount: 0,
          farrowingIntervalSumDays: 0,
          farrowingIntervalCount: 0,
          gestationNumberSum: 0,
          gestationNumberCount: 0,
          diseaseSuspicionsByDiagnosis: emptyRecord(),
          animalsByHealthStatus: emptyRecord(),
          herdCountForIncidence: 0,
          exitsByKind: {},
          ageSale: { sumDays: 0, count: 0 },
          ageSlaughter: { sumDays: 0, count: 0 },
          ageDeath: { sumDays: 0, count: 0 },
          fattening: { sumDays: 0, count: 0 },
          sowCullsCount: 0,
          activeFarmIds: new Set(),
          activeUsersByRole: emptyRecord(),
          activeUserKeys: new Set()
        };
        acc.set(departmentCode, row);
      }
      return row;
    };

    for (const [departmentCode, ids] of deptFarmIds) {
      const row = ensure(departmentCode);
      row.farmCount = ids.size;
    }

    for (const animal of animals) {
      const dept = farmDept.get(animal.farmId);
      if (!dept) continue;
      const row = ensure(dept);
      incRecord(row.animalCountByCategory, animal.productionCategory);
      incRecord(row.animalsByHealthStatus, animal.healthStatus);
      row.herdCountForIncidence += 1;
      if (animal.productionCategory === "breeding_female") {
        row.activeSowsCount += 1;
      }
    }

    for (const exit of dayExits) {
      const dept = farmDept.get(exit.farmId);
      if (!dept) continue;
      const row = ensure(dept);
      const heads = exit.headcountAffected ?? 1;
      const kindKey = exit.kind;
      const bucket = ensureExitKind(row.exitsByKind, kindKey);
      bucket.headcount += heads;
      const weight = decimalToNum(exit.weightKg);
      const price = decimalToNum(exit.price);
      if (weight != null && weight > 0) {
        bucket.totalWeightKg += weight;
      }
      if (price != null) {
        bucket.totalPriceXof += price;
      }

      if (exit.kind === LivestockExitKind.mortality) {
        row.mortalityHeadcount += heads;
        const cause = exit.deathCause?.trim() || "non_renseigne";
        incRecord(row.mortalityByCause, cause, heads);
      }
      if (exit.kind === LivestockExitKind.sale) {
        row.exitsSaleHeadcount += heads;
        if (weight != null && weight > 0 && price != null) {
          row.saleWeightKgSum += weight;
          row.salePriceKgSum += price / weight;
        }
      }
      if (exit.kind === LivestockExitKind.slaughter) {
        row.exitsSlaughterHeadcount += heads;
      }

      if (exit.animal?.productionCategory === "breeding_female") {
        row.sowCullsCount += heads;
      }

      // Âges : individuels uniquement (batch exclus).
      if (exit.animalId && exit.animal) {
        const origin =
          exit.animal.birthDate ??
          (exit.animal.entryDate ? new Date(exit.animal.entryDate) : null);
        if (origin) {
          const ageDays = daysBetween(origin, exit.occurredAt);
          if (exit.kind === LivestockExitKind.sale) {
            row.ageSale.sumDays += ageDays;
            row.ageSale.count += 1;
          } else if (exit.kind === LivestockExitKind.slaughter) {
            row.ageSlaughter.sumDays += ageDays;
            row.ageSlaughter.count += 1;
          } else if (exit.kind === LivestockExitKind.mortality) {
            row.ageDeath.sumDays += ageDays;
            row.ageDeath.count += 1;
          }
        }
        if (exit.animal.entryDate) {
          const fatDays = daysBetween(
            new Date(exit.animal.entryDate),
            exit.occurredAt
          );
          row.fattening.sumDays += fatDays;
          row.fattening.count += 1;
        }
      }
    }

    for (const rec of mortalityHealth) {
      const dept = farmDept.get(rec.farmId);
      if (!dept) continue;
      const cause = rec.mortality?.cause ?? "unknown";
      incRecord(ensure(dept).mortalityByCause, cause, 1);
    }

    for (const litter of littersBorn) {
      const dept = farmDept.get(litter.farmId);
      if (!dept) continue;
      const row = ensure(dept);
      row.littersCount += 1;
      row.bornAlive += litter.bornAlive;
      row.stillborn += litter.stillborn;
      row.mummifiedTotal += litter.mummified;
    }

    for (const litter of littersWeaned) {
      const dept = farmDept.get(litter.farmId);
      if (!dept) continue;
      ensure(dept).weanedEstimate += litter.bornAlive;
    }

    for (const consult of vetConsultations) {
      const dept = farmDept.get(consult.farmId);
      if (!dept) continue;
      ensure(dept).vetConsultationsCount += 1;
    }

    for (const g of gestationsEnded) {
      const dept = farmDept.get(g.farmId);
      if (!dept) continue;
      const row = ensure(dept);
      if (g.status === GestationStatus.completed) {
        row.gestationsCompleted += 1;
      } else if (g.status === GestationStatus.aborted) {
        row.gestationsAborted += 1;
      } else if (g.status === GestationStatus.lost) {
        row.gestationsLost += 1;
      }
      row.gestationNumberSum += g.gestationNumber;
      row.gestationNumberCount += 1;
    }

    for (const m of matingsDay) {
      const dept = farmDept.get(m.farmId);
      if (!dept) continue;
      const row = ensure(dept);
      if (m.matingType === MatingType.artificial_insemination) {
        row.matingsAI += 1;
      } else {
        row.matingsNatural += 1;
      }
    }

    // Intervalle mise bas–mise bas : pour chaque naissance du jour, écart vs précédente.
    const sowIds = [...new Set(completedBirths.map((g) => g.sowId))];
    const priorBirths =
      sowIds.length === 0
        ? []
        : await this.prisma.gestation.findMany({
            where: {
              sowId: { in: sowIds },
              status: GestationStatus.completed,
              actualBirthDate: { not: null, lt: dayStart }
            },
            select: {
              sowId: true,
              actualBirthDate: true
            },
            orderBy: { actualBirthDate: "desc" }
          });
    const lastBirthBySow = new Map<string, Date>();
    for (const prior of priorBirths) {
      if (!prior.actualBirthDate) continue;
      if (!lastBirthBySow.has(prior.sowId)) {
        lastBirthBySow.set(prior.sowId, prior.actualBirthDate);
      }
    }
    for (const birth of completedBirths) {
      if (!birth.actualBirthDate) continue;
      const dept = farmDept.get(birth.farmId);
      if (!dept) continue;
      const prev = lastBirthBySow.get(birth.sowId);
      if (!prev) continue;
      const interval = daysBetween(prev, birth.actualBirthDate);
      if (interval <= 0 || interval > 400) continue;
      const row = ensure(dept);
      row.farrowingIntervalSumDays += interval;
      row.farrowingIntervalCount += 1;
      lastBirthBySow.set(birth.sowId, birth.actualBirthDate);
    }

    for (const rec of diseaseRecords) {
      const dept = farmDept.get(rec.farmId);
      if (!dept) continue;
      const key = normalizeDiagnosis(rec.disease?.diagnosis);
      incRecord(ensure(dept).diseaseSuspicionsByDiagnosis, key, 1);
    }

    const markActive = (farmId: string) => {
      const dept = farmDept.get(farmId);
      if (!dept) return;
      ensure(dept).activeFarmIds.add(farmId);
    };
    for (const r of activeExitFarms) markActive(r.farmId);
    for (const r of activeLitterFarms) markActive(r.farmId);
    for (const r of activeGestationFarms) markActive(r.farmId);
    for (const r of activeHealthFarms) markActive(r.farmId);
    for (const r of activeExpenseFarms) markActive(r.farmId);
    for (const r of activeWeightFarms) markActive(r.animal.farmId);

    for (const user of activeOwners) {
      const role =
        user.profiles.find((p) => p.type === "producer")?.type ??
        user.profiles[0]?.type ??
        "producer";
      for (const farm of user.ownedFarms) {
        if (!farm.departmentCode) continue;
        const row = ensure(farm.departmentCode);
        const key = `${user.id}:${role}`;
        if (row.activeUserKeys.has(key)) continue;
        row.activeUserKeys.add(key);
        incRecord(row.activeUsersByRole, role, 1);
      }
    }

    const addGmq = (
      departmentCode: string,
      category: string,
      gmq: number | null
    ) => {
      if (gmq == null || !Number.isFinite(gmq)) return;
      const row = ensure(departmentCode);
      const key = category || "unknown";
      const prev = row.gmqSums.get(key) ?? { total: 0, count: 0 };
      prev.total += gmq;
      prev.count += 1;
      row.gmqSums.set(key, prev);
    };

    for (const weight of animalWeights) {
      const dept = farmDept.get(weight.animal.farmId);
      if (!dept) continue;
      const history = weight.animal.weights;
      if (history.length < 2) continue;
      const prev = history[history.length - 2];
      const gmq = gmqBetween(
        decimalToNum(prev.weightKg) ?? 0,
        decimalToNum(weight.weightKg) ?? 0,
        prev.measuredAt,
        weight.measuredAt
      );
      addGmq(dept, weight.animal.productionCategory, gmq);
    }

    for (const weight of batchWeights) {
      const dept = farmDept.get(weight.batch.farmId);
      if (!dept) continue;
      const history = weight.batch.weights;
      if (history.length < 2) continue;
      const prev = history[history.length - 2];
      const gmq = gmqBetween(
        decimalToNum(prev.avgWeightKg) ?? 0,
        decimalToNum(weight.avgWeightKg) ?? 0,
        prev.measuredAt,
        weight.measuredAt
      );
      addGmq(dept, weight.batch.categoryKey ?? "batch", gmq);
    }

    return [...acc.entries()].map(([departmentCode, row]) => {
      const avgPricePerKg =
        row.saleWeightKgSum > 0
          ? row.salePriceKgSum / row.saleWeightKgSum
          : null;
      return {
        date: dayStart,
        departmentCode,
        farmCount: row.farmCount,
        animalCountByCategory: row.animalCountByCategory,
        mortalityHeadcount: row.mortalityHeadcount,
        mortalityByCause: row.mortalityByCause,
        littersCount: row.littersCount,
        bornAlive: row.bornAlive,
        stillborn: row.stillborn,
        mummifiedTotal: row.mummifiedTotal,
        weanedEstimate: row.weanedEstimate,
        avgGmqByCategory: avgRecord(row.gmqSums),
        exitsSaleHeadcount: row.exitsSaleHeadcount,
        exitsSaleAvgPricePerKg:
          avgPricePerKg != null
            ? Math.round(avgPricePerKg * 10000) / 10000
            : null,
        exitsSlaughterHeadcount: row.exitsSlaughterHeadcount,
        vetConsultationsCount: row.vetConsultationsCount,
        gestationsCompleted: row.gestationsCompleted,
        gestationsAborted: row.gestationsAborted,
        gestationsLost: row.gestationsLost,
        matingsNatural: row.matingsNatural,
        matingsAI: row.matingsAI,
        activeSowsCount: row.activeSowsCount,
        farrowingIntervalSumDays: row.farrowingIntervalSumDays,
        farrowingIntervalCount: row.farrowingIntervalCount,
        gestationNumberSum: row.gestationNumberSum,
        gestationNumberCount: row.gestationNumberCount,
        diseaseSuspicionsByDiagnosis: row.diseaseSuspicionsByDiagnosis,
        animalsByHealthStatus: row.animalsByHealthStatus,
        herdCountForIncidence: row.herdCountForIncidence,
        exitsByKind: row.exitsByKind,
        avgAgeAtSaleDays: weightedAvgFromSum(
          row.ageSale.sumDays,
          row.ageSale.count
        ),
        exitsSaleForAgeCount: row.ageSale.count,
        avgAgeAtSlaughterDays: weightedAvgFromSum(
          row.ageSlaughter.sumDays,
          row.ageSlaughter.count
        ),
        exitsSlaughterForAgeCount: row.ageSlaughter.count,
        avgAgeAtDeathDays: weightedAvgFromSum(
          row.ageDeath.sumDays,
          row.ageDeath.count
        ),
        exitsDeathForAgeCount: row.ageDeath.count,
        avgFatteningDurationDays: weightedAvgFromSum(
          row.fattening.sumDays,
          row.fattening.count
        ),
        fatteningDurationCount: row.fattening.count,
        sowCullsCount: row.sowCullsCount,
        activeFarmsCount: row.activeFarmIds.size,
        activeUsersByRole: row.activeUsersByRole
      };
    });
  }
}
