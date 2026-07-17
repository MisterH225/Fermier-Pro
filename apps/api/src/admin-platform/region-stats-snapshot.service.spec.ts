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
      { farmId: "farm-a", productionCategory: "fattening" },
      { farmId: "farm-b", productionCategory: "starter" },
      { farmId: "farm-c", productionCategory: "fattening" }
    ]);
    prisma.livestockExit.findMany.mockImplementation(
      async (args: { where: { kind: LivestockExitKind } }) => {
        if (args.where.kind === LivestockExitKind.mortality) {
          return [
            {
              farmId: "farm-a",
              headcountAffected: 2,
              deathCause: "infection"
            }
          ];
        }
        if (args.where.kind === LivestockExitKind.sale) {
          return [];
        }
        return [];
      }
    );
    prisma.litter.findMany.mockResolvedValue([]);
    prisma.vetConsultation.findMany.mockResolvedValue([
      { farmId: "farm-b" }
    ]);
    prisma.animalWeight.findMany.mockResolvedValue([]);
    prisma.livestockBatchWeight.findMany.mockResolvedValue([]);
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
