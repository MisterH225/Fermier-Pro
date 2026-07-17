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
import {
  computeHealthRates,
  computeLifecycleRates,
  computeReproductionRates,
  mergeExitsByKind,
  mergeWeightedAvg,
  safeRate,
  type ExitKindAgg
} from "./region-stats-p28.util";

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
  herdSampleDays: number;
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
  national?: Record<string, unknown>;
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
      case "health":
        return this.queryHealth(query);
      case "lifecycle":
        return this.queryLifecycle(query);
      case "adoption":
        return this.queryAdoption(query);
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
    const { from, to, rows, coverage, periodDays } =
      await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => {
        const rates = computeReproductionRates(row);
        const avgSows =
          row.herdSampleDays > 0
            ? row.activeSowsCount / row.herdSampleDays
            : row.activeSowsCount;
        const rawProductivity = safeRate(row.weanedEstimate, avgSows);
        const productiviteNumeriqueAn =
          rawProductivity != null && periodDays > 0
            ? Math.round(rawProductivity * (365 / periodDays) * 100) / 100
            : null;
        return {
          departmentCode: row.departmentCode,
          farmCount: row.farmCount,
          littersCount: row.littersCount,
          bornAlive: row.bornAlive,
          stillborn: row.stillborn,
          mummifiedTotal: row.mummifiedTotal,
          weanedEstimate: row.weanedEstimate,
          gestationsCompleted: row.gestationsCompleted,
          gestationsAborted: row.gestationsAborted,
          gestationsLost: row.gestationsLost,
          matingsNatural: row.matingsNatural,
          matingsAI: row.matingsAI,
          activeSowsCount: Math.round(avgSows),
          tauxMiseBas: rates.tauxMiseBas,
          tauxMortNes: rates.tauxMortNes,
          tauxMomifies: rates.tauxMomifies,
          tauxPertesGestation: rates.tauxPertesGestation,
          partIA: rates.partIA,
          prolificiteNesVifs: rates.prolificiteNesVifs,
          productiviteNumeriqueAn,
          intervalleMiseBasJours: rates.intervalleMiseBasJours,
          rangPorteeMoyen: rates.rangPorteeMoyen
        };
      })
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

  /**
   * Santé : suspicions déclarées (pas cas confirmés).
   * Classement départements par incidence /1 000, pas par volume brut.
   */
  async queryHealth(query: RegionalStatsQueryDto): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const enriched = rows.map((row) => {
      const avgHerd =
        row.herdSampleDays > 0
          ? row.herdCountForIncidence / row.herdSampleDays
          : row.herdCountForIncidence;
      const rates = computeHealthRates({
        diseaseSuspicionsByDiagnosis: row.diseaseSuspicionsByDiagnosis,
        mortalityByCause: row.mortalityByCause,
        herdCountForIncidence: avgHerd,
        mortalityHeadcount: row.mortalityHeadcount
      });
      return {
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        herdCountForIncidence: Math.round(avgHerd),
        animalsByHealthStatus: row.animalsByHealthStatus,
        /** Libellés prudents — pas de « cas confirmés ». */
        totalSuspicionsDeclared: rates.totalSuspicionsDeclared,
        incidencePerThousand: rates.incidencePerThousand,
        suspicionsByDiagnosis: rates.suspicionsByDiagnosis,
        mortalityByCause: rates.mortalityByCause,
        letaliteApparenteDeclarative: rates.letaliteApparenteDeclarative,
        letaliteLabel:
          "corrélation déclarative (décès ÷ suspicions déclarées — non confirmée labo)"
      };
    });

    enriched.sort(
      (a, b) => (b.incidencePerThousand ?? 0) - (a.incidencePerThousand ?? 0)
    );

    const departments = suppressLowCells(enriched);
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  async queryLifecycle(
    query: RegionalStatsQueryDto
  ): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const departments = suppressLowCells(
      rows.map((row) => {
        const avgHerd =
          row.herdSampleDays > 0
            ? row.herdCountForIncidence / row.herdSampleDays
            : row.herdCountForIncidence;
        const avgSows =
          row.herdSampleDays > 0
            ? row.activeSowsCount / row.herdSampleDays
            : row.activeSowsCount;
        const rates = computeLifecycleRates({
          exitsByKind: row.exitsByKind,
          herdCountForIncidence: avgHerd,
          avgAgeAtSaleDays: row.avgAgeAtSaleDays,
          avgAgeAtSlaughterDays: row.avgAgeAtSlaughterDays,
          avgAgeAtDeathDays: row.avgAgeAtDeathDays,
          avgFatteningDurationDays: row.avgFatteningDurationDays,
          sowCullsCount: row.sowCullsCount,
          activeSowsCount: avgSows,
          mortalityHeadcount: row.mortalityHeadcount
        });
        return {
          departmentCode: row.departmentCode,
          farmCount: row.farmCount,
          exitsByKind: rates.exitsByKind,
          exitsSaleHeadcount: row.exitsByKind.sale?.headcount ?? 0,
          tauxVenteCheptel: rates.tauxVenteCheptel,
          tauxMortaliteGlobal: rates.tauxMortaliteGlobal,
          tauxReformeTruies: rates.tauxReformeTruies,
          avgAgeAtSaleDays: rates.avgAgeAtSaleDays,
          avgAgeAtSlaughterDays: rates.avgAgeAtSlaughterDays,
          avgAgeAtDeathDays: rates.avgAgeAtDeathDays,
          avgFatteningDurationDays: rates.avgFatteningDurationDays,
          repartitionSorties: rates.repartitionSorties,
          sowCullsCount: row.sowCullsCount
        };
      })
    );
    const payload = { from, to, coverage, departments };
    assertNoNominativeFields(payload);
    return payload;
  }

  /**
   * Adoption : fermes actives + MAU depuis snapshot ; rétention J+30 à la volée.
   */
  async queryAdoption(
    query: RegionalStatsQueryDto
  ): Promise<RegionalSectionPayload> {
    const { from, to, rows, coverage } = await this.loadAggregated(query);
    const retention = await this.computeRetentionLive();

    const departments = suppressLowCells(
      rows.map((row) => ({
        departmentCode: row.departmentCode,
        farmCount: row.farmCount,
        activeFarmsCount: row.activeFarmsCount,
        activeUsersByRole: row.activeUsersByRole
      }))
    );

    const payload = {
      from,
      to,
      coverage,
      departments,
      national: {
        mauByRole: retention.mauByRole,
        wauByRole: retention.wauByRole,
        retentionJ30: retention.retentionJ30,
        retentionJ90: retention.retentionJ90
      }
    };
    assertNoNominativeFields(payload);
    return payload;
  }

  async loadAggregated(query: RegionalStatsQueryDto): Promise<{
    from: string;
    to: string;
    rows: StatsAggregatedDeptRow[];
    coverage: RegionalStatsCoverage;
    periodDays: number;
  }> {
    const today = startOfUtcDay(new Date());
    const toDate = parseIsoDateParam(query.to, today);
    const fromDate = parseIsoDateParam(
      query.from,
      addUtcDays(toDate, -29)
    );
    const from = fromDate.toISOString().slice(0, 10);
    const to = toDate.toISOString().slice(0, 10);
    const periodDays = Math.max(
      1,
      Math.round(
        (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)
      ) + 1
    );

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
    return { from, to, rows, coverage, periodDays };
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
    snapshots: Array<{
      departmentCode: string;
      farmCount: number;
      animalCountByCategory: Prisma.JsonValue;
      mortalityHeadcount: number;
      mortalityByCause: Prisma.JsonValue;
      littersCount: number;
      bornAlive: number;
      stillborn: number;
      mummifiedTotal?: number;
      weanedEstimate: number;
      avgGmqByCategory: Prisma.JsonValue;
      exitsSaleHeadcount: number;
      exitsSaleAvgPricePerKg: Prisma.Decimal | null;
      exitsSlaughterHeadcount: number;
      vetConsultationsCount: number;
      gestationsCompleted?: number;
      gestationsAborted?: number;
      gestationsLost?: number;
      matingsNatural?: number;
      matingsAI?: number;
      activeSowsCount?: number;
      farrowingIntervalSumDays?: number;
      farrowingIntervalCount?: number;
      gestationNumberSum?: number;
      gestationNumberCount?: number;
      diseaseSuspicionsByDiagnosis?: Prisma.JsonValue;
      animalsByHealthStatus?: Prisma.JsonValue;
      herdCountForIncidence?: number;
      exitsByKind?: Prisma.JsonValue;
      avgAgeAtSaleDays?: number | null;
      exitsSaleForAgeCount?: number;
      avgAgeAtSlaughterDays?: number | null;
      exitsSlaughterForAgeCount?: number;
      avgAgeAtDeathDays?: number | null;
      exitsDeathForAgeCount?: number;
      avgFatteningDurationDays?: number | null;
      fatteningDurationCount?: number;
      sowCullsCount?: number;
      activeFarmsCount?: number;
      activeUsersByRole?: Prisma.JsonValue;
    }>
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
          mummifiedTotal: 0,
          weanedEstimate: 0,
          avgGmqByCategory: {},
          gmqWeight: {},
          exitsSaleHeadcount: 0,
          exitsSaleAvgPricePerKg: null,
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
          diseaseSuspicionsByDiagnosis: {},
          animalsByHealthStatus: {},
          herdCountForIncidence: 0,
          herdSampleDays: 0,
          exitsByKind: {},
          avgAgeAtSaleDays: null,
          exitsSaleForAgeCount: 0,
          avgAgeAtSlaughterDays: null,
          exitsSlaughterForAgeCount: 0,
          avgAgeAtDeathDays: null,
          exitsDeathForAgeCount: 0,
          avgFatteningDurationDays: null,
          fatteningDurationCount: 0,
          sowCullsCount: 0,
          activeFarmsCount: 0,
          activeUsersByRole: {}
        };
        byDept.set(snap.departmentCode, row);
      }

      row.farmCount = Math.max(row.farmCount, snap.farmCount);
      row.mortalityHeadcount += snap.mortalityHeadcount;
      row.littersCount += snap.littersCount;
      row.bornAlive += snap.bornAlive;
      row.stillborn += snap.stillborn;
      row.mummifiedTotal += snap.mummifiedTotal ?? 0;
      row.weanedEstimate += snap.weanedEstimate;
      row.exitsSaleHeadcount += snap.exitsSaleHeadcount;
      row.exitsSlaughterHeadcount += snap.exitsSlaughterHeadcount;
      row.vetConsultationsCount += snap.vetConsultationsCount;
      row.gestationsCompleted += snap.gestationsCompleted ?? 0;
      row.gestationsAborted += snap.gestationsAborted ?? 0;
      row.gestationsLost += snap.gestationsLost ?? 0;
      row.matingsNatural += snap.matingsNatural ?? 0;
      row.matingsAI += snap.matingsAI ?? 0;
      row.activeSowsCount += snap.activeSowsCount ?? 0;
      row.farrowingIntervalSumDays += snap.farrowingIntervalSumDays ?? 0;
      row.farrowingIntervalCount += snap.farrowingIntervalCount ?? 0;
      row.gestationNumberSum += snap.gestationNumberSum ?? 0;
      row.gestationNumberCount += snap.gestationNumberCount ?? 0;
      row.herdCountForIncidence += snap.herdCountForIncidence ?? 0;
      row.herdSampleDays += 1;
      row.sowCullsCount += snap.sowCullsCount ?? 0;
      row.activeFarmsCount = Math.max(
        row.activeFarmsCount,
        snap.activeFarmsCount ?? 0
      );

      this.mergeJsonCounts(row.mortalityByCause, snap.mortalityByCause);
      this.mergeJsonCounts(
        row.animalCountByCategory,
        snap.animalCountByCategory,
        "max"
      );
      this.mergeJsonCounts(
        row.diseaseSuspicionsByDiagnosis,
        snap.diseaseSuspicionsByDiagnosis ?? {}
      );
      this.mergeJsonCounts(
        row.animalsByHealthStatus,
        snap.animalsByHealthStatus ?? {},
        "max"
      );
      this.mergeJsonCounts(
        row.activeUsersByRole,
        snap.activeUsersByRole ?? {},
        "max"
      );
      this.mergeWeightedAvg(
        row.avgGmqByCategory,
        row.gmqWeight,
        snap.avgGmqByCategory
      );

      row.exitsByKind = mergeExitsByKind(
        row.exitsByKind,
        this.parseExitsByKind(snap.exitsByKind)
      );

      const saleMerged = mergeWeightedAvg(
        row.avgAgeAtSaleDays,
        row.exitsSaleForAgeCount,
        snap.avgAgeAtSaleDays,
        snap.exitsSaleForAgeCount ?? 0
      );
      row.avgAgeAtSaleDays = saleMerged.avg;
      row.exitsSaleForAgeCount = saleMerged.count;

      const slaughterMerged = mergeWeightedAvg(
        row.avgAgeAtSlaughterDays,
        row.exitsSlaughterForAgeCount,
        snap.avgAgeAtSlaughterDays,
        snap.exitsSlaughterForAgeCount ?? 0
      );
      row.avgAgeAtSlaughterDays = slaughterMerged.avg;
      row.exitsSlaughterForAgeCount = slaughterMerged.count;

      const deathMerged = mergeWeightedAvg(
        row.avgAgeAtDeathDays,
        row.exitsDeathForAgeCount,
        snap.avgAgeAtDeathDays,
        snap.exitsDeathForAgeCount ?? 0
      );
      row.avgAgeAtDeathDays = deathMerged.avg;
      row.exitsDeathForAgeCount = deathMerged.count;

      const fatMerged = mergeWeightedAvg(
        row.avgFatteningDurationDays,
        row.fatteningDurationCount,
        snap.avgFatteningDurationDays,
        snap.fatteningDurationCount ?? 0
      );
      row.avgFatteningDurationDays = fatMerged.avg;
      row.fatteningDurationCount = fatMerged.count;

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

  private parseExitsByKind(
    source: Prisma.JsonValue | undefined
  ): Record<string, ExitKindAgg> {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      return {};
    }
    const out: Record<string, ExitKindAgg> = {};
    for (const [kind, raw] of Object.entries(source as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const o = raw as Record<string, unknown>;
      out[kind] = {
        headcount: Number(o.headcount) || 0,
        totalWeightKg: Number(o.totalWeightKg) || 0,
        totalPriceXof: Number(o.totalPriceXof) || 0
      };
    }
    return out;
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

  /** Rétention et MAU/WAU nationaux — calculés à la volée (pas de snapshot). */
  private async computeRetentionLive(): Promise<{
    mauByRole: JsonRecord;
    wauByRole: JsonRecord;
    retentionJ30: number | null;
    retentionJ90: number | null;
  }> {
    const now = new Date();
    const d30 = addUtcDays(startOfUtcDay(now), -30);
    const d7 = addUtcDays(startOfUtcDay(now), -7);
    const d90 = addUtcDays(startOfUtcDay(now), -90);
    const d120 = addUtcDays(startOfUtcDay(now), -120);

    const [mauUsers, wauUsers, cohort30, cohort90] = await Promise.all([
      this.prisma.user.findMany({
        where: { lastActiveAt: { gte: d30 } },
        select: { profiles: { select: { type: true } } }
      }),
      this.prisma.user.findMany({
        where: { lastActiveAt: { gte: d7 } },
        select: { profiles: { select: { type: true } } }
      }),
      this.prisma.user.findMany({
        where: {
          createdAt: { gte: d120, lt: d90 }
        },
        select: { lastActiveAt: true, createdAt: true }
      }),
      this.prisma.user.findMany({
        where: {
          createdAt: { gte: addUtcDays(d120, -60), lt: d120 }
        },
        select: { lastActiveAt: true, createdAt: true }
      })
    ]);

    const countByRole = (users: typeof mauUsers): JsonRecord => {
      const out: JsonRecord = {};
      for (const u of users) {
        for (const p of u.profiles) {
          out[p.type] = (out[p.type] ?? 0) + 1;
        }
      }
      return out;
    };

    const retentionRate = (
      cohort: Array<{ lastActiveAt: Date | null; createdAt: Date }>,
      days: number
    ): number | null => {
      if (cohort.length === 0) return null;
      let returned = 0;
      for (const u of cohort) {
        if (!u.lastActiveAt) continue;
        const threshold = addUtcDays(startOfUtcDay(u.createdAt), days);
        if (u.lastActiveAt >= threshold) returned += 1;
      }
      return safeRate(returned, cohort.length);
    };

    return {
      mauByRole: countByRole(mauUsers),
      wauByRole: countByRole(wauUsers),
      retentionJ30: retentionRate(cohort30, 30),
      retentionJ90: retentionRate(cohort90, 90)
    };
  }
}
