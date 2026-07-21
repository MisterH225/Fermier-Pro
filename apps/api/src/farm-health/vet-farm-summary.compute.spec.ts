import {
  buildBiosecurityBarns,
  buildGmqWeekly,
  buildHealthTimeline,
  buildMortalityMonthly,
  buildQuarantineCompliance,
  buildVetReadings,
  filterUpcomingFarrowings,
  lastMonthKeys,
  lastWeekKeys,
  QUARANTINE_MIN_DAYS,
  resolveBatchStatus,
  resolveTargetGmq
} from "./vet-farm-summary.compute";
import type { VetBatchSummary } from "./vet-farm-summary.types";

describe("vet-farm-summary.compute — fenêtres temporelles", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("lastMonthKeys renvoie 6 mois", () => {
    expect(lastMonthKeys(6, now)).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07"
    ]);
  });

  it("lastWeekKeys renvoie 8 semaines", () => {
    const keys = lastWeekKeys(8, now);
    expect(keys).toHaveLength(8);
    expect(keys[keys.length - 1]).toBe("2026-W29");
  });
});

describe("buildMortalityMonthly", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("ferme sans données → null", () => {
    expect(buildMortalityMonthly([], 100, 6, now)).toBeNull();
  });

  it("agrège 6 mois avec ratePercent", () => {
    const series = buildMortalityMonthly(
      [
        { occurredAt: new Date("2026-07-01T00:00:00Z"), headcountAffected: 2 },
        { occurredAt: new Date("2026-05-10T00:00:00Z"), headcountAffected: 5 },
        { occurredAt: new Date("2025-12-01T00:00:00Z"), headcountAffected: 99 }
      ],
      98,
      6,
      now
    );
    expect(series).toHaveLength(6);
    const jul = series!.find((m) => m.month === "2026-07");
    expect(jul?.count).toBe(2);
    // 2 / (98+2) * 100 = 2.0
    expect(jul?.ratePercent).toBe(2);
    const may = series!.find((m) => m.month === "2026-05");
    expect(may?.count).toBe(5);
    const feb = series!.find((m) => m.month === "2026-02");
    expect(feb?.count).toBe(0);
    expect(feb?.ratePercent).toBe(0);
  });
});

describe("buildGmqWeekly", () => {
  const now = new Date("2026-07-15T12:00:00Z");

  it("sans pesées → null", () => {
    expect(buildGmqWeekly([], 8, now)).toBeNull();
  });

  it("calcule le GMQ sur 8 semaines", () => {
    // Semaine contenant le 15 juil 2026 = W29
    // Pesée W28 → W29 : +7 kg / 7 j = 1000 g/j
    const weights = [
      {
        animalId: "a1",
        weightKg: 50,
        measuredAt: new Date("2026-07-06T00:00:00Z")
      },
      {
        animalId: "a1",
        weightKg: 57,
        measuredAt: new Date("2026-07-13T00:00:00Z")
      }
    ];
    const series = buildGmqWeekly(weights, 8, now);
    expect(series).toHaveLength(8);
    const w29 = series!.find((w) => w.week === "2026-W29");
    expect(w29?.avgGmq).toBe(1000);
    const empty = series!.filter((w) => w.avgGmq == null);
    expect(empty.length).toBeGreaterThan(0);
  });
});

describe("buildHealthTimeline", () => {
  it("ferme sans événements → null", () => {
    expect(buildHealthTimeline([], [])).toBeNull();
  });

  it("fusionne et coupe à 15", () => {
    const records = Array.from({ length: 12 }, (_, i) => ({
      occurredAt: new Date(`2026-07-${String(i + 1).padStart(2, "0")}T10:00:00Z`),
      kind: "disease",
      disease: { diagnosis: `Cas ${i}`, severity: "mild" }
    }));
    const batches = Array.from({ length: 10 }, (_, i) => ({
      id: `b${i}`,
      name: `Lot ${i}`,
      createdAt: new Date(`2026-06-${String(i + 1).padStart(2, "0")}T10:00:00Z`)
    }));
    const timeline = buildHealthTimeline(records, batches, 15);
    expect(timeline).toHaveLength(15);
    expect(timeline![0]!.type).toBe("disease");
  });

  it("mappe traitements ouverts/clôturés", () => {
    const timeline = buildHealthTimeline(
      [
        {
          occurredAt: new Date("2026-07-01T00:00:00Z"),
          kind: "treatment",
          treatment: {
            drugName: "Amox",
            endDate: new Date("2026-06-01T00:00:00Z")
          }
        },
        {
          occurredAt: new Date("2026-07-02T00:00:00Z"),
          kind: "treatment",
          treatment: { drugName: "En cours", endDate: null }
        }
      ],
      []
    );
    expect(timeline?.map((t) => t.type).sort()).toEqual([
      "treatment_closed",
      "treatment_open"
    ]);
  });
});

describe("resolveBatchStatus / targetGmq", () => {
  it("alert si cas actifs", () => {
    expect(
      resolveBatchStatus({
        avgGmq: 700,
        targetGmq: 650,
        activeCases: 1,
        mortalityPeak: false
      })
    ).toBe("alert");
  });

  it("watch si GMQ < 85% objectif", () => {
    expect(
      resolveBatchStatus({
        avgGmq: 500,
        targetGmq: 650,
        activeCases: 0,
        mortalityPeak: false
      })
    ).toBe("watch");
  });

  it("ok sinon", () => {
    expect(
      resolveBatchStatus({
        avgGmq: 700,
        targetGmq: 650,
        activeCases: 0,
        mortalityPeak: false
      })
    ).toBe("ok");
  });

  it("résout l'objectif par catégorie", () => {
    const settings = [
      { categoryKey: "starter", targetGmqGPerDay: 300 },
      { categoryKey: "finishing", targetGmqGPerDay: 650 }
    ];
    expect(resolveTargetGmq("fattening", settings)).toBe(650);
    expect(resolveTargetGmq("starter", settings)).toBe(300);
    expect(resolveTargetGmq(null, [])).toBeNull();
  });
});

describe("biosecurity helpers", () => {
  it("barns vides → null", () => {
    expect(buildBiosecurityBarns([])).toBeNull();
  });

  it("density/threshold null sans surface ; statut via capacité", () => {
    const barns = buildBiosecurityBarns([
      {
        name: "Bât A",
        pens: [
          { occupancy: 20, capacity: 20 },
          { occupancy: 5, capacity: 10 }
        ]
      }
    ]);
    expect(barns![0]!.densitySqmPerPig).toBeNull();
    expect(barns![0]!.thresholdSqm).toBeNull();
    expect(barns![0]!.status).toBe("alert");
  });

  it("quarantaine absente → null", () => {
    expect(buildQuarantineCompliance(null)).toBeNull();
  });

  it("quarantaine pending si durée insuffisante", () => {
    const c = buildQuarantineCompliance(
      {
        startedAt: new Date("2026-07-10T00:00:00Z"),
        endedAt: null,
        penName: "Q1"
      },
      QUARANTINE_MIN_DAYS,
      new Date("2026-07-15T00:00:00Z")
    );
    expect(c?.status).toBe("pending");
    expect(c?.daysElapsed).toBe(5);
  });

  it("quarantaine non conforme si sortie trop tôt", () => {
    const c = buildQuarantineCompliance(
      {
        startedAt: new Date("2026-07-01T00:00:00Z"),
        endedAt: new Date("2026-07-05T00:00:00Z"),
        penName: "Q1"
      },
      QUARANTINE_MIN_DAYS,
      new Date("2026-07-15T00:00:00Z")
    );
    expect(c?.status).toBe("non_compliant");
  });
});

describe("filterUpcomingFarrowings", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("sans mises bas → null", () => {
    expect(filterUpcomingFarrowings([], 21, now)).toBeNull();
  });

  it("filtre les 21 prochains jours", () => {
    const list = filterUpcomingFarrowings(
      [
        {
          gestationId: "g1",
          sowLabel: "T1",
          expectedBirthDate: new Date("2026-07-20T00:00:00Z")
        },
        {
          gestationId: "g2",
          sowLabel: "T2",
          expectedBirthDate: new Date("2026-08-20T00:00:00Z")
        }
      ],
      21,
      now
    );
    expect(list).toHaveLength(1);
    expect(list![0]!.gestationId).toBe("g1");
    expect(list![0]!.daysRemaining).toBe(5);
  });
});

describe("buildVetReadings — corrélations", () => {
  const baseBatch = (over: Partial<VetBatchSummary>): VetBatchSummary => ({
    id: "b1",
    name: "Lot A",
    stage: "fattening",
    headcount: 40,
    ageWeeks: 16,
    avgGmq: 500,
    targetGmq: 650,
    activeCases: 1,
    status: "alert",
    ...over
  });

  it("déclenche triple_signal", () => {
    const r = buildVetReadings({
      batches: [baseBatch({})],
      mortalityMonthly: [{ month: "2026-07", count: 5, ratePercent: 2 }],
      barns: null,
      vaccineCoveragePercent: 95,
      activeDiseaseCount: 1
    });
    expect(r.livestock?.kind).toBe("triple_signal");
    expect(r.livestock?.batchId).toBe("b1");
    expect(r.livestock?.action).toBe("open_batch");
  });

  it("ne déclenche pas triple_signal si GMQ ok", () => {
    const r = buildVetReadings({
      batches: [baseBatch({ avgGmq: 700, activeCases: 1 })],
      mortalityMonthly: [{ month: "2026-07", count: 5, ratePercent: 2 }],
      barns: null,
      vaccineCoveragePercent: 95,
      activeDiseaseCount: 1
    });
    expect(r.livestock?.kind).not.toBe("triple_signal");
  });

  it("déclenche vaccine_priority", () => {
    const r = buildVetReadings({
      batches: [baseBatch({ avgGmq: 700, activeCases: 0, status: "ok" })],
      mortalityMonthly: null,
      barns: null,
      vaccineCoveragePercent: 80,
      activeDiseaseCount: 2
    });
    expect(r.livestock?.kind).toBe("vaccine_priority");
    expect(r.livestock?.action).toBe("schedule_visit");
  });

  it("ne déclenche pas vaccine_priority sans cas actif", () => {
    const r = buildVetReadings({
      batches: [],
      mortalityMonthly: null,
      barns: null,
      vaccineCoveragePercent: 80,
      activeDiseaseCount: 0
    });
    expect(r.livestock).toBeNull();
  });

  it("déclenche density_gmq sur onglet repro", () => {
    const r = buildVetReadings({
      batches: [baseBatch({ avgGmq: 500, activeCases: 0, status: "watch" })],
      mortalityMonthly: null,
      barns: [
        {
          name: "Bât A",
          densitySqmPerPig: null,
          thresholdSqm: null,
          status: "alert"
        }
      ],
      barnBatchIds: new Map([["Bât A", ["b1"]]]),
      vaccineCoveragePercent: 95,
      activeDiseaseCount: 0
    });
    expect(r.repro?.kind).toBe("density_gmq");
    expect(r.repro?.barnName).toBe("Bât A");
  });

  it("aucune règle → null", () => {
    const r = buildVetReadings({
      batches: [baseBatch({ avgGmq: 700, activeCases: 0, status: "ok" })],
      mortalityMonthly: null,
      barns: [
        {
          name: "Bât A",
          densitySqmPerPig: null,
          thresholdSqm: null,
          status: "ok"
        }
      ],
      barnBatchIds: new Map([["Bât A", ["b1"]]]),
      vaccineCoveragePercent: 95,
      activeDiseaseCount: 0
    });
    expect(r.livestock).toBeNull();
    expect(r.repro).toBeNull();
  });
});
