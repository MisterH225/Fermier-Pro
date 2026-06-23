export const GENIUSPAY_KIND_MARKETPLACE_ESCROW = "marketplace_escrow" as const;
export const GENIUSPAY_KIND_WALLET_TOPUP = "wallet_topup" as const;

export type GeniusPayPaymentKind =
  | typeof GENIUSPAY_KIND_MARKETPLACE_ESCROW
  | typeof GENIUSPAY_KIND_WALLET_TOPUP;

export type GeniusPayPaymentMetadata = {
  kind: GeniusPayPaymentKind;
  user_id: string;
  transaction_id?: string;
  amount?: string;
};

export type GeniusPayPaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

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
    id?: number;
    reference: string;
    amount: number;
    currency?: string;
    fees?: number;
    net_amount?: number;
    status?: GeniusPayPaymentStatus;
    payment_method?: string | null;
    provider?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  };
  environment?: string;
  api_version?: string;
};
