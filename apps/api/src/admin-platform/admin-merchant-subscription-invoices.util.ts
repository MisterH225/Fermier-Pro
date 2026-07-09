import type { MerchantSubscriptionInvoiceStatus } from "@prisma/client";
import type { GeniusPayPaymentStatus } from "../marketplace/escrow/geniuspay/geniuspay.types";

export type MerchantSubscriptionInvoiceSyncInsight =
  | "aligned_completed"
  | "provider_completed_invoice_pending"
  | "invoice_paid_provider_not_found"
  | "invoice_paid_provider_pending"
  | "amount_mismatch"
  | "provider_not_completed"
  | "no_provider_ref"
  | "internal_wallet_ref"
  | "lookup_unavailable";

export function resolveInvoiceSyncInsight(params: {
  invoiceStatus: MerchantSubscriptionInvoiceStatus;
  providerRef: string | null;
  lookupFound: boolean;
  providerStatus?: GeniusPayPaymentStatus | null;
  providerAmount?: number | null;
  invoiceAmount: number;
}): MerchantSubscriptionInvoiceSyncInsight {
  const ref = params.providerRef?.trim() ?? "";
  if (!ref) {
    return "no_provider_ref";
  }
  if (
    ref.startsWith("merchant-premium:") ||
    ref.startsWith("merchant-sub-wallet:")
  ) {
    return "internal_wallet_ref";
  }
  if (!params.lookupFound) {
    return params.invoiceStatus === "paid"
      ? "invoice_paid_provider_not_found"
      : "provider_not_completed";
  }
  const providerStatus = params.providerStatus ?? null;
  const amountMatches =
    params.providerAmount != null &&
    Number.isFinite(params.providerAmount) &&
    Math.abs(params.providerAmount - params.invoiceAmount) <= 1;

  if (!amountMatches) {
    return "amount_mismatch";
  }
  if (providerStatus === "completed" && params.invoiceStatus === "pending") {
    return "provider_completed_invoice_pending";
  }
  if (providerStatus === "completed" && params.invoiceStatus === "paid") {
    return "aligned_completed";
  }
  if (params.invoiceStatus === "paid" && providerStatus !== "completed") {
    return "invoice_paid_provider_pending";
  }
  return "provider_not_completed";
}
