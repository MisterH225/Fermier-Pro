import { Injectable, Logger } from "@nestjs/common";
import {
  ChatMessageModificationType,
  ChatSecurityEventType,
  type Prisma
} from "@prisma/client";
import { containsPhone, maskPhoneNumbers } from "@fermier/phone";
import { AiGeminiService } from "../ai/ai-gemini.service";
import { PrismaService } from "../prisma/prisma.service";

const ALPHABETIC_PROMPT = `Analyse ce message de chat. Contient-il un numéro de téléphone écrit en lettres ou de façon dissimulée (ex: zero sept zero huit, 0-7-0-8, etc.) ? Réponds JSON uniquement : { "contains_phone": boolean, "confidence": number }`;

const ALPHABETIC_CONFIDENCE_THRESHOLD = 0.85;

export type SanitizedChatText = {
  body: string;
  wasModified: boolean;
  modificationType: ChatMessageModificationType | null;
};

@Injectable()
export class ChatPhoneSecurityService {
  private readonly logger = new Logger(ChatPhoneSecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: AiGeminiService
  ) {}

  async sanitizeMessageText(
    userId: string,
    farmId: string | null,
    rawBody: string
  ): Promise<SanitizedChatText> {
    const trimmed = rawBody.trim();
    if (!trimmed) {
      return { body: trimmed, wasModified: false, modificationType: null };
    }

    const regexResult = maskPhoneNumbers(trimmed);
    if (regexResult.wasModified) {
      await this.logEvent(userId, farmId, ChatSecurityEventType.phone_masked_in_text, {
        matchCount: regexResult.matchCount
      });
      return {
        body: regexResult.maskedText,
        wasModified: true,
        modificationType: ChatMessageModificationType.phone_masked
      };
    }

    if (!containsPhone(trimmed)) {
      const alphabetic = await this.detectAlphabeticPhone(trimmed);
      if (alphabetic.blocked) {
        await this.logEvent(
          userId,
          farmId,
          ChatSecurityEventType.alphabetic_phone_attempt,
          { confidence: alphabetic.confidence }
        );
        return {
          body: "****",
          wasModified: true,
          modificationType: ChatMessageModificationType.phone_masked
        };
      }
      if (alphabetic.logged) {
        await this.logEvent(
          userId,
          farmId,
          ChatSecurityEventType.alphabetic_phone_attempt,
          { confidence: alphabetic.confidence, review: true }
        );
      }
    }

    return { body: trimmed, wasModified: false, modificationType: null };
  }

  private async detectAlphabeticPhone(
    text: string
  ): Promise<{ blocked: boolean; confidence: number; logged: boolean }> {
    if (!this.gemini.isConfigured()) {
      return { blocked: false, confidence: 0, logged: false };
    }
    const prompt = `${ALPHABETIC_PROMPT}\n\nMessage:\n${text}`;
    const raw = await this.gemini.generateText(prompt);
    if (!raw) {
      this.logger.warn("Gemini indisponible pour détection alphabétique — laisser passer");
      return { blocked: false, confidence: 0, logged: true };
    }
    try {
      const parsed = JSON.parse(raw) as {
        contains_phone?: boolean;
        confidence?: number;
      };
      const confidence =
        typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const contains = Boolean(parsed.contains_phone);
      if (contains && confidence > ALPHABETIC_CONFIDENCE_THRESHOLD) {
        return { blocked: true, confidence, logged: false };
      }
      if (contains && confidence >= 0.5) {
        return { blocked: false, confidence, logged: true };
      }
      return { blocked: false, confidence, logged: false };
    } catch {
      this.logger.warn("Réponse Gemini alphabétique invalide");
      return { blocked: false, confidence: 0, logged: true };
    }
  }

  async logImageBlocked(
    userId: string,
    farmId: string | null,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.logEvent(userId, farmId, ChatSecurityEventType.image_blocked_phone, context);
  }

  private async logEvent(
    userId: string,
    farmId: string | null,
    eventType: ChatSecurityEventType,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.prisma.chatSecurityEvent.create({
        data: {
          userId,
          farmId: farmId ?? undefined,
          eventType,
          context: (context ?? undefined) as Prisma.InputJsonValue | undefined
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Impossible de journaliser ${eventType}: ${msg}`);
    }
  }
}
