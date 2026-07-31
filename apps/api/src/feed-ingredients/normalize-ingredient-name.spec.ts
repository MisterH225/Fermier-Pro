import {
  ingredientNameMatches,
  normalizeIngredientName
} from "./normalize-ingredient-name";

describe("normalizeIngredientName", () => {
  it("minuscules et sans accents", () => {
    expect(normalizeIngredientName("Tourteau d'Arachide")).toBe(
      "tourteau d arachide"
    );
    expect(normalizeIngredientName("Maïs jaune")).toBe("mais jaune");
    expect(normalizeIngredientName("  SON  DE  RIZ ")).toBe("son de riz");
  });

  it("matche un alias normalisé", () => {
    expect(
      ingredientNameMatches("mais", "Maïs jaune", ["mais", "corn"])
    ).toBe(true);
    expect(
      ingredientNameMatches("CORN", "Maïs jaune", ["mais", "corn"])
    ).toBe(true);
    expect(
      ingredientNameMatches("Maïs jaune", "Maïs jaune", ["mais", "corn"])
    ).toBe(true);
    expect(
      ingredientNameMatches("blé", "Maïs jaune", ["mais", "corn"])
    ).toBe(false);
  });
});

