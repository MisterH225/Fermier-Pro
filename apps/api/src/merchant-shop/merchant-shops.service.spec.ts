import { MERCHANT_ERROR } from "./merchant-shop.constants";
import { MerchantShopsService } from "./merchant-shops.service";

describe("MerchantShopsService.archiveShop", () => {
  const user = { id: "user-1" } as never;

  function buildService(opts: {
    blockingOrders?: number;
    productsDisabled?: number;
  }) {
    const shop = {
      id: "shop-1",
      name: "Ma boutique",
      archivedAt: null,
      merchantProfileId: "mp-1"
    };
    const prisma = {
      merchantShop: {
        findFirst: jest.fn().mockResolvedValue(shop)
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          merchantOrder: {
            count: jest.fn().mockResolvedValue(opts.blockingOrders ?? 0)
          },
          merchantShop: {
            findUnique: jest.fn().mockResolvedValue(shop),
            update: jest.fn().mockResolvedValue({ ...shop, archivedAt: new Date() })
          },
          merchantProduct: {
            updateMany: jest
              .fn()
              .mockResolvedValue({ count: opts.productsDisabled ?? 2 })
          }
        };
        return fn(tx);
      })
    };
    const profiles = {
      requireProfile: jest.fn(),
      countActiveProducts: jest.fn().mockReturnValue(0),
      maxShopsForTier: jest.fn().mockReturnValue(1)
    };
    return {
      service: new MerchantShopsService(prisma as never, profiles as never),
      prisma,
      shop
    };
  }

  it("archive et dépublie quand aucune commande bloquante", async () => {
    const { service } = buildService({ productsDisabled: 2 });
    const result = await service.archiveShop(user, "shop-1");
    expect(result).toMatchObject({
      ok: true,
      id: "shop-1",
      unpublishedProductCount: 2
    });
    expect(result.archivedAt).toBeTruthy();
  });

  it("refuse 409 avec commandes en cours", async () => {
    const { service } = buildService({ blockingOrders: 3 });
    await expect(service.archiveShop(user, "shop-1")).rejects.toMatchObject({
      response: {
        code: MERCHANT_ERROR.SHOP_HAS_ACTIVE_ORDERS,
        activeOrderCount: 3
      }
    });
  });
});

describe("MerchantShopsService.list", () => {
  it("filtre les boutiques archivées", async () => {
    const profiles = {
      requireProfile: jest.fn().mockResolvedValue({
        shops: [
          {
            id: "a",
            name: "Active",
            description: null,
            locationLabel: null,
            archivedAt: null,
            products: [],
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: "b",
            name: "Archivée",
            description: null,
            locationLabel: null,
            archivedAt: new Date(),
            products: [],
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }),
      countActiveProducts: jest.fn().mockReturnValue(0)
    };
    const service = new MerchantShopsService({} as never, profiles as never);
    const rows = await service.list({ id: "u1" } as never);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("a");
  });
});
