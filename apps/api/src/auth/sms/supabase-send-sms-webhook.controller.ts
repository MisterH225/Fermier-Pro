import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  ServiceUnavailableException
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  supabaseHookError,
  supabaseHookSuccess
} from "./supabase-hook-response.util";
import {
  buildOtpSmsMessage,
  verifySupabaseSendSmsHook
} from "./supabase-send-sms-webhook.util";
import { YellikaSmsSendError } from "./yellika-sms.errors";
import { YellikaSmsClient } from "./yellika-sms.client";

type RawBodyRequest = Request & { rawBody?: Buffer };

/**
 * Webhook Supabase Auth « Send SMS » — envoie l'OTP via Yellika SMS.
 *
 * Configurer dans Supabase Dashboard → Authentication → Hooks → Send SMS :
 * POST https://<api>/api/v1/webhooks/supabase/send-sms
 *
 * Toujours répondre HTTP 200 : Supabase ne lit le corps d'erreur que sur 200/202
 * (sinon 503 → retries → « Service currently unavailable due to hook »).
 */
@Controller("webhooks/supabase")
@SkipThrottle()
export class SupabaseSendSmsWebhookController {
  private readonly log = new Logger(SupabaseSendSmsWebhookController.name);

  constructor(private readonly yellika: YellikaSmsClient) {}

  @Post("send-sms")
  @HttpCode(HttpStatus.OK)
  async handleSendSms(
    @Req() req: RawBodyRequest,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      this.log.warn("Send SMS hook: corps webhook manquant (rawBody absent)");
      return supabaseHookError(
        "Corps webhook manquant — vérifier rawBody sur l'API Nest",
        400
      );
    }

    let event;
    try {
      event = verifySupabaseSendSmsHook(rawBody, headers);
    } catch (err) {
      this.log.warn(`Send SMS hook: signature invalide — ${String(err)}`);
      return supabaseHookError(
        "Signature webhook invalide — vérifiez SUPABASE_SEND_SMS_HOOK_SECRET sur Railway",
        401
      );
    }

    const phone = (event.user?.phone ?? event.sms?.phone ?? "").trim();
    const otp = event.sms?.otp?.trim();
    if (!phone) {
      return supabaseHookError("Numéro de téléphone manquant dans le webhook", 400);
    }
    if (!otp) {
      return supabaseHookError("OTP manquant dans le webhook", 400);
    }

    try {
      await this.yellika.sendPlainText(phone, buildOtpSmsMessage(otp));
      return supabaseHookSuccess();
    } catch (err) {
      if (err instanceof ServiceUnavailableException) {
        this.log.error(`Config Yellika manquante: ${err.message}`);
        return supabaseHookError(err.message, 500);
      }
      if (err instanceof YellikaSmsSendError) {
        this.log.error(
          `Yellika SMS échec (${phone.slice(0, 6)}…): ${err.message}`
        );
        return supabaseHookError(
          `Échec envoi SMS Yellika: ${err.message}`,
          500
        );
      }

      const message =
        err instanceof Error ? err.message : "Échec envoi SMS OTP";
      this.log.error(`Send SMS hook échec: ${message}`);
      return supabaseHookError(message, 500);
    }
  }
}
