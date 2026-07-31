import { ProductionStage } from "@prisma/client";
import type { GeminiFunctionDeclaration } from "../../../ai/ai-gemini.service";

const STAGE_ENUM = Object.values(ProductionStage);

/** Déclarations d'outils Gemini — l'IA ne calcule jamais elle-même. */
export const FORMULATION_TOOLS: GeminiFunctionDeclaration[] = [
  {
    name: "formulate_ration",
    description:
      "Calcule une ration au moindre coût pour un stade de production. " +
      "Obligatoire pour toute quantité / coût / nutrition. " +
      "Ne pas inventer de chiffres — toujours appeler cet outil.",
    parameters: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: STAGE_ENUM,
          description: "Stade de production porcin"
        },
        animalCount: {
          type: "number",
          description: "Nombre d'animaux"
        },
        avgWeightKg: {
          type: "number",
          description: "Poids moyen estimé (kg)"
        },
        avgAgeWeeks: {
          type: "number",
          description: "Âge moyen en semaines (optionnel)"
        },
        durationDays: {
          type: "number",
          description: "Durée de la période d'alimentation (jours)"
        },
        millId: {
          type: "string",
          description:
            "Id du profil moulin (MerchantProfile) si ciblé ; sinon formulation théorique catalogue"
        }
      },
      required: ["stage", "animalCount", "avgWeightKg", "durationDays"]
    }
  },
  {
    name: "recompute_with_substitution",
    description:
      "Relance la formulation en retirant un intrant et en autorisant un substitut. " +
      "Renvoie aussi l'écart nutritionnel (ex. hausse d'énergie / risque de gras).",
    parameters: {
      type: "object",
      properties: {
        stage: { type: "string", enum: STAGE_ENUM },
        animalCount: { type: "number" },
        avgWeightKg: { type: "number" },
        avgAgeWeeks: { type: "number" },
        durationDays: { type: "number" },
        millId: { type: "string" },
        removeIngredientId: {
          type: "string",
          description: "Id FeedIngredient à retirer"
        },
        addIngredientId: {
          type: "string",
          description: "Id FeedIngredient substitut à autoriser"
        },
        addPricePerKg: {
          type: "number",
          description: "Prix/kg du substitut (si connu) ; sinon prix de référence"
        },
        addMaxAvailableKg: {
          type: "number",
          description: "Stock max kg du substitut ; défaut large si théorique"
        }
      },
      required: [
        "stage",
        "animalCount",
        "avgWeightKg",
        "durationDays",
        "removeIngredientId",
        "addIngredientId"
      ]
    }
  }
];

export const FORMULATION_TOOL_NAMES = [
  "formulate_ration",
  "recompute_with_substitution"
] as const;

export type FormulationToolName = (typeof FORMULATION_TOOL_NAMES)[number];

export function isFormulationToolName(name: string): name is FormulationToolName {
  return (FORMULATION_TOOL_NAMES as readonly string[]).includes(name);
}
