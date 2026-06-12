import { tagPrefixFromCode } from "./retag-animals.util";

describe("tagPrefixFromCode", () => {
  it("extrait le préfixe", () => {
    expect(tagPrefixFromCode("All-001")).toBe("ALL");
    expect(tagPrefixFromCode("Dem-042")).toBe("DEM");
    expect(tagPrefixFromCode("")).toBeNull();
  });
});
