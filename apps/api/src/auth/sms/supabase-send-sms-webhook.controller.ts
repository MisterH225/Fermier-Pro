import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Headers,
  HttpException,
  Logger,
  Post,
  Req
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  buildOtpSmsMessage,
  verifySupabaseSendSmsHook
} from "./supabase-send-sms-webhook.util";
import { YellikaSmsClient } from "./yellika-sms.client";

type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * Webhook Supabase Auth « Send SMS » — envoie l'OTP via Yellika SMS.
 *
 * Configurer dans Supabase Dashboard → Authentication → Hooks → Send SMS :
 * POST https://<api>/api/v1/webhooks/supabase/send-sms
 */
@Controller("webhooks/supabase")
@SkipThrottle()
export class SupabaseSendSmsWebhookController {
  private readonly log = new Logger(SupabaseSendSmsWebhookController.name);

  constructor(private readonly yellika: YellikaSmsClient) {}

  @Post("send-sms")
  async handleSendSms(
    @Req() req: RawBodyRequest,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException("Corps webhook manquant");
    }

    const event = verifySupabaseSendSmsHook(rawBody, headers);
    const phone = event.user?.phone?.trim();
    const otp = event.sms?.otp?.trim();
    if (!phone) {
      throw new BadRequestException("Numéro de téléphone manquant dans le webhook");
    }
    if (!otp) {
      throw new BadRequestException("OTP manquant dans le webhook");
    }

    try {
      await this.yellika.sendPlainText(phone, buildOtpSmsMessage(otp));
      return {};
    } catch (err) {
      if (err instanceof HttpException) {
        const status = err.getStatus();
        if (status === 502 || status === 503) {
          this.log.warn(`Yellika indisponible pour ${phone}: ${err.message}`);
          throw new BadGatewayException({
            error: {
              http_code: 503,
              message: "Fournisseur SMS temporairement indisponible"
            }
          });
        }
        throw err;
      }
      this.log.error(`Send SMS hook échec: ${String(err)}`);
      throw new BadGatewayException({
        error: {
          http_code: 500,
          message: "Échec envoi SMS OTP"
        }
      });
    }
  }
}
