import { ListingMarketCategory } from "@prisma/client";
import {
  assertCharcutierAnimalLinked,
  estimateAnimalWeightKg,
  isIndividualListing,
  isLotListing,
  parseListingAnimalIds
} from "./listing-animal-sync.util";

describe("listing-animal-sync.util", () => {
  it("parseListingAnimalIds fusionne animalId et animalIds", () => {
    expect(
      parseListingAnimalIds({
        animalId: "a1",
        animalIds: ["a2"]
      })
    ).toEqual(["a1", "a2"]);
  });

  it("distingue individuel et lot", () => {
    expect(isIndividualListing(["x"])).toBe(true);
    expect(isLotListing(["x", "y"])).toBe(true);
    expect(isIndividualListing(["x", "y"])).toBe(false);
  });

  it("charcutier exige au moins un animal", () => {
    expect(() =>
      assertCharcutierAnimalLinked(ListingMarketCategory.butcher, [])
    ).toThrow(/charcutier/i);
    expect(() =>
      assertCharcutierAnimalLinked(ListingMarketCategory.butcher, ["a1"])
    ).not.toThrow();
  });

  it("estimateAnimalWeightKg préfère soldWeightKg", () => {
    const w = estimateAnimalWeightKg({
      soldWeightKg: { toNumber: () => 95 },
      entryWeightKg: { toNumber: () => 40 },
      weights: [{ weightKg: { toNumber: () => 80 } }]
    });
    expect(w).toBe(95);
  });
});
