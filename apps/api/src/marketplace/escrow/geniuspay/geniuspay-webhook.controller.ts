import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  NotFoundException,
  Post,
  Req
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { WithdrawalOrchestratorService } from "../../../wallet/withdrawal-orchestrator.service";
import { WalletRailsService } from "../../../wallet/wallet-rails.service";
import { MerchantSubscriptionBillingService } from "../../../merchant-shop/merchant-subscription-billing.service";
import { MerchantOrdersService } from "../../../merchant-shop/merchant-orders.service";
import {
  extractMerchantSubscriptionInvoiceId,
  isMerchantSubscriptionWebhookMetadata
} from "../../../merchant-shop/merchant-subscription-webhook.util";
import {
  extractProducerSubscriptionInvoiceId,
  isProducerSubscriptionWebhookMetadata
} from "../../../producer-subscription/producer-subscription-webhook.util";
import { ProducerSubscriptionBillingService } from "../../../producer-subscription/producer-subscription-billing.service";
import { MarketplaceTransactionService } from "../marketplace-transaction.service";
import { parsePayoutMetadata } from "./geniuspay-payout.util";
import {
  GENIUSPAY_KIND_MARKETPLACE_ESCROW,
  GENIUSPAY_KIND_MERCHANT_ORDER,
  GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION,
  GENIUSPAY_KIND_PRODUCER_SUBSCRIPTION,
  GENIUSPAY_KIND_WALLET_TOPUP,
  GENIUSPAY_KIND_WALLET_WITHDRAW,
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
  private readonly log = new Logger(GeniusPayWebhookController.name);

  constructor(
    private readonly transactions: MarketplaceTransactionService,
    private readonly walletRails: WalletRailsService,
    private readonly withdrawals: WithdrawalOrchestratorService,
    private readonly merchantBilling: MerchantSubscriptionBillingService,
    private readonly producerBilling: ProducerSubscriptionBillingService,
    private readonly merchantOrders: MerchantOrdersService
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

    if (
      webhookEvent === "payout.completed" ||
      webhookEvent === "payout.failed" ||
      webhookEvent === "cashout.completed" ||
      webhookEvent === "cashout.failed"
    ) {
      return this.handlePayoutWebhook(webhookEvent, body);
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
        if (transactionId) {
          await this.transactions.confirmPaymentFromWebhook(
            transactionId,
            reference,
            Number.isFinite(amount) ? amount : undefined,
            body.data.currency
          );
          return { ok: true };
        }
        // Metadata incomplète : tenter résolution par providerRef avant d'échouer.
        const escrowResolved = await this.transactions.resolveEscrowWebhookPayment(
          reference,
          Number.isFinite(amount) ? amount : undefined,
          body.data.currency,
          transactionId || undefined
        );
        if (escrowResolved) {
          return { ok: true, resolvedByReference: true };
        }
        throw new BadRequestException("transaction_id metadata manquant");
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

      if (kind === GENIUSPAY_KIND_PRODUCER_SUBSCRIPTION) {
        const invoiceId = extractProducerSubscriptionInvoiceId(metadata);
        if (!invoiceId) {
          const resolved =
            await this.producerBilling.confirmFromWebhookByProviderRef(
              reference,
              Number.isFinite(amount) ? amount : undefined
            );
          if (resolved) {
            return { ok: true, resolvedByReference: true };
          }
          throw new BadRequestException("invoice_id metadata manquant");
        }
        await this.producerBilling.confirmFromWebhook(
          reference,
          invoiceId,
          Number.isFinite(amount) ? amount : undefined
        );
        return { ok: true };
      }

      if (kind === GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION) {
        const invoiceId = extractMerchantSubscriptionInvoiceId(metadata);
        if (!invoiceId) {
          const resolved =
            await this.merchantBilling.confirmFromWebhookByProviderRef(
              reference,
              Number.isFinite(amount) ? amount : undefined
            );
          if (resolved) {
            return { ok: true, resolvedByReference: true };
          }
          throw new BadRequestException("invoice_id metadata manquant");
        }
        await this.merchantBilling.confirmFromWebhook(
          reference,
          invoiceId,
          Number.isFinite(amount) ? amount : undefined
        );
        return { ok: true };
      }

      if (kind === GENIUSPAY_KIND_MERCHANT_ORDER) {
        const orderId =
          typeof metadata.order_id === "string"
            ? metadata.order_id.trim()
            : "";
        if (!orderId) {
          throw new BadRequestException("order_id metadata manquant");
        }
        await this.merchantOrders.confirmPaymentFromWebhook(
          orderId,
          reference,
          Number.isFinite(amount) ? amount : undefined,
          body.data.currency
        );
        return { ok: true };
      }

      if (isProducerSubscriptionWebhookMetadata(metadata)) {
        const invoiceId = extractProducerSubscriptionInvoiceId(metadata);
        if (invoiceId) {
          await this.producerBilling.confirmFromWebhook(
            reference,
            invoiceId,
            Number.isFinite(amount) ? amount : undefined
          );
          return { ok: true, resolvedByMetadata: true };
        }
      }

      if (isMerchantSubscriptionWebhookMetadata(metadata)) {
        const invoiceId = extractMerchantSubscriptionInvoiceId(metadata);
        if (invoiceId) {
          await this.merchantBilling.confirmFromWebhook(
            reference,
            invoiceId,
            Number.isFinite(amount) ? amount : undefined
          );
          return { ok: true, resolvedByMetadata: true };
        }
      }

      const producerResolved =
        await this.producerBilling.confirmFromWebhookByProviderRef(
          reference,
          Number.isFinite(amount) ? amount : undefined
        );
      if (producerResolved) {
        return { ok: true, resolvedByReference: true };
      }

      const merchantResolved =
        await this.merchantBilling.confirmFromWebhookByProviderRef(
          reference,
          Number.isFinite(amount) ? amount : undefined
        );
      if (merchantResolved) {
        return { ok: true, resolvedByReference: true };
      }

      const escrowTransactionId =
        typeof metadata.transaction_id === "string"
          ? metadata.transaction_id.trim()
          : "";
      const escrowResolved = await this.transactions.resolveEscrowWebhookPayment(
        reference,
        Number.isFinite(amount) ? amount : undefined,
        body.data.currency,
        escrowTransactionId || undefined
      );
      if (escrowResolved) {
        return { ok: true, resolvedByReference: true };
      }

      // Ne pas ACK silencieusement : GeniusPay doit pouvoir retenter.
      this.log.error(
        `payment.success non résolu ref=${reference} kind=${String(kind ?? "")}`
      );
      throw new NotFoundException(
        `Paiement GeniusPay non résolu (ref=${reference})`
      );
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
      if (kind === GENIUSPAY_KIND_MERCHANT_ORDER) {
        const orderId =
          typeof metadata.order_id === "string"
            ? metadata.order_id.trim()
            : "";
        if (orderId) {
          await this.merchantOrders.failPaymentFromWebhook(orderId, reference);
        }
        return { ok: true };
      }
      if (kind === GENIUSPAY_KIND_MERCHANT_SUBSCRIPTION) {
        const invoiceId = extractMerchantSubscriptionInvoiceId(metadata);
        const failed = await this.merchantBilling.failFromWebhook(
          reference,
          invoiceId
        );
        return { ok: true, expiredInvoice: failed };
      }
      if (kind === GENIUSPAY_KIND_PRODUCER_SUBSCRIPTION) {
        const invoiceId = extractProducerSubscriptionInvoiceId(metadata);
        const failed = await this.producerBilling.failFromWebhook(
          reference,
          invoiceId
        );
        return { ok: true, expiredInvoice: failed };
      }
      if (isMerchantSubscriptionWebhookMetadata(metadata)) {
        const invoiceId = extractMerchantSubscriptionInvoiceId(metadata);
        const failed = await this.merchantBilling.failFromWebhook(
          reference,
          invoiceId
        );
        return { ok: true, expiredInvoice: failed };
      }
      if (isProducerSubscriptionWebhookMetadata(metadata)) {
        const invoiceId = extractProducerSubscriptionInvoiceId(metadata);
        const failed = await this.producerBilling.failFromWebhook(
          reference,
          invoiceId
        );
        return { ok: true, expiredInvoice: failed };
      }
      // Fallback : tenter les deux factures abo par référence.
      const merchantFailed = await this.merchantBilling.failFromWebhook(
        reference,
        extractMerchantSubscriptionInvoiceId(metadata)
      );
      if (merchantFailed) {
        return { ok: true, expiredInvoice: true };
      }
      const producerFailed = await this.producerBilling.failFromWebhook(
        reference,
        extractProducerSubscriptionInvoiceId(metadata)
      );
      if (producerFailed) {
        return { ok: true, expiredInvoice: true };
      }
      return { ok: true, ignored: true };
    }

    return { ok: true, ignored: true, event: webhookEvent };
  }

  private async handlePayoutWebhook(
    webhookEvent: string,
    body: GeniusPayWebhookPayload
  ) {
    const payout = body.data?.payout;
    const reference =
      payout?.reference?.trim() || body.data?.reference?.trim() || "";
    if (!reference) {
      throw new BadRequestException("reference payout manquante");
    }

    const metadata = parsePayoutMetadata(
      payout?.metadata ?? body.data?.metadata ?? undefined
    );
    if (!metadata || metadata.kind !== GENIUSPAY_KIND_WALLET_WITHDRAW) {
      return { ok: true, ignored: true, reason: "payout hors retrait wallet" };
    }

    const userId = metadata.user_id.trim();
    if (!userId) {
      throw new BadRequestException("user_id metadata payout manquant");
    }

    const isSuccess =
      webhookEvent === "payout.completed" ||
      webhookEvent === "cashout.completed";
    const isFailure =
      webhookEvent === "payout.failed" || webhookEvent === "cashout.failed";

    if (isSuccess) {
      const completed = await this.withdrawals.completeWithdrawalFromPayoutWebhook(
        reference,
        userId
      );
      return { ok: true, completed };
    }

    if (isFailure) {
      const failed = await this.withdrawals.failWithdrawalFromPayoutWebhook(
        reference,
        userId,
        `Payout ${payout?.status ?? "failed"}`
      );
      return { ok: true, failed };
    }

    return { ok: true, ignored: true, event: webhookEvent };
  }
}
