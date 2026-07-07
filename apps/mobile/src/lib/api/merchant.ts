import { apiGetJson, apiPatchJson, apiPostJson } from "./http";

export type MerchantMeDto = {
  subscriptionTier: "free" | "premium" | null;
  subscriptionChosenAt: string | null;
  premiumPaidAt: string | null;
  shopSkipped: boolean;
  productSkipped: boolean;
  onboardingComplete: boolean;
  shopCount: number;
  activeProductCount: number;
  maxShops: number;
  maxActiveProducts: number | null;
  premiumPriceXof: number;
  premiumMaxShops: number;
  shops: Array<{
    id: string;
    name: string;
    description: string | null;
    locationLabel: string | null;
    productCount: number;
    activeProductCount: number;
    createdAt: string;
  }>;
  needsShopNudge: boolean;
  needsProductNudge: boolean;
};

export type MerchantProductDto = {
  id: string;
  shopId: string;
  shopName: string | null;
  categoryId: string;
  categoryName: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  photoUrls: string[];
  stock: number;
  status: string;
  publishedAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantCategoryDto = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export function fetchMerchantMe(
  accessToken: string,
  profileId: string
): Promise<MerchantMeDto> {
  return apiGetJson<MerchantMeDto>("/merchant/me", accessToken, profileId);
}

export function patchMerchantOnboarding(
  accessToken: string,
  profileId: string,
  body: {
    shopSkipped?: boolean;
    productSkipped?: boolean;
    onboardingComplete?: boolean;
  }
): Promise<MerchantMeDto> {
  return apiPatchJson<MerchantMeDto>(
    "/merchant/me/onboarding",
    body,
    accessToken,
    profileId
  );
}

export function chooseMerchantSubscription(
  accessToken: string,
  profileId: string,
  body: {
    tier: "free" | "premium";
    paymentMethod?: "wallet" | "mobile_money";
  }
): Promise<MerchantMeDto | { pending: boolean; providerRef: string; paymentUrl?: string | null; amount: number }> {
  return apiPostJson(
    "/merchant/me/subscription",
    body,
    accessToken,
    profileId
  );
}

export function createMerchantShop(
  accessToken: string,
  profileId: string,
  body: { name: string; description?: string; locationLabel?: string }
) {
  return apiPostJson("/merchant/shops", body, accessToken, profileId);
}

export function fetchMerchantProducts(
  accessToken: string,
  profileId: string
): Promise<MerchantProductDto[]> {
  return apiGetJson<MerchantProductDto[]>(
    "/merchant/products",
    accessToken,
    profileId
  );
}

export function createMerchantProduct(
  accessToken: string,
  profileId: string,
  shopId: string,
  body: {
    name: string;
    categoryId: string;
    description?: string;
    price: number;
    photoUrls?: string[];
    stock: number;
  }
): Promise<MerchantProductDto> {
  return apiPostJson<MerchantProductDto>(
    `/merchant/shops/${shopId}/products`,
    body,
    accessToken,
    profileId
  );
}

export function publishMerchantProduct(
  accessToken: string,
  profileId: string,
  productId: string
): Promise<MerchantProductDto> {
  return apiPostJson<MerchantProductDto>(
    `/merchant/products/${productId}/publish`,
    {},
    accessToken,
    profileId
  );
}

export function swapMerchantProductActive(
  accessToken: string,
  profileId: string,
  productId: string
): Promise<MerchantProductDto> {
  return apiPostJson<MerchantProductDto>(
    `/merchant/products/${productId}/swap-active`,
    {},
    accessToken,
    profileId
  );
}

export function fetchMerchantCategories(
  accessToken: string
): Promise<MerchantCategoryDto[]> {
  return apiGetJson<MerchantCategoryDto[]>("/merchant/categories", accessToken);
}

export function fetchMerchantCatalog(
  accessToken: string,
  params?: { categoryId?: string; cursor?: string }
) {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set("categoryId", params.categoryId);
  if (params?.cursor) q.set("cursor", params.cursor);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return apiGetJson<{
    items: Array<MerchantProductDto & { shopLocation?: string | null; merchantName?: string | null }>;
    nextCursor: string | null;
  }>(`/merchant/catalog/products${suffix}`, accessToken);
}

export function fetchMerchantCatalogProduct(
  accessToken: string,
  productId: string
) {
  return apiGetJson<
    MerchantProductDto & {
      sellerUserId: string;
      merchantName: string | null;
      shopDescription: string | null;
      shopLocation: string | null;
    }
  >(`/merchant/catalog/products/${productId}`, accessToken);
}

export function purchaseMerchantProduct(
  accessToken: string,
  productId: string,
  body: { quantity: number; paymentMethod: "wallet" | "mobile_money" }
) {
  return apiPostJson<{
    orderId: string;
    providerRef: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    paymentUrl: string | null;
  }>(`/merchant/catalog/products/${productId}/purchase`, body, accessToken);
}

export function confirmMerchantOrderPayment(
  accessToken: string,
  orderId: string,
  providerRef: string
) {
  return apiPostJson(
    `/merchant/catalog/orders/${orderId}/payment/confirm`,
    { providerRef },
    accessToken
  );
}

export function fetchMerchantSellerOrders(accessToken: string, profileId: string) {
  return apiGetJson("/merchant/orders/seller", accessToken, profileId);
}
