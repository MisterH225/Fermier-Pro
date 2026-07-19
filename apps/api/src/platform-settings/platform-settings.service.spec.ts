import { Prisma } from "@prisma/client";
import { PlatformSettingsService } from "./platform-settings.service";

function defaultRow(
  overrides: Partial<Record<string, unknown>> = {}
): Record<string, unknown> {
  return {
    id: "default",
    marketplaceCommissionRate: 0.015,
    sellerMarketplaceCommissionRate: 0.02,
    vetCommissionRate: 0.01,
    supportPhone: null,
    supportTelegramUrl: null,
    marketplaceWeightArbitrationMinDiffKg: 1,
    marketplaceWeightArbitrationCumulativeMinDiffKg: 5,
    marketplaceWeightTolerancePercent: 3,
    ...overrides
  };
}

describe("PlatformSettingsService", () => {
  const prisma = {
    platformSettings: {
      upsert: jest.fn(),
      findUnique: jest.fn()
    }
  };

  let service: PlatformSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlatformSettingsService(prisma as never);
  });

  it("getPublicFeeRates lit une seule fois la ligne default", async () => {
    prisma.platformSettings.upsert.mockResolvedValue(defaultRow());
    const fees = await service.getPublicFeeRates();
    expect(fees).toEqual({
      marketplaceBuyerCommissionRate: 0.015,
      marketplaceSellerCommissionRate: 0.02,
      vetCommissionRate: 0.01
    });
    expect(prisma.platformSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it("coalesce les appels concurrents sur un seul upsert", async () => {
    let resolveUpsert!: (value: Record<string, unknown>) => void;
    prisma.platformSettings.upsert.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpsert = resolve;
        })
    );

    const p1 = service.getSupportContact();
    const p2 = service.getPublicFeeRates();
    expect(prisma.platformSettings.upsert).toHaveBeenCalledTimes(1);

    resolveUpsert(defaultRow());
    await Promise.all([p1, p2]);
    expect(prisma.platformSettings.upsert).toHaveBeenCalledTimes(1);
  });

  it("récupère via findUnique après collision P2002", async () => {
    prisma.platformSettings.upsert.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["id"] }
      })
    );
    prisma.platformSettings.findUnique.mockResolvedValue(defaultRow());

    await expect(service.getOrCreateSettingsRow()).resolves.toMatchObject({
      id: "default"
    });
    expect(prisma.platformSettings.findUnique).toHaveBeenCalledWith({
      where: { id: "default" }
    });
  });
});
