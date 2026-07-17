import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, UserWalletEntryKind } from "@prisma/client";
import {
  maskFullName,
  maskPhone,
  normalizePhone
} from "../invitations/identifier-utils";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_CURRENCY = "XOF";
const WALLET_REF_PREFIX = "wallet:";
const WALLET_PENDING_PREFIX = "wallet:pending:";
const TOPUP_PENDING_PREFIX = "wallet:topup-pending:";
const WITHDRAW_PENDING_PREFIX = "wallet:withdraw-pending:";
const VET_PENDING_PREFIX = "wallet:vet-pending:";
const MERCHANT_PENDING_PREFIX = "wallet:merchant-pending:";

export type WalletSummary = {
  balance: number;
  pendingBalance: number;
  availableBalance: number;
  currency: string;
  monthCredits: number;
  monthDebits: number;
};

export type WalletEntryDto = {
  id: string;
  kind: UserWalletEntryKind;
  amount: number;
  balanceAfter: number;
  currency: string;
  transactionId: string | null;
  counterpartyUserId: string | null;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
};

const CREDIT_KINDS: ReadonlySet<UserWalletEntryKind> = new Set([
  UserWalletEntryKind.credit_topup,
  UserWalletEntryKind.credit_transfer,
  UserWalletEntryKind.credit_escrow_release,
  UserWalletEntryKind.credit_refund,
  UserWalletEntryKind.credit_adjustment
]);

export type WalletTransferRecipientDto = {
  userId: string;
  displayName: string;
  phoneMasked: string;
};

@Injectable()
export class UserWalletService {
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

  topUpPendingRef(userId: string): string {
    return `${TOPUP_PENDING_PREFIX}${userId}`;
  }

  isTopUpPendingRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(TOPUP_PENDING_PREFIX));
  }

  withdrawPendingRef(userId: string, amount: number): string {
    return `${WITHDRAW_PENDING_PREFIX}${userId}:${amount}`;
  }

  isWithdrawPendingRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(WITHDRAW_PENDING_PREFIX));
  }

  vetWalletPendingRef(appointmentId: string): string {
    return `${VET_PENDING_PREFIX}${appointmentId}`;
  }

  isVetWalletPendingRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(VET_PENDING_PREFIX));
  }

  async resolveTransferRecipientByPhone(
    requesterUserId: string,
    phoneRaw: string
  ): Promise<WalletTransferRecipientDto> {
    const normalized = normalizePhone(phoneRaw.trim());
    if (!normalized) {
      throw new BadRequestException("Numéro de téléphone invalide");
    }
    const user = await this.prisma.user.findUnique({
      where: { phone: normalized },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        accountStatus: true
      }
    });
    if (!user || !user.isActive || user.accountStatus !== "active") {
      throw new NotFoundException(
        "Aucun compte actif trouvé pour ce numéro de téléphone"
      );
    }
    if (user.id === requesterUserId) {
      throw new BadRequestException(
        "Impossible de transférer vers votre propre numéro"
      );
    }
    const displayName =
      user.fullName?.trim() ||
      maskFullName(user.firstName, user.lastName) ||
      "Utilisateur Fermier Pro";
    return {
      userId: user.id,
      displayName,
      phoneMasked: maskPhone(user.phone ?? normalized)
    };
  }

  async assertSufficientBalance(userId: string, amount: number): Promise<void> {
    const wallet = await this.ensureWallet(userId);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException(
        "Solde insuffisant — rechargez votre portefeuille ou utilisez mobile money."
      );
    }
  }

  async ensureWallet(userId: string, currency = DEFAULT_CURRENCY) {
    return this.prisma.userWallet.upsert({
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

    const monthEntries = await this.prisma.userWalletEntry.findMany({
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
      if (CREDIT_KINDS.has(e.kind)) {
        monthCredits += n;
      } else {
        monthDebits += n;
      }
    }

    return {
      balance: Number(wallet.balance),
      pendingBalance: Number(wallet.pendingBalance),
      availableBalance: Number(wallet.balance),
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
    const rows = await this.prisma.userWalletEntry.findMany({
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

  async creditTopUp(
    userId: string,
    amount: number,
    currency: string,
    providerRef: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_topup,
      note,
      idempotencyKey,
      { providerRef }
    );
  }

  async debitWithdraw(
    userId: string,
    amount: number,
    currency: string,
    providerRef: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    return this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_withdraw,
      note,
      idempotencyKey,
      { providerRef }
    );
  }

  async debitFee(
    userId: string,
    amount: number,
    currency: string,
    note: string,
    idempotencyKey: string,
    providerRef?: string
  ): Promise<WalletEntryDto> {
    return this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_fee,
      note,
      idempotencyKey,
      { providerRef }
    );
  }

  async creditEscrowRelease(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_escrow_release,
      note,
      idempotencyKey,
      { transactionId }
    );
  }

  async creditRefund(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string,
    idempotencyKey?: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_refund,
      note,
      idempotencyKey ?? `refund:${transactionId}:${amount}`,
      { transactionId }
    );
  }

  async transfer(
    fromUserId: string,
    toUserId: string,
    amount: number,
    currency: string,
    note: string,
    idempotencyKey: string,
    feeAmount = 0
  ): Promise<{ debit: WalletEntryDto; credit: WalletEntryDto; fee?: WalletEntryDto }> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant de transfert invalide");
    }
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      throw new BadRequestException("Frais de transfert invalides");
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException("Impossible de transférer vers soi-même");
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true }
    });
    if (!recipient) {
      throw new NotFoundException("Destinataire introuvable");
    }

    const totalDebit = amount + feeAmount;
    const existingDebit = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existingDebit) {
      const credit = await this.prisma.userWalletEntry.findFirst({
        where: {
          idempotencyKey: `${idempotencyKey}:credit`,
          kind: UserWalletEntryKind.credit_transfer
        }
      });
      const fee = feeAmount
        ? await this.prisma.userWalletEntry.findFirst({
            where: {
              idempotencyKey: `${idempotencyKey}:fee`,
              kind: UserWalletEntryKind.debit_fee
            }
          })
        : null;
      if (credit) {
        return {
          debit: this.serializeEntry(existingDebit),
          credit: this.serializeEntry(credit),
          ...(fee ? { fee: this.serializeEntry(fee) } : {})
        };
      }
    }

    const transferNote = note.trim() || (feeAmount > 0 ? "Transfert portefeuille" : "Transfert portefeuille (gratuit)");

    return this.prisma.$transaction(async (tx) => {
      const fromWallet = await tx.userWallet.upsert({
        where: { userId: fromUserId },
        create: { userId: fromUserId, currency },
        update: {}
      });
      const debited = await tx.userWallet.updateMany({
        where: {
          id: fromWallet.id,
          balance: { gte: totalDebit }
        },
        data: { balance: { decrement: totalDebit } }
      });
      if (debited.count === 0) {
        throw new BadRequestException("Solde insuffisant pour ce transfert");
      }
      const fromAfter = Number(fromWallet.balance) - totalDebit;
      const fromAfterTransfer = fromAfter + feeAmount;
      const debitEntry = await tx.userWalletEntry.create({
        data: {
          walletId: fromWallet.id,
          kind: UserWalletEntryKind.debit_transfer,
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(fromAfterTransfer),
          currency,
          counterpartyUserId: toUserId,
          note: transferNote,
          idempotencyKey
        }
      });

      let feeEntry: WalletEntryDto | undefined;
      if (feeAmount > 0) {
        const feeRow = await tx.userWalletEntry.create({
          data: {
            walletId: fromWallet.id,
            kind: UserWalletEntryKind.debit_fee,
            amount: new Prisma.Decimal(feeAmount),
            balanceAfter: new Prisma.Decimal(fromAfter),
            currency,
            counterpartyUserId: toUserId,
            note: "Frais de transfert portefeuille",
            idempotencyKey: `${idempotencyKey}:fee`
          }
        });
        feeEntry = this.serializeEntry(feeRow);
      }

      const toWallet = await tx.userWallet.upsert({
        where: { userId: toUserId },
        create: { userId: toUserId, currency },
        update: {}
      });
      await tx.userWallet.update({
        where: { id: toWallet.id },
        data: { balance: { increment: amount } }
      });
      const toAfter = Number(toWallet.balance) + amount;
      const creditEntry = await tx.userWalletEntry.create({
        data: {
          walletId: toWallet.id,
          kind: UserWalletEntryKind.credit_transfer,
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(toAfter),
          currency,
          counterpartyUserId: fromUserId,
          note: transferNote,
          idempotencyKey: `${idempotencyKey}:credit`
        }
      });

      return {
        debit: this.serializeEntry(debitEntry),
        credit: this.serializeEntry(creditEntry),
        ...(feeEntry ? { fee: feeEntry } : {})
      };
    });
  }

  async lockFundsForWithdrawal(
    userId: string,
    totalDebit: number,
    currency: string
  ): Promise<void> {
    if (!Number.isFinite(totalDebit) || totalDebit <= 0) {
      throw new BadRequestException("Montant de blocage invalide");
    }
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.upsert({
        where: { userId },
        create: { userId, currency },
        update: {}
      });
      const locked = await tx.userWallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: totalDebit }
        },
        data: {
          balance: { decrement: totalDebit },
          pendingBalance: { increment: totalDebit }
        }
      });
      if (locked.count === 0) {
        throw new BadRequestException("Solde insuffisant pour ce retrait");
      }
    });
  }

  async releaseWithdrawalLock(
    userId: string,
    totalDebit: number,
    currency: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return this.serializeEntry(existing);
    }
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUniqueOrThrow({
        where: { userId }
      });
      const pending = Number(wallet.pendingBalance);
      if (pending < totalDebit) {
        throw new BadRequestException("Fonds bloqués insuffisants");
      }
      const balanceAfter = Number(wallet.balance) + totalDebit;
      await tx.userWallet.update({
        where: { id: wallet.id },
        data: {
          balance: new Prisma.Decimal(balanceAfter),
          pendingBalance: new Prisma.Decimal(pending - totalDebit)
        }
      });
      const entry = await tx.userWalletEntry.create({
        data: {
          walletId: wallet.id,
          kind: UserWalletEntryKind.credit_adjustment,
          amount: new Prisma.Decimal(totalDebit),
          balanceAfter: new Prisma.Decimal(balanceAfter),
          currency,
          note,
          idempotencyKey
        }
      });
      return this.serializeEntry(entry);
    });
  }

  async completeWithdrawalFromLock(
    userId: string,
    amount: number,
    feeAmount: number,
    currency: string,
    providerRef: string,
    note: string,
    idempotencyKey: string
  ): Promise<{ withdraw: WalletEntryDto; fee?: WalletEntryDto }> {
    const totalDebit = amount + feeAmount;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      const fee = feeAmount
        ? await this.prisma.userWalletEntry.findFirst({
            where: {
              idempotencyKey: `${idempotencyKey}:fee`,
              kind: UserWalletEntryKind.debit_fee
            }
          })
        : null;
      return {
        withdraw: this.serializeEntry(existing),
        ...(fee ? { fee: this.serializeEntry(fee) } : {})
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.userWallet.findUniqueOrThrow({
        where: { userId }
      });
      const pending = Number(wallet.pendingBalance);
      if (pending < totalDebit) {
        throw new BadRequestException("Fonds bloqués insuffisants pour finaliser le retrait");
      }
      await tx.userWallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: new Prisma.Decimal(pending - totalDebit)
        }
      });

      const finalBalance = Number(wallet.balance);
      const balanceAfterWithdraw =
        feeAmount > 0 ? finalBalance + feeAmount : finalBalance;

      const withdrawEntry = await tx.userWalletEntry.create({
        data: {
          walletId: wallet.id,
          kind: UserWalletEntryKind.debit_withdraw,
          amount: new Prisma.Decimal(amount),
          balanceAfter: new Prisma.Decimal(balanceAfterWithdraw),
          currency,
          providerRef,
          note,
          idempotencyKey
        }
      });

      let feeEntry: WalletEntryDto | undefined;
      if (feeAmount > 0) {
        const feeRow = await tx.userWalletEntry.create({
          data: {
            walletId: wallet.id,
            kind: UserWalletEntryKind.debit_fee,
            amount: new Prisma.Decimal(feeAmount),
            balanceAfter: new Prisma.Decimal(finalBalance),
            currency,
            providerRef,
            note: "Frais de retrait portefeuille",
            idempotencyKey: `${idempotencyKey}:fee`
          }
        });
        feeEntry = this.serializeEntry(feeRow);
      }

      return {
        withdraw: this.serializeEntry(withdrawEntry),
        ...(feeEntry ? { fee: feeEntry } : {})
      };
    });
  }

  async debitForEscrowHold(
    userId: string,
    amount: number,
    currency: string,
    transactionId: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    const idempotencyKey = `escrow-hold:${transactionId}`;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_escrow_hold,
      note,
      idempotencyKey,
      { transactionId }
    );
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  merchantPendingRef(orderId: string): string {
    return `${MERCHANT_PENDING_PREFIX}${orderId}`;
  }

  isMerchantWalletPendingRef(providerRef: string | null | undefined): boolean {
    return Boolean(providerRef?.startsWith(MERCHANT_PENDING_PREFIX));
  }

  async debitForMerchantHold(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    const idempotencyKey = `merchant-hold:${orderId}`;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_escrow_hold,
      note,
      idempotencyKey,
      { merchantOrderId: orderId }
    );
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  async debitForMerchantSubscription(
    userId: string,
    amount: number,
    currency: string,
    reference: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    const idempotencyKey = `merchant-subscription:${reference}`;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_fee,
      note,
      idempotencyKey,
      { providerRef: reference }
    );
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  async debitForProducerSubscription(
    userId: string,
    amount: number,
    currency: string,
    reference: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    const idempotencyKey = `producer-subscription:${reference}`;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_fee,
      note,
      idempotencyKey,
      { providerRef: reference }
    );
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  async creditMerchantPayout(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    buyerUserId: string,
    note: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_escrow_release,
      note,
      `merchant-payout:${orderId}`,
      { merchantOrderId: orderId, counterpartyUserId: buyerUserId }
    );
  }

  async creditMerchantOrderRefund(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    note: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_refund,
      note,
      `merchant-refund:${orderId}`,
      { merchantOrderId: orderId }
    );
  }

  /**
   * Clawback litige post-completed : récupère le net versé au commerçant
   * pour rembourser l’acheteur (les commissions plateforme sont annulées à part).
   */
  async debitMerchantClawback(
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    buyerUserId: string,
    note: string
  ): Promise<WalletEntryDto> {
    return this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_adjustment,
      note,
      `merchant-clawback:${orderId}`,
      { merchantOrderId: orderId, counterpartyUserId: buyerUserId }
    );
  }

  async debitForVetHold(
    userId: string,
    amount: number,
    currency: string,
    appointmentId: string,
    note: string
  ): Promise<{ providerRef: string; entryId: string }> {
    const idempotencyKey = `vet-hold:${appointmentId}`;
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return {
        providerRef: this.walletProviderRef(existing.id),
        entryId: existing.id
      };
    }
    const entry = await this.debit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.debit_escrow_hold,
      note,
      idempotencyKey,
      { vetAppointmentId: appointmentId }
    );
    return {
      providerRef: this.walletProviderRef(entry.id),
      entryId: entry.id
    };
  }

  async confirmVetPendingHold(
    providerRef: string,
    userId: string,
    amount: number,
    currency: string,
    appointmentId: string,
    note: string
  ): Promise<string> {
    if (!this.isVetWalletPendingRef(providerRef)) {
      throw new BadRequestException("Référence portefeuille RDV invalide");
    }
    const apptId = providerRef.slice(VET_PENDING_PREFIX.length);
    if (apptId !== appointmentId) {
      throw new BadRequestException("Référence portefeuille invalide pour ce RDV");
    }
    const hold = await this.debitForVetHold(
      userId,
      amount,
      currency,
      appointmentId,
      note
    );
    return hold.providerRef;
  }

  async confirmMerchantPendingHold(
    providerRef: string,
    userId: string,
    amount: number,
    currency: string,
    orderId: string,
    note: string
  ): Promise<string> {
    if (!this.isMerchantWalletPendingRef(providerRef)) {
      throw new BadRequestException("Référence portefeuille boutique invalide");
    }
    const pendingOrderId = providerRef.slice(MERCHANT_PENDING_PREFIX.length);
    if (pendingOrderId !== orderId) {
      throw new BadRequestException("Référence portefeuille invalide pour cette commande");
    }
    const hold = await this.debitForMerchantHold(
      userId,
      amount,
      currency,
      orderId,
      note
    );
    return hold.providerRef;
  }

  async creditVetRefund(
    userId: string,
    amount: number,
    currency: string,
    appointmentId: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_refund,
      note,
      idempotencyKey,
      { vetAppointmentId: appointmentId }
    );
  }

  async creditVetPayout(
    userId: string,
    amount: number,
    currency: string,
    appointmentId: string,
    note: string,
    idempotencyKey: string
  ): Promise<WalletEntryDto> {
    return this.credit(
      userId,
      amount,
      currency,
      UserWalletEntryKind.credit_escrow_release,
      note,
      idempotencyKey,
      { vetAppointmentId: appointmentId }
    );
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
      throw new BadRequestException(
        "Référence portefeuille invalide pour cette transaction"
      );
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
    const entry = await this.prisma.userWalletEntry.findUnique({
      where: { id: entryId }
    });
    if (!entry || entry.transactionId !== transactionId) {
      throw new BadRequestException(
        "Paiement portefeuille introuvable pour cette transaction"
      );
    }
  }

  private async credit(
    userId: string,
    amount: number,
    currency: string,
    kind: UserWalletEntryKind,
    note: string,
    idempotencyKey: string,
    extra: {
      transactionId?: string;
      vetAppointmentId?: string;
      merchantOrderId?: string;
      counterpartyUserId?: string;
      providerRef?: string;
    } = {}
  ): Promise<WalletEntryDto> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant de crédit invalide");
    }
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return this.serializeEntry(existing);
    }
    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.userWallet.upsert({
          where: { userId },
          create: { userId, currency },
          update: {}
        });
        const balanceAfter = Number(wallet.balance) + amount;
        await tx.userWallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } }
        });
        return tx.userWalletEntry.create({
          data: {
            walletId: wallet.id,
            kind,
            amount: new Prisma.Decimal(amount),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            currency,
            transactionId: extra.transactionId,
            vetAppointmentId: extra.vetAppointmentId,
            merchantOrderId: extra.merchantOrderId,
            counterpartyUserId: extra.counterpartyUserId,
            providerRef: extra.providerRef,
            note,
            idempotencyKey
          }
        });
      });
      return this.serializeEntry(entry);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const raced = await this.prisma.userWalletEntry.findUnique({
          where: { idempotencyKey }
        });
        if (raced) {
          return this.serializeEntry(raced);
        }
      }
      throw e;
    }
  }

  private async debit(
    userId: string,
    amount: number,
    currency: string,
    kind: UserWalletEntryKind,
    note: string,
    idempotencyKey: string,
    extra: {
      transactionId?: string;
      vetAppointmentId?: string;
      merchantOrderId?: string;
      counterpartyUserId?: string;
      providerRef?: string;
    } = {}
  ): Promise<WalletEntryDto> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant de débit invalide");
    }
    const existing = await this.prisma.userWalletEntry.findUnique({
      where: { idempotencyKey }
    });
    if (existing) {
      return this.serializeEntry(existing);
    }
    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.userWallet.upsert({
          where: { userId },
          create: { userId, currency },
          update: {}
        });
        const debited = await tx.userWallet.updateMany({
          where: {
            id: wallet.id,
            balance: { gte: amount }
          },
          data: { balance: { decrement: amount } }
        });
        if (debited.count === 0) {
          throw new BadRequestException(
            "Solde insuffisant — rechargez votre portefeuille ou utilisez mobile money."
          );
        }
        const balanceAfter = Number(wallet.balance) - amount;
        return tx.userWalletEntry.create({
          data: {
            walletId: wallet.id,
            kind,
            amount: new Prisma.Decimal(amount),
            balanceAfter: new Prisma.Decimal(balanceAfter),
            currency,
            transactionId: extra.transactionId,
            vetAppointmentId: extra.vetAppointmentId,
            merchantOrderId: extra.merchantOrderId,
            counterpartyUserId: extra.counterpartyUserId,
            providerRef: extra.providerRef,
            note,
            idempotencyKey
          }
        });
      });
      return this.serializeEntry(entry);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const raced = await this.prisma.userWalletEntry.findUnique({
          where: { idempotencyKey }
        });
        if (raced) {
          return this.serializeEntry(raced);
        }
      }
      throw e;
    }
  }

  private serializeEntry(row: {
    id: string;
    kind: UserWalletEntryKind;
    amount: Prisma.Decimal;
    balanceAfter: Prisma.Decimal;
    currency: string;
    transactionId: string | null;
    counterpartyUserId?: string | null;
    providerRef?: string | null;
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
      counterpartyUserId: row.counterpartyUserId ?? null,
      providerRef: row.providerRef ?? null,
      note: row.note,
      createdAt: row.createdAt.toISOString()
    };
  }
}
