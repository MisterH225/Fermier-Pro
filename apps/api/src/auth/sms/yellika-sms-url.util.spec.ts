import { resolveYellikaSmsSendUrl } from "./yellika-sms-url.util";

describe("resolveYellikaSmsSendUrl", () => {
  it("utilise l'URL par défaut v3", () => {
    expect(resolveYellikaSmsSendUrl(undefined)).toBe(
      "https://panel.yellikasms.com/api/v3/sms/send"
    );
  });

  it("ajoute /sms/send à une base v3", () => {
    expect(resolveYellikaSmsSendUrl("https://panel.yellikasms.com/api/v3/")).toBe(
      "https://panel.yellikasms.com/api/v3/sms/send"
    );
  });

  it("ne duplique pas /sms/send si déjà présent dans la base", () => {
    expect(
      resolveYellikaSmsSendUrl("https://panel.yellikasms.com/api/v3/sms/send")
    ).toBe("https://panel.yellikasms.com/api/v3/sms/send");
  });
});
