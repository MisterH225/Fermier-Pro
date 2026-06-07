import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  MarketplaceFundMovementKind,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "./mobile-money.gateway";

@Injectable()
export class EscrowService {
  private readonly log = new Logger(EscrowService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  async holdFunds(
    transactionId: string,
    buyerUserId: string,
    amount: number,
    currency: string,
    label: string
  ): Promise<{ providerRef: string }> {
    const init = await this.gateway.initiatePayment({
      amount,
      currency,
      buyerUserId,
      transactionId,
      label
    });
    await this.logMovement(transactionId, MarketplaceFundMovementKind.HOLD, amount, currency, init.providerRef, "Initiation blocage fonds");
    return { providerRef: init.providerRef };
  }

  async confirmHold(providerRef: string, transactionId: string): Promise<boolean> {
    const res = await this.gateway.confirmPayment(providerRef, transactionId);
    return res.success;
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
    originalProviderRef?: string | null
  ): Promise<void> {
    const res = await this.gateway.refund({
      amount: refundAmount,
      currency,
      buyerUserId,
      transactionId,
      originalProviderRef
    });
    if (!res.success) {
      throw new Error("Échec remboursement acheteur via mobile money");
    }
    await this.logMovement(
      transactionId,
      MarketplaceFundMovementKind.REFUND_BUYER,
      refundAmount,
      currency,
      res.providerRef,
      "Remboursement acheteur"
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
