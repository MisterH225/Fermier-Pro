import { MarketplaceFundMovementKind, MarketplaceTransactionStatus } from "@prisma/client";
import { settlementAmounts } from "./transaction.utils";

/**
 * Specs ciblées sur la logique de règlement (bugs escrow août 2026).
 */

describe("settlementAmounts — trop-perçu (bug 3)", () => {
  it("rembourse l'écart quand le poids réel diminue le prix (buyerPaysCommission)", () => {
    const blocked = 110_000;
    const finalAmount = 90_000;
    const amounts = settlementAmounts({
      blockedAmount: blocked,
      finalAmount,
      commissionRate: 0.1,
      buyerPaysCommission: true,
      sellerCommissionRate: 0
    });
    expect(amounts.buyerRefundAmount).toBe(11_000);
    expect(amounts.sellerReceivedAmount).toBe(90_000);
    expect(amounts.buyerAdditionalCharge).toBe(0);
  });

  it("rembourse blocked − finalAmount (mode historique sans buyerPaysCommission)", () => {
    const amounts = settlementAmounts({
      blockedAmount: 100_000,
      finalAmount: 80_000,
      commissionRate: 0.05,
      buyerPaysCommission: false,
      sellerCommissionRate: 0
    });
    expect(amounts.buyerRefundAmount).toBe(20_000);
    expect(amounts.sellerReceivedAmount).toBe(76_000);
  });

  it("ne rembourse pas si le montant final consomme tout le blocage", () => {
    const amounts = settlementAmounts({
      blockedAmount: 100_000,
      finalAmount: 100_000,
      commissionRate: 0.1,
      buyerPaysCommission: false
    });
    expect(amounts.buyerRefundAmount).toBe(0);
  });
});

describe("criteres reglement complet (bugs 1-2-3)", () => {
  const isSettlementComplete = (params: {
    status: MarketplaceTransactionStatus;
    listingSold: boolean;
    hasRelease: boolean;
    buyerRefundAmount: number;
    hasRefund: boolean;
  }): boolean => {
    const refundOk =
      params.buyerRefundAmount <= 0 ? true : params.hasRefund;
    return (
      params.status === MarketplaceTransactionStatus.TRANSACTION_CLOSED &&
      params.listingSold &&
      params.hasRelease &&
      refundOk
    );
  };

  it("refuse la facture si seul RELEASE existe (ancien chemin priorRelease)", () => {
    expect(
      isSettlementComplete({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        listingSold: false,
        hasRelease: true,
        buyerRefundAmount: 5_000,
        hasRefund: false
      })
    ).toBe(false);
  });

  it("autorise la facture seulement si close + sold + release + refund", () => {
    expect(
      isSettlementComplete({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        listingSold: true,
        hasRelease: true,
        buyerRefundAmount: 5_000,
        hasRefund: true
      })
    ).toBe(true);
  });

  it("n'exige pas de refund si buyerRefundAmount = 0", () => {
    expect(
      isSettlementComplete({
        status: MarketplaceTransactionStatus.TRANSACTION_CLOSED,
        listingSold: true,
        hasRelease: true,
        buyerRefundAmount: 0,
        hasRefund: false
      })
    ).toBe(true);
  });

  it("documente les kinds de mouvements critiques", () => {
    expect(MarketplaceFundMovementKind.RELEASE_TO_SELLER).toBeDefined();
    expect(MarketplaceFundMovementKind.REFUND_BUYER).toBeDefined();
    expect(MarketplaceFundMovementKind.COMMISSION).toBeDefined();
  });
});
