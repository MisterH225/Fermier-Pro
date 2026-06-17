import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { SkipThrottle } from "@nestjs/throttler";
import { MarketplaceTransactionService } from "./marketplace-transaction.service";

type PaymentWebhookBody = {
  event: "payment.confirmed" | "payment.failed";
  transactionId: string;
  providerRef: string;
  amount?: number;
  currency?: string;
};

/**
 * Webhook prestataire mobile money (source de vérité asynchrone).
 * Signature HMAC-SHA256 du corps JSON via MOBILE_MONEY_WEBHOOK_SECRET.
 */
@Controller("webhooks/mobile-money")
@SkipThrottle()
export class MobileMoneyWebhookController {
  constructor(private readonly transactions: MarketplaceTransactionService) {}

  @Post("payment")
  async handlePayment(
    @Headers("x-mm-signature") signature: string | undefined,
    @Body() body: PaymentWebhookBody
  ) {
    this.verifySignature(signature, body);
    if (!body.transactionId?.trim() || !body.providerRef?.trim()) {
      throw new BadRequestException("transactionId et providerRef requis");
    }
    if (body.event === "payment.confirmed") {
      await this.transactions.confirmPaymentFromWebhook(
        body.transactionId.trim(),
        body.providerRef.trim(),
        body.amount,
        body.currency
      );
      return { ok: true };
    }
    if (body.event === "payment.failed") {
      await this.transactions.failPaymentFromWebhook(
        body.transactionId.trim(),
        body.providerRef.trim()
      );
      return { ok: true };
    }
    throw new BadRequestException("event inconnu");
  }

  private verifySignature(
    signature: string | undefined,
    body: PaymentWebhookBody
  ): void {
    const secret = process.env.MOBILE_MONEY_WEBHOOK_SECRET?.trim();
    if (!secret) {
      // Secret obligatoire dans tous les environnements déployés
      throw new UnauthorizedException("Webhook secret non configuré");
    }
    if (!signature?.trim()) {
      throw new UnauthorizedException("Signature manquante");
    }
    const expected = createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex");
    const provided = signature.trim().replace(/^sha256=/i, "");
    try {
      const ok = timingSafeEqual(
        Buffer.from(expected, "utf8"),
        Buffer.from(provided, "utf8")
      );
      if (!ok) {
        throw new UnauthorizedException("Signature invalide");
      }
    } catch {
      throw new UnauthorizedException("Signature invalide");
    }
  }
}
