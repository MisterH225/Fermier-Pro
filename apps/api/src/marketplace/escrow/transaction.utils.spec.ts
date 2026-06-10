import { MarketplacePriceType } from "@prisma/client";
import {
  calculateAgreedDealAmount,
  calculateBlockedAmount
} from "./transaction.utils";

describe("transaction.utils", () => {
  describe("calculateAgreedDealAmount", () => {
    it("retourne le prix forfaitaire convenu", () => {
      expect(
        calculateAgreedDealAmount({
          priceType: MarketplacePriceType.flat,
          agreedPricePerKg: null,
          agreedFlatPrice: 945_000,
          estimatedWeightKg: null
        })
      ).toBe(945_000);
    });

    it("retourne prix/kg × poids estimé sans marge escrow", () => {
      expect(
        calculateAgreedDealAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: 1_500,
          agreedFlatPrice: null,
          estimatedWeightKg: 630
        })
      ).toBe(945_000);
    });

    it("se rabat sur offeredPrice si les termes stockés sont absents", () => {
      expect(
        calculateAgreedDealAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: null,
          agreedFlatPrice: null,
          estimatedWeightKg: null,
          offeredPrice: 945_000
        })
      ).toBe(945_000);
    });
  });

  describe("calculateBlockedAmount", () => {
    it("applique la marge 10 % au kg pour l'escrow", () => {
      expect(
        calculateBlockedAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: 1_500,
          agreedFlatPrice: null,
          estimatedWeightKg: 630
        })
      ).toBeCloseTo(1_039_500, 0);
    });
  });
});
