import { ConflictException } from "@nestjs/common";
import {
  MerchantOrderDisputeStatus,
  MerchantOrderStatus
} from "@prisma/client";
import { MERCHANT_ERROR } from "./merchant-shop.constants";
import { MerchantOrdersService } from "./merchant-orders.service";

describe("MerchantOrdersService litige post-completed (clawback)", () => {
  const adminId = "admin-1";
  const sellerId = "seller-1";
  const buyerId = "buyer-1";

  function baseOrder(overrides: Record<string, unknown> = {}) {
    const now = new Date("2026-07-17T12:00:00.000Z");
    return {
      id: "order-1",
      productId: "prod-1",
      buyerUserId: buyerId,
      sellerUserId: sellerId,
      quantity: 1,
      unitPrice: 10_000,
      totalAmount: 10_000,
      buyerCommission: 500,
      sellerCommission: 300,
      paymentMethod: "wallet",
      providerRef: null,
      escrowHeld: false,
      status: MerchantOrderStatus.disputed,
      paidAt: now,
      confirmedAt: now,
      shippedAt: now,
      deliveredAt: now,
      completedAt: now,
      rejectedAt: null,
      disputeOpenedAt: now,
      resolvedAt: null,
      resolutionNote: null,
      timeoutAt: null,
      createdAt: now,
      events: [],
      buyer: { id: buyerId, fullName: "Buyer", phone: null },
      seller: { id: sellerId, fullName: "Seller", phone: null },
      dispute: {
        id: "disp-1",
        status: MerchantOrderDisputeStatus.open,
        reason: "Produit défectueux",
        sellerNote: null,
        buyerNote: null,
        resolvedAt: null,
        resolutionNote: null,
        createdAt: now
      },
      product: {
        id: "prod-1",
        name: "Aliment",
        currency: "XOF",
        photoUrls: [],
        stock: 0,
        status: "published"
      },
      ...overrides
    };
  }

  function buildService(opts: {
    order: ReturnType<typeof baseOrder>;
    wallet?: {
      debitMerchantClawback?: jest.Mock;
      creditMerchantOrderRefund?: jest.Mock;
      creditMerchantPayout?: jest.Mock;
    };
    platformRevenue?: { findFirst: jest.Mock; update: jest.Mock };
  }) {
    const wallet = {
      debitMerchantClawback:
        opts.wallet?.debitMerchantClawback ?? jest.fn().mockResolvedValue({}),
      creditMerchantOrderRefund:
        opts.wallet?.creditMerchantOrderRefund ??
        jest.fn().mockResolvedValue({}),
      creditMerchantPayout:
        opts.wallet?.creditMerchantPayout ?? jest.fn().mockResolvedValue({})
    };
    const platformRevenue = opts.platformRevenue ?? {
      findFirst: jest.fn().mockResolvedValue({
        id: "rev-1",
        type: "COMMISSION",
        commissionAmount: 800
      }),
      update: jest.fn().mockResolvedValue({})
    };
    const prisma = {
      merchantOrder: {
        findFirst: jest.fn().mockResolvedValue(opts.order),
        findUniqueOrThrow: jest.fn().mockResolvedValue(opts.order),
        update: jest.fn().mockResolvedValue(opts.order)
      },
      merchantOrderDispute: {
        update: jest.fn().mockResolvedValue({})
      },
      merchantOrderEvent: {
        create: jest.fn().mockResolvedValue({})
      },
      merchantProduct: {
        update: jest.fn().mockResolvedValue({})
      },
      platformRevenue,
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        if (typeof fn === "function") {
          const updated = {
            ...opts.order,
            status: MerchantOrderStatus.refunded,
            escrowHeld: false,
            resolvedAt: new Date()
          };
          return fn({
            merchantOrder: {
              update: jest.fn().mockResolvedValue(updated)
            },
            merchantOrderEvent: {
              create: jest.fn().mockResolvedValue({})
            }
          });
        }
        return fn;
      })
    };
    const notifications = { notify: jest.fn() };
    const service = new MerchantOrdersService(
      prisma as never,
      {} as never,
      wallet as never,
      {} as never,
      {} as never,
      {} as never,
      notifications as never,
      {} as never
    );
    return { service, wallet, platformRevenue, prisma, notifications };
  }

  it("admin buyer-win post-completed : débit vendeur (net) + crédit acheteur (total payé) + reversal commissions", async () => {
    const order = baseOrder();
    const { service, wallet, platformRevenue } = buildService({ order });

    await service.resolveDispute(adminId, "order-1", "buyer", "Défaut reconnu");

    // sellerNet = 10000 - 300 = 9700
    expect(wallet.debitMerchantClawback).toHaveBeenCalledWith(
      sellerId,
      9700,
      "XOF",
      "order-1",
      buyerId,
      expect.stringContaining("Clawback")
    );
    // blockedAmount = 10000 + 500 = 10500
    expect(wallet.creditMerchantOrderRefund).toHaveBeenCalledWith(
      buyerId,
      10500,
      "XOF",
      "order-1",
      expect.stringContaining("post-completed")
    );
    expect(platformRevenue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "COMMISSION_REVERSAL",
          commissionAmount: expect.anything()
        })
      })
    );
  });

  it("accept-return vendeur déclenche le même clawback", async () => {
    const order = baseOrder();
    const { service, wallet } = buildService({ order });

    await service.acceptReturn(
      { id: sellerId } as never,
      "order-1",
      "Je reprends l’article"
    );

    expect(wallet.debitMerchantClawback).toHaveBeenCalled();
    expect(wallet.creditMerchantOrderRefund).toHaveBeenCalled();
  });

  it("escrow encore tenu : refundEscrow sans clawback vendeur", async () => {
    const order = baseOrder({ escrowHeld: true });
    const refundEscrowAmounts = {
      debitMerchantClawback: jest.fn(),
      creditMerchantOrderRefund: jest.fn().mockResolvedValue({}),
      creditMerchantPayout: jest.fn()
    };
    const { service, wallet } = buildService({
      order,
      wallet: refundEscrowAmounts
    });
    // refundEscrow utilise computeAmounts via platformSettings — mock léger
    (service as unknown as { platformSettings: { getMarketplaceCommissionRate: jest.Mock; getSellerMarketplaceCommissionRate: jest.Mock } }).platformSettings = {
      getMarketplaceCommissionRate: jest.fn().mockResolvedValue(0.05),
      getSellerMarketplaceCommissionRate: jest.fn().mockResolvedValue(0.03)
    };

    await service.resolveDispute(adminId, "order-1", "buyer");

    expect(wallet.debitMerchantClawback).not.toHaveBeenCalled();
    expect(wallet.creditMerchantOrderRefund).toHaveBeenCalled();
  });

  it("solde vendeur insuffisant → 409 SELLER_BALANCE_INSUFFICIENT", async () => {
    const { BadRequestException } = await import("@nestjs/common");
    const order = baseOrder();
    const { service } = buildService({
      order,
      wallet: {
        debitMerchantClawback: jest
          .fn()
          .mockRejectedValue(
            new BadRequestException(
              "Solde insuffisant — rechargez votre portefeuille ou utilisez mobile money."
            )
          )
      }
    });

    await expect(
      service.resolveDispute(adminId, "order-1", "buyer")
    ).rejects.toBeInstanceOf(ConflictException);

    try {
      await service.resolveDispute(adminId, "order-1", "buyer");
    } catch (e) {
      expect((e as ConflictException).getResponse()).toMatchObject({
        code: MERCHANT_ERROR.SELLER_BALANCE_INSUFFICIENT
      });
    }
  });
});
