import {
  assertAppEnvConfiguredOnRailway,
  isDeploymentProduction,
  isRunningOnRailway
} from "./runtime-env.util";

describe("isDeploymentProduction", () => {
  const originalAppEnv = process.env.APP_ENV;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("returns true for APP_ENV=production", () => {
    process.env.APP_ENV = "production";
    process.env.NODE_ENV = "development";
    expect(isDeploymentProduction()).toBe(true);
  });

  it("returns false for APP_ENV=staging even when NODE_ENV=production", () => {
    process.env.APP_ENV = "staging";
    process.env.NODE_ENV = "production";
    expect(isDeploymentProduction()).toBe(false);
  });

  it("returns false for APP_ENV=preview even when NODE_ENV=production", () => {
    process.env.APP_ENV = "preview";
    process.env.NODE_ENV = "production";
    expect(isDeploymentProduction()).toBe(false);
  });

  it("falls back to NODE_ENV=production when APP_ENV is absent", () => {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = "production";
    expect(isDeploymentProduction()).toBe(true);
  });

  it("returns false when APP_ENV is absent and NODE_ENV is not production", () => {
    delete process.env.APP_ENV;
    process.env.NODE_ENV = "development";
    expect(isDeploymentProduction()).toBe(false);
  });
});

describe("assertAppEnvConfiguredOnRailway", () => {
  const envKeys = [
    "APP_ENV",
    "RAILWAY_ENVIRONMENT",
    "RAILWAY_PROJECT_ID"
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

  it("does not throw locally when APP_ENV is absent and Railway vars are unset", () => {
    delete process.env.APP_ENV;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_PROJECT_ID;
    expect(isRunningOnRailway()).toBe(false);
    expect(() => assertAppEnvConfiguredOnRailway()).not.toThrow();
  });

  it("throws when RAILWAY_ENVIRONMENT is set but APP_ENV is absent", () => {
    process.env.RAILWAY_ENVIRONMENT = "production";
    delete process.env.APP_ENV;
    expect(() => assertAppEnvConfiguredOnRailway()).toThrow(
      /APP_ENV est obligatoire sur Railway/
    );
  });

  it("throws when RAILWAY_PROJECT_ID is set but APP_ENV is empty", () => {
    process.env.RAILWAY_PROJECT_ID = "proj_abc";
    process.env.APP_ENV = "   ";
    expect(() => assertAppEnvConfiguredOnRailway()).toThrow(
      /APP_ENV est obligatoire sur Railway/
    );
  });

  it("does not throw on Railway when APP_ENV is set", () => {
    process.env.RAILWAY_ENVIRONMENT = "production";
    process.env.APP_ENV = "staging";
    expect(() => assertAppEnvConfiguredOnRailway()).not.toThrow();
  });
});
