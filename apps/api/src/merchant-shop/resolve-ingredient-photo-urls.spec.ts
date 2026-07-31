import { resolveIngredientPhotoUrls } from "./mill-ingredient-offers.service";

describe("resolveIngredientPhotoUrls", () => {
  it("privilégie imageUrl réelle", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: "https://cdn.example/mais.jpg",
        iconKey: "cereal",
        category: "cereal"
      })
    ).toEqual(["https://cdn.example/mais.jpg"]);
  });

  it("fallback pictogramme de catégorie", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: null,
        iconKey: "plant_protein",
        category: "plant_protein"
      })
    ).toEqual(["fermier-icon:plant_protein"]);
  });

  it("fallback category si iconKey absent", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: null,
        iconKey: null,
        category: "mineral"
      })
    ).toEqual(["fermier-icon:mineral"]);
  });
});
