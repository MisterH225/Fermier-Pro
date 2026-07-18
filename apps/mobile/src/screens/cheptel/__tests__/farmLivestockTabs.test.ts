import {
  FARM_LIVESTOCK_TAB_KEYS,
  isFarmLivestockTabKey
} from "../farmLivestockTabs";

describe("FARM_LIVESTOCK_TAB_KEYS", () => {
  it("inclut le segment Gestations aux côtés de Bandes et Cheptel", () => {
    expect(FARM_LIVESTOCK_TAB_KEYS).toEqual([
      "overview",
      "batches",
      "cheptel",
      "weight",
      "gestation",
      "history"
    ]);
    expect(FARM_LIVESTOCK_TAB_KEYS).toContain("gestation");
    expect(FARM_LIVESTOCK_TAB_KEYS).toContain("batches");
    expect(FARM_LIVESTOCK_TAB_KEYS).toContain("cheptel");
  });

  it("valide les clés connues", () => {
    expect(isFarmLivestockTabKey("gestation")).toBe(true);
    expect(isFarmLivestockTabKey("unknown")).toBe(false);
  });
});
