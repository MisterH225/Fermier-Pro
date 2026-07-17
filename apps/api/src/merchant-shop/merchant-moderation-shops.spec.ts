import { MERCHANT_ERROR } from "./merchant-shop.constants";
import { MerchantModerationService } from "./merchant-moderation.service";

describe("MerchantModerationService shops", () => {
  const admin = { id: "admin-1" } as never;

  it("hard delete OK sans historique (avec garde)", async () => {
    const allowCalls: string[] = [];
    const prisma = {
      merchantShop: {
        findUnique: jest.fn().mockResolvedValue({
          id: "shop-1",
          name: "Shop",
          merchantProfile: { userId: "seller-1" },
          _count: { products: 2 }
        }),
        delete: jest.fn().mockResolvedValue({ id: "shop-1" })
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          merchantOrder: { count: jest.fn().mockResolvedValue(0) },
          merchantShop: {
            delete: jest.fn().mockResolvedValue({ id: "shop-1" })
          },
          $executeRawUnsafe: jest.fn(async (sql: string) => {
            allowCalls.push(sql);
            return 1;
          })
        };
        return fn(tx);
      })
    };
    const push = { sendToUser: jest.fn() };
    const audit = { record: jest.fn() };
    const subscription = {};
    const service = new MerchantModerationService(
      prisma as never,
      push as never,
      subscription as never,
      audit as never
    );

    const result = await service.hardDeleteShop(admin, "shop-1", {
      reason: "Spam boutique"
    });
    expect(result).toEqual({ ok: true, id: "shop-1" });
    expect(allowCalls[0]).toMatch(/allow_merchant_catalog_delete/);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "merchant_shop.hard_delete" })
    );
    expect(push.sendToUser).toHaveBeenCalled();
  });

  it("hard delete refusé avec historique", async () => {
    const prisma = {
      merchantShop: {
        findUnique: jest.fn().mockResolvedValue({
          id: "shop-1",
          name: "Shop",
          merchantProfile: { userId: "seller-1" },
          _count: { products: 1 }
        })
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          merchantOrder: { count: jest.fn().mockResolvedValue(7) },
          merchantShop: { delete: jest.fn() },
          $executeRawUnsafe: jest.fn()
        };
        return fn(tx);
      })
    };
    const service = new MerchantModerationService(
      prisma as never,
      { sendToUser: jest.fn() } as never,
      {} as never,
      { record: jest.fn() } as never
    );

    await expect(
      service.hardDeleteShop(admin, "shop-1", { reason: "Nettoyage" })
    ).rejects.toMatchObject({
      response: { code: MERCHANT_ERROR.SHOP_HAS_ORDER_HISTORY, orderCount: 7 }
    });
  });

  it("orphans détecte produits publiés sur boutique archivée", async () => {
    const prisma = {
      merchantProfile: {
        findMany: jest.fn().mockResolvedValue([])
      },
      merchantProduct: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "prod-1",
            name: "Sac",
            shop: { id: "shop-arch", name: "Ghost" }
          }
        ])
      }
    };
    const service = new MerchantModerationService(
      prisma as never,
      { sendToUser: jest.fn() } as never,
      {} as never,
      { record: jest.fn() } as never
    );

    const result = await service.listOrphans();
    expect(result.publishedOnArchivedOrOrphanShop).toEqual([
      expect.objectContaining({
        id: "prod-1",
        reason: "published_on_archived_shop"
      })
    ]);
    expect(result.counts.publishedIssues).toBe(1);
  });

  it("orphans détecte boutique sans Profile merchant actif", async () => {
    const prisma = {
      merchantProfile: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "mp-1",
            userId: "u-1",
            isActive: true,
            user: {
              id: "u-1",
              email: "ghost@test.com",
              fullName: "Ghost",
              profiles: []
            },
            shops: [
              {
                id: "shop-orphan",
                name: "Orpheline",
                archivedAt: null,
                merchantProfileId: "mp-1",
                products: [
                  { id: "p1", name: "Item", status: "published" }
                ]
              }
            ]
          }
        ])
      },
      merchantProduct: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new MerchantModerationService(
      prisma as never,
      { sendToUser: jest.fn() } as never,
      {} as never,
      { record: jest.fn() } as never
    );

    const result = await service.listOrphans();
    expect(result.orphanShops).toEqual([
      expect.objectContaining({
        id: "shop-orphan",
        reason: "missing_or_inactive_merchant_profile"
      })
    ]);
    expect(result.publishedOnArchivedOrOrphanShop[0]).toMatchObject({
      id: "p1",
      reason: expect.stringContaining("orphan_shop")
    });
  });
});
