import { formatVetDisplayName } from "../HealthVerifiedBadge";
import {
  healthVerifiedDaysAgo,
  isHealthBadgeRecentlyExpired
} from "../MarketplaceListingCard";

describe("formatVetDisplayName", () => {
  it("préfixe Dr si absent", () => {
    expect(formatVetDisplayName("Amadou Diallo")).toBe("Dr Amadou Diallo");
  });

  it("conserve Dr / Dr. déjà présents", () => {
    expect(formatVetDisplayName("Dr Amadou Diallo")).toBe("Dr Amadou Diallo");
    expect(formatVetDisplayName("Dr. Amadou Diallo")).toBe("Dr. Amadou Diallo");
  });

  it("gère les espaces", () => {
    expect(formatVetDisplayName("  Fatou Ba  ")).toBe("Dr Fatou Ba");
  });
});

describe("affichage badge Santé (règles carte / détail)", () => {
  const realNow = Date.now;

  afterEach(() => {
    Date.now = realNow;
  });

  it("affiche le badge seulement dans la fenêtre 30 j", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    Date.now = () => now;
    const verifiedAt = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(verifiedAt)).not.toBeNull();
  });

  it("n'affiche pas de badge négatif hors fenêtre", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    Date.now = () => now;
    const expiredAt = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(expiredAt)).toBeNull();
  });

  it("CTA producteur « expiré récemment » sans badge actif", () => {
    const now = Date.parse("2026-07-31T12:00:00.000Z");
    Date.now = () => now;
    const last = new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString();
    expect(healthVerifiedDaysAgo(last)).toBeNull();
    expect(isHealthBadgeRecentlyExpired(last)).toBe(true);
  });
});
