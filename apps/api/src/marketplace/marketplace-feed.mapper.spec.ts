import { ListingMarketCategory } from "@prisma/client";
import {
  isPigListingCategory,
  merchantProductToFeedItem,
  shouldIncludeMerchantProducts,
  shouldIncludePigListings,
  sortFeedByPublishedAt,
  withListingKind
} from "./marketplace-feed.mapper";

describe("marketplace-feed.mapper", () => {
  describe("isPigListingCategory", () => {
    it("reconnaît les catégories porc", () => {
      expect(isPigListingCategory(ListingMarketCategory.piglet)).toBe(true);
      expect(isPigListingCategory("butcher")).toBe(true);
    });

    it("rejette les slugs boutique", () => {
      expect(isPigListingCategory("alimentation")).toBe(false);
      expect(isPigListingCategory(null)).toBe(false);
    });
  });

  describe("shouldIncludePigListings / shouldIncludeMerchantProducts", () => {
    it("all ou absent inclut les deux", () => {
      expect(shouldIncludePigListings()).toBe(true);
      expect(shouldIncludeMerchantProducts()).toBe(true);
      expect(shouldIncludePigListings("all")).toBe(true);
      expect(shouldIncludeMerchantProducts("all")).toBe(true);
    });

    it("filtre porc uniquement pour catégorie porc", () => {
      expect(shouldIncludePigListings("piglet")).toBe(true);
      expect(shouldIncludeMerchantProducts("piglet")).toBe(false);
    });

    it("filtre boutique uniquement pour slug commerçant", () => {
      expect(shouldIncludePigListings("equipement")).toBe(false);
      expect(shouldIncludeMerchantProducts("equipement")).toBe(true);
    });
  });

  describe("merchantProductToFeedItem", () => {
    it("mappe un produit publié vers le DTO annonce", () => {
      const publishedAt = new Date("2026-06-01T10:00:00.000Z");
      const createdAt = new Date("2026-05-30T08:00:00.000Z");
      const row = merchantProductToFeedItem({
        id: "prod-1",
        name: "Aliment starter",
        description: "Sac 25 kg",
        price: 12_500,
        currency: "XOF",
        photoUrls: ["https://cdn.example/1.jpg"],
        stock: 8,
        viewCount: 42,
        publishedAt,
        createdAt,
        updatedAt: createdAt,
        category: { id: "cat-1", name: "Alimentation", slug: "alimentation" },
        shop: {
          id: "shop-1",
          name: "Boutique Test",
          locationLabel: "Dakar",
          merchantProfile: {
            user: { id: "user-1", fullName: "Vendeur E2E" }
          }
        }
      });

      expect(row).toMatchObject({
        id: "prod-1",
        kind: "merchant",
        title: "Aliment starter",
        unitPrice: 12_500,
        stock: 8,
        quantity: 8,
        category: "alimentation",
        categoryLabel: "Alimentation",
        viewsCount: 42,
        status: "published",
        feedIngredientId: null,
        millIngredientOfferId: null,
        farm: { id: "shop-1", name: "Boutique Test" },
        seller: { id: "user-1", fullName: "Vendeur E2E" }
      });
      expect(row.photoUrls).toEqual(["https://cdn.example/1.jpg"]);
      expect(row.publishedAt).toBe(publishedAt.toISOString());
    });

    it("mappe une offre moulin synchronisée en kind bulk_feed", () => {
      const row = merchantProductToFeedItem({
        id: "prod-bulk",
        name: "Maïs",
        description: "Intrant en gros",
        price: 1000,
        currency: "XOF",
        photoUrls: [],
        stock: 50,
        viewCount: 0,
        publishedAt: new Date("2026-07-01T00:00:00.000Z"),
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
        category: { id: "cat-1", name: "Alimentation", slug: "alimentation" },
        shop: {
          id: "shop-1",
          name: "Moulin Test",
          locationLabel: null,
          merchantProfile: {
            user: { id: "user-mill", fullName: "Moulin" }
          }
        },
        millIngredientOffer: {
          id: "offer-1",
          feedIngredientId: "ing-1"
        }
      });
      expect(row.kind).toBe("bulk_feed");
      expect(row.feedIngredientId).toBe("ing-1");
      expect(row.millIngredientOfferId).toBe("offer-1");
    });
  });

  describe("withListingKind", () => {
    it("ajoute kind listing", () => {
      expect(withListingKind({ id: "l1", title: "Porc" })).toEqual({
        id: "l1",
        title: "Porc",
        kind: "listing"
      });
    });
  });

  describe("sortFeedByPublishedAt", () => {
    it("trie par publishedAt décroissant", () => {
      const sorted = sortFeedByPublishedAt([
        { id: "a", publishedAt: "2026-01-01T00:00:00.000Z" },
        { id: "b", publishedAt: "2026-06-01T00:00:00.000Z" },
        { id: "c", createdAt: "2026-03-01T00:00:00.000Z" }
      ]);
      expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
    });
  });
});
