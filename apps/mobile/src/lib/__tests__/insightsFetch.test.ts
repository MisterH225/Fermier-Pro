import { safeInsightFetch } from "../api/insights";

describe("safeInsightFetch", () => {
  it("retourne null si le fetch rejette (timeout / réseau)", async () => {
    await expect(
      safeInsightFetch(async () => {
        throw new Error("aborted");
      })
    ).resolves.toBeNull();
  });

  it("propage le résultat en succès", async () => {
    const insight = {
      kind: "first" as const,
      headline: { key: "insights.firstWeighing" }
    };
    await expect(safeInsightFetch(async () => insight)).resolves.toEqual(
      insight
    );
  });
});
