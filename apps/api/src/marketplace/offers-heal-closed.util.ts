import {
  MarketplaceTransactionStatus,
  OfferStatus
} from "@prisma/client";

const TERMINAL_OFFER_STATUSES = new Set<OfferStatus>([
  OfferStatus.completed,
  OfferStatus.cancelled,
  OfferStatus.rejected,
  OfferStatus.withdrawn
]);

/**
 * Offres encore « actives » alors que la transaction liée est déjà
 * TRANSACTION_CLOSED (ex. finalizeSettlementSideEffects interrompu).
 */
export function staleOfferIdsAfterClosedTransaction(
  rows: Array<{
    id: string;
    status: OfferStatus;
    transaction: { id: string; status: MarketplaceTransactionStatus } | null;
  }>
): string[] {
  return rows
    .filter(
      (row) =>
        row.transaction?.status ===
          MarketplaceTransactionStatus.TRANSACTION_CLOSED &&
        !TERMINAL_OFFER_STATUSES.has(row.status)
    )
    .map((row) => row.id);
}
