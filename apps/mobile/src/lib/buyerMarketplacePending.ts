import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type {
  MarketplaceOfferMineRow,
  MarketplaceTransactionDto
} from "./api";
import type { RootStackParamList } from "../types/navigation";

const BUYER_TX_ACTION_STATUSES = new Set([
  "PAYMENT_PENDING",
  "PAYMENT_HELD",
  "PICKUP_PROPOSED",
  "PICKUP_SCHEDULED",
  "SELLER_SHIPPED"
]);

const INACTIVE_OFFER_STATUSES = new Set([
  "rejected",
  "withdrawn",
  "completed"
]);

export type BuyerPendingMarketplaceItem =
  | {
      kind: "offer";
      id: string;
      title: string;
      subtitle: string;
      offer: MarketplaceOfferMineRow;
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

export function isBuyerActionableOffer(offer: MarketplaceOfferMineRow): boolean {
  switch (offer.status) {
    case "countered":
      return true;
    case "credit_agreed":
      return !offer.advancePaidDeclaredAt;
    case "balance_pending":
      return !offer.balancePaidDeclaredAt;
    default:
      return false;
  }
}

export function isBuyerTrackedOffer(offer: MarketplaceOfferMineRow): boolean {
  return !INACTIVE_OFFER_STATUSES.has(offer.status);
}

export function isBuyerActionableTransaction(
  tx: MarketplaceTransactionDto,
  buyerUserId: string
): boolean {
  return (
    tx.buyerUserId === buyerUserId && BUYER_TX_ACTION_STATUSES.has(tx.status)
  );
}

function offerPriority(offer: MarketplaceOfferMineRow): number {
  if (offer.status === "countered") return 0;
  if (offer.status === "balance_pending") return 1;
  if (offer.status === "credit_agreed") return 2;
  if (offer.status === "pending") return 3;
  return 4;
}

function transactionPriority(status: string): number {
  switch (status) {
    case "PAYMENT_PENDING":
      return 0;
    case "PAYMENT_HELD":
      return 1;
    case "PICKUP_PROPOSED":
      return 2;
    case "PICKUP_SCHEDULED":
      return 3;
    case "SELLER_SHIPPED":
      return 4;
    default:
      return 5;
  }
}

export function buildBuyerPendingMarketplaceItems(
  offers: MarketplaceOfferMineRow[],
  transactions: MarketplaceTransactionDto[],
  buyerUserId: string
): BuyerPendingMarketplaceItem[] {
  const items: BuyerPendingMarketplaceItem[] = [];

  for (const offer of offers) {
    if (!isBuyerActionableOffer(offer)) continue;
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
    if (!isBuyerActionableTransaction(tx, buyerUserId)) continue;
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

export function buildBuyerTrackedOffers(
  offers: MarketplaceOfferMineRow[]
): MarketplaceOfferMineRow[] {
  return offers
    .filter(isBuyerTrackedOffer)
    .sort((a, b) => {
      const pa = isBuyerActionableOffer(a) ? 0 : 1;
      const pb = isBuyerActionableOffer(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function openBuyerOffersHub(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  opts?: {
    highlightOfferId?: string;
    offersListingId?: string;
  }
) {
  navigation.navigate("MarketplaceList", {
    tab: "offers",
    offersSubTab: "sent",
    buyerView: true,
    fromDashboard: true,
    highlightOfferId: opts?.highlightOfferId,
    offersListingId: opts?.offersListingId
  });
}

export function openBuyerPendingItem(
  navigation: NativeStackNavigationProp<RootStackParamList>,
  item: BuyerPendingMarketplaceItem
) {
  if (item.kind === "transaction") {
    navigation.navigate("MarketplaceTransaction", {
      transactionId: item.transaction.id
    });
    return;
  }

  const txId = item.offer.transaction?.id;
  if (
    txId &&
    (item.offer.status === "accepted" ||
      item.offer.status === "credit_agreed" ||
      item.offer.status === "advance_confirmed" ||
      item.offer.status === "balance_pending" ||
      item.offer.status === "balance_declared")
  ) {
    navigation.navigate("MarketplaceTransaction", { transactionId: txId });
    return;
  }

  openBuyerOffersHub(navigation, {
    highlightOfferId: item.offer.id,
    offersListingId: item.offer.listing.id
  });
}
