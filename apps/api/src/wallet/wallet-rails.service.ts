import { randomUUID } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { WalletFeeTransactionType, type User } from "@prisma/client";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { PrismaService } from "../prisma/prisma.service";
import type { WalletTransferDto } from "./dto/wallet-operations.dto";
import { PlatformAccountService } from "./platform-account.service";
import { UserWalletService } from "./user-wallet.service";
import { WalletFeeService } from "./wallet-fee.service";
import { WithdrawalOrchestratorService } from "./withdrawal-orchestrator.service";

@Injectable()
export class WalletRailsService {
  constructor(
    private readonly wallet: UserWalletService,
    private readonly prisma: PrismaService,
    private readonly fees: WalletFeeService,
    private readonly platformAccount: PlatformAccountService,
    private readonly withdrawals: WithdrawalOrchestratorService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  async quoteFee(transactionType: WalletFeeTransactionType, amount: number) {
    return this.fees.calculateFee(transactionType, amount);
  }

  async initiateTopUp(user: User, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant invalide");
    }
    const feeBreakdown = await this.fees.calculateFee(
      WalletFeeTransactionType.deposit,
      amount
    );
    const summary = await this.wallet.getSummary(user.id);
    const init = await this.gateway.initiateTopUp({
      amount: feeBreakdown.amount,
      currency: summary.currency,
      userId: user.id,
      label: "Recharge portefeuille Fermier Pro"
    });
    return {
      providerRef: init.providerRef,
      amount: feeBreakdown.amount,
      feeAmount: feeBreakdown.feeAmount,
      netAmount: feeBreakdown.netAmount,
      currency: summary.currency,
      paymentUrl: init.paymentUrl ?? null
    };
  }

  /** Confirmation asynchrone via webhook GeniusPay (sans JWT utilisateur). */
  async confirmTopUpFromWebhook(
    userId: string,
    amount: number,
    providerRef: string
  ) {
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey: `topup:${providerRef}` }
    });
    if (existing) {
      return { ok: true, idempotent: true };
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("Utilisateur introuvable");
    }
    return this.confirmTopUp(user, amount, providerRef);
  }

  async confirmTopUp(user: User, amount: number, providerRef: string) {
    const summary = await this.wallet.getSummary(user.id);
    const confirmed = await this.gateway.confirmTopUp(
      providerRef,
      user.id,
      amount
    );
    if (!confirmed.success) {
      throw new BadRequestException(
        confirmed.failureReason ?? "Recharge mobile money non confirmée"
      );
    }
    const verifiedAmount = confirmed.verifiedAmount;
    if (
      verifiedAmount == null ||
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0
    ) {
      throw new BadRequestException(
        "Montant de recharge non vérifiable auprès du prestataire"
      );
    }
    const feeBreakdown = await this.fees.calculateFee(
      WalletFeeTransactionType.deposit,
      verifiedAmount
    );
    const entry = await this.wallet.creditTopUp(
      user.id,
      feeBreakdown.netAmount,
      summary.currency,
      providerRef,
      feeBreakdown.feeAmount > 0
        ? `Recharge portefeuille (net après frais ${feeBreakdown.feeAmount} XOF)`
        : "Recharge portefeuille via mobile money",
      `topup:${providerRef}`
    );

    if (feeBreakdown.feeAmount > 0) {
      await this.platformAccount.recordTransferFee(feeBreakdown.feeAmount);
    }
    await this.platformAccount.recordTopUp(feeBreakdown.netAmount);

    return {
      ok: true,
      entry,
      feeAmount: feeBreakdown.feeAmount,
      balance: entry.balanceAfter,
      currency: summary.currency
    };
  }

  initiateWithdraw(user: User, amount: number, phone?: string, clientRequestId?: string) {
    return this.withdrawals.initiateWithdrawal(user, amount, phone, clientRequestId);
  }

  confirmWithdraw(
    user: User,
    amount: number,
    providerRef: string,
    phone?: string,
    withdrawalRequestId?: string
  ) {
    return this.withdrawals.confirmWithdrawal(
      user,
      amount,
      providerRef,
      phone,
      withdrawalRequestId
    );
  }

  async transfer(fromUser: User, dto: WalletTransferDto) {
    const toUserId = await this.resolveTransferTargetUserId(fromUser.id, dto);
    const feeBreakdown = await this.fees.calculateFee(
      WalletFeeTransactionType.transfer,
      dto.amount
    );
    const summary = await this.wallet.getSummary(fromUser.id);
    const idempotencyKey =
      dto.clientRequestId?.trim() || `transfer:${randomUUID()}`;
    const note =
      dto.note?.trim() ||
      (feeBreakdown.isFree
        ? "Transfert portefeuille (gratuit)"
        : `Transfert portefeuille (frais ${feeBreakdown.feeAmount} XOF)`);

    const result = await this.wallet.transfer(
      fromUser.id,
      toUserId,
      dto.amount,
      summary.currency,
      note,
      idempotencyKey,
      feeBreakdown.feeAmount
    );

    if (feeBreakdown.feeAmount > 0) {
      await this.platformAccount.recordTransferFee(feeBreakdown.feeAmount);
    }

    return {
      ok: true,
      debit: result.debit,
      credit: result.credit,
      feeAmount: feeBreakdown.feeAmount,
      totalDebit: feeBreakdown.totalDebit,
      balance: result.debit.balanceAfter,
      currency: summary.currency
    };
  }

  async lookupTransferRecipient(fromUser: User, phone: string) {
    return this.wallet.resolveTransferRecipientByPhone(fromUser.id, phone);
  }

  private async resolveTransferTargetUserId(
    fromUserId: string,
    dto: WalletTransferDto
  ): Promise<string> {
    const directId = dto.toUserId?.trim();
    const phone = dto.recipientPhone?.trim();
    if (directId && phone) {
      throw new BadRequestException(
        "Indiquez soit l'identifiant utilisateur, soit le numéro de téléphone"
      );
    }
    if (directId) {
      if (directId === fromUserId) {
        throw new BadRequestException("Impossible de transférer vers soi-même");
      }
      const user = await this.prisma.user.findUnique({
        where: { id: directId },
        select: { id: true, isActive: true, accountStatus: true }
      });
      if (!user || !user.isActive || user.accountStatus !== "active") {
        throw new NotFoundException("Destinataire introuvable");
      }
      return directId;
    }
    if (phone) {
      const resolved = await this.wallet.resolveTransferRecipientByPhone(
        fromUserId,
        phone
      );
      return resolved.userId;
    }
    throw new BadRequestException(
      "Destinataire requis (numéro de téléphone ou identifiant)"
    );
  }
}
