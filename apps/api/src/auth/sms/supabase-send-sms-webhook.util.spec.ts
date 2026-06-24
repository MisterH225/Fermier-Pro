import { Webhook } from "standardwebhooks";
import {
  buildOtpSmsMessage,
  verifySupabaseSendSmsHook
} from "./supabase-send-sms-webhook.util";

describe("supabase-send-sms-webhook.util", () => {
  const secretBase64 = Buffer.from("test-hook-secret-32bytes!!!!").toString(
    "base64"
  );

  beforeEach(() => {
    process.env.SUPABASE_SEND_SMS_HOOK_SECRET = `v1,whsec_${secretBase64}`;
  });

  it("construit un message OTP lisible", () => {
    expect(buildOtpSmsMessage("123456")).toContain("123456");
    expect(buildOtpSmsMessage("123456")).toContain("Fermier Pro");
  });

  it("vérifie une signature Standard Webhooks valide", () => {
    const payload = JSON.stringify({
      user: { id: "u1", phone: "+2250708123456" },
      sms: { otp: "654321" }
    });
    const wh = new Webhook(secretBase64);
    const msgId = "msg_test_123";
    const timestamp = new Date();
    const signature = wh.sign(msgId, timestamp, payload);

    const result = verifySupabaseSendSmsHook(payload, {
      "webhook-id": msgId,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature
    });
    expect(result.sms.otp).toBe("654321");
    expect(result.user.phone).toBe("+2250708123456");
  });
});
