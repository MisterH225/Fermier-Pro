import {
  farmQualifiesForHealthBadgeExpiryReminder,
  healthBadgeExpiryReminderCompletedAtBounds
} from "./health-badge-expiry.service";
import {
  HEALTH_BADGE_EXPIRY_REMINDER_DAYS,
  healthBadgeExpiryWindowKey,
  isInHealthBadgeExpiryReminderWindow,
  MS_PER_DAY
} from "./health-verified.util";

describe("HealthBadgeExpiryService — règles métier", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");
  const completedAtJ5 = new Date(
    now.getTime() - (30 - HEALTH_BADGE_EXPIRY_REMINDER_DAYS) * MS_PER_DAY
  );

  it("fenêtre J-5 : qualifie une ferme avec annonce active", () => {
    expect(
      farmQualifiesForHealthBadgeExpiryReminder({
        completedAt: completedAtJ5,
        hasActiveListing: true,
        alreadyReminded: false,
        now
      })
    ).toBe(true);
    expect(isInHealthBadgeExpiryReminderWindow(completedAtJ5, now)).toBe(true);
  });

  it("exclut une ferme sans annonce marketplace active", () => {
    expect(
      farmQualifiesForHealthBadgeExpiryReminder({
        completedAt: completedAtJ5,
        hasActiveListing: false,
        alreadyReminded: false,
        now
      })
    ).toBe(false);
  });

  it("idempotence : une seule notification par ferme / fenêtre", () => {
    const key = healthBadgeExpiryWindowKey(completedAtJ5);
    expect(key).toBe(completedAtJ5.toISOString());

    expect(
      farmQualifiesForHealthBadgeExpiryReminder({
        completedAt: completedAtJ5,
        hasActiveListing: true,
        alreadyReminded: false,
        now
      })
    ).toBe(true);

    expect(
      farmQualifiesForHealthBadgeExpiryReminder({
        completedAt: completedAtJ5,
        hasActiveListing: true,
        alreadyReminded: true,
        now
      })
    ).toBe(false);
  });

  it("bornes SQL J-5 couvrent exactement le jour restant = 5", () => {
    const { gte, lt } = healthBadgeExpiryReminderCompletedAtBounds(now);
    expect(completedAtJ5.getTime()).toBeGreaterThanOrEqual(gte.getTime());
    expect(completedAtJ5.getTime()).toBeLessThan(lt.getTime());

    // J-6 (elapsed = 24 j) est sur la borne haute exclusive → exclu.
    const j6 = new Date(now.getTime() - (30 - 6) * MS_PER_DAY);
    expect(j6.getTime()).toBeGreaterThanOrEqual(lt.getTime());
    expect(isInHealthBadgeExpiryReminderWindow(j6, now)).toBe(false);
  });
});
