import { apiDeleteJson, apiGetJson, apiPatchJson, apiPostJson } from "./http";

export type MerchantMeDto = {
  subscriptionTier: "free" | "premium" | null;
  subscriptionStatus?:
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "trialing"
    | null;
  subscriptionChosenAt: string | null;
  premiumPaidAt: string | null;
  nextBillingAt?: string | null;
  graceEndsAt?: string | null;
  trialEndsAt?: string | null;
  promoPercentOffApplied?: number | null;
  billingUnit?: "hour" | "day" | "month";
  billingInterval?: number;
  graceDays?: number;
  trialAvailable?: boolean;
  trialUnits?: number;
  promoEnabled?: boolean;
  promoPercentOff?: number;
  premiumFullPriceXof?: number;
  pendingRenewal?: {
    invoiceId: string;
    amount: number;
    currency: string;
    paymentUrl: string | null;
    providerRef: string | null;
    dueDate: string;
  } | null;
  pendingSubscription?: {
    invoiceId: string;
    amount: number;
    currency: string;
    paymentUrl: string | null;
    providerRef: string | null;
    dueDate: string;
  } | null;
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
  viewCount?: number;
  status: string;
  publishedAt: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
  moderationReason?: string | null;
  moderatedAt?: string | null;
  resubmissionCount?: number;
  resubmittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantOrderDto = {
  id: string;
  productId: string;
  productName: string | null;
  productPhotoUrls: string[];
  productCurrency: string;
  buyerUserId: string;
  buyerName: string | null;
  buyerPhone?: string | null;
  sellerUserId: string;
  sellerName: string | null;
  sellerPhone?: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerCommission: number;
  sellerCommission: number;
  sellerNet: number;
  paymentMethod: string;
  providerRef: string | null;
  status: string;
  escrowHeld?: boolean;
  paidAt: string | null;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt: string | null;
  rejectedAt?: string | null;
  disputeOpenedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  timeoutAt?: string | null;
  disputeWindowEndsAt?: string | null;
  createdAt: string;
  timeline?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorUserId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  dispute: {
    id: string;
    reason: string;
    sellerNote: string | null;
    buyerNote: string | null;
    status: string;
    openedByUserId: string;
    createdAt: string;
    resolvedAt: string | null;
    resolutionNote?: string | null;
  } | null;
};

export type MerchantDashboardDto = {
  kpis: {
    monthRevenueXof: number;
    pendingOrders: number;
    productViews: number;
  };
  lowStockProducts: Array<{ id: string; name: string; stock: number; shopName: string }>;
  moderationEvents: Array<{
    id: string;
    productId: string;
    productName: string;
    reason: string;
    deletedAt: string;
  }>;
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

export function fetchMerchantDashboard(
  accessToken: string,
  profileId: string
): Promise<MerchantDashboardDto> {
  return apiGetJson<MerchantDashboardDto>("/merchant/dashboard", accessToken, profileId);
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
    startTrial?: boolean;
    promoCode?: string;
  }
): Promise<MerchantMeDto | { pending: boolean; providerRef: string; paymentUrl?: string | null; amount: number; invoiceId?: string }> {
  return apiPostJson(
    "/merchant/me/subscription",
    body,
    accessToken,
    profileId
  );
}

export type MerchantPromoCodeBenefit = {
  codeId: string;
  code: string;
  type: "trial" | "discount" | "promo";
  label: string | null;
  percentOff: number | null;
  trialUnits: number | null;
  discountedPriceXof: number | null;
  fullPriceXof: number;
};

export function validateMerchantPromoCode(
  accessToken: string,
  profileId: string,
  code: string
): Promise<MerchantPromoCodeBenefit> {
  return apiPostJson(
    "/merchant/me/subscription/validate-code",
    { code },
    accessToken,
    profileId
  );
}

export function renewMerchantSubscription(
  accessToken: string,
  profileId: string
): Promise<{
  pending: boolean;
  invoiceId: string;
  amount: number;
  providerRef: string | null;
  paymentUrl: string | null;
}> {
  return apiPostJson(
    "/merchant/me/subscription/renew",
    {},
    accessToken,
    profileId
  );
}

export function cancelMerchantSubscription(
  accessToken: string,
  profileId: string
): Promise<MerchantMeDto> {
  return apiPostJson(
    "/merchant/me/subscription/cancel",
    {},
    accessToken,
    profileId
  );
}

export function confirmMerchantSubscription(
  accessToken: string,
  profileId: string,
  providerRef: string,
  invoiceId?: string
): Promise<MerchantMeDto> {
  return apiPostJson(
    "/merchant/me/subscription/confirm",
    { providerRef, ...(invoiceId ? { invoiceId } : {}) },
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

/** Archive (soft-delete) une boutique — dépublie ses produits. */
export function archiveMerchantShop(
  accessToken: string,
  profileId: string,
  shopId: string
): Promise<{
  ok: boolean;
  id: string;
  archivedAt: string;
  unpublishedProductCount: number;
}> {
  return apiDeleteJson(
    `/merchant/shops/${shopId}`,
    accessToken,
    profileId
  );
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

export function resubmitMerchantProduct(
  accessToken: string,
  profileId: string,
  productId: string
): Promise<MerchantProductDto> {
  return apiPostJson<MerchantProductDto>(
    `/merchant/products/${productId}/resubmit`,
    {},
    accessToken,
    profileId
  );
}

export function unpublishMerchantProduct(
  accessToken: string,
  profileId: string,
  productId: string
): Promise<MerchantProductDto> {
  return apiPostJson<MerchantProductDto>(
    `/merchant/products/${productId}/unpublish`,
    {},
    accessToken,
    profileId
  );
}

export function updateMerchantProduct(
  accessToken: string,
  profileId: string,
  productId: string,
  body: {
    name?: string;
    categoryId?: string;
    description?: string;
    price?: number;
    photoUrls?: string[];
    stock?: number;
  }
): Promise<MerchantProductDto> {
  return apiPatchJson<MerchantProductDto>(
    `/merchant/products/${productId}`,
    body,
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
  params?: {
    categoryId?: string;
    cursor?: string;
    q?: string;
    sort?: "recent" | "price_asc" | "price_desc" | "popular";
  }
) {
  const q = new URLSearchParams();
  if (params?.categoryId) q.set("categoryId", params.categoryId);
  if (params?.cursor) q.set("cursor", params.cursor);
  if (params?.q) q.set("q", params.q);
  if (params?.sort) q.set("sort", params.sort);
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
      shopId: string;
      sellerUserId: string;
      merchantName: string | null;
      shopDescription: string | null;
      shopLocation: string | null;
    }
  >(`/merchant/catalog/products/${productId}`, accessToken);
}

export function fetchMerchantCatalogOrder(
  accessToken: string,
  orderId: string
) {
  return apiGetJson<MerchantOrderDto>(
    `/merchant/catalog/orders/${orderId}`,
    accessToken
  );
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
  return apiPostJson<MerchantOrderDto>(
    `/merchant/catalog/orders/${orderId}/payment/confirm`,
    { providerRef },
    accessToken
  );
}

export function fetchMerchantSellerOrders(accessToken: string, profileId: string) {
  return apiGetJson<MerchantOrderDto[]>("/merchant/orders/seller", accessToken, profileId);
}

export function fetchMerchantBuyerOrders(accessToken: string) {
  return apiGetJson<MerchantOrderDto[]>("/merchant/orders/buyer", accessToken);
}

export function fetchMerchantOrder(
  accessToken: string,
  orderId: string,
  profileId?: string | null
) {
  return apiGetJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}`,
    accessToken,
    profileId ?? undefined
  );
}

export function completeMerchantOrder(
  accessToken: string,
  orderId: string,
  profileId?: string | null
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/complete`,
    {},
    accessToken,
    profileId ?? undefined
  );
}

export function confirmMerchantOrder(
  accessToken: string,
  profileId: string,
  orderId: string
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/confirm`,
    {},
    accessToken,
    profileId
  );
}

export function rejectMerchantOrder(
  accessToken: string,
  profileId: string,
  orderId: string
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/reject`,
    {},
    accessToken,
    profileId
  );
}

export function shipMerchantOrder(
  accessToken: string,
  profileId: string,
  orderId: string
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/ship`,
    {},
    accessToken,
    profileId
  );
}

export function markMerchantOrderDelivered(
  accessToken: string,
  profileId: string,
  orderId: string
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/mark-delivered`,
    {},
    accessToken,
    profileId
  );
}

export function openMerchantOrderDispute(
  accessToken: string,
  orderId: string,
  body: { reason: string },
  profileId?: string | null
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/dispute`,
    body,
    accessToken,
    profileId ?? undefined
  );
}

export function respondMerchantOrderDispute(
  accessToken: string,
  orderId: string,
  body: { note: string },
  profileId?: string | null
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/dispute/respond`,
    body,
    accessToken,
    profileId ?? undefined
  );
}

/** Commerçant : accepte la reprise → remboursement (escrow ou clawback post-completed). */
export function acceptMerchantOrderDisputeReturn(
  accessToken: string,
  profileId: string,
  orderId: string,
  body: { note: string }
) {
  return apiPostJson<MerchantOrderDto>(
    `/merchant/orders/${orderId}/dispute/accept-return`,
    body,
    accessToken,
    profileId
  );
}
