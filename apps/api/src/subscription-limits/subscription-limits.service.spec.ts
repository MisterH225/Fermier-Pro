import {
  FarmInvitationStatus,
  FarmStatus,
  MembershipRole,
  MerchantProductDisabledReason,
  MerchantProductStatus,
  MerchantSubscriptionTier
} from "@prisma/client";
import { ForbiddenException } from "@nestjs/common";
import { SubscriptionLimitsService } from "./subscription-limits.service";
import { SUBSCRIPTION_LIMIT_ERROR } from "./subscription-limit.errors";

describe("SubscriptionLimitsService", () => {
  function buildPrisma(overrides: Record<string, unknown> = {}) {
    return {
      platformSettings: {
        findUnique: jest.fn().mockResolvedValue({
          producerStandardMaxFarms: 1,
          producerPremiumMaxFarms: null,
          merchantStandardMaxShops: 1,
          merchantStandardMaxProductsPerShop: 3,
          merchantPremiumMaxShops: 3,
          merchantPremiumMaxProductsPerShop: null
        })
      },
      producerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionTier: MerchantSubscriptionTier.free
        })
      },
      merchantProfile: {
        findUnique: jest.fn().mockResolvedValue({
          subscriptionTier: MerchantSubscriptionTier.free
        })
      },
      farm: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      farmMembership: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      farmInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      merchantShop: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          writeLockedAt: null,
          archivedAt: null
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      merchantProduct: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      $transaction: jest.fn(async (ops: unknown) => {
        if (typeof ops === "function") {
          return ops({});
        }
        return ops;
      }),
      ...overrides
    };
  }

  it("resolveMaxFarms: null = unlimited for premium default", () => {
    const service = new SubscriptionLimitsService(buildPrisma() as never);
    const limits = service.limitsFromSettings(null);
    expect(service.resolveMaxFarms(MerchantSubscriptionTier.premium, limits)).toBeNull();
    expect(service.resolveMaxFarms(MerchantSubscriptionTier.free, limits)).toBe(1);
  });

  it("assertWithinLimit does not throw when max is null", () => {
    const service = new SubscriptionLimitsService(buildPrisma() as never);
    expect(() =>
      service.assertWithinLimit(999, null, SUBSCRIPTION_LIMIT_ERROR.FARM_LIMIT_REACHED, "x")
    ).not.toThrow();
  });

  it("assertFarmCreate throws FARM_LIMIT_REACHED", async () => {
    const prisma = buildPrisma();
    prisma.farm.count = jest.fn().mockResolvedValue(1);
    const service = new SubscriptionLimitsService(prisma as never);
    await expect(service.assertFarmCreate("u1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
    try {
      await service.assertFarmCreate("u1");
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: SUBSCRIPTION_LIMIT_ERROR.FARM_LIMIT_REACHED
      });
    }
  });

  it("assertShopCreate throws SHOP_LIMIT_REACHED", async () => {
    const prisma = buildPrisma();
    prisma.merchantShop.count = jest.fn().mockResolvedValue(1);
    const service = new SubscriptionLimitsService(prisma as never);
    try {
      await service.assertShopCreate("mp1");
      fail("expected throw");
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: SUBSCRIPTION_LIMIT_ERROR.SHOP_LIMIT_REACHED
      });
    }
  });

  it("assertProductPublish blocks write-locked shop", async () => {
    const prisma = buildPrisma();
    prisma.merchantShop.findUnique = jest.fn().mockResolvedValue({
      writeLockedAt: new Date(),
      archivedAt: null
    });
    const service = new SubscriptionLimitsService(prisma as never);
    await expect(
      service.assertProductPublish("s1", MerchantSubscriptionTier.free)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("assertProductPublish throws PRODUCT_LIMIT_REACHED per shop", async () => {
    const prisma = buildPrisma();
    prisma.merchantProduct.count = jest.fn().mockResolvedValue(3);
    const service = new SubscriptionLimitsService(prisma as never);
    try {
      await service.assertProductPublish("s1", MerchantSubscriptionTier.free);
      fail("expected throw");
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: SUBSCRIPTION_LIMIT_ERROR.PRODUCT_LIMIT_REACHED
      });
    }
  });

  it("applyProducerDemotion locks excess farms and archives memberships", async () => {
    const prisma = buildPrisma();
    prisma.farm.findMany = jest
      .fn()
      .mockResolvedValueOnce([
        { id: "f-old" },
        { id: "f-new" }
      ])
      .mockResolvedValueOnce([
        { id: "f-old" },
        { id: "f-new" }
      ]);
    const service = new SubscriptionLimitsService(prisma as never);
    await service.applyProducerDemotion("owner-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    const ops = (prisma.$transaction as jest.Mock).mock.calls[0]![0] as unknown[];
    expect(ops.length).toBeGreaterThan(0);
    expect(prisma.farm.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["f-new"] } },
        data: expect.objectContaining({ writeLockedAt: expect.any(Date) })
      })
    );
    expect(prisma.farmMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { archived: true },
        where: expect.objectContaining({
          role: { not: MembershipRole.owner }
        })
      })
    );
    expect(prisma.farmInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: FarmInvitationStatus.expired }
      })
    );
  });

  it("applyMerchantDemotion locks excess shops and unpublishes excess products", async () => {
    const prisma = buildPrisma();
    prisma.merchantShop.findMany = jest.fn().mockResolvedValue([
      {
        id: "shop-1",
        products: [{ id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }]
      },
      {
        id: "shop-2",
        products: [{ id: "p5" }]
      }
    ]);
    const service = new SubscriptionLimitsService(prisma as never);
    await service.applyMerchantDemotion("mp1");

    expect(prisma.merchantShop.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["shop-2"] } },
        data: expect.objectContaining({ writeLockedAt: expect.any(Date) })
      })
    );
    expect(prisma.merchantProduct.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining(["p4", "p5"]) } },
        data: expect.objectContaining({
          status: MerchantProductStatus.disabled,
          disabledReason: MerchantProductDisabledReason.downgrade
        })
      })
    );
  });

  it("restoreProducerPremium clears locks and unarchives memberships", async () => {
    const prisma = buildPrisma();
    prisma.farm.findMany = jest.fn().mockResolvedValue([{ id: "f1" }]);
    const service = new SubscriptionLimitsService(prisma as never);
    await service.restoreProducerPremium("u1");
    expect(prisma.farm.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { writeLockedAt: null }
      })
    );
    expect(prisma.farmMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { archived: false },
        where: expect.objectContaining({ archived: true })
      })
    );
  });

  it("restoreMerchantPremium republishes downgrade/limit_free products", async () => {
    const prisma = buildPrisma();
    prisma.merchantShop.findMany = jest.fn().mockResolvedValue([{ id: "s1" }]);
    const service = new SubscriptionLimitsService(prisma as never);
    await service.restoreMerchantPremium("mp1");
    expect(prisma.merchantProduct.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          disabledReason: {
            in: [
              MerchantProductDisabledReason.downgrade,
              MerchantProductDisabledReason.limit_free
            ]
          }
        }),
        data: expect.objectContaining({
          status: MerchantProductStatus.published,
          disabledReason: null
        })
      })
    );
  });

  it("limitsFromSettings: null fields mean unlimited; missing row uses defaults", () => {
    const service = new SubscriptionLimitsService(buildPrisma() as never);
    expect(service.limitsFromSettings(null).producerStandardMaxFarms).toBe(1);
    const limits = service.limitsFromSettings({
      producerStandardMaxFarms: null,
      producerPremiumMaxFarms: 10,
      merchantStandardMaxShops: null,
      merchantStandardMaxProductsPerShop: null,
      merchantPremiumMaxShops: null,
      merchantPremiumMaxProductsPerShop: 99
    } as never);
    expect(limits.producerStandardMaxFarms).toBeNull();
    expect(limits.producerPremiumMaxFarms).toBe(10);
    expect(limits.merchantStandardMaxShops).toBeNull();
    expect(limits.merchantStandardMaxProductsPerShop).toBeNull();
    expect(limits.merchantPremiumMaxShops).toBeNull();
    expect(limits.merchantPremiumMaxProductsPerShop).toBe(99);
  });

  it("keeps FarmStatus.active filter concept for demotion farms", () => {
    expect(FarmStatus.active).toBe("active");
  });
});
