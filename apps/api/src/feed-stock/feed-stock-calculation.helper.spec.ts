import {
  daysBetweenUtc,
  resolveFeedStockStatus,
  sumEntryKgFromMovements
} from "./feed-stock-calculation.helper";

describe("feed-stock-calculation.helper", () => {
  describe("daysBetweenUtc", () => {
    it("retourne au minimum 1 jour", () => {
      const d = new Date("2026-06-01T12:00:00.000Z");
      expect(daysBetweenUtc(d, d)).toBe(1);
    });

    it("arrondit la différence en jours entiers", () => {
      const a = new Date("2026-06-01T00:00:00.000Z");
      const b = new Date("2026-06-11T00:00:00.000Z");
      expect(daysBetweenUtc(a, b)).toBe(10);
    });
  });

  describe("sumEntryKgFromMovements", () => {
    const entries = [
      {
        occurredAt: new Date("2026-06-01T10:00:00.000Z"),
        quantityKg: 500
      },
      {
        occurredAt: new Date("2026-06-05T10:00:00.000Z"),
        quantityKg: 200
      },
      {
        occurredAt: new Date("2026-06-15T10:00:00.000Z"),
        quantityKg: 100
      }
    ];

    it("somme les entrées strictement après le début et jusqu'à la fin inclusive", () => {
      const sum = sumEntryKgFromMovements(
        entries,
        new Date("2026-06-01T10:00:00.000Z"),
        new Date("2026-06-10T00:00:00.000Z")
      );
      expect(sum).toBe(200);
    });

    it("inclut une entrée à la date de fin", () => {
      const sum = sumEntryKgFromMovements(
        entries,
        new Date("2026-06-01T10:00:00.000Z"),
        new Date("2026-06-05T10:00:00.000Z")
      );
      expect(sum).toBe(200);
    });
  });

  describe("resolveFeedStockStatus", () => {
    it("utilise les seuils personnalisés de la ferme", () => {
      expect(
        resolveFeedStockStatus(6, 80, true, {
          criticalDays: 7,
          warningDays: 14
        })
      ).toBe("critical");

      expect(
        resolveFeedStockStatus(10, 80, true, {
          criticalDays: 7,
          warningDays: 14
        })
      ).toBe("warning");

      expect(
        resolveFeedStockStatus(20, 80, true, {
          criticalDays: 7,
          warningDays: 14
        })
      ).toBe("ok");
    });

    it("retourne no_data sans données suffisantes", () => {
      expect(resolveFeedStockStatus(5, 10, false)).toBe("no_data");
    });
  });
});
