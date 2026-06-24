import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request, Response } from "express";
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
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      throw new BadRequestException("Corps webhook manquant");
    }

    let event;
    try {
      event = verifySupabaseSendSmsHook(rawBody, headers);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw err;
    }

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
      if (err instanceof ServiceUnavailableException) {
        this.log.error(`Config Yellika manquante: ${err.message}`);
        throw new HttpException(
          {
            error: {
              http_code: 503,
              message: err.message
            }
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      if (err instanceof YellikaSmsSendError) {
        this.log.error(`Yellika SMS échec (${phone.slice(0, 6)}…): ${err.message}`);
        if (err.retryable) {
          res.setHeader("Retry-After", "true");
          throw new HttpException(
            {
              error: {
                http_code: 503,
                message: `Échec envoi SMS: ${err.message}`
              }
            },
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
        throw new HttpException(
          {
            error: {
              http_code: 400,
              message: `Configuration SMS invalide: ${err.message}`
            }
          },
          HttpStatus.BAD_REQUEST
        );
      }

      this.log.error(`Send SMS hook échec: ${String(err)}`);
      res.setHeader("Retry-After", "true");
      throw new HttpException(
        {
          error: {
            http_code: 503,
            message: "Échec envoi SMS OTP"
          }
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
