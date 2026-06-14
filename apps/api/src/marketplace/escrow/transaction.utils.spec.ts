import { MarketplacePriceType } from "@prisma/client";
import {
  calculateAgreedDealAmount,
  calculateBlockedAmount,
  resolveHandoverDealTotalPrice,
  resolveReceiptRealWeightKg
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

  describe("resolveReceiptRealWeightKg", () => {
    it("somme les poids par animal", () => {
      expect(
        resolveReceiptRealWeightKg({
          existingRealWeightKg: null,
          animalWeights: [{ weightKg: 120 }, { weightKg: 118.5 }]
        })
      ).toBe(238.5);
    });

    it("utilise realWeightKg si pas de détail par animal", () => {
      expect(
        resolveReceiptRealWeightKg({
          existingRealWeightKg: null,
          realWeightKg: 630
        })
      ).toBe(630);
    });

    it("conserve le poids déjà déclaré en secours", () => {
      expect(
        resolveReceiptRealWeightKg({
          existingRealWeightKg: 500,
          realWeightKg: undefined
        })
      ).toBe(500);
    });
  });

  describe("resolveHandoverDealTotalPrice", () => {
    it("privilégie finalAmount de la transaction escrow", () => {
      expect(
        resolveHandoverDealTotalPrice({
          offeredPrice: 800_000,
          dtoTotalPrice: 700_000,
          transaction: {
            finalAmount: { toNumber: () => 945_000 },
            priceType: MarketplacePriceType.flat,
            agreedPricePerKg: null,
            agreedFlatPrice: { toNumber: () => 800_000 },
            realWeightKg: null,
            arbitrationWeightKg: null
          }
        })
      ).toBe(945_000);
    });

    it("utilise offeredPrice plutôt que le prix affiché de l'annonce", () => {
      expect(
        resolveHandoverDealTotalPrice({
          offeredPrice: 880_000,
          dtoTotalPrice: 1_000_000,
          transaction: null
        })
      ).toBe(880_000);
    });
  });
});
