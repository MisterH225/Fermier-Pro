import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Lite en premier : quota gratuit plus généreux que 2.5-flash. */
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODELS = [
  "gemini-flash-latest",
  "gemini-2.5-flash"
] as const;
const TIMEOUT_MS = 12_000;
const DEFAULT_QUOTA_COOLDOWN_MS = 15 * 60 * 1000;

type CallModelResult = {
  text: string | null;
  quotaExceeded: boolean;
};

@Injectable()
export class AiGeminiService {
  private readonly logger = new Logger(AiGeminiService.name);
  private quotaBlockedUntil = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("GEMINI_API_KEY")?.trim());
  }

  /** Pause les appels Gemini après dépassement de quota (évite le spam Railway). */
  isQuotaBlocked(): boolean {
    return Date.now() < this.quotaBlockedUntil;
  }

  private quotaCooldownMs(): number {
    const raw = this.config.get<string>("GEMINI_QUOTA_COOLDOWN_MS");
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_QUOTA_COOLDOWN_MS;
  }

  private markQuotaExceeded(): void {
    const cooldown = this.quotaCooldownMs();
    this.quotaBlockedUntil = Date.now() + cooldown;
    this.logger.error(
      `Quota Gemini dépassé — appels IA suspendus ${Math.round(cooldown / 60_000)} min`
    );
  }

  private modelChain(): string[] {
    const primary =
      this.config.get<string>("GEMINI_MODEL")?.trim() || DEFAULT_MODEL;
    const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
    return [...new Set(chain)];
  }

  private isQuotaError(status: number, errText: string): boolean {
    if (status === 429) {
      return true;
    }
    const lower = errText.toLowerCase();
    return (
      lower.includes("quota") ||
      lower.includes("resource_exhausted") ||
      lower.includes("rate limit") ||
      lower.includes("exceeded")
    );
  }

  /** Génération JSON volumineuse (prévisions IA) — tokens étendus. */
  async generatePredictionJson(prompt: string): Promise<string | null> {
    if (this.isQuotaBlocked()) {
      return null;
    }
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      return null;
    }

    let sawQuotaError = false;
    for (const model of this.modelChain()) {
      const { text, quotaExceeded } = await this.callModel(apiKey, model, prompt, {
        maxOutputTokens: 8192,
        timeoutMs: 30_000
      });
      if (text) {
        return text;
      }
      if (quotaExceeded) {
        sawQuotaError = true;
      }
    }
    if (sawQuotaError) {
      this.markQuotaExceeded();
    }
    return null;
  }

  async generateText(prompt: string): Promise<string | null> {
    if (this.isQuotaBlocked()) {
      return null;
    }
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      return null;
    }

    const chain = this.modelChain();
    let sawQuotaError = false;
    for (const model of chain) {
      const { text, quotaExceeded } = await this.callModel(apiKey, model, prompt);
      if (text) {
        if (model !== chain[0]) {
          this.logger.log(`Gemini OK via modèle de secours: ${model}`);
        }
        return text;
      }
      if (quotaExceeded) {
        sawQuotaError = true;
      }
    }
    if (sawQuotaError) {
      this.markQuotaExceeded();
    }
    return null;
  }

  private async callModel(
    apiKey: string,
    model: string,
    prompt: string,
    options?: { maxOutputTokens?: number; timeoutMs?: number }
  ): Promise<CallModelResult> {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: options?.maxOutputTokens ?? 1024,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        const quotaExceeded = this.isQuotaError(res.status, errText);
        this.logger.warn(
          `Gemini ${model} HTTP ${res.status}${quotaExceeded ? " (quota)" : ""}: ${errText.slice(0, 180)}`
        );
        return { text: null, quotaExceeded };
      }

      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      return { text: text?.trim() ?? null, quotaExceeded: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gemini ${model} indisponible: ${msg}`);
      return { text: null, quotaExceeded: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async generateWithImageUrl(
    prompt: string,
    imageUrl: string
  ): Promise<string | null> {
    const image = await this.fetchImageBase64(imageUrl);
    if (!image) {
      return null;
    }
    return this.generateWithImageBase64(prompt, image.base64, image.mimeType);
  }

  async generateWithImageBase64(
    prompt: string,
    base64: string,
    mimeType: string
  ): Promise<string | null> {
    if (this.isQuotaBlocked()) {
      return null;
    }
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      return null;
    }
    const normalizedMime = mimeType.split(";")[0]?.trim() || "image/jpeg";

    let sawQuotaError = false;
    for (const model of this.modelChain()) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS * 2);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: normalizedMime,
                      data: base64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
              responseMimeType: "application/json"
            }
          })
        });
        if (!res.ok) {
          const errText = await res.text();
          if (this.isQuotaError(res.status, errText)) {
            sawQuotaError = true;
          }
          continue;
        }
        const body = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text?.trim()) {
          return text.trim();
        }
      } catch {
        /* try next model */
      } finally {
        clearTimeout(timer);
      }
    }
    if (sawQuotaError) {
      this.markQuotaExceeded();
    }
    return null;
  }

  private async fetchImageBase64(
    imageUrl: string
  ): Promise<{ base64: string; mimeType: string } | null> {
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return null;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const mimeType = contentType.split(";")[0]?.trim() || "image/jpeg";
      return { base64: buf.toString("base64"), mimeType };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Image fetch failed: ${msg}`);
      return null;
    }
  }
}
