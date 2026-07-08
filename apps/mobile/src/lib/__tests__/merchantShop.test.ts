import type { MerchantMeDto } from "../api/merchant";
import { hasMerchantShop, resolveMerchantShopId } from "../merchantShop";

const meWithShop = {
  shopCount: 1,
  shops: [{ id: "shop-a", name: "Boutique A" }]
} as unknown as MerchantMeDto;

describe("merchantShop", () => {
  describe("resolveMerchantShopId", () => {
    it("priorise le shopId de navigation même si merchant-me est vide", () => {
      expect(resolveMerchantShopId(null, "shop-from-route")).toBe("shop-from-route");
      expect(resolveMerchantShopId({ shops: [] } as unknown as MerchantMeDto, "shop-from-route")).toBe(
        "shop-from-route"
      );
    });

    it("retourne la première boutique si aucun shopId préféré", () => {
      expect(resolveMerchantShopId(meWithShop, null)).toBe("shop-a");
    });

    it("retourne null sans boutique ni shopId préféré", () => {
      expect(resolveMerchantShopId(null, null)).toBeNull();
      expect(resolveMerchantShopId({ shops: [] } as unknown as MerchantMeDto, null)).toBeNull();
    });
  });

  describe("hasMerchantShop", () => {
    it("détecte une boutique via shops[] ou shopCount", () => {
      expect(hasMerchantShop(meWithShop)).toBe(true);
      expect(hasMerchantShop({ shopCount: 1, shops: [] } as unknown as MerchantMeDto)).toBe(true);
      expect(hasMerchantShop({ shopCount: 0, shops: [] } as unknown as MerchantMeDto)).toBe(false);
    });
  });
});
