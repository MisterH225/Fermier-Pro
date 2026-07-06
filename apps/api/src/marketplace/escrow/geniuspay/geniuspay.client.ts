import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import type {
  GeniusPayApiResponse,
  GeniusPayPaymentData,
  GeniusPayPaymentMetadata
} from "./geniuspay.types";

const DEFAULT_BASE_URL = "https://pay.genius.ci/api/v1/merchant";

export type CreateGeniusPayPaymentParams = {
  amount: number;
  currency: string;
  description: string;
  metadata: GeniusPayPaymentMetadata;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    country?: string | null;
  };
  successUrl?: string | null;
  errorUrl?: string | null;
};

@Injectable()
export class GeniusPayClient {
  private readonly log = new Logger(GeniusPayClient.name);

  private get baseUrl(): string {
    return (
      process.env.GENIUSPAY_API_BASE_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/$/, "");
  }

  private get apiKey(): string {
    const key = process.env.GENIUSPAY_API_KEY?.trim();
    if (!key) {
      throw new ServiceUnavailableException("GENIUSPAY_API_KEY non configurée");
    }
    return key;
  }

  private get apiSecret(): string {
    const secret = process.env.GENIUSPAY_API_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("GENIUSPAY_API_SECRET non configurée");
    }
    return secret;
  }

  async createPayment(
    params: CreateGeniusPayPaymentParams
  ): Promise<GeniusPayPaymentData> {
    const body: Record<string, unknown> = {
      amount: Math.round(params.amount),
      currency: params.currency || "XOF",
      description: params.description.slice(0, 500),
      metadata: params.metadata
    };
    if (params.customer) {
      body.customer = params.customer;
    }
    const successUrl = params.successUrl?.trim();
    const errorUrl = params.errorUrl?.trim();
    if (successUrl) body.success_url = successUrl;
    if (errorUrl) body.error_url = errorUrl;

    return this.request<GeniusPayPaymentData>("POST", "/payments", body);
  }

  async getPayment(reference: string): Promise<GeniusPayPaymentData> {
    const ref = reference.trim();
    if (!ref) {
      throw new BadGatewayException("Référence GeniusPay manquante");
    }
    return this.request<GeniusPayPaymentData>("GET", `/payments/${encodeURIComponent(ref)}`);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "X-API-Secret": this.apiSecret
    };
    const init: RequestInit = { method, headers };
    if (body) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      this.log.error(`GeniusPay ${method} ${path} réseau: ${String(err)}`);
      throw new BadGatewayException("Prestataire GeniusPay injoignable");
    }

    let json: GeniusPayApiResponse<T>;
    try {
      json = (await res.json()) as GeniusPayApiResponse<T>;
    } catch {
      throw new BadGatewayException("Réponse GeniusPay invalide");
    }

    if (!res.ok || !json.success || !json.data) {
      const code = json.error?.code?.trim();
      const msg =
        json.error?.message?.trim() ??
        `GeniusPay HTTP ${res.status}`;
      const detail = code ? `${msg} (${code})` : msg;
      this.log.warn(`GeniusPay ${method} ${path} échec: ${detail}`);
      throw new BadGatewayException(detail);
    }
    return json.data;
  }
}
