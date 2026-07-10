export const GENIUSPAY_KIND_MARKETPLACE_ESCROW = "marketplace_escrow" as const;
export const GENIUSPAY_KIND_WALLET_TOPUP = "wallet_topup" as const;
export const GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION = "merchant_subscription" as const;
export const GENIUSPAY_KIND_MERCHANT_ORDER = "merchant_order" as const;
export const GENIUSPAY_KIND_WALLET_WITHDRAW = "wallet_withdraw" as const;
export const GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT =
  "marketplace_seller_payout" as const;
export const GENIUSPAY_KIND_MARKETPLACE_REFUND = "marketplace_refund" as const;

export type GeniusPayPaymentKind =
  | typeof GENIUSPAY_KIND_MARKETPLACE_ESCROW
  | typeof GENIUSPAY_KIND_WALLET_TOPUP
  | typeof GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION
  | typeof GENIUSPAY_KIND_MERCHANT_ORDER;

export type GeniusPayPayoutKind =
  | typeof GENIUSPAY_KIND_WALLET_WITHDRAW
  | typeof GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT
  | typeof GENIUSPAY_KIND_MARKETPLACE_REFUND;

export type GeniusPayPaymentMetadata = {
  kind: GeniusPayPaymentKind;
  user_id: string;
  transaction_id?: string;
  invoice_id?: string;
  order_id?: string;
  amount?: string;
};

export type GeniusPayPayoutMetadata = {
  kind: GeniusPayPayoutKind;
  user_id: string;
  transaction_id?: string;
  amount?: string;
  withdrawal_request_id?: string;
};

export type GeniusPayPaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

export type GeniusPayPayoutStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type GeniusPayPaymentData = {
  id: number;
  reference: string;
  amount: number;
  currency: string;
  fees?: number;
  net_amount?: number;
  status: GeniusPayPaymentStatus;
  payment_url?: string | null;
  checkout_url?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export type GeniusPayPayoutData = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  fees?: number;
  net_amount?: number;
  status: GeniusPayPayoutStatus;
  metadata?: Record<string, string | number | boolean | null>;
  recipient?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
};

export type GeniusPayWalletData = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance?: number;
  available_balance?: number;
  status: string;
};

export type GeniusPayApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

export type GeniusPayWebhookPayload = {
  id: string;
  event: string;
  timestamp: number;
  created_at?: string;
  data: {
    object?: string;
    id?: number | string;
    reference?: string;
    amount?: number;
    currency?: string;
    fees?: number;
    net_amount?: number;
    status?: GeniusPayPaymentStatus | GeniusPayPayoutStatus;
    payment_method?: string | null;
    provider?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
    payout?: GeniusPayPayoutData;
  };
  environment?: string;
  api_version?: string;
};
