import {
  addBillingPeriod,
  applyPromoPercent
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
});
