import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  MarketplaceFundMovementKind,
  MarketplacePaymentMethod,
  Prisma
} from "@prisma/client";
import { BuyerWalletService } from "../../buyer-wallet/buyer-wallet.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "./mobile-money.gateway";

export type HoldFundsOptions = {
  paymentMethod?: MarketplacePaymentMethod;
};

@Injectable()
export class EscrowService {
  private readonly log = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly buyerWallet: BuyerWalletService,
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
  ): Promise<{ providerRef: string; paymentMethod: MarketplacePaymentMethod }> {
    const method = options?.paymentMethod ?? MarketplacePaymentMethod.mobile_money;

    if (method === MarketplacePaymentMethod.wallet) {
      await this.buyerWallet.assertSufficientBalance(buyerUserId, amount);
      const providerRef = this.buyerWallet.walletPendingRef(transactionId);
      return { providerRef, paymentMethod: method };
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
      paymentMethod: MarketplacePaymentMethod.mobile_money
    };
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
  ): Promise<{ success: boolean; providerRef?: string }> {
    if (this.buyerWallet.isWalletPendingRef(providerRef)) {
      if (!walletContext) {
        throw new Error("Contexte portefeuille manquant pour confirmer le paiement");
      }
      const confirmedRef = await this.buyerWallet.confirmPendingHold(
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
    if (this.buyerWallet.isWalletProviderRef(providerRef)) {
      await this.buyerWallet.requireWalletEntryForRef(providerRef, transactionId);
      return { success: true, providerRef };
    }
    const res = await this.gateway.confirmPayment(providerRef, transactionId);
    return { success: res.success, providerRef };
  }

  async releaseFundsToSeller(
    transactionId: string,
    sellerUserId: string,
    sellerAmount: number,
    currency: string
  ): Promise<void> {
    const res = await this.gateway.releaseFunds({
      amount: sellerAmount,
      currency,
      recipientUserId: sellerUserId,
      transactionId,
      label: `Marketplace settlement ${transactionId}`
    });
    if (!res.success) {
      throw new Error("Échec versement vendeur via mobile money");
    }
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.RELEASE_TO_SELLER,
      sellerAmount,
      currency,
      res.providerRef,
      "Versement vendeur"
    );
  }

  async refundBuyer(
    transactionId: string,
    buyerUserId: string,
    refundAmount: number,
    currency: string,
    _originalProviderRef?: string | null
  ): Promise<void> {
    const entry = await this.buyerWallet.creditRefund(
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
      this.buyerWallet.walletProviderRef(entry.id),
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
