import { GENIUSPAY_KIND_PRODUCER_SUBSCRIPTION } from "../marketplace/escrow/geniuspay/geniuspay.types";

const PRODUCER_SUB_TX_PREFIX = "producer-sub:";

function coerceMetadataString(
  value: string | number | boolean | null | undefined
): string {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

export function extractProducerSubscriptionInvoiceId(
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
  if (transactionId.startsWith(PRODUCER_SUB_TX_PREFIX)) {
    const fromTx = transactionId.slice(PRODUCER_SUB_TX_PREFIX.length).trim();
    if (fromTx) {
      return fromTx;
    }
  }

  return null;
}

export function isProducerSubscriptionWebhookMetadata(
  metadata: Record<string, string | number | boolean | null> | undefined
): boolean {
  if (!metadata) {
    return false;
  }
  if (metadata.kind === GENIUSPAY_KIND_PRODUCER_SUBSCRIPTION) {
    return true;
  }
  // Ne pas traiter un simple invoice_id comme producteur (collision avec commerçant).
  const transactionId = coerceMetadataString(metadata.transaction_id);
  return transactionId.startsWith(PRODUCER_SUB_TX_PREFIX);
}
