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
      category: "cereal",
      canonicalName: "Maïs jaune"
    });
    expect(v.kind).toBe("remote");
    if (v.kind === "remote") {
      expect(v.uri).toBe("https://cdn/mais.jpg");
    }
  });

  it("fallback photo locale catalogue si pas d'URL (plus d'initiales)", () => {
    const v = resolveIngredientVisual({
      imageUrl: null,
      iconKey: null,
      category: "mineral",
      photoUrls: ["fermier-icon:mineral"],
      canonicalName: "Sel"
    });
    expect(v.kind).toBe("local");
    if (v.kind === "local") {
      expect(v.source).toBeTruthy();
    }
  });

  it("ignore les marqueurs fermier-icon dans photoUrls au profit de l'URL HTTP", () => {
    const v = resolveIngredientVisual({
      photoUrls: ["fermier-icon:cereal", "https://cdn/mais.jpg"],
      canonicalName: "Maïs jaune"
    });
    expect(v.kind).toBe("remote");
    if (v.kind === "remote") {
      expect(v.uri).toBe("https://cdn/mais.jpg");
    }
  });
});
