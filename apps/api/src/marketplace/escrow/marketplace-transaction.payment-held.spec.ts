import { MarketplaceTransactionService } from "./marketplace-transaction.service";

describe("MarketplaceTransactionService.onPaymentHeldSideEffects", () => {
  const sendToUser = jest.fn().mockResolvedValue(undefined);
  const listingUpdate = jest.fn().mockResolvedValue({});
  const offerUpdate = jest.fn().mockResolvedValue({});
  const findUnique = jest.fn();

  function buildService() {
    const prisma = {
      marketplaceTransaction: { findUnique },
      marketplaceListing: { update: listingUpdate },
      marketplaceOffer: { update: offerUpdate }
    };
    return new MarketplaceTransactionService(
      prisma as never,
      {} as never,
      { sendToUser } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("vente standard PAYMENT_HELD → 2 notifications (vendeur + acheteur)", async () => {
    findUnique.mockResolvedValue({
      id: "tx-std",
      listingId: "listing-1",
      offerId: "offer-1",
      buyerUserId: "buyer-1",
      sellerUserId: "seller-1",
      blockedAmount: 150_000,
      currency: "XOF",
      isCredit: false,
      listing: { title: "Porcs charcutiers" }
    });

    const service = buildService();
    await (
      service as unknown as {
        onPaymentHeldSideEffects: (id: string) => Promise<void>;
      }
    ).onPaymentHeldSideEffects("tx-std");

    expect(listingUpdate).toHaveBeenCalledWith({
      where: { id: "listing-1" },
      data: { activeOfferCount: { increment: 1 } }
    });
    expect(offerUpdate).not.toHaveBeenCalled();
    expect(sendToUser).toHaveBeenCalledTimes(2);
    expect(sendToUser).toHaveBeenCalledWith(
      "seller-1",
      "Paiement sécurisé",
      expect.stringContaining("Un acheteur a sécurisé"),
      expect.objectContaining({
        type: "marketplace_payment_held",
        transactionId: "tx-std",
        listingId: "listing-1"
      })
    );
    expect(sendToUser).toHaveBeenCalledWith(
      "buyer-1",
      "Paiement sécurisé",
      expect.stringContaining(
        "est bloqué en sécurité sur la plateforme jusqu'à la réception et la validation du poids"
      ),
      expect.objectContaining({
        type: "marketplace_payment_held_buyer",
        transactionId: "tx-std",
        listingId: "listing-1"
      })
    );
    expect(
      sendToUser.mock.calls.some(
        (c) => c[3]?.type === "marketplace_credit_advance_held"
      )
    ).toBe(false);
  });

  it("vente crédit PAYMENT_HELD → 2 notifs branche crédit, pas de 3e standard", async () => {
    findUnique.mockResolvedValue({
      id: "tx-credit",
      listingId: "listing-2",
      offerId: "offer-2",
      buyerUserId: "buyer-2",
      sellerUserId: "seller-2",
      blockedAmount: 50_000,
      currency: "XOF",
      isCredit: true,
      listing: { title: "Truie" }
    });

    const service = buildService();
    await (
      service as unknown as {
        onPaymentHeldSideEffects: (id: string) => Promise<void>;
      }
    ).onPaymentHeldSideEffects("tx-credit");

    expect(offerUpdate).toHaveBeenCalledWith({
      where: { id: "offer-2" },
      data: expect.objectContaining({
        status: "advance_confirmed",
        advancePaymentMode: "escrow"
      })
    });
    expect(sendToUser).toHaveBeenCalledTimes(2);
    expect(sendToUser).toHaveBeenCalledWith(
      "buyer-2",
      "Avance sécurisée",
      expect.any(String),
      expect.objectContaining({
        type: "marketplace_credit_advance_held",
        transactionId: "tx-credit"
      })
    );
    expect(sendToUser).toHaveBeenCalledWith(
      "seller-2",
      "Avance en escrow",
      expect.any(String),
      expect.objectContaining({
        type: "marketplace_credit_advance_held_seller",
        transactionId: "tx-credit"
      })
    );
    expect(
      sendToUser.mock.calls.some(
        (c) =>
          c[3]?.type === "marketplace_payment_held" ||
          c[3]?.type === "marketplace_payment_held_buyer"
      )
    ).toBe(false);
  });
});
