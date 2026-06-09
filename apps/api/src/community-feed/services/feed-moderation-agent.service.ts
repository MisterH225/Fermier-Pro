import { Injectable, Logger } from "@nestjs/common";
import { ModerationSeverity } from "@prisma/client";
import { containsPhone, maskPhoneNumbers } from "@fermier/phone";
import { AiGeminiService } from "../../ai/ai-gemini.service";
import { findCommunityRule } from "../constants/community-rules";

export type PreSendModerationResult = {
  allowed: boolean;
  maskedBody: string;
  wasPhoneMasked: boolean;
  isViolation: boolean;
  violationType: string | null;
  severity: ModerationSeverity | null;
  shouldBlock: boolean;
  warningMessageFr: string | null;
  ruleId: string | null;
  aiConfidence: number | null;
};

export type PostSendModerationResult = {
  isViolation: boolean;
  violationType: string | null;
  severity: ModerationSeverity | null;
  actionRecommended: "none" | "warn" | "remove" | "ban_temp";
  aiConfidence: number | null;
};

const PRE_SEND_PROMPT = `Analyse ce message d'un utilisateur dans une communauté d'éleveurs porcins. Évalue s'il contient : insultes ou attaques personnelles, fausses informations médicales dangereuses, contenu publicitaire déguisé, spam. Réponds JSON uniquement : { "is_violation": boolean, "violation_type": string | null, "severity": "low" | "medium" | "high" | null, "should_block": boolean, "warning_message_fr": string | null, "rule_id": string | null, "confidence": number }`;

const POST_SEND_PROMPT = `Analyse ce post publié dans une communauté d'éleveurs. Cherche des violations subtiles : contenu offensant camouflé, désinformation médicale présentée comme vraie, attaque indirecte, manipulation de la communauté. Réponds JSON : { "is_violation": boolean, "violation_type": string | null, "severity": "low" | "medium" | "high" | null, "action_recommended": "none" | "warn" | "remove" | "ban_temp", "rule_id": string | null, "confidence": number }`;

const INSULT_PATTERNS = [
  /\b(idiot|imbécile|connard|débile|nul+|pourri|sale\s+\w+)\b/i,
  /\b(stupide|crétin|merde)\b/i
];

const AD_PATTERNS = [
  /\b(promo|promotion|achetez|commandez|whatsapp|telegram)\b/i,
  /\b(offre\s+spéciale|prix\s+réduit|contactez[- ]moi)\b/i
];

@Injectable()
export class FeedModerationAgentService {
  private readonly logger = new Logger(FeedModerationAgentService.name);

  constructor(private readonly gemini: AiGeminiService) {}

  async preSendCheck(body: string): Promise<PreSendModerationResult> {
    const trimmed = body.trim();
    if (!trimmed) {
      return this.cleanResult(trimmed, false);
    }

    if (containsPhone(trimmed)) {
      const masked = maskPhoneNumbers(trimmed);
      return {
        allowed: true,
        maskedBody: masked.maskedText,
        wasPhoneMasked: true,
        isViolation: false,
        violationType: null,
        severity: null,
        shouldBlock: false,
        warningMessageFr:
          "Les numéros de téléphone sont automatiquement masqués pour votre sécurité.",
        ruleId: "R007",
        aiConfidence: 1
      };
    }

    const heuristic = this.heuristicPreSend(trimmed);
    if (heuristic) {
      return heuristic;
    }

    const ai = await this.geminiPreSend(trimmed);
    if (ai) {
      return ai;
    }

    return this.cleanResult(trimmed, false);
  }

  async postSendReview(body: string): Promise<PostSendModerationResult> {
    const trimmed = body.trim();
    if (!trimmed) {
      return {
        isViolation: false,
        violationType: null,
        severity: null,
        actionRecommended: "none",
        aiConfidence: null
      };
    }

    const ai = await this.geminiPostSend(trimmed);
    if (ai) {
      return ai;
    }

    return {
      isViolation: false,
      violationType: null,
      severity: null,
      actionRecommended: "none",
      aiConfidence: null
    };
  }

  private cleanResult(
    body: string,
    wasPhoneMasked: boolean
  ): PreSendModerationResult {
    return {
      allowed: true,
      maskedBody: body,
      wasPhoneMasked,
      isViolation: false,
      violationType: null,
      severity: null,
      shouldBlock: false,
      warningMessageFr: null,
      ruleId: null,
      aiConfidence: null
    };
  }

  private heuristicPreSend(body: string): PreSendModerationResult | null {
    if (INSULT_PATTERNS.some((p) => p.test(body))) {
      return {
        allowed: false,
        maskedBody: body,
        wasPhoneMasked: false,
        isViolation: true,
        violationType: "insulte",
        severity: ModerationSeverity.high,
        shouldBlock: true,
        warningMessageFr:
          "Ce message a été bloqué car il contient du contenu inapproprié.",
        ruleId: "R001",
        aiConfidence: 0.95
      };
    }

    if (AD_PATTERNS.some((p) => p.test(body))) {
      return {
        allowed: false,
        maskedBody: body,
        wasPhoneMasked: false,
        isViolation: true,
        violationType: "publicité",
        severity: ModerationSeverity.medium,
        shouldBlock: true,
        warningMessageFr:
          "Ce message ne respecte pas les règles de la communauté. Merci de le modifier avant d'envoyer.",
        ruleId: "R005",
        aiConfidence: 0.9
      };
    }

    if (/\b(peut[- ]être|éventuellement|si\s+vous)\b/i.test(body) && /\b(maladie|symptôme)\b/i.test(body)) {
      return {
        allowed: true,
        maskedBody: body,
        wasPhoneMasked: false,
        isViolation: true,
        violationType: "pertinence",
        severity: ModerationSeverity.low,
        shouldBlock: false,
        warningMessageFr:
          "Rappel : restez bienveillant et pertinent dans vos échanges.",
        ruleId: "R003",
        aiConfidence: 0.7
      };
    }

    return null;
  }

  private async geminiPreSend(body: string): Promise<PreSendModerationResult | null> {
    if (!this.gemini.isConfigured()) {
      return null;
    }
    try {
      const raw = await this.gemini.generateText(`${PRE_SEND_PROMPT}\n\nMessage:\n${body}`);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(this.extractJson(raw)) as {
        is_violation?: boolean;
        violation_type?: string | null;
        severity?: ModerationSeverity | null;
        should_block?: boolean;
        warning_message_fr?: string | null;
        rule_id?: string | null;
        confidence?: number;
      };

      if (!parsed.is_violation) {
        return null;
      }

      const severity = parsed.severity ?? ModerationSeverity.medium;
      const shouldBlock = Boolean(parsed.should_block) || severity !== ModerationSeverity.low;
      const rule = findCommunityRule(parsed.rule_id);

      return {
        allowed: !shouldBlock,
        maskedBody: body,
        wasPhoneMasked: false,
        isViolation: true,
        violationType: parsed.violation_type ?? rule?.label ?? "violation",
        severity,
        shouldBlock,
        warningMessageFr:
          parsed.warning_message_fr ??
          (severity === ModerationSeverity.low
            ? "Rappel : restez bienveillant et pertinent dans vos échanges."
            : severity === ModerationSeverity.medium
              ? "Ce message ne respecte pas les règles de la communauté. Merci de le modifier avant d'envoyer."
              : "Ce message a été bloqué car il contient du contenu inapproprié."),
        ruleId: parsed.rule_id ?? rule?.id ?? null,
        aiConfidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85
      };
    } catch (err) {
      this.logger.warn(`Gemini pre-send moderation failed: ${String(err)}`);
      return null;
    }
  }

  private async geminiPostSend(body: string): Promise<PostSendModerationResult | null> {
    if (!this.gemini.isConfigured()) {
      return null;
    }
    try {
      const raw = await this.gemini.generateText(`${POST_SEND_PROMPT}\n\nPost:\n${body}`);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(this.extractJson(raw)) as {
        is_violation?: boolean;
        violation_type?: string | null;
        severity?: ModerationSeverity | null;
        action_recommended?: PostSendModerationResult["actionRecommended"];
        confidence?: number;
      };

      if (!parsed.is_violation) {
        return {
          isViolation: false,
          violationType: null,
          severity: null,
          actionRecommended: "none",
          aiConfidence: null
        };
      }

      return {
        isViolation: true,
        violationType: parsed.violation_type ?? "violation_subtile",
        severity: parsed.severity ?? ModerationSeverity.medium,
        actionRecommended: parsed.action_recommended ?? "warn",
        aiConfidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8
      };
    } catch (err) {
      this.logger.warn(`Gemini post-send moderation failed: ${String(err)}`);
      return null;
    }
  }

  private extractJson(raw: string): string {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return raw.slice(start, end + 1);
    }
    return raw;
  }
}
