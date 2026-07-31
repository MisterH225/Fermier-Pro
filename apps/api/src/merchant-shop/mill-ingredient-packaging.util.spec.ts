import { MillIngredientPackaging } from "@prisma/client";
import {
  defaultUnitToKg,
  packagingUnitLabel,
  pricePerKg,
  resolveUnitToKg
} from "./mill-ingredient-packaging.util";

describe("mill-ingredient-packaging.util", () => {
  it("defaultUnitToKg — conversions standards", () => {
    expect(defaultUnitToKg(MillIngredientPackaging.kg)).toBe(1);
    expect(defaultUnitToKg(MillIngredientPackaging.sack_50kg)).toBe(50);
    expect(defaultUnitToKg(MillIngredientPackaging.sack_25kg)).toBe(25);
    expect(defaultUnitToKg(MillIngredientPackaging.ton)).toBe(1000);
    expect(defaultUnitToKg(MillIngredientPackaging.liter)).toBe(1);
  });

  it("resolveUnitToKg — surcharge valide ou défaut", () => {
    expect(resolveUnitToKg(MillIngredientPackaging.sack_50kg, undefined)).toBe(
      50
    );
    expect(resolveUnitToKg(MillIngredientPackaging.liter, 0.75)).toBe(0.75);
    expect(resolveUnitToKg(MillIngredientPackaging.kg, 0)).toBe(1);
    expect(resolveUnitToKg(MillIngredientPackaging.kg, -1)).toBe(1);
  });

  it("pricePerKg — comparaison composition", () => {
    expect(pricePerKg(25000, 50)).toBe(500);
    expect(pricePerKg(1000, 1)).toBe(1000);
    expect(pricePerKg(1000, 0)).toBeNull();
  });

  it("packagingUnitLabel — français", () => {
    expect(packagingUnitLabel(MillIngredientPackaging.sack_50kg)).toBe(
      "sac 50 kg"
    );
    expect(packagingUnitLabel(MillIngredientPackaging.ton)).toBe("tonne");
  });
});
