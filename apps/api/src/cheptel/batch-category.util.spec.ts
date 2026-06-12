import { mapBatchCategoryKey, mapBatchTypeTag } from "./batch-category.util";

describe("batch-category.util", () => {
  it("reconnaît fattening, starter et sous_mere", () => {
    expect(mapBatchCategoryKey("fattening")).toBe("fattening");
    expect(mapBatchCategoryKey("starter")).toBe("starter");
    expect(mapBatchCategoryKey("sous_mere")).toBe("sous_mere");
    expect(mapBatchTypeTag("fattening")).toBe("fattening");
    expect(mapBatchTypeTag("starter")).toBe("starter");
    expect(mapBatchTypeTag("sous_mere")).toBe("sous_mere");
  });

  it("reconnaît les libellés legacy", () => {
    expect(mapBatchCategoryKey("finisher")).toBe("fattening");
    expect(mapBatchCategoryKey("nursery")).toBe("starter");
  });
});
