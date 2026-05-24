import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DEFAULT_MODEL = "gemini-2.5-flash";
const FALLBACK_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-latest"
] as const;
const TIMEOUT_MS = 12_000;

@Injectable()
export class AiGeminiService {
  private readonly logger = new Logger(AiGeminiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("GEMINI_API_KEY")?.trim());
  }

  private modelChain(): string[] {
    const primary =
      this.config.get<string>("GEMINI_MODEL")?.trim() || DEFAULT_MODEL;
    const chain = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
    return [...new Set(chain)];
  }

  async generateText(prompt: string): Promise<string | null> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      return null;
    }

    for (const model of this.modelChain()) {
      const text = await this.callModel(apiKey, model, prompt);
      if (text) {
        if (model !== this.modelChain()[0]) {
          this.logger.log(`Gemini OK via modèle de secours: ${model}`);
        }
        return text;
      }
    }
    return null;
  }

  private async callModel(
    apiKey: string,
    model: string,
    prompt: string
  ): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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
            maxOutputTokens: 1024,
            responseMimeType: "application/json"
          }
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(
          `Gemini ${model} HTTP ${res.status}: ${errText.slice(0, 180)}`
        );
        return null;
      }

      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gemini ${model} indisponible: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async generateWithImageUrl(
    prompt: string,
    imageUrl: string
  ): Promise<string | null> {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!apiKey) {
      return null;
    }
    const image = await this.fetchImageBase64(imageUrl);
    if (!image) {
      return null;
    }

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
                      mime_type: image.mimeType,
                      data: image.base64
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
