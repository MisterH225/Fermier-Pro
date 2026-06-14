import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BuyerWalletEntryKind,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_CURRENCY = "XOF";
const WALLET_REF_PREFIX = "wallet:";
const WALLET_PENDING_PREFIX = "wallet:pending:";

export type WalletSummary = {
  balance: number;
  currency: string;
  monthCredits: number;
  monthDebits: number;
};

export type WalletEntryDto = {
  id: string;
  kind: BuyerWalletEntryKind;
  amount: number;
  balanceAfter: number;
  currency: string;
  transactionId: string | null;
  note: string | null;
  createdAt: string;
};

@Injectable()
export class BuyerWalletService {
  constructor(private readonly prisma: PrismaService) {}

  walletProviderRef(entryId: string): string {
    return `${WALLET_REF_PREFIX}${entryId}`;
  }

  isWalletProviderRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(WALLET_REF_PREFIX));
  }

  walletPendingRef(transactionId: string): string {
    return `${WALLET_PENDING_PREFIX}${transactionId}`;
  }

  isWalletPendingRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(WALLET_PENDING_PREFIX));
  }

  async assertSufficientBalance(userId: string, amount: number): Promise<void> {
    const wallet = await this.ensureWallet(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        "Solde insuffisant — utilisez mobile money ou attendez un remboursement escrow."
      );
    }
  }

  async ensureWallet(userId: string, currency = DEFAULT_CURRENCY) {
    return this.prisma.buyerWallet.upsert({
      where: { userId },
      create: { userId, currency },
      update: {}
    });
  }

  async getSummary(userId: string): Promise<WalletSummary> {
    const wallet = await this.ensureWallet(userId);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const monthEntries = await this.prisma.buyerWalletEntry.findMany({
      where: {
        walletId: wallet.id,
        createdAt: { gte: monthStart }
      },
      select: { kind: true, amount: true }
    });

    let monthCredits = 0;
    let monthDebits = 0;
    for (const e of monthEntries) {
      const n = Number(e.amount);
      if (
        e.kind === BuyerWalletEntryKind.credit_refund ||
        e.kind === BuyerWalletEntryKind.credit_adjustment
      ) {
        monthCredits += n;
      } else {
        monthDebits += n;
      }
    }

    return {
      balance: Number(wallet.balance),
      currency: wallet.currency,
      monthCredits,
      monthDebits
    };
  }

  async listEntries(
    userId: string,
    opts?: { limit?: number; cursor?: string }
  ): Promise<{ entries: WalletEntryDto[]; nextCursor: string | null }> {
    const wallet = await this.ensureWallet(userId);
    const limit = Math.min(opts?.limit ?? 50, 100);
    const rows = await this.prisma.buyerWalletEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(opts?.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1
          }
        : {})
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      entries: page.map((r) => this.serializeEntry(r)),
      nextCursor: hasMore ? page[page.length - 1]!.id : null
    };
  }

  async creditRefund(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string,
    idempotencyKey?: string
  ): Promise<WalletEntryDto> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant de crédit invalide");
    }
    if (idempotencyKey) {
      const existing = await this.prisma.buyerWalletEntry.findUnique({
        where: { idempotencyKey }
      });
      if (existing) {
        return this.serializeEntry(existing);
      }
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.buyerWallet.upsert({
        where: { userId },
        create: { userId, currency },
        update: {}
      });
      const balanceAfter = Number(wallet.balance) + amount;
      const updated = await tx.buyerWallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(balanceAfter) }
      });
      return tx.buyerWalletEntry.create({
        data: {
          walletId: updated.id,
          kind: BuyerWalletEntryKind.credit_refund,
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(balanceAfter),
          currency,
          transactionId,
          note,
          idempotencyKey
        }
      });
    });
    return this.serializeEntry(entry);
  }

  async debitForEscrowHold(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant de débit invalide");
    }
    const idempotencyKey = `escrow-hold:${transactionId}`;
    const existing = await this.prisma.buyerWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.buyerWallet.upsert({
        where: { userId },
        create: { userId, currency },
        update: {}
      });
      const current = Number(wallet.balance);
      if (current < amount) {
        throw new BadRequestException(
          "Solde insuffisant — utilisez mobile money ou attendez un remboursement escrow."
        );
      }
      const balanceAfter = current - amount;
      await tx.buyerWallet.update({
        where: { id: wallet.id },
        data: { balance: new Prisma.Decimal(balanceAfter) }
      });
      return tx.buyerWalletEntry.create({
        data: {
          walletId: wallet.id,
          kind: BuyerWalletEntryKind.debit_escrow_hold,
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(balanceAfter),
          currency,
          transactionId,
          note,
          idempotencyKey
        }
      });
    });
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  async confirmPendingHold(
    providerRef: string,
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string
  ): Promise<string> {
    if (!this.isWalletPendingRef(providerRef)) {
      throw new BadRequestException("Référence portefeuille en attente invalide");
    }
    const txId = providerRef.slice(WALLET_PENDING_PREFIX.length);
    if (txId !== transactionId) {
      throw new BadRequestException("Référence portefeuille invalide pour cette transaction");
    }
    const hold = await this.debitForEscrowHold(
      userId,
      amount,
      currency,
      transactionId,
      note
    );
    return hold.providerRef;
  }

  async requireWalletEntryForRef(
    providerRef: string,
    transactionId: string
  ): Promise<void> {
    if (!this.isWalletProviderRef(providerRef)) {
      throw new NotFoundException("Référence portefeuille invalide");
    }
    const entryId = providerRef.slice(WALLET_REF_PREFIX.length);
    const entry = await this.prisma.buyerWalletEntry.findUnique({
      where: { id: entryId }
    });
    if (!entry || entry.transactionId !== transactionId) {
      throw new BadRequestException("Paiement portefeuille introuvable pour cette transaction");
    }
  }

  private serializeEntry(row: {
    id: string;
    kind: BuyerWalletEntryKind;
    amount: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    currency: string;
    transactionId: string | null;
    note: string | null;
    createdAt: Date;
  }): WalletEntryDto {
    return {
      id: row.id,
      kind: row.kind,
      amount: Number(row.amount),
      balanceAfter: Number(row.balanceAfter),
      currency: row.currency,
      transactionId: row.transactionId,
      note: row.note,
      createdAt: row.createdAt.toISOString()
    };
  }
}
