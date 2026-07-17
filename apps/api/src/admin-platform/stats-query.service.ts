import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertNoNominativeFields,
  suppressLowCells
} from "./institution-privacy.util";
import { RegionalStatsQueryDto } from "./dto/regional-stats-query.dto";
import type { InstitutionStatSection } from "./institution-stats-sections.constants";
import {
  addUtcDays,
  parseIsoDateParam,
  startOfUtcDay,
  startOfUtcWeek
} from "./region-stats-date.util";
import {
  computeZScore,
  isOvermortality
} from "./region-stats-zscore.util";

type JsonRecord = Record<string, number>;

export type StatsAggregatedDeptRow = {
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

export type RegionalStatsCoverage = {
  farmCount: number;
  animalCount: number;
  departmentsCovered: number;
};

export type RegionalSectionPayload = {
  from: string;
  to: string;
  coverage: RegionalStatsCoverage;
  departments: Record<string, unknown>[];
};

@Injectable()
export class StatsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async querySection(
    section: InstitutionStatSection,
    query: RegionalStatsQueryDto
  ): Promise<RegionalSectionPayload> {
    switch (section) {
      case "mortality":
        return this.queryMortality(query);
      case "herd":
        return this.queryHerd(query);
      case "reproduction":
        return this.queryReproduction(query);
      case "growth":
        return this.queryGrowth(query);
      case "vetCoverage":
        return this.queryVetCoverage(query);
      case "economy":
        return this.queryEconomy(query);
      case "movements":
        throw new Error("Section movements non servie (P-14)");
      default:
        throw new Error(`Section inconnue : ${String(section)}`);
    }
  }

  async queryMortality(query: RegionalStatsQueryDto): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const zByDept = await this.mortalityZScoresByDepartment();

    const departments = suppressLowCells(
      rows.map((row) => {
        const zScore = zByDept.get(row.departmentCode) ?? null;
        return {
          departmentCode: row.departmentCode,
          farmCount: row.farmCount,
          mortalityHeadcount: row.mortalityHeadcount,
          mortalityByCause: row.mortalityByCause,
          zScore,
          overmortality: isOvermortality(zScore)
        };
      })
    );

    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryHerd(query: RegionalStatsQueryDto): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        animalCountByCategory: row.animalCountByCategory,
        exitsSaleHeadcount: row.exitsSaleHeadcount,
        exitsSlaughterHeadcount: row.exitsSlaughterHeadcount
      }))
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryReproduction(
    query: RegionalStatsQueryDto
  ): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        littersCount: row.littersCount,
        bornAlive: row.bornAlive,
        stillborn: row.stillborn,
        weanedEstimate: row.weanedEstimate
      }))
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryGrowth(query: RegionalStatsQueryDto): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        avgGmqByCategory: row.avgGmqByCategory,
        exitsSaleAvgPricePerKg: row.exitsSaleAvgPricePerKg
      }))
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryVetCoverage(
    query: RegionalStatsQueryDto
  ): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        vetConsultationsCount: row.vetConsultationsCount
      }))
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryEconomy(query: RegionalStatsQueryDto): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        exitsSaleHeadcount: row.exitsSaleHeadcount,
        exitsSaleAvgPricePerKg: row.exitsSaleAvgPricePerKg,
        exitsSlaughterHeadcount: row.exitsSlaughterHeadcount
      }))
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async loadAggregated(query: RegionalStatsQueryDto): Promise<{
    from: string;
    to: string;
    rows: StatsAggregatedDeptRow[];
    coverage: RegionalStatsCoverage;
  }> {
    const today = startOfUtcDay(new Date());
    const toDate = parseIsoDateParam(query.to, today);
    const fromDate = parseIsoDateParam(
      query.from,
      addUtcDays(toDate, -29)
    );
    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);

    const departmentCodes = await this.resolveDepartmentFilter(query);
    const snapshots = await this.prisma.regionStatsDaily.findMany({
      where: {
        date: { gte: fromDate, lte: toDate },
        ...(departmentCodes
          ? { departmentCode: { in: departmentCodes } }
          : {})
      },
      orderBy: [{ departmentCode: "asc" }, { date: "asc" }]
    });

    const rows = this.aggregateSnapshots(snapshots);
    const coverage = this.buildCoverage(rows);
    return { from, to, rows, coverage };
  }

  private async resolveDepartmentFilter(
    query: RegionalStatsQueryDto
  ): Promise<string[] | null> {
    if (query.departmentCode?.trim()) {
      return [query.departmentCode.trim()];
    }
    if (!query.regionCode?.trim()) {
      return null;
    }
    const regionCode = query.regionCode.trim();
    const departments = await this.prisma.adminRegionRef.findMany({
      where: {
        level: "department",
        OR: [{ parentCode: regionCode }, { code: regionCode }]
      },
      select: { code: true }
    });
    return departments.map((d) => d.code);
  }

  private aggregateSnapshots(
    snapshots: {
      departmentCode: string;
      farmCount: number;
      animalCountByCategory: Prisma.JsonValue;
      mortalityHeadcount: number;
      mortalityByCause: Prisma.JsonValue;
      littersCount: number;
      bornAlive: number;
      stillborn: number;
      weanedEstimate: number;
      avgGmqByCategory: Prisma.JsonValue;
      exitsSaleHeadcount: number;
      exitsSaleAvgPricePerKg: Prisma.Decimal | null;
      exitsSlaughterHeadcount: number;
      vetConsultationsCount: number;
    }[]
  ): StatsAggregatedDeptRow[] {
    const byDept = new Map<
      string,
      StatsAggregatedDeptRow & { gmqWeight: JsonRecord }
    >();

    for (const snap of snapshots) {
      let row = byDept.get(snap.departmentCode);
      if (!row) {
        row = {
          departmentCode: snap.departmentCode,
          farmCount: 0,
          animalCountByCategory: {},
          mortalityHeadcount: 0,
          mortalityByCause: {},
          littersCount: 0,
          bornAlive: 0,
          stillborn: 0,
          weanedEstimate: 0,
          avgGmqByCategory: {},
          gmqWeight: {},
          exitsSaleHeadcount: 0,
          exitsSaleAvgPricePerKg: null,
          exitsSlaughterHeadcount: 0,
          vetConsultationsCount: 0
        };
        byDept.set(snap.departmentCode, row);
      }

      row.farmCount = Math.max(row.farmCount, snap.farmCount);
      row.mortalityHeadcount += snap.mortalityHeadcount;
      row.littersCount += snap.littersCount;
      row.bornAlive += snap.bornAlive;
      row.stillborn += snap.stillborn;
      row.weanedEstimate += snap.weanedEstimate;
      row.exitsSaleHeadcount += snap.exitsSaleHeadcount;
      row.exitsSlaughterHeadcount += snap.exitsSlaughterHeadcount;
      row.vetConsultationsCount += snap.vetConsultationsCount;

      this.mergeJsonCounts(row.mortalityByCause, snap.mortalityByCause);
      this.mergeJsonCounts(
        row.animalCountByCategory,
        snap.animalCountByCategory,
        "max"
      );
      this.mergeWeightedAvg(
        row.avgGmqByCategory,
        row.gmqWeight,
        snap.avgGmqByCategory
      );

      const price = snap.exitsSaleAvgPricePerKg?.toNumber() ?? null;
      if (price != null && snap.exitsSaleHeadcount > 0) {
        if (row.exitsSaleAvgPricePerKg == null) {
          row.exitsSaleAvgPricePerKg = price;
        } else {
          row.exitsSaleAvgPricePerKg =
            (row.exitsSaleAvgPricePerKg + price) / 2;
        }
      }
    }

    return [...byDept.values()].map(
      ({ gmqWeight: _gmqWeight, ...row }) => row
    );
  }

  private mergeJsonCounts(
    target: JsonRecord,
    source: Prisma.JsonValue,
    mode: "sum" | "max" = "sum"
  ): void {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return;
    }
    for (const [key, value] of Object.entries(source as JsonRecord)) {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        continue;
      }
      if (mode === "max") {
        target[key] = Math.max(target[key] ?? 0, n);
      } else {
        target[key] = (target[key] ?? 0) + n;
      }
    }
  }

  private mergeWeightedAvg(
    target: JsonRecord,
    weights: JsonRecord,
    source: Prisma.JsonValue
  ): void {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return;
    }
    for (const [key, value] of Object.entries(source as JsonRecord)) {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) {
        continue;
      }
      const w = (weights[key] ?? 0) + 1;
      weights[key] = w;
      const prev = target[key] ?? 0;
      target[key] = prev + (n - prev) / w;
    }
  }

  private buildCoverage(rows: StatsAggregatedDeptRow[]): RegionalStatsCoverage {
    let farmCount = 0;
    let animalCount = 0;
    for (const row of rows) {
      farmCount += row.farmCount;
      animalCount += Object.values(row.animalCountByCategory).reduce(
        (sum, n) => sum + n,
        0
      );
    }
    return {
      farmCount,
      animalCount,
      departmentsCovered: rows.length
    };
  }

  private async mortalityZScoresByDepartment(): Promise<Map<string, number | null>> {
    const currentWeekStart = startOfUtcWeek(new Date());
    const historyStart = addUtcDays(currentWeekStart, -8 * 7);
    const historyEnd = addUtcDays(currentWeekStart, 7);

    const snapshots = await this.prisma.regionStatsDaily.findMany({
      where: {
        date: { gte: historyStart, lt: historyEnd }
      },
      select: {
        date: true,
        departmentCode: true,
        mortalityHeadcount: true
      }
    });

    const weekly = new Map<string, Map<string, number>>();
    for (const snap of snapshots) {
      const weekKey = startOfUtcWeek(snap.date).toISOString().slice(0, 10);
      if (!weekly.has(snap.departmentCode)) {
        weekly.set(snap.departmentCode, new Map());
      }
      const deptWeeks = weekly.get(snap.departmentCode)!;
      deptWeeks.set(
        weekKey,
        (deptWeeks.get(weekKey) ?? 0) + snap.mortalityHeadcount
      );
    }

    const currentWeekKey = currentWeekStart.toISOString().slice(0, 10);
    const result = new Map<string, number | null>();

    for (const [departmentCode, weeks] of weekly) {
      const current = weeks.get(currentWeekKey) ?? 0;
      const historical: number[] = [];
      for (let i = 1; i <= 8; i += 1) {
        const weekKey = addUtcDays(currentWeekStart, -7 * i)
          .toISOString()
          .slice(0, 10);
        historical.push(weeks.get(weekKey) ?? 0);
      }
      result.set(departmentCode, computeZScore(current, historical));
    }

    return result;
  }
}
