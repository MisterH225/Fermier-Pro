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
}
