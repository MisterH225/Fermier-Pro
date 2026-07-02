import {
  effectiveBatchHeadcount,
  isBatchDeletable
} from "./livestock-batch-membership.util";

describe("livestock-batch-membership.util", () => {
  it("privilégie le nombre de membres actifs rattachés", () => {
    expect(effectiveBatchHeadcount(0, 3)).toBe(3);
    expect(effectiveBatchHeadcount(10, 2)).toBe(2);
  });

  it("utilise le headcount stocké sans membres rattachés", () => {
    expect(effectiveBatchHeadcount(12, 0)).toBe(12);
    expect(effectiveBatchHeadcount(0, 0)).toBe(0);
  });

  it("détermine si une bande est supprimable", () => {
    expect(isBatchDeletable(0, 0)).toBe(true);
    expect(isBatchDeletable(0, 2)).toBe(false);
    expect(isBatchDeletable(5, 0)).toBe(false);
  });
});
