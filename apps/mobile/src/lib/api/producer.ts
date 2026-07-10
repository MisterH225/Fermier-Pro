import { apiGetJson, apiPostJson } from "./http";

export type ProducerMeDto = {
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
  teamPremiumActive: boolean;
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
  premiumPriceXof: number;
};

export function fetchProducerMe(
  accessToken: string,
  profileId: string
): Promise<ProducerMeDto> {
  return apiGetJson<ProducerMeDto>("/producers/me", accessToken, profileId);
}

export function chooseProducerSubscription(
  accessToken: string,
  profileId: string,
  body: {
    tier: "free" | "premium";
    paymentMethod?: "wallet" | "mobile_money";
    startTrial?: boolean;
  }
): Promise<
  | ProducerMeDto
  | {
      pending: boolean;
      providerRef: string;
      paymentUrl?: string | null;
      amount: number;
      invoiceId?: string;
    }
> {
  return apiPostJson("/producers/me/subscription", body, accessToken, profileId);
}

export function renewProducerSubscription(
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
    "/producers/me/subscription/renew",
    {},
    accessToken,
    profileId
  );
}

export function cancelProducerSubscription(
  accessToken: string,
  profileId: string
): Promise<ProducerMeDto> {
  return apiPostJson(
    "/producers/me/subscription/cancel",
    {},
    accessToken,
    profileId
  );
}

export function confirmProducerSubscription(
  accessToken: string,
  profileId: string,
  providerRef: string,
  invoiceId?: string
): Promise<ProducerMeDto> {
  return apiPostJson(
    "/producers/me/subscription/confirm",
    { providerRef, ...(invoiceId ? { invoiceId } : {}) },
    accessToken,
    profileId
  );
}
