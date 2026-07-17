import {
  MerchantOrderStatus,
  MerchantProductDisabledReason,
  MerchantProductStatus
} from "@prisma/client";
import {
  archiveShopInTransaction,
  countAnyOrdersForShop,
  countBlockingOrdersForShop,
  shopActiveOrdersConflict,
  shopOrderHistoryConflict
} from "./merchant-shop-archive";
import { MERCHANT_ERROR } from "./merchant-shop.constants";

function mockTx(overrides: Record<string, unknown> = {}) {
  return {
    merchantOrder: {
      count: jest.fn().mockResolvedValue(0)
    },
    merchantShop: {
      findUnique: jest.fn().mockResolvedValue({
        id: "shop-1",
        archivedAt: null
      }),
      update: jest.fn().mockResolvedValue({ id: "shop-1" }),
      delete: jest.fn().mockResolvedValue({ id: "shop-1" })
    },
    merchantProduct: {
      updateMany: jest.fn().mockResolvedValue({ count: 3 })
    },
    ...overrides
  } as never;
}

describe("merchant-shop-archive", () => {
  it("compte les commandes bloquantes", async () => {
    const tx = mockTx();
    (tx as { merchantOrder: { count: jest.Mock } }).merchantOrder.count.mockResolvedValue(
      2
    );
    await expect(countBlockingOrdersForShop(tx, "shop-1")).resolves.toBe(2);
    expect(
      (tx as { merchantOrder: { count: jest.Mock } }).merchantOrder.count
    ).toHaveBeenCalledWith({
      where: {
        product: { shopId: "shop-1" },
        status: {
          in: [
            MerchantOrderStatus.paid,
            MerchantOrderStatus.confirmed,
            MerchantOrderStatus.shipping,
            MerchantOrderStatus.delivered,
            MerchantOrderStatus.disputed
          ]
        }
      }
    });
  });

  it("archive atomiquement et dépublie les produits", async () => {
    const tx = mockTx();
    const at = new Date("2026-07-17T12:00:00.000Z");
    const result = await archiveShopInTransaction(tx, "shop-1", at);
    expect(result.productCount).toBe(3);
    expect(
      (tx as { merchantShop: { update: jest.Mock } }).merchantShop.update
    ).toHaveBeenCalledWith({
      where: { id: "shop-1" },
      data: { archivedAt: at }
    });
    expect(
      (tx as { merchantProduct: { updateMany: jest.Mock } }).merchantProduct
        .updateMany
    ).toHaveBeenCalledWith({
      where: {
        shopId: "shop-1",
        status: {
          in: [MerchantProductStatus.published, MerchantProductStatus.draft]
        }
      },
      data: {
        status: MerchantProductStatus.disabled,
        disabledAt: at,
        disabledReason: MerchantProductDisabledReason.shop_archived
      }
    });
  });

  it("refuse l’archivage si déjà archivée", async () => {
    const tx = mockTx({
      merchantShop: {
        findUnique: jest.fn().mockResolvedValue({
          id: "shop-1",
          archivedAt: new Date()
        }),
        update: jest.fn()
      }
    });
    await expect(archiveShopInTransaction(tx, "shop-1")).rejects.toMatchObject({
      response: { code: MERCHANT_ERROR.SHOP_ALREADY_ARCHIVED }
    });
  });

  it("expose 409 actifs / historique", () => {
    expect(shopActiveOrdersConflict(1).getResponse()).toMatchObject({
      code: MERCHANT_ERROR.SHOP_HAS_ACTIVE_ORDERS,
      activeOrderCount: 1
    });
    expect(shopOrderHistoryConflict(4).getResponse()).toMatchObject({
      code: MERCHANT_ERROR.SHOP_HAS_ORDER_HISTORY,
      orderCount: 4
    });
  });

  it("compte tout l’historique pour hard delete", async () => {
    const tx = mockTx();
    (tx as { merchantOrder: { count: jest.Mock } }).merchantOrder.count.mockResolvedValue(
      5
    );
    await expect(countAnyOrdersForShop(tx, "shop-1")).resolves.toBe(5);
  });
});
