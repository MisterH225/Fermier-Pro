import { Injectable } from "@nestjs/common";
import {
  WalletFeeConfig,
  WalletFeeTransactionType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type WalletFeeBreakdown = {
  transactionType: WalletFeeTransactionType;
  amount: number;
  feeAmount: number;
  netAmount: number;
  totalDebit: number;
  isFree: boolean;
};

export type WalletFeeConfigDto = {
  transactionType: WalletFeeTransactionType;
  feePercentage: number;
  feeFixed: number;
  minFee: number;
  maxFee: number | null;
  isActive: boolean;
};

export type UpdateWalletFeeConfigDto = {
  feePercentage?: number;
  feeFixed?: number;
  minFee?: number;
  maxFee?: number | null;
  isActive?: boolean;
};

const DEFAULT_CONFIGS: WalletFeeConfigDto[] = [
  {
    transactionType: WalletFeeTransactionType.deposit,
    feePercentage: 0,
    feeFixed: 0,
    minFee: 0,
    maxFee: null,
    isActive: true
  },
  {
    transactionType: WalletFeeTransactionType.withdrawal,
    feePercentage: 0,
    feeFixed: 0,
    minFee: 0,
    maxFee: null,
    isActive: true
  },
  {
    transactionType: WalletFeeTransactionType.transfer,
    feePercentage: 0,
    feeFixed: 0,
    minFee: 0,
    maxFee: null,
    isActive: true
  }
];

@Injectable()
export class WalletFeeService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(): Promise<void> {
    for (const cfg of DEFAULT_CONFIGS) {
      await this.prisma.walletFeeConfig.upsert({
        where: { transactionType: cfg.transactionType },
        create: {
          id: `fee_${cfg.transactionType}`,
          transactionType: cfg.transactionType,
          feePercentage: cfg.feePercentage,
          feeFixed: cfg.feeFixed,
          minFee: cfg.minFee,
          maxFee: cfg.maxFee,
          isActive: cfg.isActive
        },
        update: {}
      });
    }
  }

  async listConfigs(): Promise<WalletFeeConfigDto[]> {
    await this.ensureDefaults();
    const rows = await this.prisma.walletFeeConfig.findMany({
      orderBy: { transactionType: "asc" }
    });
    return rows.map((row) => this.serialize(row));
  }

  async updateConfig(
    transactionType: WalletFeeTransactionType,
    dto: UpdateWalletFeeConfigDto
  ): Promise<WalletFeeConfigDto> {
    await this.ensureDefaults();
    const row = await this.prisma.walletFeeConfig.update({
      where: { transactionType },
      data: {
        ...(dto.feePercentage !== undefined
          ? { feePercentage: dto.feePercentage }
          : {}),
        ...(dto.feeFixed !== undefined ? { feeFixed: dto.feeFixed } : {}),
        ...(dto.minFee !== undefined ? { minFee: dto.minFee } : {}),
        ...(dto.maxFee !== undefined ? { maxFee: dto.maxFee } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {})
      }
    });
    return this.serialize(row);
  }

  async calculateFee(
    transactionType: WalletFeeTransactionType,
    amount: number
  ): Promise<WalletFeeBreakdown> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        transactionType,
        amount,
        feeAmount: 0,
        netAmount: amount,
        totalDebit: amount,
        isFree: true
      };
    }

    await this.ensureDefaults();
    const config = await this.prisma.walletFeeConfig.findUnique({
      where: { transactionType }
    });
    if (!config || !config.isActive) {
      return {
        transactionType,
        amount,
        feeAmount: 0,
        netAmount: amount,
        totalDebit: amount,
        isFree: true
      };
    }

    const pct = Number(config.feePercentage);
    const fixed = Number(config.feeFixed);
    const minFee = Number(config.minFee);
    const maxFee =
      config.maxFee != null ? Number(config.maxFee) : Number.POSITIVE_INFINITY;

    let fee = amount * pct + fixed;
    if (minFee > 0) {
      fee = Math.max(fee, minFee);
    }
    if (Number.isFinite(maxFee)) {
      fee = Math.min(fee, maxFee);
    }
    fee = Math.round(fee);

    const feeAmount = fee > 0 ? fee : 0;
    const isFree = feeAmount === 0;

    if (transactionType === WalletFeeTransactionType.deposit) {
      return {
        transactionType,
        amount,
        feeAmount,
        netAmount: amount - feeAmount,
        totalDebit: amount,
        isFree
      };
    }

    return {
      transactionType,
      amount,
      feeAmount,
      netAmount: amount,
      totalDebit: amount + feeAmount,
      isFree
    };
  }

  private serialize(row: WalletFeeConfig): WalletFeeConfigDto {
    return {
      transactionType: row.transactionType,
      feePercentage: Number(row.feePercentage),
      feeFixed: Number(row.feeFixed),
      minFee: Number(row.minFee),
      maxFee: row.maxFee != null ? Number(row.maxFee) : null,
      isActive: row.isActive
    };
  }
}
