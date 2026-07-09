import {
  extractMerchantSubscriptionInvoiceId,
  isMerchantSubscriptionWebhookMetadata
} from "./merchant-subscription-webhook.util";
import { GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION } from "../marketplace/escrow/geniuspay/geniuspay.types";

describe("merchant-subscription-webhook.util", () => {
  it("extrait invoice_id depuis metadata string", () => {
    expect(
      extractMerchantSubscriptionInvoiceId({
        kind: GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION,
        invoice_id: "inv-abc",
        user_id: "user-1"
      })
    ).toBe("inv-abc");
  });

  it("extrait invoice_id depuis metadata numérique", () => {
    expect(
      extractMerchantSubscriptionInvoiceId({
        invoice_id: 42,
        user_id: "user-1"
      })
    ).toBe("42");
  });

  it("extrait invoice_id depuis transaction_id merchant-sub:", () => {
    expect(
      extractMerchantSubscriptionInvoiceId({
        transaction_id: "merchant-sub:inv-from-tx",
        user_id: "user-1"
      })
    ).toBe("inv-from-tx");
  });

  it("détecte metadata abonnement sans kind explicite", () => {
    expect(
      isMerchantSubscriptionWebhookMetadata({
        transaction_id: "merchant-sub:inv-1",
        user_id: "user-1"
      })
    ).toBe(true);
    expect(
      isMerchantSubscriptionWebhookMetadata({
        kind: "wallet_topup",
        user_id: "user-1"
      })
    ).toBe(false);
  });
});
