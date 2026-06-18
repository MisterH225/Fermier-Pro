import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type PlatformAccountView = {
  id: string;
  aggregatorBalance: number;
  totalVirtualBalance: number;
  platformFeeBalance: number;
  lastReconciliationAt: string | null;
  reconciliationStatus: string;
  walletsSum: number;
  difference: number;
  isBalanced: boolean;
};

@Injectable()
export class PlatformAccountService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAccount() {
    return this.prisma.platformAccount.upsert({
      where: { id: "main" },
      create: { id: "main" },
      update: {}
    });
  }

  async recordTopUp(netAmount: number): Promise<void> {
    if (netAmount <= 0) {
      return;
    }
    await this.ensureAccount();
    await this.prisma.platformAccount.update({
      where: { id: "main" },
      data: {
        aggregatorBalance: { increment: netAmount },
        totalVirtualBalance: { increment: netAmount }
      }
    });
  }

  async recordWithdrawalCompleted(
    amountToReceive: number,
    totalVirtualDebit: number,
    feeAmount: number
  ): Promise<void> {
    await this.ensureAccount();
    await this.prisma.platformAccount.update({
      where: { id: "main" },
      data: {
        aggregatorBalance: { decrement: amountToReceive },
        totalVirtualBalance: { decrement: totalVirtualDebit },
        ...(feeAmount > 0
          ? { platformFeeBalance: { increment: feeAmount } }
          : {})
      }
    });
  }

  async recordTransferFee(feeAmount: number): Promise<void> {
    if (feeAmount <= 0) {
      return;
    }
    await this.ensureAccount();
    await this.prisma.platformAccount.update({
      where: { id: "main" },
      data: {
        platformFeeBalance: { increment: feeAmount }
      }
    });
  }

  async reconcile(): Promise<PlatformAccountView> {
    await this.ensureAccount();
    const [account, walletsAgg] = await Promise.all([
      this.prisma.platformAccount.findUniqueOrThrow({
        where: { id: "main" }
      }),
      this.prisma.userWallet.aggregate({
        _sum: {
          balance: true,
          pendingBalance: true
        }
      })
    ]);

    const walletsSum =
      Number(walletsAgg._sum.balance ?? 0) +
      Number(walletsAgg._sum.pendingBalance ?? 0);
    const aggregatorBalance = Number(account.aggregatorBalance);
    const difference = aggregatorBalance - walletsSum;
    const isBalanced = Math.abs(difference) < 1;

    const updated = await this.prisma.platformAccount.update({
      where: { id: "main" },
      data: {
        totalVirtualBalance: new Prisma.Decimal(walletsSum),
        lastReconciliationAt: new Date(),
        reconciliationStatus: isBalanced ? "ok" : "discrepancy"
      }
    });

    return {
      id: updated.id,
      aggregatorBalance: Number(updated.aggregatorBalance),
      totalVirtualBalance: Number(updated.totalVirtualBalance),
      platformFeeBalance: Number(updated.platformFeeBalance),
      lastReconciliationAt: updated.lastReconciliationAt?.toISOString() ?? null,
      reconciliationStatus: updated.reconciliationStatus,
      walletsSum,
      difference,
      isBalanced
    };
  }

  async getView(): Promise<PlatformAccountView> {
    return this.reconcile();
  }
}
