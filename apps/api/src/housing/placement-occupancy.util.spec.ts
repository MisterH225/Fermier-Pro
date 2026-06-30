import {
  countPlacementOccupancy,
  countPlacementOccupancyFromRows
} from "./placement-occupancy.util";

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

describe("countPlacementOccupancyFromRows", () => {
  it("maps Prisma placement rows", () => {
    expect(
      countPlacementOccupancyFromRows([
        { animalId: "a1", animal: { status: "active" } },
        {
          animalId: null,
          batch: { headcount: 12, status: "active" }
        }
      ])
    ).toBe(13);
  });
});
