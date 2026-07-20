import {
  aggregateHealthVerifiedByFarm,
  aggregateLatestVerifiedVisitByFarm,
  daysUntilHealthBadgeExpiry,
  HEALTH_BADGE_EXPIRY_REMINDER_DAYS,
  HEALTH_VERIFIED_WINDOW_MS,
  healthBadgeExpiryWindowKey,
  isInHealthBadgeExpiryReminderWindow,
  isRecentlyExpiredHealthBadge,
  isWithinHealthVerifiedWindow,
  MS_PER_DAY
} from "./health-verified.util";

describe("health-verified.util", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("accepte une complétion dans la fenêtre 30 j", () => {
    const at = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(true);
  });

  it("exclut une complétion hors fenêtre 30 j", () => {
    const at = new Date(now.getTime() - HEALTH_VERIFIED_WINDOW_MS - 1000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(false);
  });

  it("exclut une date dans le futur", () => {
    const at = new Date(now.getTime() + 60_000);
    expect(isWithinHealthVerifiedWindow(at, now)).toBe(false);
  });

  it("exclut un vétérinaire non verified", () => {
    const map = aggregateHealthVerifiedByFarm(
      [
        {
          farmId: "f1",
          completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          vetProfileId: "v1",
          vetName: "Dr. A",
          vetVerified: false
        }
      ],
      now
    );
    expect(map.has("f1")).toBe(false);
  });

  it("exclut une consultation non terminale (hors candidats — pas de completedAt valide)", () => {
    const map = aggregateHealthVerifiedByFarm([], now);
    expect(map.size).toBe(0);
  });

  it("retient la dernière complétion verified dans la fenêtre", () => {
    const older = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const newer = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const map = aggregateHealthVerifiedByFarm(
      [
        {
          farmId: "f1",
          completedAt: older,
          vetProfileId: "v1",
          vetName: "Dr. Old",
          vetVerified: true
        },
        {
          farmId: "f1",
          completedAt: newer,
          vetProfileId: "v2",
          vetName: "Dr. New",
          vetVerified: true
        },
        {
          farmId: "f1",
          completedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          vetProfileId: "v3",
          vetName: "Dr. Pending",
          vetVerified: false
        },
        {
          farmId: "f2",
          completedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          vetProfileId: "v1",
          vetName: "Dr. Old",
          vetVerified: true
        }
      ],
      now
    );
    expect(map.get("f1")).toEqual({
      completedAt: newer,
      vetProfileId: "v2",
      vetName: "Dr. New"
    });
    expect(map.has("f2")).toBe(false);
  });

  describe("fenêtre J-5 expiration badge", () => {
    it("détecte une complétion à exactement J-5", () => {
      const completedAt = new Date(
        now.getTime() -
          (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS) * MS_PER_DAY
      );
      expect(daysUntilHealthBadgeExpiry(completedAt, now)).toBe(5);
      expect(isInHealthBadgeExpiryReminderWindow(completedAt, now)).toBe(true);
    });

    it("exclut J-6 et J-4", () => {
      const j6 = new Date(now.getTime() - (30 - 6) * MS_PER_DAY);
      const j4 = new Date(now.getTime() - (30 - 4) * MS_PER_DAY);
      expect(isInHealthBadgeExpiryReminderWindow(j6, now)).toBe(false);
      expect(isInHealthBadgeExpiryReminderWindow(j4, now)).toBe(false);
    });

    it("produit une clé d'idempotence stable par complétion", () => {
      const at = new Date("2026-06-25T08:00:00.000Z");
      expect(healthBadgeExpiryWindowKey(at)).toBe(at.toISOString());
      expect(healthBadgeExpiryWindowKey(at)).toBe(
        healthBadgeExpiryWindowKey(new Date(at.getTime()))
      );
    });

    it("agrège la dernière visite verified hors fenêtre 30 j", () => {
      const old = new Date(now.getTime() - 40 * MS_PER_DAY);
      const map = aggregateLatestVerifiedVisitByFarm([
        {
          farmId: "f1",
          completedAt: old,
          vetProfileId: "v1",
          vetName: "Dr. A",
          vetVerified: true,
          vetUserId: "u1"
        }
      ]);
      expect(map.get("f1")?.vetUserId).toBe("u1");
      expect(map.get("f1")?.completedAt).toEqual(old);
    });

    it("détecte un badge expiré depuis moins de 15 j", () => {
      const completedAt = new Date(now.getTime() - 35 * MS_PER_DAY);
      expect(isRecentlyExpiredHealthBadge(completedAt, now)).toBe(true);
      const tooOld = new Date(now.getTime() - 50 * MS_PER_DAY);
      expect(isRecentlyExpiredHealthBadge(tooOld, now)).toBe(false);
    });
  });
});
