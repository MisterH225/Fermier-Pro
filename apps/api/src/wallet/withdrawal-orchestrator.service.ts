import { randomUUID } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  WalletFeeTransactionType,
  WithdrawalRequestStatus,
  type User
} from "@prisma/client";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { PrismaService } from "../prisma/prisma.service";
import { PlatformAccountService } from "./platform-account.service";
import { UserWalletService } from "./user-wallet.service";
import { WalletFeeService } from "./wallet-fee.service";

export type WithdrawalRequestDto = {
  id: string;
  status: WithdrawalRequestStatus;
  amountRequested: number;
  feeAmount: number;
  totalDebit: number;
  amountToReceive: number;
  phoneNumber: string;
  createdAt: string;
  requiresApproval: boolean;
};

@Injectable()
export class WithdrawalOrchestratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: UserWalletService,
    private readonly fees: WalletFeeService,
    private readonly platformAccount: PlatformAccountService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  async getAutoApproveThreshold(): Promise<number> {
    const row = await this.prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: { withdrawalAutoApproveThreshold: true }
    });
    const n = Number(row?.withdrawalAutoApproveThreshold ?? 50_000);
    return Number.isFinite(n) && n > 0 ? n : 50_000;
  }

  async initiateWithdrawal(
    user: User,
    amount: number,
    phone?: string,
    clientRequestId?: string
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant invalide");
    }
    if (amount < 100) {
      throw new BadRequestException("Montant minimum : 100 XOF");
    }

    const feeBreakdown = await this.fees.calculateFee(
      WalletFeeTransactionType.withdrawal,
      amount
    );
    const summary = await this.wallet.getSummary(user.id);
    const payoutPhone = phone?.trim() || user.phone?.trim() || null;
    if (!payoutPhone) {
      throw new BadRequestException(
        "Numéro mobile money requis — renseignez votre téléphone sur le profil ou dans la demande."
      );
    }

    await this.wallet.assertSufficientBalance(user.id, feeBreakdown.totalDebit);

    const idempotencyKey =
      clientRequestId?.trim() || `withdraw-init:${randomUUID()}`;
    const existing = await this.prisma.withdrawalRequest.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return this.serializeInitResponse(existing, summary.currency);
    }

    const wallet = await this.wallet.ensureWallet(user.id, summary.currency);
    const threshold = await this.getAutoApproveThreshold();
    const requiresApproval = amount > threshold;

    if (requiresApproval) {
      await this.wallet.lockFundsForWithdrawal(
        user.id,
        feeBreakdown.totalDebit,
        summary.currency
      );
      const request = await this.prisma.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          userId: user.id,
          amountRequested: feeBreakdown.amount,
          feeAmount: feeBreakdown.feeAmount,
          totalDebit: feeBreakdown.totalDebit,
          amountToReceive: feeBreakdown.netAmount,
          phoneNumber: payoutPhone,
          status: WithdrawalRequestStatus.pending_review,
          idempotencyKey
        }
      });
      return {
        requiresApproval: true,
        withdrawalRequestId: request.id,
        status: request.status,
        amount: feeBreakdown.amount,
        feeAmount: feeBreakdown.feeAmount,
        totalDebit: feeBreakdown.totalDebit,
        amountToReceive: feeBreakdown.netAmount,
        currency: summary.currency,
        phone: payoutPhone,
        message:
          "Votre demande de retrait est en attente de validation par l'équipe Fermier Pro."
      };
    }

    await this.wallet.lockFundsForWithdrawal(
      user.id,
      feeBreakdown.totalDebit,
      summary.currency
    );

    try {
      const init = await this.gateway.initiateWithdraw({
        amount: feeBreakdown.netAmount,
        currency: summary.currency,
        userId: user.id,
        phone: payoutPhone,
        label: "Retrait portefeuille Fermier Pro"
      });

      const request = await this.prisma.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          userId: user.id,
          amountRequested: feeBreakdown.amount,
          feeAmount: feeBreakdown.feeAmount,
          totalDebit: feeBreakdown.totalDebit,
          amountToReceive: feeBreakdown.netAmount,
          phoneNumber: payoutPhone,
          status: WithdrawalRequestStatus.processing,
          providerRef: init.providerRef,
          idempotencyKey
        }
      });

      return {
        requiresApproval: false,
        withdrawalRequestId: request.id,
        providerRef: init.providerRef,
        amount: feeBreakdown.amount,
        feeAmount: feeBreakdown.feeAmount,
        totalDebit: feeBreakdown.totalDebit,
        amountToReceive: feeBreakdown.netAmount,
        currency: summary.currency,
        phone: payoutPhone,
        paymentUrl: init.paymentUrl ?? null
      };
    } catch (error) {
      await this.wallet.releaseWithdrawalLock(
        user.id,
        feeBreakdown.totalDebit,
        summary.currency,
        "Échec initiation retrait — fonds débloqués",
        `withdraw-init-release:${idempotencyKey}`
      );
      throw error;
    }
  }

  async confirmWithdrawal(
    user: User,
    amount: number,
    providerRef: string,
    phone?: string,
    withdrawalRequestId?: string
  ) {
    const request = await this.findProcessingRequest(
      user.id,
      withdrawalRequestId,
      providerRef
    );
    const amountRequested = Number(request.amountRequested);
    const feeAmount = Number(request.feeAmount);
    const totalDebit = Number(request.totalDebit);
    const netAmount = Number(request.amountToReceive);

    if (amount !== amountRequested) {
      throw new BadRequestException("Montant incohérent avec la demande de retrait");
    }

    const summary = await this.wallet.getSummary(user.id);

    const confirmed = await this.gateway.confirmWithdraw(
      providerRef,
      user.id,
      netAmount
    );
    if (!confirmed.success) {
      await this.wallet.releaseWithdrawalLock(
        user.id,
        totalDebit,
        summary.currency,
        confirmed.failureReason ?? "Retrait mobile money non confirmé",
        `withdraw-release:${providerRef}`
      );
      await this.prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: WithdrawalRequestStatus.failed,
          failureReason:
            confirmed.failureReason ?? "Retrait mobile money non confirmé"
        }
      });
      throw new BadRequestException(
        confirmed.failureReason ?? "Retrait mobile money non confirmé"
      );
    }

    const result = await this.wallet.completeWithdrawalFromLock(
      user.id,
      amountRequested,
      feeAmount,
      summary.currency,
      providerRef,
      phone?.trim()
        ? `Retrait vers ${phone.trim()}`
        : "Retrait portefeuille vers mobile money",
      `withdraw:${providerRef}`
    );

    await this.platformAccount.recordWithdrawalCompleted(
      netAmount,
      totalDebit,
      feeAmount
    );

    await this.prisma.withdrawalRequest.update({
      where: { id: request.id },
      data: {
        status: WithdrawalRequestStatus.completed,
        providerRef
      }
    });

    return {
      ok: true,
      entry: result.withdraw,
      feeAmount,
      balance: result.withdraw.balanceAfter,
      currency: summary.currency
    };
  }

  async listForAdmin(status?: WithdrawalRequestStatus) {
    const rows = await this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      }
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      amountRequested: Number(row.amountRequested),
      feeAmount: Number(row.feeAmount),
      totalDebit: Number(row.totalDebit),
      amountToReceive: Number(row.amountToReceive),
      phoneNumber: row.phoneNumber,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
      user: {
        id: row.user.id,
        displayName:
          row.user.fullName?.trim() ||
          [row.user.firstName, row.user.lastName].filter(Boolean).join(" ") ||
          row.user.id,
        phone: row.user.phone
      }
    }));
  }

  async approveWithdrawal(adminUserId: string, requestId: string) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) {
      throw new NotFoundException("Demande de retrait introuvable");
    }
    if (request.status !== WithdrawalRequestStatus.pending_review) {
      throw new BadRequestException("Cette demande n'est pas en attente de validation");
    }

    const account = await this.platformAccount.ensureAccount();
    if (Number(account.aggregatorBalance) < Number(request.amountToReceive)) {
      throw new BadRequestException(
        "Liquidité plateforme insuffisante — réessayez plus tard"
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: request.userId }
    });
    const summary = await this.wallet.getSummary(user.id);

    await this.prisma.withdrawalRequest.update({
      where: { id: request.id },
      data: {
        status: WithdrawalRequestStatus.processing,
        reviewedBy: adminUserId,
        reviewedAt: new Date()
      }
    });

    try {
      const init = await this.gateway.initiateWithdraw({
        amount: Number(request.amountToReceive),
        currency: summary.currency,
        userId: user.id,
        phone: request.phoneNumber,
        label: "Retrait portefeuille Fermier Pro (validé)"
      });
      const confirmed = await this.gateway.confirmWithdraw(
        init.providerRef,
        user.id,
        Number(request.amountToReceive)
      );
      if (!confirmed.success) {
        throw new BadRequestException(
          confirmed.failureReason ?? "Échec du paiement mobile money"
        );
      }

      const result = await this.wallet.completeWithdrawalFromLock(
        user.id,
        Number(request.amountRequested),
        Number(request.feeAmount),
        summary.currency,
        init.providerRef,
        `Retrait validé vers ${request.phoneNumber}`,
        `withdraw-approved:${request.id}`
      );

      await this.platformAccount.recordWithdrawalCompleted(
        Number(request.amountToReceive),
        Number(request.totalDebit),
        Number(request.feeAmount)
      );

      await this.prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: WithdrawalRequestStatus.completed,
          providerRef: init.providerRef
        }
      });

      return { ok: true, requestId: request.id, entry: result.withdraw };
    } catch (error) {
      await this.prisma.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          status: WithdrawalRequestStatus.failed,
          failureReason:
            error instanceof Error ? error.message : "Échec du retrait"
        }
      });
      throw error;
    }
  }

  async rejectWithdrawal(
    adminUserId: string,
    requestId: string,
    reason: string
  ) {
    const request = await this.prisma.withdrawalRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) {
      throw new NotFoundException("Demande de retrait introuvable");
    }
    if (request.status !== WithdrawalRequestStatus.pending_review) {
      throw new BadRequestException("Cette demande n'est pas en attente de validation");
    }

    const summary = await this.wallet.getSummary(request.userId);
    await this.wallet.releaseWithdrawalLock(
      request.userId,
      Number(request.totalDebit),
      summary.currency,
      reason.trim() || "Retrait refusé par l'administration",
      `withdraw-reject:${request.id}`
    );

    await this.prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: WithdrawalRequestStatus.rejected,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        rejectionReason: reason.trim() || "Refusé par l'administration"
      }
    });

    return { ok: true, requestId };
  }

  private async findProcessingRequest(
    userId: string,
    withdrawalRequestId: string | undefined,
    providerRef: string
  ) {
    if (withdrawalRequestId) {
      const byId = await this.prisma.withdrawalRequest.findFirst({
        where: {
          id: withdrawalRequestId,
          userId,
          status: WithdrawalRequestStatus.processing
        }
      });
      if (byId) {
        return byId;
      }
    }
    const byRef = await this.prisma.withdrawalRequest.findFirst({
      where: {
        userId,
        providerRef,
        status: WithdrawalRequestStatus.processing
      }
    });
    if (!byRef) {
      throw new NotFoundException("Demande de retrait en cours introuvable");
    }
    return byRef;
  }

  private serializeInitResponse(
    request: {
      id: string;
      status: WithdrawalRequestStatus;
      amountRequested: Prisma.Decimal;
      feeAmount: Prisma.Decimal;
      totalDebit: Prisma.Decimal;
      amountToReceive: Prisma.Decimal;
      phoneNumber: string;
      providerRef: string | null;
      createdAt: Date;
    },
    currency: string
  ) {
    const requiresApproval =
      request.status === WithdrawalRequestStatus.pending_review;
    return {
      requiresApproval,
      withdrawalRequestId: request.id,
      status: request.status,
      providerRef: request.providerRef,
      amount: Number(request.amountRequested),
      feeAmount: Number(request.feeAmount),
      totalDebit: Number(request.totalDebit),
      amountToReceive: Number(request.amountToReceive),
      currency,
      phone: request.phoneNumber,
      ...(requiresApproval
        ? {
            message:
              "Votre demande de retrait est en attente de validation par l'équipe Fermier Pro."
          }
        : {})
    };
  }
}
