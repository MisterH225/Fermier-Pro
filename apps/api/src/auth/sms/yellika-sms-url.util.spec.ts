import {
  resolveYellikaSmsSendUrl,
  YELLIKA_SMS_SEND_URL_DEFAULT
} from "./yellika-sms-url.util";

describe("resolveYellikaSmsSendUrl", () => {
  it("utilise l'URL Yellika par défaut (chemin complet)", () => {
    expect(resolveYellikaSmsSendUrl({})).toBe(YELLIKA_SMS_SEND_URL_DEFAULT);
  });

  it("utilise YELLIKA_SMS_SEND_URL telle quelle", () => {
    expect(
      resolveYellikaSmsSendUrl({
        YELLIKA_SMS_SEND_URL: "https://panel.yellikasms.com/api/v3/sms/send/"
      })
    ).toBe("https://panel.yellikasms.com/api/v3/sms/send");
  });

  it("accepte l'alias legacy YELLIKA_SMS_API_BASE_URL", () => {
    expect(
      resolveYellikaSmsSendUrl({
        YELLIKA_SMS_API_BASE_URL: "https://panel.yellikasms.com/api/v3/sms/send"
      })
    ).toBe("https://panel.yellikasms.com/api/v3/sms/send");
  });
});
