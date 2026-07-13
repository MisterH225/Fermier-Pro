import { MobileMoneyGatewayGuard } from "./mobile-money-gateway.provider";

describe("MobileMoneyGatewayGuard", () => {
  const envKeys = [
    "APP_ENV",
    "NODE_ENV",
    "MOBILE_MONEY_PROVIDER",
    "GENIUSPAY_API_KEY",
    "GENIUSPAY_API_SECRET",
    "GENIUSPAY_WEBHOOK_SECRET"
  ] as const;

  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  });

  it("throws in production when MOBILE_MONEY_PROVIDER=dev", () => {
    process.env.APP_ENV = "production";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).toThrow(
      /MOBILE_MONEY_PROVIDER=dev interdit en production/
    );
  });

  it("throws in production when APP_ENV=prod and provider defaults to dev", () => {
    process.env.APP_ENV = "prod";
    delete process.env.MOBILE_MONEY_PROVIDER;
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).toThrow(/gateway simulé/);
  });

  it("does not throw in non-production with provider=dev", () => {
    process.env.APP_ENV = "development";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).not.toThrow();
  });

  it("does not throw when APP_ENV is absent and NODE_ENV is not production", () => {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = "test";
    process.env.MOBILE_MONEY_PROVIDER = "dev";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).not.toThrow();
  });

  it("throws in production when geniuspay vars are missing", () => {
    process.env.APP_ENV = "production";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).toThrow(
      /variables manquantes: GENIUSPAY_API_KEY/
    );
  });

  it("throws in production when GENIUSPAY_API_KEY has invalid format", () => {
    process.env.APP_ENV = "production";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    process.env.GENIUSPAY_API_KEY = "sk_live_wrong";
    process.env.GENIUSPAY_API_SECRET = "sk_secret";
    process.env.GENIUSPAY_WEBHOOK_SECRET = "whsec_ok";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).toThrow(/GENIUSPAY_API_KEY doit être/);
  });

  it("throws in production when GENIUSPAY_WEBHOOK_SECRET has invalid format", () => {
    process.env.APP_ENV = "production";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    process.env.GENIUSPAY_API_KEY = "pk_live_ok";
    process.env.GENIUSPAY_API_SECRET = "sk_secret";
    process.env.GENIUSPAY_WEBHOOK_SECRET = "not-a-whsec";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).toThrow(
      /GENIUSPAY_WEBHOOK_SECRET doit commencer par whsec_/
    );
  });

  it("does not throw in staging when geniuspay vars are missing (log only)", () => {
    process.env.APP_ENV = "staging";
    process.env.MOBILE_MONEY_PROVIDER = "geniuspay";
    const guard = new MobileMoneyGatewayGuard();
    expect(() => guard.onModuleInit()).not.toThrow();
  });
});
