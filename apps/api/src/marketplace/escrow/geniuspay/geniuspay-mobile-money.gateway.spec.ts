import { GeniusPayMobileMoneyGateway } from "./geniuspay-mobile-money.gateway";
import type { GeniusPayClient } from "./geniuspay.client";
import type { PrismaService } from "../../../prisma/prisma.service";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT,
  GENIUSPAY_KIND_WALLET_TOPUP,
  GENIUSPAY_KIND_WALLET_WITHDRAW
} from "./geniuspay.types";

describe("GeniusPayMobileMoneyGateway", () => {
  const createPayment = jest.fn();
  const getPayment = jest.fn();
  const lookupPayment = jest.fn();
  const createPayout = jest.fn();
  const lookupPayout = jest.fn();
  const findUnique = jest.fn();

  const client = {
    createPayment,
    getPayment,
    lookupPayment,
    createPayout,
    lookupPayout
  } as unknown as GeniusPayClient;

  const prisma = {
    user: { findUnique }
  } as unknown as PrismaService;

  const gateway = new GeniusPayMobileMoneyGateway(client, prisma);

  beforeEach(() => {
    jest.resetAllMocks();
    lookupPayment.mockResolvedValue(null);
    lookupPayout.mockResolvedValue(null);
    findUnique.mockResolvedValue({
      fullName: "Test User",
      firstName: null,
      lastName: null,
      email: "test@example.com",
      phone: "+2250700000000"
    });
  });

  it("initie un paiement escrow avec checkout_url", async () => {
    createPayment.mockResolvedValue({
      id: 1,
      reference: "MTX-ESCROW1",
      amount: 10000,
      currency: "XOF",
      status: "pending",
      checkout_url: "https://geniuspay.ci/checkout/MTX-ESCROW1"
    });

    const result = await gateway.initiatePayment({
      amount: 10000,
      currency: "XOF",
      buyerUserId: "buyer-1",
      transactionId: "tx-1",
      label: "Marketplace listing"
    });

    expect(result.providerRef).toBe("MTX-ESCROW1");
    expect(result.paymentUrl).toContain("checkout");
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          kind: GENIUSPAY_KIND_MARKETPLACE_ESCROW,
          transaction_id: "tx-1",
          user_id: "buyer-1"
        })
      })
    );
  });

  it("construit checkout_url depuis la reference si absent", async () => {
    createPayment.mockResolvedValue({
      id: 4,
      reference: "MTX-FALLBACK1",
      amount: 10000,
      currency: "XOF",
      status: "pending"
    });

    const result = await gateway.initiateTopUp({
      amount: 10000,
      currency: "XOF",
      userId: "user-1",
      label: "Recharge"
    });

    expect(result.paymentUrl).toBe(
      "https://geniuspay.ci/checkout/MTX-FALLBACK1"
    );
  });

  it("confirme un topup complété", async () => {
    lookupPayment.mockResolvedValue({
      id: 2,
      reference: "MTX-TOPUP1",
      amount: 5000,
      currency: "XOF",
      status: "completed",
      metadata: {
        kind: GENIUSPAY_KIND_WALLET_TOPUP,
        user_id: "user-1",
        amount: "5000"
      }
    });

    const result = await gateway.confirmTopUp("MTX-TOPUP1", "user-1");
    expect(result.success).toBe(true);
  });

  it("refuse un escrow dont la transaction ne correspond pas", async () => {
    lookupPayment.mockResolvedValue({
      id: 3,
      reference: "MTX-ESCROW2",
      amount: 10000,
      currency: "XOF",
      status: "completed",
      metadata: {
        kind: GENIUSPAY_KIND_MARKETPLACE_ESCROW,
        user_id: "buyer-1",
        transaction_id: "tx-other"
      }
    });

    const result = await gateway.confirmPayment("MTX-ESCROW2", "tx-1");
    expect(result.success).toBe(false);
    expect(result.failureReason).toContain("transaction");
  });

  it("reprend un checkout pending existant", async () => {
    lookupPayment.mockResolvedValue({
      id: 5,
      reference: "MTX-RESUME1",
      amount: 5000,
      currency: "XOF",
      status: "pending",
      checkout_url: "https://geniuspay.ci/checkout/MTX-RESUME1"
    });

    const result = await gateway.resumePendingCheckout("MTX-RESUME1");
    expect(result?.providerRef).toBe("MTX-RESUME1");
    expect(result?.paymentUrl).toContain("checkout");
  });

  it("initie un retrait wallet via payout", async () => {
    createPayout.mockResolvedValue({
      id: "p1",
      reference: "PYT-WITHDRAW1",
      amount: 5000,
      currency: "XOF",
      status: "pending"
    });
    lookupPayout.mockResolvedValue({
      id: "p1",
      reference: "PYT-WITHDRAW1",
      amount: 5000,
      currency: "XOF",
      status: "completed",
      metadata: {
        kind: GENIUSPAY_KIND_WALLET_WITHDRAW,
        user_id: "user-1",
        amount: "5000"
      }
    });

    const init = await gateway.initiateWithdraw({
      amount: 5000,
      currency: "XOF",
      userId: "user-1",
      phone: "0700000000",
      label: "Retrait",
      idempotencyKey: "withdraw-1"
    });
    expect(init.providerRef).toBe("PYT-WITHDRAW1");
    expect(createPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          kind: GENIUSPAY_KIND_WALLET_WITHDRAW,
          user_id: "user-1"
        })
      })
    );

    const confirmed = await gateway.confirmWithdraw("PYT-WITHDRAW1", "user-1", 5000);
    expect(confirmed.success).toBe(true);
  });

  it("verse un vendeur via payout marketplace", async () => {
    createPayout.mockResolvedValue({
      id: "p2",
      reference: "PYT-SELLER1",
      amount: 12000,
      currency: "XOF",
      status: "pending"
    });
    lookupPayout.mockResolvedValue({
      id: "p2",
      reference: "PYT-SELLER1",
      amount: 12000,
      currency: "XOF",
      status: "completed",
      metadata: {
        kind: GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT,
        user_id: "seller-1",
        transaction_id: "tx-1",
        amount: "12000"
      }
    });

    const result = await gateway.releaseFunds({
      amount: 12000,
      currency: "XOF",
      recipientUserId: "seller-1",
      transactionId: "tx-1",
      label: "Versement vendeur"
    });
    expect(result.success).toBe(true);
    expect(result.providerRef).toBe("PYT-SELLER1");
  });
});
