import {
  dashboardFeedItemEligibleForGauge,
  feedStatEligibleForGauge
} from "../feedStockGaugeView";

describe("feedStockGaugeView eligibility", () => {
  it("masque les stats à stock nul même avec un dernier contrôle", () => {
    expect(
      feedStatEligibleForGauge({
        lastCheckDate: "2026-06-28T10:00:00.000Z",
        currentStockKg: "0",
        hasSufficientData: true,
        stockAtLastEntry: "120"
      })
    ).toBe(false);
  });

  it("affiche les stats avec stock positif", () => {
    expect(
      feedStatEligibleForGauge({
        lastCheckDate: null,
        currentStockKg: "677",
        hasSufficientData: true,
        stockAtLastEntry: null
      })
    ).toBe(true);
  });

  it("masque le dashboard quand remainingKg vaut 0", () => {
    expect(
      dashboardFeedItemEligibleForGauge({
        remainingKg: "0",
        daysRemaining: 0,
        percentRemaining: 0,
        stockStatus: "critical"
      })
    ).toBe(false);
  });

  it("affiche le dashboard quand remainingKg est positif", () => {
    expect(
      dashboardFeedItemEligibleForGauge({
        remainingKg: "38.6",
        daysRemaining: 2,
        percentRemaining: 4,
        stockStatus: "critical"
      })
    ).toBe(true);
  });
});
