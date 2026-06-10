import { Injectable, Logger } from "@nestjs/common";
import { AiGeminiService } from "../ai/ai-gemini.service";
import type {
  CollectedPredictionData,
  FarmPredictionsPayload
} from "./prediction.types";

const SYSTEM_PROMPT =
  "Tu es un agent expert en production porcine et en analyse prédictive. Tu analyses des données réelles d'élevage pour générer des prévisions précises et actionnables. Tes prévisions doivent être conservatrices et basées sur les données historiques. Ne jamais inventer de données.";

@Injectable()
export class PredictiveAgentService {
  private readonly logger = new Logger(PredictiveAgentService.name);

  constructor(private readonly gemini: AiGeminiService) {}

  isConfigured(): boolean {
    return this.gemini.isConfigured();
  }

  async generatePredictions(
    data: CollectedPredictionData
  ): Promise<FarmPredictionsPayload | null> {
    if (!this.gemini.isConfigured()) {
      return null;
    }

    const userPrompt = this.buildUserPrompt(data);
    const raw = await this.gemini.generatePredictionJson(
      `${SYSTEM_PROMPT}\n\n${userPrompt}`
    );
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as FarmPredictionsPayload;
      if (!this.isValidPayload(parsed)) {
        this.logger.warn("Réponse Gemini prédictions — schéma invalide");
        return null;
      }
      return parsed;
    } catch {
      this.logger.warn("Réponse Gemini prédictions — JSON invalide");
      return null;
    }
  }

  private buildUserPrompt(data: CollectedPredictionData): string {
    return [
      "Analyse ces données d'élevage et génère des prévisions pour 30, 60 et 90 jours.",
      `Données : cheptel_actuel=${JSON.stringify(data.cheptel_data)},`,
      `gmq_historique=${JSON.stringify(data.gmq_data)},`,
      `gestations_actives=${JSON.stringify(data.gestation_data)},`,
      `mortalite_historique=${JSON.stringify(data.mortality_data)},`,
      `prix_marche=${JSON.stringify(data.price_data)},`,
      `consommation_aliment=${JSON.stringify(data.feed_data)},`,
      `historique_financier=${JSON.stringify(data.finance_data)},`,
      `objectifs_ferme=${JSON.stringify(data.settings_data)}.`,
      "Réponds UNIQUEMENT en JSON valide sans markdown selon ce schéma exact :",
      "{ cheptel_predictions: {...}, finance_predictions: {...}, stock_predictions: {...}, gestation_predictions: {...}, sale_timing: {...}, alerts: [...] }",
      "Utilise les clés d'horizon 30j, 60j, 90j. Montants en devise de la ferme.",
      "Si une donnée manque, utilise des valeurs conservatrices (0 ou tableaux vides) et baisse la confiance."
    ].join(" ");
  }

  private isValidPayload(v: unknown): v is FarmPredictionsPayload {
    if (!v || typeof v !== "object") {
      return false;
    }
    const o = v as Record<string, unknown>;
    return (
      typeof o.cheptel_predictions === "object" &&
      typeof o.finance_predictions === "object" &&
      typeof o.stock_predictions === "object" &&
      typeof o.gestation_predictions === "object" &&
      typeof o.sale_timing === "object" &&
      Array.isArray(o.alerts)
    );
  }
}
