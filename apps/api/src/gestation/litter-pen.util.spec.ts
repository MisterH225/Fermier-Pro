import {
  findEmptyPenForLitter,
  litterPenCapacityWarning,
  penFitsLitterHeadcount,
  rankPensForLitterSuggestion,
  resolveLitterPenPlacement
} from "@fermier/types";

describe("litter-pen", () => {
  const pens = [
    { id: "a", occupancy: 2, capacity: 10 },
    { id: "b", occupancy: 0, capacity: 8 },
    { id: "c", occupancy: 0, capacity: 4 },
    { id: "d", occupancy: 0, capacity: 0 }
  ];

  it("penFitsLitterHeadcount respects capacity", () => {
    expect(penFitsLitterHeadcount(2, 10, 8)).toBe(true);
    expect(penFitsLitterHeadcount(2, 10, 9)).toBe(false);
    expect(penFitsLitterHeadcount(0, 0, 20)).toBe(true);
  });

  it("findEmptyPenForLitter returns only empty pens with capacity", () => {
    expect(findEmptyPenForLitter(pens, 5)).toBe("b");
    expect(
      findEmptyPenForLitter(
        [
          { id: "a", occupancy: 2, capacity: 10 },
          { id: "b", occupancy: 0, capacity: 8 },
          { id: "c", occupancy: 0, capacity: 4 }
        ],
        9
      )
    ).toBeNull();
    expect(
      findEmptyPenForLitter([{ id: "d", occupancy: 0, capacity: 0 }], 20)
    ).toBe("d");
  });

  it("rankPensForLitterSuggestion prefers empty then most free slots", () => {
    const ranked = rankPensForLitterSuggestion(
      [
        { id: "a", occupancy: 2, capacity: 10 },
        { id: "b", occupancy: 0, capacity: 8 },
        { id: "c", occupancy: 0, capacity: 4 }
      ],
      5
    );
    expect(ranked[0]).toEqual({ id: "b", suggested: true });
    expect(ranked.find((p) => p.id === "a")?.suggested).toBe(false);
  });

  it("resolveLitterPenPlacement distinguishes user choice and auto empty", () => {
    expect(resolveLitterPenPlacement(pens, 5, "a")).toEqual({
      kind: "user",
      penId: "a"
    });
    expect(resolveLitterPenPlacement(pens, 5, "missing")).toEqual({
      kind: "missing_chosen"
    });
    expect(resolveLitterPenPlacement(pens, 5)).toEqual({
      kind: "auto_empty",
      penId: "b"
    });
    expect(
      resolveLitterPenPlacement(
        [{ id: "a", occupancy: 2, capacity: 10 }],
        9
      )
    ).toEqual({ kind: "no_empty" });
  });

  it("litterPenCapacityWarning flags overcrowding", () => {
    expect(litterPenCapacityWarning(7, 10, 2)).toBe("warn");
    expect(litterPenCapacityWarning(8, 10, 4)).toBe("block");
    expect(litterPenCapacityWarning(2, 0, 20)).toBeNull();
  });
});
