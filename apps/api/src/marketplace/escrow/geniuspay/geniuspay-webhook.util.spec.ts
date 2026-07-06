import { createHmac } from "crypto";
import {
  isLikelyGeniusPayWebhookSecret,
  verifyGeniusPayWebhookSignature
} from "./geniuspay-webhook.util";

describe("verifyGeniusPayWebhookSignature", () => {
  const secret = "whsec_sandbox_test_secret";
  const payload = {
    id: "evt-1",
    event: "webhook.test",
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

  it("valide le format whsec_", () => {
    expect(isLikelyGeniusPayWebhookSecret("whsec_sandbox_abc")).toBe(true);
    expect(isLikelyGeniusPayWebhookSecret("whsec_live_abc")).toBe(true);
    expect(isLikelyGeniusPayWebhookSecret("whsec_abc123")).toBe(true);
    expect(isLikelyGeniusPayWebhookSecret("sk_sandbox_abc")).toBe(false);
  });

  it("accepte whsec_ sans suffixe sandbox/live (format GeniusPay courant)", () => {
    const altSecret = "whsec_abc123secret";
    const rawBody = JSON.stringify(payload);
    const ts = String(payload.timestamp);
    const signature = createHmac("sha256", altSecret)
      .update(`${ts}.${rawBody}`)
      .digest("hex");
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        rawPayload: rawBody,
        secret: altSecret
      })
    ).not.toThrow();
  });

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

  it("rejette une clé API sk_ confondue avec le secret webhook", () => {
    const rawBody = JSON.stringify(payload);
    const ts = String(payload.timestamp);
    const signature = sign(ts, rawBody);
    expect(() =>
      verifyGeniusPayWebhookSignature({
        signature,
        timestamp: ts,
        rawPayload: rawBody,
        secret: "sk_sandbox_api_secret"
      })
    ).toThrow("clé API");
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
