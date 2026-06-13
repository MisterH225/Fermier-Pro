import { formatFarmMoney, formatPricePerKg } from "./formatMoney";

export const MARKETPLACE_OFFER_MESSAGE_TYPE = "marketplace_offer" as const;

export type MarketplaceOfferChatPayload = {
  _type: typeof MARKETPLACE_OFFER_MESSAGE_TYPE;
  offerId: string;
  listingId: string;
  listingTitle: string;
  currency: string;
  offeredPrice: number;
  proposedPricePerKg?: number | null;
  quantity?: number | null;
  status: string;
  message?: string | null;
};

export function parseMarketplaceOfferMessage(
  body: string
): MarketplaceOfferChatPayload | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<MarketplaceOfferChatPayload>;
    if (parsed._type !== MARKETPLACE_OFFER_MESSAGE_TYPE || !parsed.offerId) {
      return null;
    }
    return parsed as MarketplaceOfferChatPayload;
  } catch {
    return null;
  }
}

export function formatOfferPreview(payload: MarketplaceOfferChatPayload): string {
  const price =
    payload.proposedPricePerKg != null
      ? formatPricePerKg(payload.proposedPricePerKg, payload.currency)
      : formatFarmMoney(payload.offeredPrice, payload.currency);
  return `Proposition · ${price}`;
}
