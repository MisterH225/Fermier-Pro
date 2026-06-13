import type { FeedProductionPhase } from "@prisma/client";

export type PhaseInference = {
  phase: FeedProductionPhase;
  confidence: "high" | "medium" | "low";
  alternatives: FeedProductionPhase[];
};

const PHASE_LABELS: Record<FeedProductionPhase, string> = {
  sous_mere: "Sous mère / lactation",
  transition: "Transition / sevrage",
  starter: "Démarrage",
  growth: "Croissance",
  fattening: "Engraissement",
  breeder: "Reproducteurs",
  unknown: "Non précisé"
};

export function feedPhaseLabel(phase: FeedProductionPhase): string {
  return PHASE_LABELS[phase] ?? phase;
}

/** Infère la phase cible d'un aliment à partir de son libellé. */
export function inferFeedPhaseFromName(name: string): PhaseInference {
  const k = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();

  const rules: Array<{
    phase: FeedProductionPhase;
    confidence: PhaseInference["confidence"];
    patterns: RegExp[];
  }> = [
    {
      phase: "sous_mere",
      confidence: "high",
      patterns: [
        /\bsous[\s-]?mere\b/,
        /\blactation\b/,
        /\bmaternel\b/,
        /\bpre[\s-]?sevrage\b/
      ]
    },
    {
      phase: "transition",
      confidence: "high",
      patterns: [
        /\btransition\b/,
        /\bpost[\s-]?sevrage\b/,
        /\bpre[\s-]?demarrage\b/,
        /\bsevrage\b/
      ]
    },
    {
      phase: "starter",
      confidence: "high",
      patterns: [/\bdemarrage\b/, /\bstarter\b/, /\bporcelet\b/]
    },
    {
      phase: "growth",
      confidence: "high",
      patterns: [/\bcroissance\b/, /\bgrowth\b/, /\bdeveloppement\b/]
    },
    {
      phase: "fattening",
      confidence: "high",
      patterns: [
        /\bengraissement\b/,
        /\bfinition\b/,
        /\bfinisher\b/,
        /\bfattening\b/
      ]
    },
    {
      phase: "breeder",
      confidence: "medium",
      patterns: [/\breproducteur\b/, /\bgestation\b/, /\btruie\b/, /\bverrat\b/]
    }
  ];

  const hits: FeedProductionPhase[] = [];
  let best: PhaseInference | null = null;

  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(k))) {
      hits.push(rule.phase);
      if (!best || rule.confidence === "high") {
        best = {
          phase: rule.phase,
          confidence: rule.confidence,
          alternatives: []
        };
      }
    }
  }

  if (best) {
    best.alternatives = hits.filter((h) => h !== best!.phase);
    if (best.alternatives.length > 0 && best.confidence === "high") {
      best.confidence = "medium";
    }
    return best;
  }

  if (/\baliment\b/.test(k) || k.length < 4) {
    return { phase: "unknown", confidence: "low", alternatives: [] };
  }

  return {
    phase: "unknown",
    confidence: "low",
    alternatives: ["starter", "growth", "fattening"]
  };
}

/** Phase alimentaire attendue pour une bande (catégorie + âge moyen). */
export function resolveBatchFeedPhase(params: {
  categoryKey: string | null | undefined;
  productionCategory?: string | null;
  avgAgeWeeks: number | null;
}): FeedProductionPhase {
  const cat = (
    params.categoryKey ??
    params.productionCategory ??
    ""
  ).toLowerCase();

  const isFattening =
    cat.includes("finish") ||
    cat.includes("engrais") ||
    cat === "fattening" ||
    cat === "finisher";
  if (isFattening) {
    return "fattening";
  }

  const isStarter =
    cat.includes("nursery") ||
    cat.includes("demarrage") ||
    cat === "starter" ||
    cat.includes("porcelet");
  const age = params.avgAgeWeeks;

  if (isStarter || cat === "starter") {
    if (age == null) {
      return "starter";
    }
    if (age <= 3) {
      return "sous_mere";
    }
    if (age <= 5) {
      return "transition";
    }
    if (age <= 12) {
      return "starter";
    }
    return "growth";
  }

  if (age != null) {
    if (age <= 5) {
      return "transition";
    }
    if (age <= 12) {
      return "starter";
    }
    if (age <= 20) {
      return "growth";
    }
    return "fattening";
  }

  return "growth";
}

/** Deux phases sont compatibles pour l'affectation (ex. transition ↔ starter). */
export function feedPhasesCompatible(
  feedPhase: FeedProductionPhase,
  batchPhase: FeedProductionPhase
): boolean {
  if (feedPhase === "unknown" || batchPhase === "unknown") {
    return true;
  }
  if (feedPhase === batchPhase) {
    return true;
  }
  const adjacent: Record<FeedProductionPhase, FeedProductionPhase[]> = {
    sous_mere: ["transition"],
    transition: ["sous_mere", "starter"],
    starter: ["transition", "growth"],
    growth: ["starter", "fattening"],
    fattening: ["growth"],
    breeder: [],
    unknown: []
  };
  return adjacent[feedPhase]?.includes(batchPhase) ?? false;
}

export function effectiveFeedPhase(
  stored: FeedProductionPhase,
  name: string
): FeedProductionPhase {
  if (stored !== "unknown") {
    return stored;
  }
  const inferred = inferFeedPhaseFromName(name);
  return inferred.confidence === "high" ? inferred.phase : "unknown";
}
