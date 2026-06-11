import { ListingMarketCategory } from "@prisma/client";
import {
  listingHeadcount,
  resolveFlatListingPricing,
  resolveListingCreditEnabled
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

describe("resolveListingCreditEnabled", () => {
  it("true uniquement si charcutier et opt-in", () => {
    expect(
      resolveListingCreditEnabled(ListingMarketCategory.butcher, true)
    ).toBe(true);
    expect(
      resolveListingCreditEnabled(ListingMarketCategory.butcher, false)
    ).toBe(false);
    expect(
      resolveListingCreditEnabled(ListingMarketCategory.piglet, true)
    ).toBe(false);
  });
});
