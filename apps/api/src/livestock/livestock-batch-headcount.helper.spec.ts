import {
  countCheptelHeadcountAt
} from "../farms/cheptel-headcount.util";

describe("cheptel headcount after herd exit", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const earlier = new Date("2026-06-01T12:00:00.000Z");

  it("exclut les sujets sortis du cheptel de l'effectif", () => {
    const animals = [
      { status: "active", createdAt: earlier, livestockBatchId: null },
      { status: "exited", createdAt: earlier, livestockBatchId: null },
      { status: "reformed", createdAt: earlier, livestockBatchId: null }
    ];
    expect(countCheptelHeadcountAt(animals, [], now)).toBe(1);
  });

  it("diminue l'effectif quand un sujet actif d'une bande sort", () => {
    const animals = [
      { status: "active", createdAt: earlier, livestockBatchId: "batch-1" },
      { status: "exited", createdAt: earlier, livestockBatchId: "batch-1" }
    ];
    const batches = [
      {
        id: "batch-1",
        headcount: 2,
        status: "active",
        closedAt: null,
        createdAt: earlier
      }
    ];
    expect(countCheptelHeadcountAt(animals, batches, now)).toBe(1);
  });
});
