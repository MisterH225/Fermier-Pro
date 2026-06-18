export type MobileMoneyInitResult = {
  providerRef: string;
  /** URL ou instructions USSD — null en mode dev auto-confirm. */
  paymentUrl?: string | null;
};

export type MobileMoneyConfirmResult = {
  success: boolean;
  providerRef: string;
  failureReason?: string;
};

export type MobileMoneyRefundResult = {
  success: boolean;
  providerRef: string;
};

/** Port vers le prestataire Mobile Money (Orange, MTN, Wave…). */
export interface MobileMoneyGateway {
  initiatePayment(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyInitResult>;

  confirmPayment(
    providerRef: string,
    transactionId: string
  ): Promise<MobileMoneyConfirmResult>;

  refund(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    originalProviderRef?: string | null;
  }): Promise<MobileMoneyRefundResult>;

  chargeAdditional(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
  }): Promise<MobileMoneyConfirmResult>;

  releaseFunds(params: {
    amount: number;
    currency: string;
    recipientUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyRefundResult>;

  /** Recharge portefeuille depuis mobile money. */
  initiateTopUp(params: {
    amount: number;
    currency: string;
    userId: string;
    label: string;
  }): Promise<MobileMoneyInitResult>;

  confirmTopUp(
    providerRef: string,
    userId: string,
    amount: number
  ): Promise<MobileMoneyConfirmResult>;

  /** Retrait portefeuille vers mobile money. */
  initiateWithdraw(params: {
    amount: number;
    currency: string;
    userId: string;
    phone?: string | null;
    label: string;
  }): Promise<MobileMoneyInitResult>;

  confirmWithdraw(
    providerRef: string,
    userId: string,
    amount: number
  ): Promise<MobileMoneyConfirmResult>;
}

export const MOBILE_MONEY_GATEWAY = Symbol("MOBILE_MONEY_GATEWAY");
