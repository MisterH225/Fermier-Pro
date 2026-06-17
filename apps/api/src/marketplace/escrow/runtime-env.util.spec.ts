import { isDeploymentProduction } from "./runtime-env.util";

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
