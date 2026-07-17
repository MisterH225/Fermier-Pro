import {
  parseScheduledReportsConfig,
  previousPeriodRange,
  sanitizeScheduledReportsConfig,
  shouldRunScheduledReport
} from "./institution-scheduled-reports.util";

describe("institution-scheduled-reports.util", () => {
  it("sanitize rejette les sections inconnues", () => {
    expect(
      sanitizeScheduledReportsConfig({
        isActive: true,
        cadence: "monthly",
        format: "pdf",
        sections: ["mortality", "fake" as never, "movements"]
      }).sections
    ).toEqual(["mortality"]);
  });

  it("shouldRunScheduledReport — idempotent mensuel", () => {
    const config = sanitizeScheduledReportsConfig({
      isActive: true,
      cadence: "monthly",
      format: "pdf",
      sections: ["mortality"],
      lastRunAt: "2026-06-01T06:00:00.000Z"
    });
    expect(
      shouldRunScheduledReport(config, new Date("2026-06-15T12:00:00.000Z"))
    ).toBe(false);
    expect(
      shouldRunScheduledReport(config, new Date("2026-07-02T06:00:00.000Z"))
    ).toBe(true);
  });

  it("previousPeriodRange mensuel", () => {
    const range = previousPeriodRange(
      "monthly",
      new Date("2026-07-05T00:00:00.000Z")
    );
    expect(range).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("parse retourne null pour entrée invalide", () => {
    expect(parseScheduledReportsConfig(null)).toBeNull();
    expect(parseScheduledReportsConfig("x")).toBeNull();
  });
});
