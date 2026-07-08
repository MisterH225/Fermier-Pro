import { BadGatewayException } from "@nestjs/common";
import type {
  CreateGeniusPayPaymentParams,
  CreateGeniusPayPayoutParams
} from "../../src/marketplace/escrow/geniuspay/geniuspay.client";
import type {
  GeniusPayPaymentData,
  GeniusPayPaymentMetadata,
  GeniusPayPaymentStatus,
  GeniusPayPayoutData,
  GeniusPayWalletData
} from "../../src/marketplace/escrow/geniuspay/geniuspay.types";

type StoredPayment = GeniusPayPaymentData & {
  metadata: Record<string, string | number | boolean | null>;
};

/**
 * Mock GeniusPay en mémoire pour les e2e (abonnement commerçant, etc.).
 */
export class GeniusPayE2eMock {
  private seq = 0;
  private readonly payments = new Map<string, StoredPayment>();

  async createPayment(
    params: CreateGeniusPayPaymentParams
  ): Promise<GeniusPayPaymentData> {
    this.seq += 1;
    const reference = `e2e-gp-${this.seq}-${Date.now()}`;
    const metadata = params.metadata as GeniusPayPaymentMetadata;
    const data: StoredPayment = {
      id: this.seq,
      reference,
      amount: Math.round(params.amount),
      currency: params.currency || "XOF",
      status: "pending",
      checkout_url: `https://e2e.fermier.test/pay/${reference}`,
      metadata: metadata as unknown as Record<
        string,
        string | number | boolean | null
      >
    };
    this.payments.set(reference, data);
    return data;
  }

  async getPayment(reference: string): Promise<GeniusPayPaymentData> {
    const payment = this.payments.get(reference.trim());
    if (!payment) {
      throw new BadGatewayException("Paiement GeniusPay e2e introuvable");
    }
    return payment;
  }

  async lookupPayment(reference: string): Promise<GeniusPayPaymentData | null> {
    return this.payments.get(reference.trim()) ?? null;
  }

  markPaymentCompleted(reference: string, status: GeniusPayPaymentStatus = "completed") {
    const payment = this.payments.get(reference.trim());
    if (!payment) {
      throw new Error(`Paiement e2e introuvable: ${reference}`);
    }
    payment.status = status;
  }

  reset() {
    this.payments.clear();
    this.seq = 0;
  }

  async createPayout(
    _params: CreateGeniusPayPayoutParams
  ): Promise<GeniusPayPayoutData> {
    throw new Error("GeniusPayE2eMock.createPayout non implémenté");
  }

  async getPayout(_reference: string): Promise<GeniusPayPayoutData> {
    throw new Error("GeniusPayE2eMock.getPayout non implémenté");
  }

  async lookupPayout(_reference: string): Promise<GeniusPayPayoutData | null> {
    return null;
  }

  async listWallets(): Promise<GeniusPayWalletData[]> {
    return [];
  }

  async resolvePayoutWalletId(): Promise<string> {
    return "e2e-payout-wallet";
  }
}
