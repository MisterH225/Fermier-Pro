import { getPhoneAuthReadiness } from "./phone-auth-config";

describe("getPhoneAuthReadiness", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.YELLIKA_SMS_API_TOKEN;
    delete process.env.YELLIKA_SMS_SENDER_ID;
    delete process.env.SUPABASE_SEND_SMS_HOOK_SECRET;
    delete process.env.SEND_SMS_HOOK_SECRETS;
  });

  afterAll(() => {
    process.env = env;
  });

  it("signale les variables manquantes", () => {
    const r = getPhoneAuthReadiness();
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual([
      "YELLIKA_SMS_API_TOKEN",
      "YELLIKA_SMS_SENDER_ID",
      "SUPABASE_SEND_SMS_HOOK_SECRET"
    ]);
  });

  it("ready quand tout est renseigné", () => {
    process.env.YELLIKA_SMS_API_TOKEN = "token";
    process.env.YELLIKA_SMS_SENDER_ID = "FERMIER";
    process.env.SUPABASE_SEND_SMS_HOOK_SECRET = "v1,whsec_test";
    const r = getPhoneAuthReadiness();
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });
});
