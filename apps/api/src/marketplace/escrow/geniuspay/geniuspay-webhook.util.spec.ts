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

  function sign(ts: string, rawBody: string): string {
    return createHmac("sha256", secret)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
  }

  it("accepte une signature valide sur le corps brut", () => {
    const rawBody = JSON.stringify(payload);
    const ts = String(payload.timestamp);
    const signature = sign(ts, rawBody);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        rawPayload: rawBody,
        secret
      })
    ).not.toThrow();
  });

  it("accepte une signature valide sur Buffer (corps HTTP brut)", () => {
    const rawBody = JSON.stringify(payload);
    const ts = String(payload.timestamp);
    const signature = sign(ts, rawBody);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        rawPayload: Buffer.from(rawBody, "utf8"),
        secret
      })
    ).not.toThrow();
  });

  it("rejette si le corps brut diffère de celui signé par GeniusPay", () => {
    const signedBody = '{"amount":5000,"meta":"x"}';
    const alteredBody = '{"meta":"x","amount":5000}';
    const ts = String(payload.timestamp);
    const signature = sign(ts, signedBody);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        rawPayload: alteredBody,
        secret
      })
    ).toThrow("Signature webhook GeniusPay invalide");
  });

  it("rejette une signature invalide", () => {
    const rawBody = JSON.stringify(payload);
    const ts = String(payload.timestamp);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature: "deadbeef",
        timestamp: ts,
        rawPayload: rawBody,
        secret
      })
    ).toThrow("Signature webhook GeniusPay invalide");
  });

  it("rejette un timestamp expiré", () => {
    const rawBody = JSON.stringify(payload);
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const signature = sign(oldTs, rawBody);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: oldTs,
        rawPayload: rawBody,
        secret
      })
    ).toThrow("Timestamp webhook GeniusPay expiré");
  });
});
