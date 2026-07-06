import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { WalletRailsService } from "../../../wallet/wallet-rails.service";
import { MarketplaceTransactionService } from "../marketplace-transaction.service";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_WALLET_TOPUP,
  type GeniusPayWebhookPayload
} from "./geniuspay.types";
import { verifyGeniusPayWebhookSignature } from "./geniuspay-webhook.util";

type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * Webhook GeniusPay (source de vérité asynchrone pour escrow marketplace et recharge wallet).
 */
@Controller("webhooks/geniuspay")
@SkipThrottle()
export class GeniusPayWebhookController {
  constructor(
    private readonly transactions: MarketplaceTransactionService,
    private readonly walletRails: WalletRailsService
  ) {}

  @Post()
  async handle(
    @Req() req: RawBodyRequest,
    @Headers("x-webhook-signature") signature: string | undefined,
    @Headers("x-webhook-timestamp") timestamp: string | undefined,
    @Headers("x-webhook-event") event: string | undefined
  ) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException("Corps webhook GeniusPay manquant");
    }

    verifyGeniusPayWebhookSignature({
      signature,
      timestamp,
      rawPayload: rawBody,
      secret: process.env.GENIUSPAY_WEBHOOK_SECRET
    });

    let body: GeniusPayWebhookPayload;
    try {
      body = JSON.parse(rawBody.toString("utf8")) as GeniusPayWebhookPayload;
    } catch {
      throw new BadRequestException("Corps webhook GeniusPay JSON invalide");
    }

    const webhookEvent = (event ?? body.event ?? "").trim();

    if (webhookEvent === "webhook.test") {
      return { ok: true, test: true };
    }

    const reference = body.data?.reference?.trim();
    if (!reference) {
      throw new BadRequestException("reference manquante");
    }

    const metadata = body.data?.metadata ?? {};
    const kind = metadata.kind;
    const amount = Number(body.data.amount);

    if (webhookEvent === "payment.success") {
      if (kind === GENIUSPAY_KIND_MARKETPLACE_ESCROW) {
        const transactionId =
          typeof metadata.transaction_id === "string"
            ? metadata.transaction_id.trim()
            : "";
        if (!transactionId) {
          throw new BadRequestException("transaction_id metadata manquant");
        }
        await this.transactions.confirmPaymentFromWebhook(
          transactionId,
          reference,
          Number.isFinite(amount) ? amount : undefined,
          body.data.currency
        );
        return { ok: true };
      }

      if (kind === GENIUSPAY_KIND_WALLET_TOPUP) {
        const userId =
          typeof metadata.user_id === "string" ? metadata.user_id.trim() : "";
        if (!userId) {
          throw new BadRequestException("user_id metadata manquant");
        }
        const grossAmount =
          typeof metadata.amount === "string" || typeof metadata.amount === "number"
            ? Number(metadata.amount)
            : amount;
        if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
          throw new BadRequestException("montant recharge invalide");
        }
        await this.walletRails.confirmTopUpFromWebhook(
          userId,
          grossAmount,
          reference
        );
        return { ok: true };
      }

      return { ok: true, ignored: true, reason: "kind inconnu" };
    }

    if (
      webhookEvent === "payment.failed" ||
      webhookEvent === "payment.cancelled" ||
      webhookEvent === "payment.expired"
    ) {
      if (kind === GENIUSPAY_KIND_MARKETPLACE_ESCROW) {
        const transactionId =
          typeof metadata.transaction_id === "string"
            ? metadata.transaction_id.trim()
            : "";
        if (transactionId) {
          await this.transactions.failPaymentFromWebhook(transactionId, reference);
        }
        return { ok: true };
      }
      return { ok: true, ignored: true };
    }

    return { ok: true, ignored: true, event: webhookEvent };
  }
}
