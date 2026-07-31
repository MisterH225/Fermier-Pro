import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageParam,
  Tool
} from "@anthropic-ai/sdk/resources/messages";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/** Défaut : Haiku récent / économique pour dialogue court. Configurable via ANTHROPIC_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_TOKENS = 1024;

export type AnthropicUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AnthropicChatParams = {
  system: string;
  messages: MessageParam[];
  tools: Tool[];
  maxTokens?: number;
};

/**
 * Client Anthropic serveur-only (ANTHROPIC_API_KEY jamais exposée au mobile).
 * Isolé pour mocker facilement dans les tests.
 */
@Injectable()
export class AnthropicClientService {
  private readonly logger = new Logger(AnthropicClientService.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("ANTHROPIC_API_KEY")?.trim());
  }

  model(): string {
    return (
      this.config.get<string>("ANTHROPIC_MODEL")?.trim() ||
      DEFAULT_ANTHROPIC_MODEL
    );
  }

  timeoutMs(): number {
    const raw = this.config.get<string>("ANTHROPIC_TIMEOUT_MS");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
  }

  async createMessage(params: AnthropicChatParams): Promise<Message> {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY")?.trim();
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY manquante");
    }
    if (!this.client) {
      this.client = new Anthropic({
        apiKey,
        timeout: this.timeoutMs()
      });
    }

    return this.client.messages.create({
      model: this.model(),
      max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: params.system,
      messages: params.messages,
      tools: params.tools
    });
  }

  /** Log coût tokens sans PII (pas de contenu message). */
  logUsage(usage: AnthropicUsage, meta: { toolIterations: number }): void {
    this.logger.log(
      JSON.stringify({
        event: "anthropic_usage",
        model: this.model(),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        toolIterations: meta.toolIterations
      })
    );
  }
}
