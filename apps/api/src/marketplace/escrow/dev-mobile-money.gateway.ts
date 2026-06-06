import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  MobileMoneyConfirmResult,
  MobileMoneyGateway,
  MobileMoneyInitResult,
  MobileMoneyRefundResult
} from "./mobile-money.gateway";

/**
 * Gateway simulé pour dev/staging.
 * Les paiements sont marqués pending jusqu'à confirmPayment(ref).
 * Brancher un vrai provider via MOBILE_MONEY_PROVIDER sans changer EscrowService.
 */
@Injectable()
export class DevMobileMoneyGateway implements MobileMoneyGateway {
  private readonly log = new Logger(DevMobileMoneyGateway.name);
  private readonly pending = new Map<
    string,
    { amount: number; currency: string; buyerUserId: string; transactionId: string }
  >();

  async initiatePayment(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyInitResult> {
    const providerRef = `dev-mm-${randomUUID()}`;
    this.pending.set(providerRef, {
      amount: params.amount,
      currency: params.currency,
      buyerUserId: params.buyerUserId,
      transactionId: params.transactionId
    });
    this.log.debug(
      `initiate ${providerRef} ${params.amount} ${params.currency} tx=${params.transactionId}`
    );
    return { providerRef, paymentUrl: null };
  }

  async confirmPayment(providerRef: string): Promise<MobileMoneyConfirmResult> {
    const row = this.pending.get(providerRef);
    if (!row) {
      return { success: false, providerRef, failureReason: "Référence introuvable" };
    }
    this.pending.delete(providerRef);
    return { success: true, providerRef };
  }

  async refund(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
    originalProviderRef?: string | null;
  }): Promise<MobileMoneyRefundResult> {
    this.log.debug(
      `refund ${params.amount} ${params.currency} buyer=${params.buyerUserId} tx=${params.transactionId}`
    );
    return { success: true, providerRef: `dev-refund-${randomUUID()}` };
  }

  async chargeAdditional(params: {
    amount: number;
    currency: string;
    buyerUserId: string;
    transactionId: string;
  }): Promise<MobileMoneyConfirmResult> {
    const providerRef = `dev-charge-${randomUUID()}`;
    this.log.debug(
      `chargeAdditional ${params.amount} tx=${params.transactionId}`
    );
    return { success: true, providerRef };
  }

  async releaseFunds(params: {
    amount: number;
    currency: string;
    recipientUserId: string;
    transactionId: string;
    label: string;
  }): Promise<MobileMoneyRefundResult> {
    this.log.debug(
      `release ${params.amount} ${params.currency} to=${params.recipientUserId} tx=${params.transactionId}`
    );
    return { success: true, providerRef: `dev-release-${randomUUID()}` };
  }
}
