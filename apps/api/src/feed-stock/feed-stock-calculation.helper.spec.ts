import {
  buildConsumptionIntervals,
  calendarDaysElapsed,
  computeWeightedAvgDailyKg,
  daysBetweenUtc,
  projectStockFromAnchor,
  resolveCurrentStockKg,
  resolveFeedStockStatus,
  resolveStockAnchor,
  selectConsumptionRateIntervals,
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

  describe("resolveCurrentStockKg", () => {
    const checkAt = new Date("2026-06-01T12:00:00.000Z");
    const entryAfter = new Date("2026-06-05T12:00:00.000Z");

    it("utilise le registre si une entrée est postérieure au dernier contrôle", () => {
      expect(
        resolveCurrentStockKg({
          ledgerStockKg: 1000,
          latestCheck: {
            occurredAt: checkAt,
            bagsCounted: 20,
            stockAfterKg: 500
          },
          lastInOccurredAt: entryAfter,
          weightPerBagKg: 25
        })
      ).toBe(1000);
    });

    it("utilise le contrôle physique si c'est le dernier événement", () => {
      expect(
        resolveCurrentStockKg({
          ledgerStockKg: 999,
          latestCheck: {
            occurredAt: entryAfter,
            bagsCounted: 20,
            stockAfterKg: 500
          },
          lastInOccurredAt: checkAt,
          weightPerBagKg: 25
        })
      ).toBe(500);
    });

    it("retourne le registre sans contrôle", () => {
      expect(
        resolveCurrentStockKg({
          ledgerStockKg: 750,
          latestCheck: null,
          lastInOccurredAt: checkAt,
          weightPerBagKg: 25
        })
      ).toBe(750);
    });
  });

  describe("computeWeightedAvgDailyKg", () => {
    it("pondère par la durée des intervalles (pas une moyenne des taux)", () => {
      const weighted = computeWeightedAvgDailyKg([
        { days: 10, consumedKg: 50 },
        { days: 20, consumedKg: 400 }
      ]);
      // (50+400)/(10+20) = 15 — pas (5+20)/2 = 12,5
      expect(weighted).toBeCloseTo(15, 5);
    });

    it("retourne null sans consommation positive", () => {
      expect(
        computeWeightedAvgDailyKg([{ days: 10, consumedKg: 0 }])
      ).toBeNull();
    });
  });

  describe("buildConsumptionIntervals", () => {
    const wp = 25;

    it("conserve l'intervalle entrée → 1er contrôle même avec 2+ contrôles", () => {
      const d0 = new Date("2026-06-01T00:00:00.000Z");
      const d10 = new Date("2026-06-11T00:00:00.000Z");
      const d20 = new Date("2026-06-21T00:00:00.000Z");

      const { intervals } = buildConsumptionIntervals({
        weightPerBagKg: wp,
        entryRows: [
          {
            id: "in1",
            occurredAt: d0,
            quantityKg: 1000,
            stockAfterKg: 1000
          }
        ],
        checksChron: [
          {
            id: "c1",
            occurredAt: d10,
            bagsCounted: 38,
            stockAfterKg: 950
          },
          {
            id: "c2",
            occurredAt: d20,
            bagsCounted: 34,
            stockAfterKg: 850
          }
        ]
      });

      expect(intervals).toHaveLength(2);
      expect(intervals[0]!.fromCheckId).toBe("in1");
      expect(intervals[0]!.toCheckId).toBe("c1");
      expect(intervals[0]!.consumedKg).toBeCloseTo(50, 1);
      expect(intervals[1]!.consumedKg).toBeCloseTo(100, 1);
    });

    it("inclut les entrées entre deux contrôles", () => {
      const d0 = new Date("2026-06-01T00:00:00.000Z");
      const d10 = new Date("2026-06-11T00:00:00.000Z");
      const d15 = new Date("2026-06-16T00:00:00.000Z");
      const d20 = new Date("2026-06-21T00:00:00.000Z");

      const { intervals } = buildConsumptionIntervals({
        weightPerBagKg: wp,
        entryRows: [
          {
            id: "in1",
            occurredAt: d0,
            quantityKg: 1000,
            stockAfterKg: 1000
          },
          {
            id: "in2",
            occurredAt: d15,
            quantityKg: 100,
            stockAfterKg: 1000
          }
        ],
        checksChron: [
          {
            id: "c1",
            occurredAt: d10,
            bagsCounted: 38,
            stockAfterKg: 950
          },
          {
            id: "c2",
            occurredAt: d20,
            bagsCounted: 36,
            stockAfterKg: 900
          }
        ]
      });

      const betweenChecks = intervals.find(
        (x) => x.fromCheckId === "c1" && x.toCheckId === "c2"
      );
      // 950 + 100 - 900 = 150 kg sur 10 j
      expect(betweenChecks?.consumedKg).toBeCloseTo(150, 1);
      expect(betweenChecks?.dailyKg).toBeCloseTo(15, 1);
    });
  });

  describe("calendarDaysElapsed", () => {
    it("retourne 0 pour la même date", () => {
      const d = new Date("2026-06-01T12:00:00.000Z");
      expect(calendarDaysElapsed(d, d)).toBe(0);
    });

    it("compte les jours sans minimum à 1", () => {
      const a = new Date("2026-06-01T00:00:00.000Z");
      const b = new Date("2026-06-06T00:00:00.000Z");
      expect(calendarDaysElapsed(a, b)).toBe(5);
    });
  });

  describe("selectConsumptionRateIntervals", () => {
    it("privilégie les intervalles entre contrôles quand il y en a ≥ 2", () => {
      const intervals = [
        {
          fromCheckId: "in1",
          toCheckId: "c1",
          days: 10,
          consumedKg: 50,
          dailyKg: 5
        },
        {
          fromCheckId: "c1",
          toCheckId: "c2",
          days: 10,
          consumedKg: 150,
          dailyKg: 15
        },
        {
          fromCheckId: "c2",
          toCheckId: "c3",
          days: 10,
          consumedKg: 200,
          dailyKg: 20
        }
      ];
      const selected = selectConsumptionRateIntervals(
        intervals,
        new Set(["in1"])
      );
      expect(selected).toHaveLength(2);
      expect(selected.every((i) => i.fromCheckId !== "in1")).toBe(true);
      expect(computeWeightedAvgDailyKg(selected)).toBeCloseTo(17.5, 5);
    });

    it("retombe sur l'intervalle entrée → contrôle s'il n'y a qu'un seul contrôle", () => {
      const intervals = [
        {
          fromCheckId: "in1",
          toCheckId: "c1",
          days: 10,
          consumedKg: 200,
          dailyKg: 20
        }
      ];
      const selected = selectConsumptionRateIntervals(
        intervals,
        new Set(["in1"])
      );
      expect(selected).toHaveLength(1);
      expect(computeWeightedAvgDailyKg(selected)).toBeCloseTo(20, 5);
    });
  });

  describe("projectStockFromAnchor", () => {
    const asOf = new Date("2026-06-11T12:00:00.000Z");

    it("amortit la conso depuis le dernier contrôle", () => {
      const projected = projectStockFromAnchor(
        {
          stockKg: 800,
          anchorDate: new Date("2026-06-01T12:00:00.000Z")
        },
        20,
        asOf
      );
      expect(projected).toBeCloseTo(600, 1);
    });

    it("ne projette pas sans taux de conso", () => {
      expect(
        projectStockFromAnchor(
          {
            stockKg: 800,
            anchorDate: new Date("2026-06-01T12:00:00.000Z")
          },
          null,
          asOf
        )
      ).toBe(800);
    });
  });

  describe("resolveStockAnchor", () => {
    it("ancre sur une entrée postérieure au dernier contrôle", () => {
      const anchor = resolveStockAnchor({
        ledgerStockKg: 900,
        latestCheck: {
          occurredAt: new Date("2026-06-01T12:00:00.000Z"),
          bagsCounted: 32,
          stockAfterKg: 800
        },
        lastIn: {
          occurredAt: new Date("2026-06-09T12:00:00.000Z"),
          stockAfterKg: 900
        },
        weightPerBagKg: 25,
        asOf: new Date("2026-06-11T12:00:00.000Z")
      });
      expect(anchor.stockKg).toBe(900);
      expect(anchor.anchorDate.toISOString()).toBe("2026-06-09T12:00:00.000Z");
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
