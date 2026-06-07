import { Injectable, Logger } from "@nestjs/common";
import { AiGeminiService } from "../ai/ai-gemini.service";

const VISION_PROMPT = `Analyse cette image. Contient-elle un numéro de téléphone visible, qu'il soit écrit à la main, tapé, ou imprimé ? Cherche aussi les numéros partiellement cachés ou écrits de façon créative. Réponds JSON uniquement : { "contains_phone": boolean, "confidence": number, "detected_numbers": string[] }`;

export type ImageAnalysisResult = {
  allowed: boolean;
  reason?: "phone_number_detected" | "analysis_unavailable";
};

@Injectable()
export class ImageAnalysisService {
  private readonly logger = new Logger(ImageAnalysisService.name);

  constructor(private readonly gemini: AiGeminiService) {}

  async analyzeImageBase64(
    base64: string,
    mimeType: string
  ): Promise<ImageAnalysisResult> {
    if (!this.gemini.isConfigured()) {
      this.logger.warn("Gemini indisponible — image bloquée par précaution");
      return { allowed: false, reason: "analysis_unavailable" };
    }

    const raw = await this.gemini.generateWithImageBase64(
      VISION_PROMPT,
      base64,
      mimeType
    );
    if (!raw) {
      this.logger.warn("Analyse vision échouée — image bloquée par précaution");
      return { allowed: false, reason: "analysis_unavailable" };
    }

    try {
      const parsed = JSON.parse(raw) as {
        contains_phone?: boolean;
        confidence?: number;
        detected_numbers?: string[];
      };
      const confidence =
        typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const contains = Boolean(parsed.contains_phone);

      if (contains && confidence >= 0.5) {
        return { allowed: false, reason: "phone_number_detected" };
      }
      if (confidence < 0.5) {
        return { allowed: true };
      }
      return { allowed: true };
    } catch {
      this.logger.warn("Réponse Gemini vision invalide — image bloquée par précaution");
      return { allowed: false, reason: "analysis_unavailable" };
    }
  }
}
