import { createHmac } from "crypto";
import { verifyGeniusPayWebhookSignature } from "./geniuspay-webhook.util";

describe("verifyGeniusPayWebhookSignature", () => {
  const secret = "whsec_test_secret";
  const payload = {
    id: "evt-1",
    event: "payment.success",
    timestamp: Math.floor(Date.now() / 1000),
    data: {
      reference: "MTX-ABC123",
      amount: 5000,
      metadata: { kind: "wallet_topup", user_id: "u1" }
    }
  };

  function sign(ts: string, body: unknown): string {
    return createHmac("sha256", secret)
      .update(`${ts}.${JSON.stringify(body)}`)
      .digest("hex");
  }

  it("accepte une signature valide", () => {
    const ts = String(payload.timestamp);
    const signature = sign(ts, payload);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        payload,
        secret
      })
    ).not.toThrow();
  });

  it("rejette une signature invalide", () => {
    const ts = String(payload.timestamp);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature: "deadbeef",
        timestamp: ts,
        payload,
        secret
      })
    ).toThrow("Signature webhook GeniusPay invalide");
  });

  it("rejette un timestamp expiré", () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const signature = sign(oldTs, payload);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: oldTs,
        payload,
        secret
      })
    ).toThrow("Timestamp webhook GeniusPay expiré");
  });
});
