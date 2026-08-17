import {
  buildBuyerTrackedOffers,
  isBuyerTrackedOffer
} from "../buyerMarketplacePending";
import type { MarketplaceOfferMineRow, MarketplaceTransactionDto } from "../api";

function offer(
  partial: Partial<MarketplaceOfferMineRow> &
    Pick<MarketplaceOfferMineRow, "id" | "status">
): MarketplaceOfferMineRow {
  return {
    listingId: "listing-1",
    offeredPrice: 1000,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    listing: {
      id: "listing-1",
      title: "Porc large White",
      status: "sold",
      currency: "XOF",
      farm: { id: "farm-1", name: "La ferme" },
      seller: { id: "seller-1", fullName: "Vendeur" },
      animal: null
    },
    transaction: null,
    ...partial
  } as MarketplaceOfferMineRow;
}

describe("isBuyerTrackedOffer", () => {
  it("masque une offre accepted liée à TRANSACTION_CLOSED", () => {
    expect(
      isBuyerTrackedOffer(
        offer({
          id: "o1",
          status: "accepted",
          transaction: { id: "t1", status: "TRANSACTION_CLOSED" }
        })
      )
    ).toBe(false);
  });

  it("garde une offre accepted en cours de paiement", () => {
    expect(
      isBuyerTrackedOffer(
        offer({
          id: "o1",
          status: "accepted",
          transaction: { id: "t1", status: "PAYMENT_PENDING" }
        })
      )
    ).toBe(true);
  });
});

describe("buildBuyerTrackedOffers", () => {
  it("exclut via la liste transactions même si nested transaction absente", () => {
    const tracked = buildBuyerTrackedOffers(
      [offer({ id: "offer-stuck", status: "accepted", transaction: null })],
      [
        {
          id: "tx-1",
          offerId: "offer-stuck",
          status: "TRANSACTION_CLOSED"
        } as MarketplaceTransactionDto
      ]
    );
    expect(tracked).toHaveLength(0);
  });
});
