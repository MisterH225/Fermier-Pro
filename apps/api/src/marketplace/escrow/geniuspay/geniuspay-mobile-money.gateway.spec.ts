import { GeniusPayMobileMoneyGateway } from "./geniuspay-mobile-money.gateway";
import type { GeniusPayClient } from "./geniuspay.client";
import type { PrismaService } from "../../../prisma/prisma.service";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_WALLET_TOPUP
} from "./geniuspay.types";

describe("GeniusPayMobileMoneyGateway", () => {
  const createPayment = jest.fn();
  const getPayment = jest.fn();
  const lookupPayment = jest.fn();
  const findUnique = jest.fn();

  const client = {
    createPayment,
    getPayment,
    lookupPayment
  } as unknown as GeniusPayClient;

  const prisma = {
    user: { findUnique }
  } as unknown as PrismaService;

  const gateway = new GeniusPayMobileMoneyGateway(client, prisma);

  beforeEach(() => {
    jest.resetAllMocks();
    lookupPayment.mockResolvedValue(null);
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
});
