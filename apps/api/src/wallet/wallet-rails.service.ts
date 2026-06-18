import { randomUUID } from "crypto";
import {
  BadRequestException,
  Inject,
  Injectable
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  MOBILE_MONEY_GATEWAY,
  type MobileMoneyGateway
} from "../marketplace/escrow/mobile-money.gateway";
import { UserWalletService } from "./user-wallet.service";

@Injectable()
export class WalletRailsService {
  constructor(
    private readonly wallet: UserWalletService,
    @Inject(MOBILE_MONEY_GATEWAY)
    private readonly gateway: MobileMoneyGateway
  ) {}

  async initiateTopUp(user: User, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant invalide");
    }
    const summary = await this.wallet.getSummary(user.id);
    const init = await this.gateway.initiateTopUp({
      amount,
      currency: summary.currency,
      userId: user.id,
      label: "Recharge portefeuille Fermier Pro"
    });
    return {
      providerRef: init.providerRef,
      amount,
      currency: summary.currency,
      paymentUrl: init.paymentUrl ?? null
    };
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
    const entry = await this.wallet.creditTopUp(
      user.id,
      amount,
      summary.currency,
      providerRef,
      "Recharge portefeuille via mobile money",
      `topup:${providerRef}`
    );
    return {
      ok: true,
      entry,
      balance: entry.balanceAfter,
      currency: summary.currency
    };
  }

  async initiateWithdraw(user: User, amount: number, phone?: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Montant invalide");
    }
    await this.wallet.assertSufficientBalance(user.id, amount);
    const summary = await this.wallet.getSummary(user.id);
    const payoutPhone = phone?.trim() || user.phone?.trim() || null;
    if (!payoutPhone) {
      throw new BadRequestException(
        "Numéro mobile money requis — renseignez votre téléphone sur le profil ou dans la demande."
      );
    }
    const init = await this.gateway.initiateWithdraw({
      amount,
      currency: summary.currency,
      userId: user.id,
      phone: payoutPhone,
      label: "Retrait portefeuille Fermier Pro"
    });
    return {
      providerRef: init.providerRef,
      amount,
      currency: summary.currency,
      phone: payoutPhone,
      paymentUrl: init.paymentUrl ?? null
    };
  }

  async confirmWithdraw(
    user: User,
    amount: number,
    providerRef: string,
    phone?: string
  ) {
    await this.wallet.assertSufficientBalance(user.id, amount);
    const summary = await this.wallet.getSummary(user.id);
    const confirmed = await this.gateway.confirmWithdraw(
      providerRef,
      user.id,
      amount
    );
    if (!confirmed.success) {
      throw new BadRequestException(
        confirmed.failureReason ?? "Retrait mobile money non confirmé"
      );
    }
    const entry = await this.wallet.debitWithdraw(
      user.id,
      amount,
      summary.currency,
      providerRef,
      phone?.trim()
        ? `Retrait vers ${phone.trim()}`
        : "Retrait portefeuille vers mobile money",
      `withdraw:${providerRef}`
    );
    return {
      ok: true,
      entry,
      balance: entry.balanceAfter,
      currency: summary.currency
    };
  }

  async transfer(
    fromUser: User,
    toUserId: string,
    amount: number,
    note?: string,
    clientRequestId?: string
  ) {
    const summary = await this.wallet.getSummary(fromUser.id);
    const idempotencyKey =
      clientRequestId?.trim() || `transfer:${randomUUID()}`;
    const result = await this.wallet.transfer(
      fromUser.id,
      toUserId,
      amount,
      summary.currency,
      note?.trim() || "Transfert portefeuille (gratuit)",
      idempotencyKey
    );
    return {
      ok: true,
      debit: result.debit,
      credit: result.credit,
      balance: result.debit.balanceAfter,
      currency: summary.currency
    };
  }
}
