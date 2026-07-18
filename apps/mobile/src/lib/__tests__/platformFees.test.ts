import {
  computeSellerFeeBreakdown,
  computeVetFeeBreakdown,
  parsePriceInput
} from "../platformFees";

describe("platformFees", () => {
  it("calcule la commission vendeur marketplace (entier)", () => {
    const b = computeSellerFeeBreakdown(10_000, 0.05);
    expect(b).toEqual({
      grossAmount: 10_000,
      feeAmount: 500,
      netAmount: 9_500,
      ratePct: 5
    });
  });

  it("retourne null si prix invalide", () => {
    expect(computeSellerFeeBreakdown(0, 0.05)).toBeNull();
    expect(computeSellerFeeBreakdown(-1, 0.05)).toBeNull();
    expect(computeVetFeeBreakdown(NaN, 0.05)).toBeNull();
  });

  it("calcule la commission véto (centimes)", () => {
    const b = computeVetFeeBreakdown(123.45, 0.05);
    expect(b?.feeAmount).toBe(6.17);
    expect(b?.netAmount).toBe(117.28);
    expect(b?.ratePct).toBe(5);
  });

  it("parsePriceInput accepte virgule et espaces", () => {
    expect(parsePriceInput("12 500")).toBe(12500);
    expect(parsePriceInput("12,5")).toBe(12.5);
    expect(parsePriceInput("")).toBeNull();
  });
});
