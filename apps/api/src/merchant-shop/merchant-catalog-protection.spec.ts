import {
  installMerchantCatalogDeleteGuard,
  MERCHANT_CATALOG_MODELS
} from "./merchant-catalog-protection";

describe("merchant-catalog-protection", () => {
  it("protège MerchantShop et MerchantProduct", () => {
    expect(MERCHANT_CATALOG_MODELS.has("MerchantShop")).toBe(true);
    expect(MERCHANT_CATALOG_MODELS.has("MerchantProduct")).toBe(true);
    expect(MERCHANT_CATALOG_MODELS.has("MerchantOrder")).toBe(false);
  });

  it("refuse deleteMany sans filtre via middleware", async () => {
    const calls: unknown[] = [];
    const client = {
      $use(fn: (params: unknown, next: (p: unknown) => Promise<unknown>) => Promise<unknown>) {
        calls.push(fn);
      }
    };
    installMerchantCatalogDeleteGuard(client as never);
    expect(calls).toHaveLength(1);

    const middleware = calls[0] as (
      params: {
        action: string;
        model?: string;
        args?: { where?: unknown };
      },
      next: (p: unknown) => Promise<unknown>
    ) => Promise<unknown>;

    await expect(
      middleware(
        { action: "deleteMany", model: "MerchantShop", args: { where: {} } },
        async () => ({ count: 0 })
      )
    ).rejects.toThrow(/sans filtre refusé/);

    await expect(
      middleware(
        { action: "deleteMany", model: "MerchantProduct", args: {} },
        async () => ({ count: 0 })
      )
    ).rejects.toThrow(/sans filtre refusé/);

    const ok = await middleware(
      {
        action: "deleteMany",
        model: "MerchantShop",
        args: { where: { id: "shop-1" } }
      },
      async () => ({ count: 1 })
    );
    expect(ok).toEqual({ count: 1 });
  });
});
