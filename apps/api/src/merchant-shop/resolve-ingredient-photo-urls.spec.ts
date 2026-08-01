import { resolveIngredientPhotoUrls } from "./mill-ingredient-offers.service";
import {
  FEED_INGREDIENT_DEFAULT_IMAGE_URL,
  feedIngredientCatalogImageUrl
} from "../feed-ingredients/feed-ingredient-images";

describe("resolveIngredientPhotoUrls", () => {
  it("privilégie imageUrl réelle", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: "https://cdn.example/mais.jpg",
        iconKey: "cereal",
        category: "cereal",
        canonicalName: "Maïs jaune"
      })
    ).toEqual(["https://cdn.example/mais.jpg"]);
  });

  it("fallback URL catalogue par canonicalName (pas de pictogramme)", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: null,
        iconKey: "plant_protein",
        category: "plant_protein",
        canonicalName: "Tourteau de soja"
      })
    ).toEqual([feedIngredientCatalogImageUrl("Tourteau de soja")]);
  });

  it("fallback image générique si aucun nom", () => {
    expect(
      resolveIngredientPhotoUrls({
        imageUrl: null,
        iconKey: null,
        category: "mineral"
      })
    ).toEqual([FEED_INGREDIENT_DEFAULT_IMAGE_URL]);
  });
});
