import {
  ListingStatus,
  MarketplaceTransactionStatus
} from "@prisma/client";

/** Codes stables pour l’admin / i18n — diagnostic règlement escrow. */
export type IncompleteSettlementIssue =
  | "LISTING_NOT_SOLD"
  | "MISSING_RELEASE"
  | "MISSING_REFUND"
  | "STUCK_BUYER_RECEIVED";

export type IncompleteSettlementSnapshot = {
  status: MarketplaceTransactionStatus;
  isCredit: boolean;
  listingStatus: ListingStatus | string;
  hasRelease: boolean;
  hasRefund: boolean;
  buyerRefundAmount: number;
  /** Crédit : solde dû ≤ 0 ou déjà déclaré payé — settle attendu après réception. */
  creditReadyToSettle?: boolean;
};

/**
 * Règles de détection d’un règlement incomplet (lecture seule).
 * Aligné sur les invariants escrow (AGENTS.md).
 */
export function classifyIncompleteSettlement(
  snap: IncompleteSettlementSnapshot
): IncompleteSettlementIssue[] {
  const issues: IncompleteSettlementIssue[] = [];

  if (snap.status === MarketplaceTransactionStatus.BUYER_RECEIVED) {
    if (!snap.isCredit || snap.creditReadyToSettle) {
      issues.push("STUCK_BUYER_RECEIVED");
    }
    return issues;
  }

  if (snap.status !== MarketplaceTransactionStatus.TRANSACTION_CLOSED) {
    return issues;
  }

  if (snap.listingStatus !== ListingStatus.sold) {
    issues.push("LISTING_NOT_SOLD");
  }
  if (!snap.hasRelease) {
    issues.push("MISSING_RELEASE");
  }
  if (snap.buyerRefundAmount > 0 && !snap.hasRefund) {
    issues.push("MISSING_REFUND");
  }

  return issues;
}
