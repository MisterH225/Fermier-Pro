import { Injectable, Logger } from "@nestjs/common";
import { LivestockExitKind, Prisma } from "@prisma/client";
import { gmqBetween } from "../cheptel/cheptel-gmq.util";
import { PrismaService } from "../prisma/prisma.service";
import { addUtcDays, startOfUtcDay } from "./region-stats-date.util";

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
  weanedEstimate: number;
  avgGmqByCategory: JsonRecord;
  exitsSaleHeadcount: number;
  exitsSaleAvgPricePerKg: number | null;
  exitsSlaughterHeadcount: number;
  vetConsultationsCount: number;
};

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
        create: {
          date: row.date,
          departmentCode: row.departmentCode,
          farmCount: row.farmCount,
          animalCountByCategory: row.animalCountByCategory,
          mortalityHeadcount: row.mortalityHeadcount,
          mortalityByCause: row.mortalityByCause,
          littersCount: row.littersCount,
          bornAlive: row.bornAlive,
          stillborn: row.stillborn,
          weanedEstimate: row.weanedEstimate,
          avgGmqByCategory: row.avgGmqByCategory,
          exitsSaleHeadcount: row.exitsSaleHeadcount,
          exitsSaleAvgPricePerKg:
            row.exitsSaleAvgPricePerKg != null
              ? new Prisma.Decimal(row.exitsSaleAvgPricePerKg)
              : null,
          exitsSlaughterHeadcount: row.exitsSlaughterHeadcount,
          vetConsultationsCount: row.vetConsultationsCount
        },
        update: {
          farmCount: row.farmCount,
          animalCountByCategory: row.animalCountByCategory,
          mortalityHeadcount: row.mortalityHeadcount,
          mortalityByCause: row.mortalityByCause,
          littersCount: row.littersCount,
          bornAlive: row.bornAlive,
          stillborn: row.stillborn,
          weanedEstimate: row.weanedEstimate,
          avgGmqByCategory: row.avgGmqByCategory,
          exitsSaleHeadcount: row.exitsSaleHeadcount,
          exitsSaleAvgPricePerKg:
            row.exitsSaleAvgPricePerKg != null
              ? new Prisma.Decimal(row.exitsSaleAvgPricePerKg)
              : null,
          exitsSlaughterHeadcount: row.exitsSlaughterHeadcount,
          vetConsultationsCount: row.vetConsultationsCount
        }
      });
    }

    this.log.log(
      `RegionStatsDaily — ${payloads.length} département(s) pour ${dayStart.toISOString().slice(0, 10)}`
    );
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

    const [
      animals,
      mortalityExits,
      saleExits,
      slaughterExits,
      littersBorn,
      littersWeaned,
      vetConsultations,
      animalWeights,
      batchWeights
    ] = await Promise.all([
      this.prisma.animal.findMany({
        where: { farmId: { in: farmIds }, status: "active" },
        select: { farmId: true, productionCategory: true }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId: { in: farmIds },
          kind: LivestockExitKind.mortality,
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          headcountAffected: true,
          deathCause: true
        }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId: { in: farmIds },
          kind: LivestockExitKind.sale,
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          headcountAffected: true,
          price: true,
          weightKg: true
        }
      }),
      this.prisma.livestockExit.findMany({
        where: {
          farmId: { in: farmIds },
          kind: LivestockExitKind.slaughter,
          occurredAt: { gte: dayStart, lt: dayEnd }
        },
        select: { farmId: true, headcountAffected: true }
      }),
      this.prisma.litter.findMany({
        where: {
          farmId: { in: farmIds },
          recordedAt: { gte: dayStart, lt: dayEnd }
        },
        select: {
          farmId: true,
          bornAlive: true,
          stillborn: true
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
      })
    ]);

    type DeptAcc = {
      farmCount: number;
      animalCountByCategory: JsonRecord;
      mortalityHeadcount: number;
      mortalityByCause: JsonRecord;
      littersCount: number;
      bornAlive: number;
      stillborn: number;
      weanedEstimate: number;
      gmqSums: Map<string, { total: number; count: number }>;
      exitsSaleHeadcount: number;
      salePriceKgSum: number;
      saleWeightKgSum: number;
      exitsSlaughterHeadcount: number;
      vetConsultationsCount: number;
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
          weanedEstimate: 0,
          gmqSums: new Map(),
          exitsSaleHeadcount: 0,
          salePriceKgSum: 0,
          saleWeightKgSum: 0,
          exitsSlaughterHeadcount: 0,
          vetConsultationsCount: 0
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
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      incRecord(row.animalCountByCategory, animal.productionCategory);
    }

    for (const exit of mortalityExits) {
      const dept = farmDept.get(exit.farmId);
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      const heads = exit.headcountAffected ?? 1;
      row.mortalityHeadcount += heads;
      const cause = exit.deathCause?.trim() || "non_renseigne";
      incRecord(row.mortalityByCause, cause, heads);
    }

    for (const exit of saleExits) {
      const dept = farmDept.get(exit.farmId);
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      const heads = exit.headcountAffected ?? 1;
      row.exitsSaleHeadcount += heads;
      const weight = decimalToNum(exit.weightKg);
      const price = decimalToNum(exit.price);
      if (weight != null && weight > 0 && price != null) {
        row.saleWeightKgSum += weight;
        row.salePriceKgSum += price / weight;
      }
    }

    for (const exit of slaughterExits) {
      const dept = farmDept.get(exit.farmId);
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      row.exitsSlaughterHeadcount += exit.headcountAffected ?? 1;
    }

    for (const litter of littersBorn) {
      const dept = farmDept.get(litter.farmId);
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      row.littersCount += 1;
      row.bornAlive += litter.bornAlive;
      row.stillborn += litter.stillborn;
    }

    for (const litter of littersWeaned) {
      const dept = farmDept.get(litter.farmId);
      if (!dept) {
        continue;
      }
      const row = ensure(dept);
      row.weanedEstimate += litter.bornAlive;
    }

    for (const consult of vetConsultations) {
      const dept = farmDept.get(consult.farmId);
      if (!dept) {
        continue;
      }
      ensure(dept).vetConsultationsCount += 1;
    }

    const addGmq = (
      departmentCode: string,
      category: string,
      gmq: number | null
    ) => {
      if (gmq == null || !Number.isFinite(gmq)) {
        return;
      }
      const row = ensure(departmentCode);
      const key = category || "unknown";
      const prev = row.gmqSums.get(key) ?? { total: 0, count: 0 };
      prev.total += gmq;
      prev.count += 1;
      row.gmqSums.set(key, prev);
    };

    for (const weight of animalWeights) {
      const dept = farmDept.get(weight.animal.farmId);
      if (!dept) {
        continue;
      }
      const history = weight.animal.weights;
      if (history.length < 2) {
        continue;
      }
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
      if (!dept) {
        continue;
      }
      const history = weight.batch.weights;
      if (history.length < 2) {
        continue;
      }
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
        weanedEstimate: row.weanedEstimate,
        avgGmqByCategory: avgRecord(row.gmqSums),
        exitsSaleHeadcount: row.exitsSaleHeadcount,
        exitsSaleAvgPricePerKg:
          avgPricePerKg != null
            ? Math.round(avgPricePerKg * 10000) / 10000
            : null,
        exitsSlaughterHeadcount: row.exitsSlaughterHeadcount,
        vetConsultationsCount: row.vetConsultationsCount
      };
    });
  }
}
