import { TrustScoreLevel, TrustScoreProfileType } from "@prisma/client";
import {
  aggregatePillars,
  endOfUtcDay,
  startOfUtcDay,
  utcDayKey
} from "./trust-score.util";

describe("trust-score snapshot idempotence helpers", () => {
  it("utc day bounds are stable for the same calendar day", () => {
    const a = new Date("2026-07-18T01:15:00.000Z");
    const b = new Date("2026-07-18T23:40:00.000Z");
    expect(utcDayKey(a)).toBe("2026-07-18");
    expect(utcDayKey(b)).toBe("2026-07-18");
    expect(startOfUtcDay(a).toISOString()).toBe("2026-07-18T00:00:00.000Z");
    expect(endOfUtcDay(b).toISOString()).toBe("2026-07-18T23:59:59.999Z");
  });

  it("recompute same inputs yields same aggregate (idempotent formula)", () => {
    const pillars = [
      {
        key: "dataRegularity",
        score: 80,
        weight: 0.3,
        sampleSize: 12,
        hasData: true
      },
      {
        key: "responsiveness",
        score: 70,
        weight: 0.3,
        sampleSize: 5,
        hasData: true
      },
      {
        key: "commercialTrust",
        score: 90,
        weight: 0.4,
        sampleSize: 8,
        hasData: true
      }
    ];
    const opts = {
      userCreatedAt: new Date("2025-01-01T00:00:00.000Z"),
      transactionCount: 12,
      now: new Date("2026-07-18T12:00:00.000Z")
    };
    const first = aggregatePillars(pillars, opts);
    const second = aggregatePillars(pillars, opts);
    expect(first).toEqual(second);
    expect(first.level).toBe(TrustScoreLevel.ensoleille);
    expect(TrustScoreProfileType.producer).toBe("producer");
  });
});
