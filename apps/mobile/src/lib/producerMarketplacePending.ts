import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  MarketplaceOfferReceivedRow,
  MarketplaceTransactionDto
} from "./api";
import type { RootStackParamList } from "../types/navigation";

const SELLER_TX_ACTION_STATUSES = new Set([
  "PICKUP_PROPOSED",
  "WEIGHT_VALIDATED",
  "WEIGHT_DECLARED"
]);

const INACTIVE_OFFER_STATUSES = new Set([
  "rejected",
  "withdrawn",
  "completed",
  "cancelled"
]);

export type ProducerPendingMarketplaceItem =
  | {
      kind: "offer";
      id: string;
      title: string;
      subtitle: string;
      offer: MarketplaceOfferReceivedRow;
      priority: number;
      createdAt: string;
    }
  | {
      kind: "transaction";
      id: string;
      title: string;
      subtitle: string;
      transaction: MarketplaceTransactionDto;
      priority: number;
      createdAt: string;
    };

export function isProducerActionableOffer(
  offer: MarketplaceOfferReceivedRow
): boolean {
  if (offer.status === "pending") return true;
  if (
    offer.status === "credit_agreed" &&
    offer.advancePaidDeclaredAt &&
    !offer.advanceConfirmedAt
  ) {
    return true;
  }
  if (offer.status === "balance_declared") return true;
  return false;
}

export function isProducerTrackedOffer(
  offer: MarketplaceOfferReceivedRow
): boolean {
  return !INACTIVE_OFFER_STATUSES.has(offer.status);
}

export function isProducerActionableTransaction(
  tx: MarketplaceTransactionDto,
  sellerUserId: string
): boolean {
  return (
    tx.sellerUserId === sellerUserId &&
    SELLER_TX_ACTION_STATUSES.has(tx.status)
  );
}

function offerPriority(offer: MarketplaceOfferReceivedRow): number {
  if (offer.status === "pending") return 0;
  if (offer.status === "balance_declared") return 1;
  if (offer.status === "credit_agreed") return 2;
  return 3;
}

function transactionPriority(status: string): number {
  switch (status) {
    case "PICKUP_PROPOSED":
      return 0;
    case "WEIGHT_DECLARED":
      return 1;
    case "WEIGHT_VALIDATED":
      return 2;
    default:
      return 3;
  }
}

export function buildProducerPendingMarketplaceItems(
  offers: MarketplaceOfferReceivedRow[],
  transactions: MarketplaceTransactionDto[],
  sellerUserId: string
): ProducerPendingMarketplaceItem[] {
  const items: ProducerPendingMarketplaceItem[] = [];

  for (const offer of offers) {
    if (!isProducerActionableOffer(offer)) continue;
    items.push({
      kind: "offer",
      id: `offer:${offer.id}`,
      title: offer.listing.title,
      subtitle: offer.status,
      offer,
      priority: offerPriority(offer),
      createdAt: offer.createdAt
    });
  }

  for (const tx of transactions) {
    if (!isProducerActionableTransaction(tx, sellerUserId)) continue;
    items.push({
      kind: "transaction",
      id: `tx:${tx.id}`,
      title: tx.listingTitle?.trim() || "Transaction marketplace",
      subtitle: tx.status,
      transaction: tx,
      priority: transactionPriority(tx.status),
      createdAt: tx.offerExpiresAt
    });
  }

  return items.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function buildProducerTrackedOffers(
  offers: MarketplaceOfferReceivedRow[]
): MarketplaceOfferReceivedRow[] {
  return offers
    .filter(isProducerTrackedOffer)
    .sort((a, b) => {
      const pa = isProducerActionableOffer(a) ? 0 : 1;
      const pb = isProducerActionableOffer(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function openProducerOffersHub(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  opts?: {
    highlightOfferId?: string;
    offersListingId?: string;
  }
) {
  navigation.navigate("MarketplaceList", {
    tab: "offers",
    offersSubTab: "received",
    highlightOfferId: opts?.highlightOfferId,
    offersListingId: opts?.offersListingId
  });
}

export function openProducerPendingItem(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  item: ProducerPendingMarketplaceItem,
  transactions: MarketplaceTransactionDto[] = []
) {
  if (item.kind === "transaction") {
    navigation.navigate("MarketplaceTransaction", {
      transactionId: item.transaction.id
    });
    return;
  }

  const linkedTx = transactions.find((tx) => tx.offerId === item.offer.id);
  if (
    linkedTx &&
    (item.offer.status === "accepted" ||
      item.offer.status === "credit_agreed" ||
      item.offer.status === "advance_confirmed" ||
      item.offer.status === "balance_pending")
  ) {
    navigation.navigate("MarketplaceTransaction", {
      transactionId: linkedTx.id
    });
    return;
  }

  openProducerOffersHub(navigation, {
    highlightOfferId: item.offer.id,
    offersListingId: item.offer.listing.id
  });
}
