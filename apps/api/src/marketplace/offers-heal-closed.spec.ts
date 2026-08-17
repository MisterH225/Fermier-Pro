import { OfferStatus } from "@prisma/client";
import { MarketplaceTransactionStatus } from "@prisma/client";
import { staleOfferIdsAfterClosedTransaction } from "./offers-heal-closed.util";

describe("staleOfferIdsAfterClosedTransaction", () => {
  it("détecte une offre accepted liée à TRANSACTION_CLOSED (cas dashboard figé)", () => {
    expect(
      staleOfferIdsAfterClosedTransaction([
        {
          id: "offer-stuck",
          status: OfferStatus.accepted,
          transaction: {
            id: "tx-d1kqf5xb",
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
          }
        }
      ])
    ).toEqual(["offer-stuck"]);
  });

  it("ignore les offres déjà completed / cancelled", () => {
    expect(
      staleOfferIdsAfterClosedTransaction([
        {
          id: "o1",
          status: OfferStatus.completed,
          transaction: {
            id: "t1",
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
          }
        },
        {
          id: "o2",
          status: OfferStatus.cancelled,
          transaction: {
            id: "t2",
            status: MarketplaceTransactionStatus.TRANSACTION_CLOSED
          }
        }
      ])
    ).toEqual([]);
  });

  it("ignore une offre accepted encore en cours (PAYMENT_HELD)", () => {
    expect(
      staleOfferIdsAfterClosedTransaction([
        {
          id: "o1",
          status: OfferStatus.accepted,
          transaction: {
            id: "t1",
            status: MarketplaceTransactionStatus.PAYMENT_HELD
          }
        }
      ])
    ).toEqual([]);
  });
});
