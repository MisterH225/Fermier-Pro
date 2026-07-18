import { MerchantProductDisabledReason } from "@prisma/client";
import { MerchantProfilesService } from "./merchant-profiles.service";

describe("MerchantProfilesService.visibleProducts", () => {
  const service = new MerchantProfilesService({} as never);

  it("conserve les produits non soft-supprimés (y compris disabledReason null)", () => {
    const products = [
      { id: "a", disabledReason: null },
      { id: "b", disabledReason: MerchantProductDisabledReason.swap },
      {
        id: "c",
        disabledReason: MerchantProductDisabledReason.merchant_deleted
      },
      { id: "d", disabledReason: MerchantProductDisabledReason.shop_archived }
    ];
    expect(service.visibleProducts(products).map((p) => p.id)).toEqual([
      "a",
      "b",
      "d"
    ]);
  });
});
