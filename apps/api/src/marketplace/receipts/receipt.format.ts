import { ListingMarketCategory, MarketplacePriceType } from "@prisma/client";

export const RECEIPT_BUCKET = "receipts";

export type ReceiptPdfInput = {
  receiptNumber: string;
  transactionId: string;
  issuedAt: Date;
  seller: {
    fullName: string | null;
    phone: string | null;
    farmName: string | null;
    farmLocation: string | null;
  };
  buyer: {
    fullName: string | null;
    phone: string | null;
  };
  animal: {
    label: string;
    categoryLabel: string;
    estimatedWeightKg: number | null;
    realWeightKg: number | null;
    weightDeltaPct: number | null;
  };
  financial: {
    priceLabel: string;
    realWeightKg: number | null;
    grossAmount: number;
    commissionRatePct: number;
    commissionAmount: number;
    sellerNetAmount: number;
    buyerPaidAmount: number;
    buyerRefundAmount: number;
    buyerAdditionalCharge: number;
    currency: string;
  };
  timeline: {
    offerAcceptedAt: Date | null;
    paymentConfirmedAt: Date | null;
    pickupDate: Date | null;
    weightValidatedAt: Date | null;
    closedAt: Date | null;
  };
  verifyUrl: string;
};

export function formatReceiptMoney(amount: number, currency: string): string {
  const label = currency === "XOF" ? "FCFA" : currency;
  return `${Math.round(amount).toLocaleString("fr-FR")} ${label}`;
}

export function formatReceiptDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function formatReceiptDateOnly(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function categoryLabelFr(
  category: ListingMarketCategory | null | undefined
): string {
  switch (category) {
    case ListingMarketCategory.piglet:
      return "Porcelet";
    case ListingMarketCategory.breeder:
      return "Reproducteur";
    case ListingMarketCategory.butcher:
      return "Porc charcutier";
    case ListingMarketCategory.reformed:
      return "Truie réformée";
    default:
      return "Lot porcin";
  }
}

export function buildPriceLabel(input: {
  priceType: MarketplacePriceType;
  agreedPricePerKg: number | null;
  agreedFlatPrice: number | null;
  currency: string;
}): string {
  if (input.priceType === MarketplacePriceType.per_kg && input.agreedPricePerKg != null) {
    return `${formatReceiptMoney(input.agreedPricePerKg, input.currency)}/kg`;
  }
  if (input.agreedFlatPrice != null) {
    return formatReceiptMoney(input.agreedFlatPrice, input.currency);
  }
  return "—";
}

export function weightDeltaPct(
  estimated: number | null,
  real: number | null
): number | null {
  if (estimated == null || real == null || estimated <= 0) {
    return null;
  }
  return ((real - estimated) / estimated) * 100;
}

export function shortTransactionId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
