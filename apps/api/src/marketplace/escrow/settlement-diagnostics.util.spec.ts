import {
  ListingStatus,
  MarketplaceTransactionStatus
} from "@prisma/client";
import { classifyIncompleteSettlement } from "./settlement-diagnostics.util";

describe("classifyIncompleteSettlement", () => {
  it("détecte CLOSED sans listing sold / sans RELEASE / sans REFUND dû", () => {
    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        isCredit: false,
        listingStatus: ListingStatus.delivered,
        hasRelease: true,
        hasRefund: false,
        buyerRefundAmount: 5_000
      })
    ).toEqual(["LISTING_NOT_SOLD", "MISSING_REFUND"]);

    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        isCredit: false,
        listingStatus: ListingStatus.sold,
        hasRelease: false,
        hasRefund: true,
        buyerRefundAmount: 0
      })
    ).toEqual(["MISSING_RELEASE"]);
  });

  it("ignore un refund manquant si buyerRefundAmount = 0", () => {
    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        isCredit: false,
        listingStatus: ListingStatus.sold,
        hasRelease: true,
        hasRefund: false,
        buyerRefundAmount: 0
      })
    ).toEqual([]);
  });

  it("détecte BUYER_RECEIVED bloqué (non-crédit ou crédit prêt à settler)", () => {
    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.BUYER_RECEIVED,
        isCredit: false,
        listingStatus: ListingStatus.shipped,
        hasRelease: false,
        hasRefund: false,
        buyerRefundAmount: 0
      })
    ).toEqual(["STUCK_BUYER_RECEIVED"]);

    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.BUYER_RECEIVED,
        isCredit: true,
        listingStatus: ListingStatus.shipped,
        hasRelease: false,
        hasRefund: false,
        buyerRefundAmount: 0,
        creditReadyToSettle: true
      })
    ).toEqual(["STUCK_BUYER_RECEIVED"]);

    expect(
      classifyIncompleteSettlement({
        status: MarketplaceTransactionStatus.BUYER_RECEIVED,
        isCredit: true,
        listingStatus: ListingStatus.shipped,
        hasRelease: false,
        hasRefund: false,
        buyerRefundAmount: 0,
        creditReadyToSettle: false
      })
    ).toEqual([]);
  });
});
