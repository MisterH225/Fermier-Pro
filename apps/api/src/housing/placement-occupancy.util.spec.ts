import { countPlacementOccupancy } from "./placement-occupancy.util";

describe("countPlacementOccupancy", () => {
  it("adds animals and batch headcounts", () => {
    expect(
      countPlacementOccupancy([
        { animalId: "a1", animalStatus: "active" },
        { animalId: null, batch: { headcount: 8, status: "active" } }
      ])
    ).toBe(9);
  });

  it("ignores inactive animals and closed batches", () => {
    expect(
      countPlacementOccupancy([
        { animalId: "a1", animalStatus: "sold" },
        { animalId: null, batch: { headcount: 8, status: "closed" } }
      ])
    ).toBe(0);
  });
});
