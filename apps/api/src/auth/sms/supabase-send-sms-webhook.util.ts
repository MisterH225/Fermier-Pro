import { UnauthorizedException } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { Webhook } from "standardwebhooks";
import type { SupabaseSendSmsHookPayload } from "./yellika-sms.types";

function throwUnauthorizedSmsWebhook(message: string): never {
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.captureMessage(`webhook_signature_failure: ${message}`, {
      level: "error",
      tags: { webhook: "supabase-sms" }
    });
  }
  throw new UnauthorizedException(message);
}

export function resolveSupabaseSendSmsHookSecret(): string {
  const raw =
    process.env.SUPABASE_SEND_SMS_HOOK_SECRET?.trim() ||
    process.env.SEND_SMS_HOOK_SECRETS?.trim();
  if (!raw) {
    throwUnauthorizedSmsWebhook("SUPABASE_SEND_SMS_HOOK_SECRET non configuré");
  }
  return raw.replace(/^v1,whsec_/i, "");
}

export function verifySupabaseSendSmsHook(
  rawPayload: string | Buffer,
  headers: Record<string, string | string[] | undefined>
): SupabaseSendSmsHookPayload {
  const secret = resolveSupabaseSendSmsHookSecret();
  const wh = new Webhook(secret);
  const payload =
    typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf8");
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value
    ])
  ) as Record<string, string>;

  try {
    return wh.verify(payload, normalizedHeaders) as SupabaseSendSmsHookPayload;
  } catch {
    throwUnauthorizedSmsWebhook("Signature webhook Supabase Send SMS invalide");
  }
}

export function buildOtpSmsMessage(otp: string): string {
  const template = process.env.YELLIKA_SMS_OTP_TEMPLATE?.trim();
  if (template) {
    return template.replace(/\{\{otp\}\}/g, otp).slice(0, 500);
  }
  const appName = process.env.YELLIKA_SMS_APP_NAME?.trim() || "Fermier Pro";
  return `${appName} : votre code de connexion est ${otp}. Ne le partagez avec personne.`;
}
