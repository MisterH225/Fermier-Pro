import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import type {
  MobileMoneyConfirmResult,
  MobileMoneyGateway,
  MobileMoneyInitResult,
  MobileMoneyRefundResult
} from "../mobile-money.gateway";
import { GeniusPayClient } from "./geniuspay.client";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_WALLET_TOPUP,
  type GeniusPayPaymentMetadata
} from "./geniuspay.types";

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
      paymentUrl: data.checkout_url ?? data.payment_url ?? null
    };
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

  async refund(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    originalProviderRef?: string | null;
  }): Promise<MobileMoneyRefundResult> {
    this.log.warn(
      `refund via GeniusPay non supporté — crédit portefeuille interne tx=${params.transactionId}`
    );
    return {
      success: false,
      providerRef: params.originalProviderRef ?? providerRefFallback()
    };
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
    this.log.warn(
      `releaseFunds via GeniusPay non supporté — versement portefeuille interne tx=${params.transactionId}`
    );
    return { success: false, providerRef: providerRefFallback() };
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
      paymentUrl: data.checkout_url ?? data.payment_url ?? null
    };
  }

  async confirmTopUp(
    providerRef: string,
    userId: string,
    amount: number
  ): Promise<MobileMoneyConfirmResult> {
    return this.confirmByReference(providerRef, (metadata) => {
      if (metadata.kind !== GENIUSPAY_KIND_WALLET_TOPUP) {
        return "Type de paiement GeniusPay inattendu";
      }
      if (metadata.user_id !== userId) {
        return "Référence non liée à cet utilisateur";
      }
      const expected = metadata.amount ? Number(metadata.amount) : amount;
      if (Number.isFinite(expected) && Math.abs(expected - amount) > 1) {
        return "Montant de recharge incohérent";
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
  }): Promise<MobileMoneyInitResult> {
    this.log.warn(
      `initiateWithdraw via GeniusPay non documenté user=${params.userId}`
    );
    return {
      providerRef: providerRefFallback(),
      paymentUrl: null
    };
  }

  async confirmWithdraw(
    providerRef: string,
    _userId: string,
    _amount: number
  ): Promise<MobileMoneyConfirmResult> {
    return {
      success: false,
      providerRef,
      failureReason: "Retrait GeniusPay non implémenté"
    };
  }

  private async confirmByReference(
    providerRef: string,
    validateMetadata: (metadata: GeniusPayPaymentMetadata) => string | null
  ): Promise<MobileMoneyConfirmResult> {
    try {
      const payment = await this.client.getPayment(providerRef);
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
        return { success: true, providerRef };
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
      this.log.warn(`confirm ${providerRef}: ${String(err)}`);
      return {
        success: false,
        providerRef,
        failureReason: "Impossible de vérifier le paiement GeniusPay"
      };
    }
  }

  private parseMetadata(
    raw: Record<string, string | number | boolean | null> | undefined
  ): GeniusPayPaymentMetadata | null {
    if (!raw) return null;
    const kind = raw.kind;
    const userId = raw.user_id;
    if (
      (kind !== GENIUSPAY_KIND_MARKETPLACE_ESCROW &&
        kind !== GENIUSPAY_KIND_WALLET_TOPUP) ||
      typeof userId !== "string" ||
      !userId.trim()
    ) {
      return null;
    }
    const transactionId =
      typeof raw.transaction_id === "string" ? raw.transaction_id : undefined;
    const amount =
      raw.amount !== undefined && raw.amount !== null
        ? String(raw.amount)
        : undefined;
    return {
      kind,
      user_id: userId,
      transaction_id: transactionId,
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
