import { YellikaSmsSendError } from "./yellika-sms.errors";
import { YellikaSmsClient } from "./yellika-sms.client";

const originalFetch = global.fetch;

describe("YellikaSmsClient", () => {
  const client = new YellikaSmsClient();

  beforeEach(() => {
    process.env.YELLIKA_SMS_API_TOKEN = "test-token";
    process.env.YELLIKA_SMS_SENDER_ID = "FERMIER";
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("formate un numéro E.164 sans le préfixe +", () => {
    expect(client.formatRecipient("+2250708123456")).toBe("2250708123456");
  });

  it("réinsère le 0 manquant pour un numéro CI tronqué", () => {
    expect(client.formatRecipient("+225708425141")).toBe("2250708425141");
  });

  it("retire le 0 local pour le Sénégal", () => {
    expect(client.formatRecipient("+2210771234567")).toBe("221771234567");
  });

  it("rejette un numéro trop court", () => {
    expect(() => client.formatRecipient("+22512")).toThrow(
      "Numéro de téléphone invalide"
    );
  });

  it("détecte status:error dans une réponse HTTP 200 Yellika", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: "error", message: "Unauthenticated." })
    });

    await expect(
      client.sendPlainText("+2250708123456", "code test")
    ).rejects.toThrow(YellikaSmsSendError);
  });

  it("accepte une réponse Yellika réussie", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status: "success", message: "SMS sent" })
    });

    await expect(
      client.sendPlainText("+2250708123456", "code test")
    ).resolves.toBeUndefined();
  });
});
