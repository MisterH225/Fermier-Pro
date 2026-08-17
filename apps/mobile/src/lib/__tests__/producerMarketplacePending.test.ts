import {
  buildProducerTrackedOffers,
  isProducerTrackedOffer
} from "../producerMarketplacePending";
import type {
  MarketplaceOfferReceivedRow,
  MarketplaceTransactionDto
} from "../api";

function offer(
  partial: Partial<MarketplaceOfferReceivedRow> &
    Pick<MarketplaceOfferReceivedRow, "id" | "status">
): MarketplaceOfferReceivedRow {
  return {
    listingId: "listing-1",
    offeredPrice: 1000,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    buyer: { id: "buyer-1", fullName: "Acheteur", email: null },
    listing: {
      id: "listing-1",
      title: "Porc large White",
      status: "sold",
      currency: "XOF",
      category: "porc",
      totalWeightKg: 65,
      pricePerKg: 2000,
      totalPrice: null,
      farm: { id: "farm-1", name: "La ferme" },
      animal: null
    },
    transaction: null,
    ...partial
  } as MarketplaceOfferReceivedRow;
}

function tx(
  partial: Partial<MarketplaceTransactionDto> &
    Pick<MarketplaceTransactionDto, "id" | "offerId" | "status">
): MarketplaceTransactionDto {
  return {
    listingId: "listing-1",
    buyerUserId: "buyer-1",
    sellerUserId: "seller-1",
    priceType: "per_kg",
    agreedPricePerKg: 2000,
    agreedFlatPrice: null,
    estimatedWeightKg: 65,
    blockedAmount: 130000,
    finalAmount: 104000,
    realWeightKg: 52,
    pickupDate: null,
    pickupLocation: null,
    offerExpiresAt: "2026-08-01T10:00:00.000Z",
    ...partial
  } as MarketplaceTransactionDto;
}

describe("isProducerTrackedOffer", () => {
  it("garde une offre accepted liée à une TX en cours", () => {
    expect(
      isProducerTrackedOffer(
        offer({
          id: "o1",
          status: "accepted",
          transaction: { id: "t1", status: "PAYMENT_HELD" }
        })
      )
    ).toBe(true);
  });

  it("masque une offre accepted dont la TX est TRANSACTION_CLOSED", () => {
    expect(
      isProducerTrackedOffer(
        offer({
          id: "o1",
          status: "accepted",
          transaction: { id: "t1", status: "TRANSACTION_CLOSED" }
        })
      )
    ).toBe(false);
  });

  it("masque via linkedTxStatus même si offer.transaction est null", () => {
    expect(
      isProducerTrackedOffer(
        offer({ id: "o1", status: "accepted", transaction: null }),
        "TRANSACTION_CLOSED"
      )
    ).toBe(false);
  });

  it("masque les offres completed / cancelled", () => {
    expect(
      isProducerTrackedOffer(offer({ id: "o1", status: "completed" }))
    ).toBe(false);
    expect(
      isProducerTrackedOffer(offer({ id: "o2", status: "cancelled" }))
    ).toBe(false);
  });
});

describe("buildProducerTrackedOffers", () => {
  it("exclut les offres dont la TX listée est clôturée (TX-D1KQF5XB)", () => {
    const offers = [
      offer({
        id: "offer-stuck",
        status: "accepted",
        transaction: { id: "tx-d1kqf5xb", status: "TRANSACTION_CLOSED" }
      }),
      offer({
        id: "offer-open",
        status: "pending",
        createdAt: "2026-08-02T10:00:00.000Z",
        listing: {
          id: "listing-2",
          title: "Autre porc",
          status: "published",
          currency: "XOF",
          category: "porc",
          totalWeightKg: 50,
          pricePerKg: 1800,
          totalPrice: null,
          farm: { id: "farm-1", name: "La ferme" },
          animal: null
        },
        transaction: null
      })
    ];
    const tracked = buildProducerTrackedOffers(offers, [
      tx({
        id: "tx-d1kqf5xb",
        offerId: "offer-stuck",
        status: "TRANSACTION_CLOSED"
      })
    ]);
    expect(tracked.map((o) => o.id)).toEqual(["offer-open"]);
  });
});
