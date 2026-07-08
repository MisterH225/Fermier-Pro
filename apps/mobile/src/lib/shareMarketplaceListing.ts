import { Alert, Share } from "react-native";
import type { TFunction } from "i18next";
import {
  formatMarketMoney,
  parseMarketNum
} from "../components/marketplace/MarketplaceListingCard";

export type ListingShareInput = {
  id: string;
  kind?: "listing" | "merchant";
  title: string;
  currency?: string;
  totalPrice?: string | number | null;
  pricePerKg?: string | number | null;
  totalWeightKg?: string | number | null;
  farm?: { name?: string | null } | null;
};

/**
 * URL deep link de partage : `EXPO_PUBLIC_LISTING_BASE_URL` (HTTPS) ou schéma app.
 */
export function buildListingShareUrl(
  listingId: string,
  kind: ListingShareInput["kind"] = "listing"
): string {
  const cleaned = listingId.trim();
  if (kind === "merchant") {
    return `fermier-pro://merchant/product/${encodeURIComponent(cleaned)}`;
  }
  const baseFromEnv = process.env.EXPO_PUBLIC_LISTING_BASE_URL?.trim() ?? "";
  if (baseFromEnv) {
    const stripped = baseFromEnv.replace(/\/$/, "");
    return `${stripped}/${encodeURIComponent(cleaned)}`;
  }
  return `fermier-pro://listing/${encodeURIComponent(cleaned)}`;
}

export function formatListingSharePrice(
  listing: ListingShareInput
): string | null {
  const cur = listing.currency || "XOF";
  const total = parseMarketNum(listing.totalPrice);
  if (total != null) return formatMarketMoney(total, cur);
  const pKg = parseMarketNum(listing.pricePerKg);
  const wKg = parseMarketNum(listing.totalWeightKg);
  if (pKg != null && wKg != null) return formatMarketMoney(pKg * wKg, cur);
  if (pKg != null) return `${formatMarketMoney(pKg, cur)}/kg`;
  return null;
}

export function buildListingShareMessage(
  listing: ListingShareInput,
  t: TFunction
): { message: string; url: string } {
  const url = buildListingShareUrl(listing.id, listing.kind);
  const price = formatListingSharePrice(listing);
  const parts = [listing.title.trim() || t("marketScreen.detailTitle")];
  const farmName = listing.farm?.name?.trim();
  if (farmName) parts.push(farmName);
  if (price) parts.push(price);
  const summary = parts.join(" — ");
  const message = t("marketScreen.share.message", { summary, url });
  return { message, url };
}

export async function shareListingViaSystem(
  listing: ListingShareInput,
  t: TFunction
): Promise<void> {
  const { message, url } = buildListingShareMessage(listing, t);
  await Share.share({ message, url });
}

type ShareListingOptionsParams = {
  listing: ListingShareInput;
  t: TFunction;
  onShareInApp: () => void;
};

export function presentListingShareOptions({
  listing,
  t,
  onShareInApp
}: ShareListingOptionsParams): void {
  Alert.alert(t("marketScreen.share.title"), undefined, [
    {
      text: t("marketScreen.share.viaLink"),
      onPress: () => {
        void shareListingViaSystem(listing, t).catch(() => undefined);
      }
    },
    {
      text: t("marketScreen.share.viaMessage"),
      onPress: onShareInApp
    },
    { text: t("common.cancel"), style: "cancel" }
  ]);
}
