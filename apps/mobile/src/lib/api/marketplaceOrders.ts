import { apiGetJson } from "./http";

export type MarketplaceOrderRole = "buyer" | "seller";

export type MarketplaceOrderSegment =
  | "action_required"
  | "active"
  | "closed"
  | "disputed";

export type MarketplaceOrderProjectionType = "escrow" | "shop";

export type MarketplaceOrderProjectionCard = {
  id: string;
  type: MarketplaceOrderProjectionType;
  reference: string;
  status: string;
  stage: string;
  stageIndex: number;
  disputed: boolean;
  actionRequiredBy: "buyer" | "seller" | "system" | "none";
  nextActionKey: string | null;
  deadlineAt: string | null;
  timeoutOutcomeKey: string | null;
  counterparty: { displayName: string };
  itemSummary: string;
  amount: number;
  currency: string;
  updatedAt: string;
};

export type MarketplaceOrdersListResponse = {
  items: MarketplaceOrderProjectionCard[];
  nextCursor: string | null;
};

export type MarketplaceOrdersCountersResponse = {
  actionRequired: number;
  active: number;
  disputed: number;
  pendingProposals: number;
};

/** GET /marketplace/orders — hub unifié escrow + boutique. */
export function fetchMarketplaceOrders(
  accessToken: string,
  params: {
    role: MarketplaceOrderRole;
    segment: MarketplaceOrderSegment;
    cursor?: string | null;
    limit?: number;
  },
  activeProfileId?: string | null
): Promise<MarketplaceOrdersListResponse> {
  const q = new URLSearchParams({
    role: params.role,
    segment: params.segment
  });
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit != null) q.set("limit", String(params.limit));
  return apiGetJson<MarketplaceOrdersListResponse>(
    `/marketplace/orders?${q.toString()}`,
    accessToken,
    activeProfileId
  );
}

/** GET /marketplace/orders/counters */
export function fetchMarketplaceOrdersCounters(
  accessToken: string,
  role: MarketplaceOrderRole,
  activeProfileId?: string | null
): Promise<MarketplaceOrdersCountersResponse> {
  return apiGetJson<MarketplaceOrdersCountersResponse>(
    `/marketplace/orders/counters?role=${role}`,
    accessToken,
    activeProfileId
  );
}
