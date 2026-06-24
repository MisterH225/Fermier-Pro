import { YellikaSmsClient } from "./yellika-sms.client";

describe("YellikaSmsClient", () => {
  const client = new YellikaSmsClient();

  beforeEach(() => {
    process.env.YELLIKA_SMS_API_TOKEN = "test-token";
    process.env.YELLIKA_SMS_SENDER_ID = "FERMIER";
  });

  it("formate un numéro E.164 sans le préfixe +", () => {
    expect(client.formatRecipient("+2250708123456")).toBe("2250708123456");
  });

  it("rejette un numéro trop court", () => {
    expect(() => client.formatRecipient("+22512")).toThrow(
      "Numéro de téléphone invalide"
    );
  });
});
