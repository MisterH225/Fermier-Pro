import { Test } from "@nestjs/testing";
import { LivestockExitKind } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { RegionStatsSnapshotService } from "./region-stats-snapshot.service";
import { addUtcDays, startOfUtcDay } from "./region-stats-date.util";

describe("RegionStatsSnapshotService", () => {
  const targetDate = startOfUtcDay(new Date("2026-07-10T12:00:00.000Z"));

  const prisma = {
    farm: { findMany: jest.fn() },
    animal: { findMany: jest.fn() },
    livestockExit: { findMany: jest.fn() },
    litter: { findMany: jest.fn() },
    vetConsultation: { findMany: jest.fn() },
    animalWeight: { findMany: jest.fn() },
    livestockBatchWeight: { findMany: jest.fn() },
    gestation: { findMany: jest.fn() },
    farmHealthRecord: { findMany: jest.fn() },
    farmExpense: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    regionStatsDaily: { upsert: jest.fn() }
  };

  let service: RegionStatsSnapshotService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.farm.findMany.mockResolvedValue([
      { id: "farm-a", departmentCode: "CI-AB" },
      { id: "farm-b", departmentCode: "CI-AB" },
      { id: "farm-c", departmentCode: "CI-BK" }
    ]);
    prisma.animal.findMany.mockResolvedValue([
      {
        farmId: "farm-a",
        productionCategory: "fattening",
        healthStatus: "healthy"
      },
      {
        farmId: "farm-b",
        productionCategory: "breeding_female",
        healthStatus: "healthy"
      },
      {
        farmId: "farm-c",
        productionCategory: "fattening",
        healthStatus: "sick"
      }
    ]);
    prisma.livestockExit.findMany.mockImplementation(
      async (args: {
        where: { kind?: LivestockExitKind; occurredAt?: unknown };
        distinct?: string[];
      }) => {
        if (args.distinct) {
          return [{ farmId: "farm-a" }];
        }
        if (args.where.kind === LivestockExitKind.mortality) {
          return [
            {
              farmId: "farm-a",
              animalId: null,
              kind: LivestockExitKind.mortality,
              headcountAffected: 2,
              deathCause: "infection",
              price: null,
              weightKg: null,
              occurredAt: targetDate,
              animal: null
            }
          ];
        }
        // Appel sans kind = toutes les sorties du jour
        if (!args.where.kind && args.where.occurredAt) {
          return [
            {
              farmId: "farm-a",
              animalId: null,
              kind: LivestockExitKind.mortality,
              headcountAffected: 2,
              deathCause: "infection",
              price: null,
              weightKg: null,
              occurredAt: targetDate,
              animal: null
            }
          ];
        }
        return [];
      }
    );
    prisma.litter.findMany.mockResolvedValue([]);
    prisma.vetConsultation.findMany.mockResolvedValue([{ farmId: "farm-b" }]);
    prisma.animalWeight.findMany.mockResolvedValue([]);
    prisma.livestockBatchWeight.findMany.mockResolvedValue([]);
    prisma.gestation.findMany.mockResolvedValue([]);
    prisma.farmHealthRecord.findMany.mockResolvedValue([]);
    prisma.farmExpense.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.regionStatsDaily.upsert.mockResolvedValue({});

    const module = await Test.createTestingModule({
      providers: [
        RegionStatsSnapshotService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get(RegionStatsSnapshotService);
  });

  it("upsert idempotent par date et département", async () => {
    await service.snapshotForDate(targetDate);
    await service.snapshotForDate(targetDate);

    expect(prisma.regionStatsDaily.upsert).toHaveBeenCalledTimes(4);
    const calls = prisma.regionStatsDaily.upsert.mock.calls;
    const abCalls = calls.filter(
      (c) => c[0].where.date_departmentCode.departmentCode === "CI-AB"
    );
    expect(abCalls).toHaveLength(2);
    expect(abCalls[0][0].create.mortalityHeadcount).toBe(2);
    expect(abCalls[0][0].update.mortalityHeadcount).toBe(2);
    expect(abCalls[0][0].where.date_departmentCode.date).toEqual(targetDate);
    expect(abCalls[0][0].create.herdCountForIncidence).toBe(2);
    expect(abCalls[0][0].create.activeSowsCount).toBe(1);
  });

  it("compte fausses couches (aborted/lost) et normalise diagnostics", async () => {
    prisma.gestation.findMany.mockImplementation(
      async (args: { where: { status?: unknown; matingDate?: unknown } }) => {
        if (args.where.matingDate) {
          return [
            { farmId: "farm-a", matingType: "artificial_insemination" },
            { farmId: "farm-a", matingType: "natural" }
          ];
        }
        if (
          args.where.status &&
          typeof args.where.status === "object" &&
          "in" in (args.where.status as object)
        ) {
          return [
            {
              farmId: "farm-a",
              status: "aborted",
              gestationNumber: 2,
              sowId: "sow-1",
              actualBirthDate: null
            },
            {
              farmId: "farm-a",
              status: "lost",
              gestationNumber: 1,
              sowId: "sow-2",
              actualBirthDate: null
            },
            {
              farmId: "farm-a",
              status: "completed",
              gestationNumber: 3,
              sowId: "sow-3",
              actualBirthDate: targetDate
            }
          ];
        }
        return [];
      }
    );
    prisma.farmHealthRecord.findMany.mockImplementation(
      async (args: { where: { kind?: string }; distinct?: string[] }) => {
        if (args.distinct) return [];
        if (args.where.kind === "disease") {
          return [
            { farmId: "farm-a", disease: { diagnosis: "PPA" } },
            { farmId: "farm-a", disease: { diagnosis: "ppa" } }
          ];
        }
        return [];
      }
    );

    await service.snapshotForDate(targetDate);
    const create = prisma.regionStatsDaily.upsert.mock.calls.find(
      (c) => c[0].where.date_departmentCode.departmentCode === "CI-AB"
    )![0].create;

    expect(create.gestationsAborted).toBe(1);
    expect(create.gestationsLost).toBe(1);
    expect(create.gestationsCompleted).toBe(1);
    expect(create.matingsAI).toBe(1);
    expect(create.diseaseSuspicionsByDiagnosis).toEqual({ ppa: 2 });
  });

  it("backfillRange appelle snapshotForDate pour chaque jour", async () => {
    const spy = jest
      .spyOn(service, "snapshotForDate")
      .mockResolvedValue(undefined);
    const from = targetDate;
    const to = addUtcDays(targetDate, 2);
    await service.backfillRange(from, to);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
