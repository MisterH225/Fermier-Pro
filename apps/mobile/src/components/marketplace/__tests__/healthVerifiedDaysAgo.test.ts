import { healthVerifiedDaysAgo } from "../MarketplaceListingCard";

describe("healthVerifiedDaysAgo", () => {
  const realNow = Date.now;

  afterEach(() => {
    Date.now = realNow;
  });

  it("retourne les jours dans la fenêtre 30 j", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    Date.now = () => now;
    const at = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(at)).toBe(5);
  });

  it("retourne null hors fenêtre", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    Date.now = () => now;
    const at = new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(at)).toBeNull();
  });

  it("retourne null si absent", () => {
    expect(healthVerifiedDaysAgo(null)).toBeNull();
    expect(healthVerifiedDaysAgo(undefined)).toBeNull();
  });
});
