import {
  countActiveAnimalsInBatch,
  countCheptelHeadcountAt
} from "./cheptel-headcount.util";

describe("countCheptelHeadcountAt", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const earlier = new Date("2026-06-01T12:00:00.000Z");

  it("compte uniquement les sujets actifs", () => {
    const animals = [
      { status: "active", createdAt: earlier, livestockBatchId: null },
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" },
      { status: "sold", createdAt: earlier, livestockBatchId: "batch-1" },
      { status: "dead", createdAt: earlier, livestockBatchId: null }
    ];
    expect(countCheptelHeadcountAt(animals, [], now)).toBe(2);
  });

  it("ignore le headcount de bande si des animaux y sont rattachés", () => {
    const animals = [
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" }
    ];
    const batches = [
      {
        id: "batch-1",
        headcount: 50,
        status: "active",
        closedAt: null,
        createdAt: earlier
      }
    ];
    expect(countCheptelHeadcountAt(animals, batches, now)).toBe(1);
  });

  it("compte le headcount des bandes sans animaux individuels (portées)", () => {
    const batches = [
      {
        id: "batch-litter",
        headcount: 10,
        status: "active",
        closedAt: null,
        createdAt: earlier
      }
    ];
    expect(countCheptelHeadcountAt([], batches, now)).toBe(10);
  });

  it("countActiveAnimalsInBatch compte les membres actifs d'une bande", () => {
    const animals = [
      { status: "active", livestockBatchId: "batch-1" },
      { status: "active", livestockBatchId: "batch-1" },
      { status: "sold", livestockBatchId: "batch-1" },
      { status: "active", livestockBatchId: null }
    ];
    expect(countActiveAnimalsInBatch(animals, "batch-1")).toBe(2);
  });
});
