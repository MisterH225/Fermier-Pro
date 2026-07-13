import { MarketplacePriceType, MarketplaceTransactionStatus } from "@prisma/client";
import {
  calculateAgreedDealAmount,
  calculateBlockedAmount,
  isDefinitiveMobileMoneyFailure,
  isPendingMobileMoneyConfirm,
  needsEscrowRefundOnCancel,
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

    it("ne se rabat pas sur offeredPrice pour per_kg sans poids estimé", () => {
      expect(
        calculateAgreedDealAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: 1_500,
          agreedFlatPrice: null,
          estimatedWeightKg: null,
          offeredPrice: 945_000
        })
      ).toBe(0);
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
    it("bloque le prix convenu (prix/kg × poids) sans buffer", () => {
      expect(
        calculateBlockedAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: 1_500,
          agreedFlatPrice: null,
          estimatedWeightKg: 630
        })
      ).toBe(945_000);
    });

    it("ajoute la commission acheteur si fournie", () => {
      expect(
        calculateBlockedAmount({
          priceType: MarketplacePriceType.per_kg,
          agreedPricePerKg: 1_500,
          agreedFlatPrice: null,
          estimatedWeightKg: 630,
          commissionRate: 0.05
        })
      ).toBe(992_250);
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

  describe("mobile money confirm helpers", () => {
    it("détecte une confirmation en attente", () => {
      expect(
        isPendingMobileMoneyConfirm("Paiement en attente de confirmation")
      ).toBe(true);
    });

    it("détecte un échec définitif GeniusPay", () => {
      expect(isDefinitiveMobileMoneyFailure("Paiement failed")).toBe(true);
      expect(isDefinitiveMobileMoneyFailure("Paiement cancelled")).toBe(true);
    });
  });

  describe("needsEscrowRefundOnCancel", () => {
    it("rembourse les statuts escrow annulables, y compris contre-poids et expédié", () => {
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.PAYMENT_HELD)
      ).toBe(true);
      expect(
        needsEscrowRefundOnCancel(
          MarketplaceTransactionStatus.WEIGHT_COUNTER_DECLARED
        )
      ).toBe(true);
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.SELLER_SHIPPED)
      ).toBe(true);
    });

    it("ne rembourse pas avant blocage ni hors cancel*", () => {
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.PAYMENT_PENDING)
      ).toBe(false);
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.PAYMENT_FAILED)
      ).toBe(false);
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.BUYER_RECEIVED)
      ).toBe(false);
      expect(
        needsEscrowRefundOnCancel(
          MarketplaceTransactionStatus.DELIVERY_DISPUTED
        )
      ).toBe(false);
      expect(
        needsEscrowRefundOnCancel(MarketplaceTransactionStatus.WEIGHT_DISPUTED)
      ).toBe(false);
    });
  });
});
