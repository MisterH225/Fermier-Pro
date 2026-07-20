import {
  healthVerifiedDaysAgo,
  healthVerifiedDaysRemaining,
  isHealthBadgeRecentlyExpired
} from "../MarketplaceListingCard";

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

describe("healthVerifiedDaysRemaining / expired recently", () => {
  const realNow = Date.now;

  afterEach(() => {
    Date.now = realNow;
  });

  it("calcule les jours restants (J-5)", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    Date.now = () => now;
    const at = new Date(now - 25 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysRemaining(at)).toBe(5);
  });

  it("détecte un badge expiré depuis moins de 15 j", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    Date.now = () => now;
    const at = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(at)).toBeNull();
    expect(isHealthBadgeRecentlyExpired(at)).toBe(true);
  });

  it("exclut un badge expiré depuis trop longtemps", () => {
    const now = Date.parse("2026-07-20T12:00:00.000Z");
    Date.now = () => now;
    const at = new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString();
    expect(isHealthBadgeRecentlyExpired(at)).toBe(false);
  });
});
