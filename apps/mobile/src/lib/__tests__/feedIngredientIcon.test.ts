import {
  parseFermierIconKey,
  resolveIngredientVisual
} from "../../components/merchant/FeedIngredientIcon";

describe("FeedIngredientIcon helpers", () => {
  it("parse le marqueur fermier-icon", () => {
    expect(parseFermierIconKey("fermier-icon:cereal")).toBe("cereal");
    expect(parseFermierIconKey("https://cdn/x.jpg")).toBeNull();
  });

  it("utilise la photo réelle si présente", () => {
    const v = resolveIngredientVisual({
      imageUrl: "https://cdn/mais.jpg",
      iconKey: "cereal",
      category: "cereal"
    });
    expect(v.imageUrl).toBe("https://cdn/mais.jpg");
  });

  it("fallback pictogramme si pas d'image", () => {
    const v = resolveIngredientVisual({
      imageUrl: null,
      iconKey: null,
      category: "mineral",
      photoUrls: ["fermier-icon:mineral"]
    });
    expect(v.imageUrl).toBeNull();
    expect(v.iconKey).toBe("mineral");
  });
});
