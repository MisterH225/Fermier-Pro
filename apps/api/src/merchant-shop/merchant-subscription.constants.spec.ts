import {
  addBillingPeriod,
  applyPromoPercent,
  billingPeriodStart,
  billingReminderKey,
  graceDurationMs,
  periodsBetweenUtc
} from "./merchant-subscription.constants";

describe("merchant-subscription.constants", () => {
  describe("addBillingPeriod", () => {
    it("ajoute des heures", () => {
      const from = new Date("2026-07-08T10:00:00.000Z");
      expect(addBillingPeriod(from, "hour", 1).toISOString()).toBe(
        "2026-07-08T11:00:00.000Z"
      );
      expect(addBillingPeriod(from, "hour", 3).toISOString()).toBe(
        "2026-07-08T13:00:00.000Z"
      );
    });

    it("ajoute des jours", () => {
      const from = new Date("2026-07-08T10:00:00.000Z");
      expect(addBillingPeriod(from, "day", 1).toISOString()).toBe(
        "2026-07-09T10:00:00.000Z"
      );
      expect(addBillingPeriod(from, "day", 7).toISOString()).toBe(
        "2026-07-15T10:00:00.000Z"
      );
    });

    it("ajoute des mois UTC", () => {
      const from = new Date("2026-01-15T12:00:00.000Z");
      expect(addBillingPeriod(from, "month", 1).toISOString()).toBe(
        "2026-02-15T12:00:00.000Z"
      );
      expect(addBillingPeriod(from, "month", 2).toISOString()).toBe(
        "2026-03-15T12:00:00.000Z"
      );
    });

    it("force un intervalle minimal de 1", () => {
      const from = new Date("2026-07-08T10:00:00.000Z");
      expect(addBillingPeriod(from, "day", 0).toISOString()).toBe(
        "2026-07-09T10:00:00.000Z"
      );
      expect(addBillingPeriod(from, "hour", -2).toISOString()).toBe(
        "2026-07-08T11:00:00.000Z"
      );
    });
  });

  describe("applyPromoPercent", () => {
    it("applique une remise entière", () => {
      expect(applyPromoPercent(10_000, 20)).toBe(8_000);
      expect(applyPromoPercent(999, 10)).toBe(899);
    });

    it("ignore une promo nulle ou négative", () => {
      expect(applyPromoPercent(5_000, 0)).toBe(5_000);
      expect(applyPromoPercent(5_000, -5)).toBe(5_000);
    });

    it("plafond à 100 %", () => {
      expect(applyPromoPercent(5_000, 100)).toBe(0);
      expect(applyPromoPercent(5_000, 150)).toBe(0);
    });
  });

  describe("billingPeriodStart / billingReminderKey", () => {
    it("tronque à l'heure pour le billing horaire", () => {
      const at = new Date("2026-07-10T14:37:22.000Z");
      expect(billingPeriodStart(at, "hour").toISOString()).toBe(
        "2026-07-10T14:00:00.000Z"
      );
      expect(billingReminderKey(at, "j0", "hour")).toBe(
        "2026-07-10T14:00:00.000Z:j0"
      );
    });

    it("tronque au jour pour month/day", () => {
      const at = new Date("2026-07-10T14:37:22.000Z");
      expect(billingPeriodStart(at, "month").toISOString()).toBe(
        "2026-07-10T00:00:00.000Z"
      );
      expect(billingReminderKey(at, "j0", "month")).toBe("2026-07-10:j0");
    });
  });

  describe("periodsBetweenUtc / graceDurationMs", () => {
    it("compte les périodes horaires", () => {
      const a = new Date("2026-07-10T10:00:00.000Z");
      const b = new Date("2026-07-10T13:00:00.000Z");
      expect(periodsBetweenUtc(a, b, "hour", 1)).toBe(3);
    });

    it("convertit la grâce en ms selon l'unité", () => {
      expect(graceDurationMs(7, "month")).toBe(7 * 86_400_000);
      expect(graceDurationMs(3, "hour")).toBe(3 * 3_600_000);
    });
  });
});
