import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  MerchantOrderStatus,
  MerchantProductDisabledReason,
  MerchantProductStatus
} from "@prisma/client";
import { MerchantProductsService } from "./merchant-products.service";
import { MERCHANT_ERROR } from "./merchant-shop.constants";

describe("MerchantProductsService.remove", () => {
  const user = { id: "user-1" } as never;

  function makeService(overrides: {
    product?: Record<string, unknown> | null;
    blockingCount?: number;
  }) {
    const product =
      overrides.product === undefined
        ? {
            id: "prod-1",
            shopId: "shop-1",
            status: MerchantProductStatus.published,
            disabledReason: null,
            category: { id: "c1", name: "Cat", slug: "cat" },
            shop: { id: "shop-1", name: "Boutique" }
          }
        : overrides.product;

    const prisma = {
      merchantProduct: {
        findFirst: jest.fn().mockResolvedValue(product),
        update: jest.fn().mockResolvedValue(product)
      },
      merchantOrder: {
        count: jest.fn().mockResolvedValue(overrides.blockingCount ?? 0)
      },
      buyerMerchantFavorite: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      $transaction: jest.fn(async (ops: unknown) => {
        if (Array.isArray(ops)) {
          return Promise.all(ops);
        }
        return ops;
      })
    };

    const profiles = {
      requireProfile: jest.fn()
    };

    const service = new MerchantProductsService(
      prisma as never,
      profiles as never
    );
    return { service, prisma };
  }

  it("soft-delete le produit et purge les favoris", async () => {
    const { service, prisma } = makeService({});
    const result = await service.remove(user, "prod-1");

    expect(result.ok).toBe(true);
    expect(result.id).toBe("prod-1");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.merchantProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prod-1" },
        data: expect.objectContaining({
          status: MerchantProductStatus.disabled,
          publishedAt: null,
          disabledReason: MerchantProductDisabledReason.merchant_deleted
        })
      })
    );
    expect(prisma.buyerMerchantFavorite.deleteMany).toHaveBeenCalledWith({
      where: { productId: "prod-1" }
    });
  });

  it("refuse si commandes bloquantes", async () => {
    const { service, prisma } = makeService({ blockingCount: 2 });
    await expect(service.remove(user, "prod-1")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: MERCHANT_ERROR.PRODUCT_HAS_ACTIVE_ORDERS,
        activeOrderCount: 2
      })
    });
    expect(prisma.merchantProduct.update).not.toHaveBeenCalled();
  });

  it("refuse si produit introuvable / déjà supprimé (hors liste)", async () => {
    const { service } = makeService({ product: null });
    await expect(service.remove(user, "prod-missing")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("compte les commandes sur les statuts bloquants", async () => {
    const { service, prisma } = makeService({});
    await service.remove(user, "prod-1");
    expect(prisma.merchantOrder.count).toHaveBeenCalledWith({
      where: {
        productId: "prod-1",
        status: {
          in: expect.arrayContaining([
            MerchantOrderStatus.paid,
            MerchantOrderStatus.confirmed,
            MerchantOrderStatus.disputed
          ])
        }
      }
    });
  });

  it("ConflictException expose le code PRODUCT_HAS_ACTIVE_ORDERS", async () => {
    const { service } = makeService({ blockingCount: 1 });
    try {
      await service.remove(user, "prod-1");
      fail("expected ConflictException");
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: MERCHANT_ERROR.PRODUCT_HAS_ACTIVE_ORDERS
      });
    }
  });
});
