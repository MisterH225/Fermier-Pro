import { InsightsService } from "./insights.service";

describe("InsightsService", () => {
  const farmAccess = { requireFarmAccess: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    animal: { findFirst: jest.fn() },
    animalWeight: { findMany: jest.fn() },
    livestockBatch: { findFirst: jest.fn() },
    livestockBatchWeight: { findMany: jest.fn() },
    livestockExit: { findFirst: jest.fn() },
    pigPriceIndexDaily: { findFirst: jest.fn() },
    litter: { findFirst: jest.fn(), findMany: jest.fn() }
  };

  const service = new InsightsService(prisma as never, farmAccess as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("gmqInsightFromPoints", () => {
    it("félicite la première pesée", () => {
      expect(service.gmqInsightFromPoints([{ kg: 20, at: new Date() }])).toEqual(
        {
          kind: "first",
          headline: { key: "insights.firstWeighing" }
        }
      );
    });

    it("calcule un delta GMQ entre deux intervalles", () => {
      const d0 = new Date("2026-01-01T00:00:00Z");
      const d1 = new Date("2026-01-11T00:00:00Z"); // +10j
      const d2 = new Date("2026-01-21T00:00:00Z"); // +10j
      // intervalle 1: +5 kg / 10j = 500 g/j
      // intervalle 2: +6 kg / 10j = 600 g/j → +20 %
      const insight = service.gmqInsightFromPoints([
        { kg: 20, at: d0 },
        { kg: 25, at: d1 },
        { kg: 31, at: d2 }
      ]);
      expect(insight?.kind).toBe("delta");
      expect(insight?.headline.key).toBe("insights.gmqUp");
      expect(insight?.headline.params?.gmq).toBe(600);
      expect(insight?.headline.params?.delta).toBe("+20");
    });

    it("signale une baisse sans jugement", () => {
      const d0 = new Date("2026-01-01T00:00:00Z");
      const d1 = new Date("2026-01-11T00:00:00Z");
      const d2 = new Date("2026-01-21T00:00:00Z");
      const insight = service.gmqInsightFromPoints([
        { kg: 20, at: d0 },
        { kg: 30, at: d1 },
        { kg: 35, at: d2 }
      ]);
      expect(insight?.headline.key).toBe("insights.gmqDown");
    });
  });

  describe("afterSale", () => {
    const user = { id: "u1" } as never;

    it("204 logique (null) sans prix ou poids", async () => {
      prisma.livestockExit.findFirst.mockResolvedValue({
        price: { toNumber: () => 0 },
        weightKg: { toNumber: () => 100 },
        currency: "XOF"
      });
      await expect(service.afterSale(user, "f1", "e1")).resolves.toBeNull();
    });

    it("compare au dernier index national", async () => {
      prisma.livestockExit.findFirst.mockResolvedValue({
        price: { toNumber: () => 185_000 },
        weightKg: { toNumber: () => 100 },
        currency: "XOF"
      });
      prisma.pigPriceIndexDaily.findFirst.mockResolvedValue({
        avgPricePerKg: { toNumber: () => 1780 },
        date: new Date()
      });
      const insight = await service.afterSale(user, "f1", "e1");
      expect(insight?.headline.key).toBe("insights.saleVsIndex");
      expect(insight?.headline.params?.pricePerKg).toBe(1850);
      expect(insight?.headline.params?.index).toBe(1780);
    });
  });

  describe("afterFarrowing", () => {
    const user = { id: "u1" } as never;

    it("félicite la première portée de la ferme", async () => {
      prisma.litter.findFirst.mockResolvedValue({
        id: "l1",
        bornAlive: 10,
        recordedAt: new Date()
      });
      prisma.litter.findMany.mockResolvedValue([]);
      const insight = await service.afterFarrowing(user, "f1", "l1");
      expect(insight?.headline.key).toBe("insights.firstLitter");
    });

    it("compare aux 12 derniers mois de la ferme", async () => {
      prisma.litter.findFirst.mockResolvedValue({
        id: "l2",
        bornAlive: 12,
        recordedAt: new Date()
      });
      prisma.litter.findMany.mockResolvedValue([
        { bornAlive: 8 },
        { bornAlive: 10 }
      ]);
      const insight = await service.afterFarrowing(user, "f1", "l2");
      expect(insight?.headline.key).toBe("insights.litterVsFarmAvg");
      expect(insight?.headline.params?.avg).toBe(9);
    });
  });
});
