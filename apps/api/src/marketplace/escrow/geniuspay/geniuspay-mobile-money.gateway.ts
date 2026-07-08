import { BadGatewayException, BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  MobileMoneyConfirmResult,
  MobileMoneyGateway,
  MobileMoneyInitResult,
  MobileMoneyRefundResult
} from "../mobile-money.gateway";
import { GeniusPayClient } from "./geniuspay.client";
import {
  normalizeCiMobilePhone,
  parsePayoutMetadata,
  payoutProviderFromEnv,
  waitForPayoutCompletion
} from "./geniuspay-payout.util";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_MARKETPLACE_REFUND,
  GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT,
  GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION,
  GENIUSPAY_KIND_WALLET_TOPUP,
  GENIUSPAY_KIND_WALLET_WITHDRAW,
  type GeniusPayPaymentMetadata,
  type GeniusPayPayoutMetadata
} from "./geniuspay.types";

export const GENIUSPAY_CHECKOUT_BASE = "https://geniuspay.ci/checkout";

export function resolveGeniusPayCheckoutUrl(data: {
  reference?: string | null;
  checkout_url?: string | null;
  payment_url?: string | null;
}): string | null {
  const direct = data.checkout_url?.trim() || data.payment_url?.trim();
  if (direct) {
    return direct;
  }
  const ref = data.reference?.trim();
  if (!ref) {
    return null;
  }
  return `${GENIUSPAY_CHECKOUT_BASE}/${encodeURIComponent(ref)}`;
}

@Injectable()
export class GeniusPayMobileMoneyGateway implements MobileMoneyGateway {
  private readonly log = new Logger(GeniusPayMobileMoneyGateway.name);

  constructor(
    private readonly client: GeniusPayClient,
    private readonly prisma: PrismaService
  ) {}

  async initiatePayment(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyInitResult> {
    const customer = await this.loadCustomer(params.buyerUserId);
    const data = await this.client.createPayment({
      amount: params.amount,
      currency: params.currency,
      description: params.label,
      customer,
      metadata: {
        kind: GENIUSPAY_KIND_MARKETPLACE_ESCROW,
        user_id: params.buyerUserId,
        transaction_id: params.transactionId,
        amount: String(Math.round(params.amount))
      },
      successUrl: process.env.GENIUSPAY_SUCCESS_URL,
      errorUrl: process.env.GENIUSPAY_ERROR_URL
    });
    return {
      providerRef: data.reference,
      paymentUrl: resolveGeniusPayCheckoutUrl(data)
    };
  }

  async initiateMerchantSubscriptionPayment(params: {
    amount: number;
    currency: string;
    userId: string;
    invoiceId: string;
    label: string;
  }): Promise<MobileMoneyInitResult> {
    const customer = await this.loadCustomer(params.userId);
    const data = await this.client.createPayment({
      amount: params.amount,
      currency: params.currency,
      description: params.label,
      customer,
      metadata: {
        kind: GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION,
        user_id: params.userId,
        invoice_id: params.invoiceId,
        transaction_id: `merchant-sub:${params.invoiceId}`,
        amount: String(Math.round(params.amount))
      },
      successUrl: process.env.GENIUSPAY_SUCCESS_URL,
      errorUrl: process.env.GENIUSPAY_ERROR_URL
    });
    return {
      providerRef: data.reference,
      paymentUrl: resolveGeniusPayCheckoutUrl(data)
    };
  }

  async confirmMerchantSubscriptionPayment(
    providerRef: string,
    invoiceId: string
  ): Promise<MobileMoneyConfirmResult> {
    return this.confirmByReference(providerRef, (metadata) => {
      if (metadata.kind !== GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION) {
        return "Type de paiement GeniusPay inattendu";
      }
      if (metadata.invoice_id !== invoiceId) {
        return "Facture abonnement non liée à ce paiement";
      }
      return null;
    });
  }

  async confirmPayment(
    providerRef: string,
    transactionId: string
  ): Promise<MobileMoneyConfirmResult> {
    return this.confirmByReference(providerRef, (metadata) => {
      if (metadata.kind !== GENIUSPAY_KIND_MARKETPLACE_ESCROW) {
        return "Type de paiement GeniusPay inattendu";
      }
      if (metadata.transaction_id !== transactionId) {
        return "Référence non liée à cette transaction";
      }
      return null;
    });
  }

  async resumePendingCheckout(
    providerRef: string
  ): Promise<MobileMoneyInitResult | null> {
    const payment = await this.client.lookupPayment(providerRef);
    if (!payment) {
      return null;
    }
    if (
      payment.status === "completed" ||
      payment.status === "failed" ||
      payment.status === "cancelled" ||
      payment.status === "expired"
    ) {
      return null;
    }
    const paymentUrl = resolveGeniusPayCheckoutUrl(payment);
    if (!paymentUrl?.trim()) {
      return null;
    }
    return {
      providerRef: payment.reference,
      paymentUrl
    };
  }

  async refund(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    originalProviderRef?: string | null;
  }): Promise<MobileMoneyRefundResult> {
    return this.createOutboundPayout({
      amount: params.amount,
      currency: params.currency,
      userId: params.buyerUserId,
      transactionId: params.transactionId,
      label: `Remboursement marketplace ${params.transactionId}`,
      kind: GENIUSPAY_KIND_MARKETPLACE_REFUND,
      idempotencyKey: `marketplace-refund:${params.transactionId}:${Math.round(params.amount)}`,
      originalProviderRef: params.originalProviderRef
    });
  }

  async chargeAdditional(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
  }): Promise<MobileMoneyConfirmResult> {
    this.log.warn(
      `chargeAdditional via GeniusPay non supporté en synchrone tx=${params.transactionId}`
    );
    return {
      success: false,
      providerRef: providerRefFallback(),
      failureReason: "Complément mobile money GeniusPay non implémenté"
    };
  }

  async releaseFunds(params: {
    amount: number;
    currency: string;
    recipientUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyRefundResult> {
    return this.createOutboundPayout({
      amount: params.amount,
      currency: params.currency,
      userId: params.recipientUserId,
      transactionId: params.transactionId,
      label: params.label,
      kind: GENIUSPAY_KIND_MARKETPLACE_SELLER_PAYOUT,
      idempotencyKey: `marketplace-release:${params.transactionId}:${Math.round(params.amount)}`
    });
  }

  async initiateTopUp(params: {
    amount: number;
    currency: string;
    userId: string;
    label: string;
  }): Promise<MobileMoneyInitResult> {
    const customer = await this.loadCustomer(params.userId);
    const data = await this.client.createPayment({
      amount: params.amount,
      currency: params.currency,
      description: params.label,
      customer,
      metadata: {
        kind: GENIUSPAY_KIND_WALLET_TOPUP,
        user_id: params.userId,
        amount: String(Math.round(params.amount))
      },
      successUrl: process.env.GENIUSPAY_SUCCESS_URL,
      errorUrl: process.env.GENIUSPAY_ERROR_URL
    });
    return {
      providerRef: data.reference,
      paymentUrl: resolveGeniusPayCheckoutUrl(data)
    };
  }

  async confirmTopUp(
    providerRef: string,
    userId: string
  ): Promise<MobileMoneyConfirmResult> {
    return this.confirmByReference(providerRef, (metadata) => {
      if (metadata.kind !== GENIUSPAY_KIND_WALLET_TOPUP) {
        return "Type de paiement GeniusPay inattendu";
      }
      if (metadata.user_id !== userId) {
        return "Référence non liée à cet utilisateur";
      }
      const providerAmount =
        metadata.amount != null && String(metadata.amount).trim() !== ""
          ? Number(metadata.amount)
          : NaN;
      if (!Number.isFinite(providerAmount) || providerAmount <= 0) {
        return "Montant de recharge absent côté prestataire";
      }
      return null;
    });
  }

  async initiateWithdraw(params: {
    amount: number;
    currency: string;
    userId: string;
    phone?: string | null;
    label: string;
    idempotencyKey?: string;
  }): Promise<MobileMoneyInitResult> {
    const payoutPhone = normalizeCiMobilePhone(
      params.phone?.trim() || (await this.loadCustomer(params.userId)).phone?.trim() || ""
    );
    if (!payoutPhone) {
      throw new BadRequestException(
        "Numéro mobile money requis pour le retrait GeniusPay."
      );
    }
    const customer = await this.loadCustomer(params.userId);
    const metadata: GeniusPayPayoutMetadata = {
      kind: GENIUSPAY_KIND_WALLET_WITHDRAW,
      user_id: params.userId,
      amount: String(Math.round(params.amount))
    };
    const payout = await this.client.createPayout({
      amount: params.amount,
      currency: params.currency,
      description: params.label,
      recipientName: customer.name?.trim() || "Client Fermier Pro",
      recipientPhone: payoutPhone,
      recipientEmail: customer.email,
      metadata,
      idempotencyKey:
        params.idempotencyKey?.trim() ||
        `wallet-withdraw:${params.userId}:${Math.round(params.amount)}:${Date.now()}`,
      provider: payoutProviderFromEnv()
    });
    return {
      providerRef: payout.reference,
      paymentUrl: null
    };
  }

  async confirmWithdraw(
    providerRef: string,
    userId: string,
    amount: number
  ): Promise<MobileMoneyConfirmResult> {
    return this.confirmPayoutByReference(providerRef, (metadata) => {
      if (metadata.kind !== GENIUSPAY_KIND_WALLET_WITHDRAW) {
        return "Type de payout GeniusPay inattendu";
      }
      if (metadata.user_id !== userId) {
        return "Référence non liée à cet utilisateur";
      }
      const providerAmount =
        metadata.amount != null && String(metadata.amount).trim() !== ""
          ? Number(metadata.amount)
          : NaN;
      if (!Number.isFinite(providerAmount) || providerAmount !== Math.round(amount)) {
        return "Montant de retrait incohérent côté prestataire";
      }
      return null;
    });
  }

  private async createOutboundPayout(params: {
    amount: number;
    currency: string;
    userId: string;
    transactionId: string;
    label: string;
    kind: GeniusPayPayoutMetadata["kind"];
    idempotencyKey: string;
    originalProviderRef?: string | null;
  }): Promise<MobileMoneyRefundResult> {
    if (!Number.isFinite(params.amount) || params.amount < 200) {
      this.log.warn(
        `payout ${params.kind} ignoré — montant ${params.amount} < minimum GeniusPay`
      );
      return {
        success: false,
        providerRef: params.originalProviderRef ?? providerRefFallback()
      };
    }

    const customer = await this.loadCustomer(params.userId);
    const payoutPhone = normalizeCiMobilePhone(customer.phone?.trim() || "");
    if (!payoutPhone) {
      throw new BadRequestException(
        "Numéro mobile money requis sur le profil pour ce versement."
      );
    }

    const metadata: GeniusPayPayoutMetadata = {
      kind: params.kind,
      user_id: params.userId,
      transaction_id: params.transactionId,
      amount: String(Math.round(params.amount))
    };

    const payout = await this.client.createPayout({
      amount: params.amount,
      currency: params.currency,
      description: params.label,
      recipientName: customer.name?.trim() || "Client Fermier Pro",
      recipientPhone: payoutPhone,
      recipientEmail: customer.email,
      metadata,
      idempotencyKey: params.idempotencyKey,
      provider: payoutProviderFromEnv()
    });

    const settled = await waitForPayoutCompletion(
      (ref) => this.client.lookupPayout(ref),
      payout.reference
    );
    if (!settled) {
      return { success: false, providerRef: payout.reference };
    }
    if (settled.status === "completed") {
      return { success: true, providerRef: settled.reference };
    }
    this.log.warn(
      `payout ${params.kind} ${payout.reference} statut=${settled.status} tx=${params.transactionId}`
    );
    return { success: false, providerRef: settled.reference };
  }

  private async confirmPayoutByReference(
    providerRef: string,
    validateMetadata: (metadata: GeniusPayPayoutMetadata) => string | null
  ): Promise<MobileMoneyConfirmResult> {
    try {
      const settled = await waitForPayoutCompletion(
        (ref) => this.client.lookupPayout(ref),
        providerRef,
        { attempts: 8, delayMs: 2500 }
      );
      if (!settled) {
        return {
          success: false,
          providerRef,
          failureReason:
            "Référence payout GeniusPay introuvable — réessayez dans un instant."
        };
      }
      const metadata = parsePayoutMetadata(settled.metadata);
      if (!metadata) {
        return {
          success: false,
          providerRef,
          failureReason: "Metadata payout GeniusPay manquantes"
        };
      }
      const metaError = validateMetadata(metadata);
      if (metaError) {
        return { success: false, providerRef, failureReason: metaError };
      }
      if (settled.status === "completed") {
        const verifiedAmount =
          metadata.amount != null && String(metadata.amount).trim() !== ""
            ? Number(metadata.amount)
            : settled.amount;
        return {
          success: true,
          providerRef,
          verifiedAmount:
            Number.isFinite(verifiedAmount) && verifiedAmount > 0
              ? verifiedAmount
              : undefined
        };
      }
      if (settled.status === "failed" || settled.status === "cancelled") {
        return {
          success: false,
          providerRef,
          failureReason: `Payout ${settled.status}`
        };
      }
      return {
        success: false,
        providerRef,
        failureReason: "Payout en attente de confirmation — réessayez dans un instant"
      };
    } catch (err) {
      const detail =
        err instanceof BadGatewayException || err instanceof BadRequestException
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      this.log.warn(`confirm payout ${providerRef}: ${detail}`);
      return {
        success: false,
        providerRef,
        failureReason:
          detail.trim() || "Impossible de vérifier le payout GeniusPay"
      };
    }
  }

  private async confirmByReference(
    providerRef: string,
    validateMetadata: (metadata: GeniusPayPaymentMetadata) => string | null
  ): Promise<MobileMoneyConfirmResult> {
    try {
      const payment = await this.client.lookupPayment(providerRef);
      if (!payment) {
        return {
          success: false,
          providerRef,
          failureReason:
            "Référence GeniusPay expirée — relancez le paiement depuis l'application."
        };
      }
      const metadata = this.parseMetadata(payment.metadata);
      if (!metadata) {
        return {
          success: false,
          providerRef,
          failureReason: "Metadata GeniusPay manquantes"
        };
      }
      const metaError = validateMetadata(metadata);
      if (metaError) {
        return { success: false, providerRef, failureReason: metaError };
      }
      if (payment.status === "completed") {
        const verifiedAmount =
          metadata.amount != null && String(metadata.amount).trim() !== ""
            ? Number(metadata.amount)
            : NaN;
        if (metadata.kind === GENIUSPAY_KIND_WALLET_TOPUP) {
          if (!Number.isFinite(verifiedAmount) || verifiedAmount <= 0) {
            return {
              success: false,
              providerRef,
              failureReason: "Montant de recharge absent côté prestataire"
            };
          }
        }
        return {
          success: true,
          providerRef,
          verifiedAmount:
            Number.isFinite(verifiedAmount) && verifiedAmount > 0
              ? verifiedAmount
              : undefined
        };
      }
      if (
        payment.status === "failed" ||
        payment.status === "cancelled" ||
        payment.status === "expired"
      ) {
        return {
          success: false,
          providerRef,
          failureReason: `Paiement ${payment.status}`
        };
      }
      return {
        success: false,
        providerRef,
        failureReason: "Paiement en attente de confirmation"
      };
    } catch (err) {
      const detail =
        err instanceof BadGatewayException
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      this.log.warn(`confirm ${providerRef}: ${detail}`);
      return {
        success: false,
        providerRef,
        failureReason:
          detail.trim() || "Impossible de vérifier le paiement GeniusPay"
      };
    }
  }

  private parseMetadata(
    raw: Record<string, string | number | boolean | null> | undefined
  ): GeniusPayPaymentMetadata | null {
    if (!raw) return null;
    const kind = raw.kind;
    const userId = raw.user_id;
    const validKind =
      kind === GENIUSPAY_KIND_MARKETPLACE_ESCROW ||
      kind === GENIUSPAY_KIND_WALLET_TOPUP ||
      kind === GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION;
    if (!validKind || typeof userId !== "string" || !userId.trim()) {
      return null;
    }
    const transactionId =
      typeof raw.transaction_id === "string" ? raw.transaction_id : undefined;
    const invoiceId =
      typeof raw.invoice_id === "string" ? raw.invoice_id : undefined;
    const amount =
      raw.amount !== undefined && raw.amount !== null
        ? String(raw.amount)
        : undefined;
    return {
      kind,
      user_id: userId,
      transaction_id: transactionId,
      invoice_id: invoiceId,
      amount
    };
  }

  private async loadCustomer(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true
      }
    });
    const name =
      user?.fullName?.trim() ||
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      undefined;
    return {
      name: name ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      country: "CI"
    };
  }
}

function providerRefFallback(): string {
  return `geniuspay-unsupported-${Date.now()}`;
}
