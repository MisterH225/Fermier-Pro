import {
  listingHeadcount,
  resolveFlatListingPricing
} from "./marketplace-listing-category.helper";

describe("resolveFlatListingPricing", () => {
  it("calcule total = prix à la tête × effectif", () => {
    expect(
      resolveFlatListingPricing({
        unitPrice: 28_000,
        headcount: 5
      })
    ).toEqual({ unitPrice: 28_000, totalPrice: 140_000 });
  });

  it("accepte totalPrice seul pour un sujet unique", () => {
    expect(
      resolveFlatListingPricing({
        totalPrice: 28_000,
        headcount: 1
      })
    ).toEqual({ unitPrice: 28_000, totalPrice: 28_000 });
  });

  it("listingHeadcount utilise animalIds", () => {
    expect(listingHeadcount(["a", "b", "c"], null, null)).toBe(3);
  });
});
