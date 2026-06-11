import { countCheptelHeadcountAt } from "./cheptel-headcount.util";

describe("countCheptelHeadcountAt", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const earlier = new Date("2026-06-01T12:00:00.000Z");

  it("compte sujets individuels + bandes sans double-compter", () => {
    const animals = [
      { status: "active", createdAt: earlier, livestockBatchId: null },
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" },
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" },
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" }
    ];
    const batches = [
      {
        id: "batch-1",
        headcount: 3,
        status: "active",
        closedAt: null,
        createdAt: earlier
      }
    ];

    expect(countCheptelHeadcountAt(animals, batches, now)).toBe(4);
  });

  it("ignore les sujets vendus ou inactifs", () => {
    const animals = [
      { status: "sold", createdAt: earlier, livestockBatchId: null },
      { status: "active", createdAt: earlier, livestockBatchId: null }
    ];
    expect(countCheptelHeadcountAt(animals, [], now)).toBe(1);
  });
});
