import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { formatE164ForYellikaSms } from "@fermier/phone";
import { YellikaSmsSendError } from "./yellika-sms.errors";
import type {
  YellikaSmsSendRequest,
  YellikaSmsSendResponse
} from "./yellika-sms.types";
import { resolveYellikaSmsSendUrl } from "./yellika-sms-url.util";

/** Client HTTP Yellika SMS v3 — https://panel.yellikasms.com/developers/docs */
@Injectable()
export class YellikaSmsClient {
  private readonly log = new Logger(YellikaSmsClient.name);

  private get sendUrl(): string {
    return resolveYellikaSmsSendUrl();
  }

  private get apiToken(): string {
    const token = process.env.YELLIKA_SMS_API_TOKEN?.trim();
    if (!token) {
      throw new ServiceUnavailableException("YELLIKA_SMS_API_TOKEN non configuré");
    }
    return token;
  }

  private get senderId(): string {
    const sender = process.env.YELLIKA_SMS_SENDER_ID?.trim();
    if (!sender) {
      throw new ServiceUnavailableException("YELLIKA_SMS_SENDER_ID non configuré");
    }
    return sender;
  }

  /**
   * Yellika attend le numéro sans « + » (ex. 2250708425141 pour la CI).
   */
  formatRecipient(e164Phone: string): string {
    const digits = formatE164ForYellikaSms(e164Phone);
    if (digits.length < 8 || digits.length > 15) {
      throw new YellikaSmsSendError(
        "Numéro de téléphone invalide pour Yellika SMS",
        false
      );
    }
    return digits;
  }

  async sendPlainText(recipientE164: string, message: string): Promise<void> {
    const body: YellikaSmsSendRequest = {
      recipient: this.formatRecipient(recipientE164),
      sender_id: this.senderId,
      type: "plain",
      message: message.slice(0, 500)
    };

    const url = this.sendUrl;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3_500)
      });
    } catch (err) {
      this.log.error(`Yellika SMS réseau: ${String(err)}`);
      throw new YellikaSmsSendError("Yellika SMS injoignable", true);
    }

    const rawText = await res.text();
    let json: YellikaSmsSendResponse | null = null;
    if (rawText.trim()) {
      try {
        json = JSON.parse(rawText) as YellikaSmsSendResponse;
      } catch {
        json = null;
      }
    }

    const providerMessage =
      json?.message ??
      json?.error ??
      (rawText.trim().slice(0, 300) || `HTTP ${res.status}`);

    if (!res.ok) {
      this.log.warn(`Yellika SMS HTTP ${res.status}: ${providerMessage}`);
      throw new YellikaSmsSendError(providerMessage, res.status >= 500);
    }

    const status = (json?.status ?? "").trim().toLowerCase();
    if (status === "error" || status === "failed" || status === "fail") {
      const retryable = !isNonRetryableYellikaError(providerMessage);
      this.log.warn(
        `Yellika SMS refusé recipient=${body.recipient} sender=${body.sender_id}: ${providerMessage}`
      );
      throw new YellikaSmsSendError(providerMessage, retryable);
    }

    this.log.log(`SMS Yellika accepté recipient=${body.recipient}`);
  }
}

function isNonRetryableYellikaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("unauthenticated") ||
    m.includes("unauthorized") ||
    m.includes("invalid token") ||
    m.includes("sender") ||
    m.includes("sender_id") ||
    m.includes("insufficient") ||
    m.includes("balance") ||
    m.includes("credit") ||
    m.includes("invalid recipient") ||
    m.includes("invalid phone")
  );
}
