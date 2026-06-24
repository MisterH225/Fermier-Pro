import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import type {
  YellikaSmsSendRequest,
  YellikaSmsSendResponse
} from "./yellika-sms.types";

const DEFAULT_BASE_URL = "https://panel.yellikasms.com/api/v3";

@Injectable()
export class YellikaSmsClient {
  private readonly log = new Logger(YellikaSmsClient.name);

  private get baseUrl(): string {
    return (
      process.env.YELLIKA_SMS_API_BASE_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/$/, "");
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
   * Yellika attend le numéro sans « + » (ex. 2250700000000).
   */
  formatRecipient(e164Phone: string): string {
    const digits = e164Phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new BadGatewayException("Numéro de téléphone invalide pour Yellika SMS");
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

    const url = `${this.baseUrl}/sms/send`;
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
        signal: AbortSignal.timeout(15_000)
      });
    } catch (err) {
      this.log.error(`Yellika SMS réseau: ${String(err)}`);
      throw new BadGatewayException("Yellika SMS injoignable");
    }

    let json: YellikaSmsSendResponse | null = null;
    try {
      json = (await res.json()) as YellikaSmsSendResponse;
    } catch {
      if (!res.ok) {
        throw new BadGatewayException(`Yellika SMS HTTP ${res.status}`);
      }
      return;
    }

    if (!res.ok) {
      const msg =
        json?.message ?? json?.error ?? `Yellika SMS HTTP ${res.status}`;
      this.log.warn(`Yellika SMS échec: ${msg}`);
      throw new BadGatewayException(msg);
    }

    this.log.debug(
      `SMS envoyé via Yellika recipient=${body.recipient} status=${json?.status ?? "ok"}`
    );
  }
}
