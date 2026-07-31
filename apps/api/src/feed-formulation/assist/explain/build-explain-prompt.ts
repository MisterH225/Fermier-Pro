import type { ProductionStage } from "@prisma/client";
import type { RequirementProfileSnapshot } from "../../engine/feed-formulation.types";
import type {
  DeviationForExplain,
  IngredientRoleContext,
  NutritionForExplain
} from "./composition-explanation.types";
import { formatNutritionLine } from "./ingredient-roles";

/**
 * Prompt Gemini — l'IA commente UNIQUEMENT les nombres fournis.
 * Sortie JSON structurée.
 */
export function buildExplainPrompt(input: {
  stage: ProductionStage;
  animalCount: number;
  avgWeightKg?: number | null;
  avgAgeWeeks?: number | null;
  profile: RequirementProfileSnapshot;
  nutrition: NutritionForExplain;
  deviations: DeviationForExplain[];
  roles: IngredientRoleContext[];
}): string {
  const p = input.profile;
  const payload = {
    stade: input.stage,
    effectif: input.animalCount,
    poidsMoyenKg: input.avgWeightKg ?? null,
    ageMoyenSemaines: input.avgAgeWeeks ?? null,
    besoinsStade: {
      proteinesPct: {
        min: p.minCrudeProteinPct,
        max: p.maxCrudeProteinPct
      },
      energieKcalKg: {
        min: p.minMetabolizableEnergyKcal,
        max: p.maxMetabolizableEnergyKcal
      },
      lysinePctMin: p.minLysinePct,
      methioninePctMin: p.minMethioninePct,
      calciumPctMin: p.minCalciumPct,
      calciumPctMax: p.maxCalciumPct,
      phosphorePctMin: p.minPhosphorusPct,
      fibresPctMax: p.maxFiberPct,
      lysineParMcalMin: p.minLysinePerMcal
    },
    profilObtenu: formatNutritionLine(input.nutrition),
    energieExacteKcalKg: input.nutrition.metabolizableEnergyKcal,
    ecarts: input.deviations.map((d) => ({
      nutriment: d.nutrient,
      cible: d.target,
      obtenu: d.actual,
      dansLesBornes: d.withinBounds
    })),
    intrants: input.roles.map((r) => ({
      id: r.feedIngredientId,
      nom: r.name,
      partPct: r.proportionPct,
      categorie: r.categoryLabelFr,
      nutrimentsDominants: r.dominantNutrients
    }))
  };

  return `Tu es un conseiller alimentation porcine en Afrique de l'Ouest.
Tu expliques une ration déjà CALCULÉE à un éleveur, en français simple (phrases courtes).

RÈGLE ANTI-HALLUCINATION (obligatoire) :
- Tu ne dois inventer AUCUN chiffre.
- Tu ne cites que les nombres présents dans DONNÉES ci-dessous (recopie-les tels quels).
- Si tu parles d'énergie, utilise exactement energieExacteKcalKg.

Structure ta réponse en JSON strict (pas de markdown) :
{
  "stageNeeds": "2–4 phrases : ce dont CES animaux ont besoin À CE STADE et pourquoi, en citant les cibles fournies",
  "ingredientJustifications": [
    { "feedIngredientId": "<id>", "name": "<nom>", "text": "1–2 phrases : ce que cet intrant apporte aux besoins du stade" }
  ],
  "energyComment": "1–2 phrases : valeur énergétique totale (nombre fourni) et rapport à l'objectif porc sans graisse (plafond finition/engraissement si présent)",
  "notableDeviations": ["phrase pour chaque écart hors bornes, sinon tableau vide"]
}

Consignes :
- Justifie CHAQUE intrant de la liste (surtout ceux ≥ 2 % de la ration).
- CMV / sel / minéraux : expliquer le rôle vitamines-minéraux, pas l'optimisation.
- Pas de jargon inutile ; pas de conseils hors données.
- notableDeviations : uniquement les écarts avec dansLesBornes=false.

DONNÉES (source de vérité) :
${JSON.stringify(payload, null, 2)}
`;
}

/** Valide que les textes IA ne contiennent pas de nombres absents des données. */
export function assertNoHallucinatedNumbers(
  texts: string[],
  allowedNumbers: number[]
): boolean {
  const allowed = new Set(
    allowedNumbers
      .filter((n) => Number.isFinite(n))
      .flatMap((n) => variantsOf(n))
  );
  const re = /\d+(?:[.,]\d+)?/g;
  for (const text of texts) {
    const matches = text.match(re) ?? [];
    for (const m of matches) {
      const normalized = m.replace(",", ".");
      const asNum = Number(normalized);
      if (!Number.isFinite(asNum)) continue;
      // Ignore années / ids triviaux trop grands hors contexte nutrition
      if (asNum > 20_000) continue;
      if (!allowed.has(normalized) && !allowed.has(String(asNum))) {
        // Tolérance arrondi 2 décimales
        const close = [...allowed].some((a) => {
          const an = Number(a);
          return Number.isFinite(an) && Math.abs(an - asNum) < 0.015;
        });
        if (!close) return false;
      }
    }
  }
  return true;
}

function variantsOf(n: number): string[] {
  const out = new Set<string>();
  out.add(String(n));
  out.add(n.toFixed(0));
  out.add(n.toFixed(1));
  out.add(n.toFixed(2));
  out.add(String(n).replace(".", ","));
  out.add(n.toFixed(1).replace(".", ","));
  out.add(n.toFixed(2).replace(".", ","));
  // fr-FR espaces milliers pour grands nombres (ex. 3100)
  if (n >= 1000) {
    out.add(Math.round(n).toLocaleString("fr-FR"));
  }
  return [...out];
}

export function collectAllowedNumbers(input: {
  animalCount: number;
  avgWeightKg?: number | null;
  avgAgeWeeks?: number | null;
  profile: RequirementProfileSnapshot;
  nutrition: NutritionForExplain;
  deviations: DeviationForExplain[];
  roles: IngredientRoleContext[];
}): number[] {
  const p = input.profile;
  const nums: number[] = [
    input.animalCount,
    input.avgWeightKg ?? NaN,
    input.avgAgeWeeks ?? NaN,
    p.minCrudeProteinPct,
    p.maxCrudeProteinPct ?? NaN,
    p.minMetabolizableEnergyKcal,
    p.maxMetabolizableEnergyKcal ?? NaN,
    p.minLysinePct,
    p.minMethioninePct,
    p.minCalciumPct,
    p.maxCalciumPct ?? NaN,
    p.minPhosphorusPct,
    p.maxFiberPct ?? NaN,
    p.minLysinePerMcal ?? NaN,
    input.nutrition.crudeProteinPct,
    input.nutrition.metabolizableEnergyKcal,
    input.nutrition.lysinePct,
    input.nutrition.methioninePct,
    input.nutrition.calciumPct,
    input.nutrition.phosphorusPct,
    input.nutrition.crudeFiberPct,
    input.nutrition.lysinePerMcal ?? NaN,
    ...input.deviations.map((d) => d.actual),
    ...input.roles.map((r) => r.proportionPct)
  ];
  return nums.filter((n) => Number.isFinite(n));
}
