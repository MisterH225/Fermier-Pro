import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  MarketplaceFundMovementKind,
  MarketplacePaymentMethod,
  Prisma
} from "@prisma/client";
import { FeatureFlagService } from "../../config-client/feature-flags.service";
import { UserWalletService } from "../../wallet/user-wallet.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway,
  type MobileMoneyInitResult
} from "./mobile-money.gateway";

export type HoldFundsOptions = {
  paymentMethod?: MarketplacePaymentMethod;
};

@Injectable()
export class EscrowService {
  private readonly log = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userWallet: UserWalletService,
    private readonly featureFlags: FeatureFlagService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  async holdFunds(
    transactionId: string,
    buyerUserId: string,
    amount: number,
    currency: string,
    label: string,
    options?: HoldFundsOptions
  ): Promise<{
    providerRef: string;
    paymentMethod: MarketplacePaymentMethod;
    paymentUrl?: string | null;
  }> {
    const method = options?.paymentMethod ?? MarketplacePaymentMethod.mobile_money;

    if (method === MarketplacePaymentMethod.wallet) {
      const walletEnabled = await this.featureFlags.isEnabled("wallet");
      if (!walletEnabled) {
        const { moduleId, message } =
          await this.featureFlags.resolveInactiveContext("wallet");
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: "MODULE_INACTIVE",
          moduleId,
          feature: "wallet",
          message: message ?? "Portefeuille désactivé",
          error: "Service Unavailable"
        });
      }
      await this.userWallet.assertSufficientBalance(buyerUserId, amount);
      const providerRef = this.userWallet.walletPendingRef(transactionId);
      return { providerRef, paymentMethod: method, paymentUrl: null };
    }

    const init = await this.gateway.initiatePayment({
      amount,
      currency,
      buyerUserId,
      transactionId,
      label
    });
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.HOLD,
      amount,
      currency,
      init.providerRef,
      "Initiation blocage fonds"
    );
    return {
      providerRef: init.providerRef,
      paymentMethod: MarketplacePaymentMethod.mobile_money,
      paymentUrl: init.paymentUrl ?? null
    };
  }

  async resumeMobileMoneyCheckout(
    providerRef: string
  ): Promise<MobileMoneyInitResult | null> {
    if (typeof this.gateway.resumePendingCheckout !== "function") {
      return null;
    }
    return this.gateway.resumePendingCheckout(providerRef);
  }

  async inspectMobileMoneyCheckout(providerRef: string) {
    if (typeof this.gateway.inspectCheckout !== "function") {
      return null;
    }
    return this.gateway.inspectCheckout(providerRef);
  }

  async confirmHold(
    providerRef: string,
    transactionId: string,
    walletContext?: {
      buyerUserId: string;
      amount: number;
      currency: string;
      label: string;
    }
  ): Promise<{
    success: boolean;
    providerRef?: string;
    failureReason?: string;
  }> {
    if (this.userWallet.isWalletPendingRef(providerRef)) {
      if (!walletContext) {
        throw new Error("Contexte portefeuille manquant pour confirmer le paiement");
      }
      const confirmedRef = await this.userWallet.confirmPendingHold(
        providerRef,
        walletContext.buyerUserId,
        walletContext.amount,
        walletContext.currency,
        transactionId,
        walletContext.label
      );
      await this.logMovement(
        transactionId,
        MarketplaceFundMovementKind.HOLD,
        walletContext.amount,
        walletContext.currency,
        confirmedRef,
        "Blocage fonds via portefeuille acheteur"
      );
      return { success: true, providerRef: confirmedRef };
    }
    if (this.userWallet.isWalletProviderRef(providerRef)) {
      await this.userWallet.requireWalletEntryForRef(providerRef, transactionId);
      return { success: true, providerRef };
    }
    const res = await this.gateway.confirmPayment(providerRef, transactionId);
    return {
      success: res.success,
      providerRef: res.providerRef,
      failureReason: res.failureReason
    };
  }

  async releaseFundsToSeller(
    transactionId: string,
    sellerUserId: string,
    sellerAmount: number,
    currency: string,
    paymentMethod?: MarketplacePaymentMethod | null
  ): Promise<void> {
    if (
      paymentMethod === MarketplacePaymentMethod.mobile_money &&
      sellerAmount >= 200
    ) {
      const payout = await this.gateway.releaseFunds({
        amount: sellerAmount,
        currency,
        recipientUserId: sellerUserId,
        transactionId,
        label: `Versement vendeur marketplace ${transactionId}`
      });
      if (payout.success) {
        await this.logMovement(
          transactionId,
          MarketplaceFundMovementKind.RELEASE_TO_SELLER,
          sellerAmount,
          currency,
          payout.providerRef,
          "Versement vendeur (mobile money GeniusPay)"
        );
        return;
      }
      throw new ServiceUnavailableException(
        "Versement vendeur mobile money indisponible — réessayez plus tard."
      );
    }

    const entry = await this.userWallet.creditEscrowRelease(
      sellerUserId,
      sellerAmount,
      currency,
      transactionId,
      "Versement vendeur marketplace (portefeuille)",
      `escrow-release:${transactionId}:${sellerAmount}`
    );
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.RELEASE_TO_SELLER,
      sellerAmount,
      currency,
      this.userWallet.walletProviderRef(entry.id),
      "Versement vendeur (portefeuille)"
    );
  }

  async refundBuyer(
    transactionId: string,
    buyerUserId: string,
    refundAmount: number,
    currency: string,
    originalProviderRef?: string | null,
    paymentMethod?: MarketplacePaymentMethod | null
  ): Promise<void> {
    if (
      paymentMethod === MarketplacePaymentMethod.mobile_money &&
      refundAmount >= 200
    ) {
      const payout = await this.gateway.refund({
        amount: refundAmount,
        currency,
        buyerUserId,
        transactionId,
        originalProviderRef
      });
      if (payout.success) {
        await this.logMovement(
          transactionId,
          MarketplaceFundMovementKind.REFUND_BUYER,
          refundAmount,
          currency,
          payout.providerRef,
          "Remboursement acheteur (mobile money GeniusPay)"
        );
        return;
      }
      throw new ServiceUnavailableException(
        "Remboursement mobile money indisponible — réessayez plus tard."
      );
    }

    const entry = await this.userWallet.creditRefund(
      buyerUserId,
      refundAmount,
      currency,
      transactionId,
      "Remboursement escrow crédité sur le portefeuille acheteur",
      `refund:${transactionId}:${refundAmount}`
    );
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.REFUND_BUYER,
      refundAmount,
      currency,
      this.userWallet.walletProviderRef(entry.id),
      "Remboursement acheteur (portefeuille)"
    );
  }

  async chargeAdditional(
    transactionId: string,
    buyerUserId: string,
    additionalAmount: number,
    currency: string
  ): Promise<boolean> {
    const res = await this.gateway.chargeAdditional({
      amount: additionalAmount,
      currency,
      buyerUserId,
      transactionId
    });
    if (res.success) {
      await this.logMovement(
        transactionId,
        MarketplaceFundMovementKind.ADDITIONAL_CHARGE,
        additionalAmount,
        currency,
        res.providerRef,
        "Complément acheteur"
      );
    }
    return res.success;
  }

  async collectCommission(
    transactionId: string,
    commissionAmount: number,
    currency: string
  ): Promise<void> {
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.COMMISSION,
      commissionAmount,
      currency,
      null,
      "Commission plateforme"
    );
  }

  private async logMovement(
    transactionId: string,
    kind: MarketplaceFundMovementKind,
    amount: number,
    currency: string,
    providerRef: string | null,
    note: string
  ): Promise<void> {
    await this.prisma.marketplaceFundMovement.create({
      data: {
        transactionId,
        kind,
        amount: new Prisma.Decimal(amount),
        currency,
        providerRef,
        note
      }
    });
    this.log.log(`[${kind}] tx=${transactionId} amount=${amount} ${currency}`);
  }
}
