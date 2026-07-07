import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import type {
  GeniusPayApiResponse,
  GeniusPayPaymentData,
  GeniusPayPaymentMetadata,
  GeniusPayPayoutData,
  GeniusPayPayoutMetadata,
  GeniusPayWalletData
} from "./geniuspay.types";
import { throwGeniusPayUserError } from "./geniuspay-errors.util";

/** Domaine utilisé en prod lorsque la recharge wallet fonctionne déjà. */
const DEFAULT_BASE_URL = "https://geniuspay.ci/api/v1/merchant";

export type CreateGeniusPayPayoutParams = {
  amount: number;
  currency: string;
  description: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  metadata: GeniusPayPayoutMetadata;
  idempotencyKey: string;
  /** wave, orange_money, mtn_money… — omis = auto-détection PawaPay */
  provider?: string | null;
};

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
  private cachedPayoutWalletId: string | null = null;

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

  async createPayout(
    params: CreateGeniusPayPayoutParams
  ): Promise<GeniusPayPayoutData> {
    const walletId = await this.resolvePayoutWalletId();
    const destination: Record<string, string> = {
      type: "mobile_money",
      account: params.recipientPhone
    };
    const provider = params.provider?.trim();
    if (provider) {
      destination.provider = provider;
    }

    const body: Record<string, unknown> = {
      wallet_id: walletId,
      recipient: {
        name: params.recipientName,
        phone: params.recipientPhone,
        ...(params.recipientEmail?.trim()
          ? { email: params.recipientEmail.trim() }
          : {})
      },
      destination,
      amount: Math.round(params.amount),
      currency: params.currency || "XOF",
      description: params.description.slice(0, 500),
      metadata: params.metadata,
      idempotency_key: params.idempotencyKey
    };

    return this.requestPayout("POST", "/payouts", body);
  }

  async getPayout(reference: string): Promise<GeniusPayPayoutData> {
    const ref = reference.trim();
    if (!ref) {
      throw new BadGatewayException("Référence payout GeniusPay manquante");
    }
    return this.requestPayout(
      "GET",
      `/payouts/${encodeURIComponent(ref)}`
    );
  }

  /** Lecture tolérante — null si la référence payout n'existe pas. */
  async lookupPayout(reference: string): Promise<GeniusPayPayoutData | null> {
    const ref = reference.trim();
    if (!ref) {
      return null;
    }
    const result = await this.requestPayoutRaw(
      "GET",
      `/payouts/${encodeURIComponent(ref)}`
    );
    if (!result.ok) {
      return null;
    }
    return result.data;
  }

  async listWallets(): Promise<GeniusPayWalletData[]> {
    const result = await this.requestRaw<{ wallets: GeniusPayWalletData[] }>(
      "GET",
      "/wallets"
    );
    if (!result.ok) {
      throwGeniusPayUserError({
        httpStatus: result.httpStatus,
        code: result.code,
        message: result.message,
        operation: "fetch"
      });
    }
    return result.data.wallets ?? [];
  }

  async resolvePayoutWalletId(): Promise<string> {
    const fromEnv = process.env.GENIUSPAY_PAYOUT_WALLET_ID?.trim();
    if (fromEnv) {
      return fromEnv;
    }
    if (this.cachedPayoutWalletId) {
      return this.cachedPayoutWalletId;
    }
    const wallets = await this.listWallets();
    const active = wallets.find(
      (w) =>
        w.status === "active" &&
        (w.type === "payout" || w.type === "default") &&
        (w.currency === "XOF" || !w.currency)
    );
    if (!active?.id) {
      throw new ServiceUnavailableException(
        "GENIUSPAY_PAYOUT_WALLET_ID non configuré et aucun wallet payout actif trouvé chez GeniusPay."
      );
    }
    this.cachedPayoutWalletId = active.id;
    return active.id;
  }

  /** Lecture tolérante — null si la référence n'existe pas chez GeniusPay. */
  async lookupPayment(reference: string): Promise<GeniusPayPaymentData | null> {
    const ref = reference.trim();
    if (!ref) {
      return null;
    }
    const result = await this.requestRaw<GeniusPayPaymentData>(
      "GET",
      `/payments/${encodeURIComponent(ref)}`
    );
    if (!result.ok) {
      return null;
    }
    return result.data;
  }

  private async requestRaw<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<
    | { ok: true; data: T }
    | { ok: false; httpStatus: number; code?: string; message?: string }
  > {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      "X-API-Secret": this.apiSecret,
      Authorization: `Bearer ${this.apiKey}`
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
      return { ok: false, httpStatus: 0, message: "Prestataire GeniusPay injoignable" };
    }

    let json: GeniusPayApiResponse<T>;
    try {
      json = (await res.json()) as GeniusPayApiResponse<T>;
    } catch {
      return { ok: false, httpStatus: res.status, message: "Réponse GeniusPay invalide" };
    }

    if (!res.ok || !json.success || !json.data) {
      const code = json.error?.code?.trim();
      const msg = json.error?.message?.trim();
      const detail = code ? `${msg ?? "Erreur GeniusPay"} (${code})` : msg ?? `HTTP ${res.status}`;
      this.log.warn(`GeniusPay ${method} ${path} échec: ${detail}`);
      return {
        ok: false,
        httpStatus: res.status,
        code: code ?? undefined,
        message: msg
      };
    }
    return { ok: true, data: json.data };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const result = await this.requestRaw<T>(method, path, body);
    if (!result.ok) {
      throwGeniusPayUserError({
        httpStatus: result.httpStatus,
        code: result.code,
        message: result.message,
        operation: method === "POST" ? "create" : "fetch"
      });
    }
    return result.data;
  }

  private async requestPayoutRaw(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<
    | { ok: true; data: GeniusPayPayoutData }
    | { ok: false; httpStatus: number; code?: string; message?: string }
  > {
    const result = await this.requestRaw<{ payout: GeniusPayPayoutData }>(
      method,
      path,
      body
    );
    if (!result.ok) {
      return result;
    }
    const payout = result.data.payout;
    if (!payout?.reference) {
      return {
        ok: false,
        httpStatus: 502,
        message: "Réponse payout GeniusPay invalide"
      };
    }
    return { ok: true, data: payout };
  }

  private async requestPayout(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>
  ): Promise<GeniusPayPayoutData> {
    const result = await this.requestPayoutRaw(method, path, body);
    if (!result.ok) {
      throwGeniusPayUserError({
        httpStatus: result.httpStatus,
        code: result.code,
        message: result.message,
        operation: method === "POST" ? "create" : "fetch"
      });
    }
    return result.data;
  }
}
