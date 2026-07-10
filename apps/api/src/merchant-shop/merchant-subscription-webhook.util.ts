import { GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION } from "../marketplace/escrow/geniuspay/geniuspay.types";

const MERCHANT_SUB_TX_PREFIX = "merchant-sub:";

function coerceMetadataString(
  value: string | number | boolean | null | undefined
): string {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

/** Extrait l'id facture depuis les metadata GeniusPay (webhook ou paiement). */
export function extractMerchantSubscriptionInvoiceId(
  metadata: Record<string, string | number | boolean | null> | undefined
): string | null {
  if (!metadata) {
    return null;
  }

  const direct = coerceMetadataString(metadata.invoice_id);
  if (direct) {
    return direct;
  }

  const transactionId = coerceMetadataString(metadata.transaction_id);
  if (transactionId.startsWith(MERCHANT_SUB_TX_PREFIX)) {
    const fromTx = transactionId.slice(MERCHANT_SUB_TX_PREFIX.length).trim();
    if (fromTx) {
      return fromTx;
    }
  }

  return null;
}

export function isMerchantSubscriptionWebhookMetadata(
  metadata: Record<string, string | number | boolean | null> | undefined
): boolean {
  if (!metadata) {
    return false;
  }
  if (metadata.kind === GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION) {
    return true;
  }
  // Ne pas traiter un simple invoice_id comme commerçant (collision avec producteur).
  const transactionId = coerceMetadataString(metadata.transaction_id);
  return transactionId.startsWith(MERCHANT_SUB_TX_PREFIX);
}
