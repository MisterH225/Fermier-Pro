import { mapBatchCategoryKey, mapBatchTypeTag } from "./batch-category.util";

describe("batch-category.util", () => {
  it("reconnaît fattening et starter exacts", () => {
    expect(mapBatchCategoryKey("fattening")).toBe("fattening");
    expect(mapBatchCategoryKey("starter")).toBe("starter");
    expect(mapBatchTypeTag("fattening")).toBe("fattening");
    expect(mapBatchTypeTag("starter")).toBe("starter");
  });

  it("reconnaît les libellés legacy", () => {
    expect(mapBatchCategoryKey("finisher")).toBe("fattening");
    expect(mapBatchCategoryKey("nursery")).toBe("starter");
  });
});
