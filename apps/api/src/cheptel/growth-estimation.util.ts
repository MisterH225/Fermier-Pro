import { calculateAnimalAgeWeeks } from "./age-calculation.util";
import type {
  AnimalGrowthInput,
  GrowthStandards,
  ProductionGrowthPhase
} from "./growth-estimation.types";
import { DEFAULT_GROWTH_STANDARDS } from "./growth-estimation.types";

const MS_DAY = 86_400_000;

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Phase de croissance à un âge donné (semaines entières). */
export function resolveProductionGrowthPhase(
  ageWeeks: number | null,
  productionCategory: string | null | undefined,
  standards: GrowthStandards = DEFAULT_GROWTH_STANDARDS
): ProductionGrowthPhase {
  const cat = (productionCategory ?? "").toLowerCase();
  if (
    cat.includes("finish") ||
    cat.includes("engrais") ||
    cat === "fattening" ||
    cat === "finisher"
  ) {
    return "fattening";
  }

  if (ageWeeks == null) {
    return cat === "starter" || cat.includes("demarrage") ? "starter" : "growth";
  }

  if (ageWeeks <= standards.ageWeeksSousMereMax) {
    return "sous_mere";
  }
  if (ageWeeks <= standards.ageWeeksTransitionMax) {
    return "transition";
  }
  if (ageWeeks <= standards.ageWeeksStarterMax) {
    return "starter";
  }
  if (ageWeeks <= standards.ageWeeksGrowthMax) {
    return "growth";
  }
  return "fattening";
}

/** Point de départ poids + date pour la simulation. */
function resolveWeightAnchor(
  animal: AnimalGrowthInput,
  standards: GrowthStandards,
  referenceDate: Date
): { weightKg: number; anchorDate: Date } | null {
  const refDay = startOfUtcDay(referenceDate);

  if (animal.lastWeightAt && animal.lastWeightKg != null && animal.lastWeightKg > 0) {
    return {
      weightKg: animal.lastWeightKg,
      anchorDate: animal.lastWeightAt
    };
  }

  if (
    animal.entryWeightKg != null &&
    animal.entryWeightKg > 0 &&
    animal.entryDate
  ) {
    return {
      weightKg: animal.entryWeightKg,
      anchorDate: animal.entryDate
    };
  }

  if (animal.birthDate) {
    const birthDay = startOfUtcDay(animal.birthDate);
    if (birthDay > refDay) {
      return null;
    }
    const ageAtRef = calculateAnimalAgeWeeks(
      { birthDate: animal.birthDate, ageWeeksAtEntry: null, entryDate: null },
      referenceDate
    );
    const weightKg =
      ageAtRef != null && ageAtRef > standards.ageWeeksSousMereMax
        ? standards.weaningWeightKg
        : standards.birthWeightKg;
    return { weightKg, anchorDate: animal.birthDate };
  }

  if (
    animal.ageWeeksAtEntry != null &&
    animal.entryDate &&
    Number.isFinite(animal.ageWeeksAtEntry)
  ) {
    const entryDay = startOfUtcDay(animal.entryDate);
    if (entryDay > refDay) {
      return null;
    }
    const entryAge = animal.ageWeeksAtEntry;
    let weightKg = standards.weaningWeightKg;
    if (entryAge <= standards.ageWeeksSousMereMax) {
      weightKg = standards.birthWeightKg;
    } else if (entryAge > standards.ageWeeksStarterMax) {
      weightKg = standards.weightKgStarterMax;
    }
    return { weightKg, anchorDate: animal.entryDate };
  }

  return null;
}

/**
 * Estime le poids actuel (kg) en appliquant le GMQ configuré semaine par semaine
 * depuis la naissance, l'entrée ou la dernière pesée.
 */
export function estimateAnimalWeightKg(
  animal: AnimalGrowthInput,
  referenceDate: Date = new Date(),
  standards: GrowthStandards = DEFAULT_GROWTH_STANDARDS
): number | null {
  const anchor = resolveWeightAnchor(animal, standards, referenceDate);
  if (!anchor) {
    return null;
  }

  const refDay = startOfUtcDay(referenceDate);
  let cursorDay = startOfUtcDay(anchor.anchorDate);
  if (cursorDay > refDay) {
    return null;
  }

  let weightKg = anchor.weightKg;

  while (cursorDay < refDay) {
    const cursorDate = new Date(cursorDay);
    const ageWeeks = calculateAnimalAgeWeeks(
      {
        birthDate: animal.birthDate ?? null,
        ageWeeksAtEntry: animal.ageWeeksAtEntry ?? null,
        entryDate: animal.entryDate ?? null
      },
      cursorDate
    );
    const phase = resolveProductionGrowthPhase(
      ageWeeks,
      animal.productionCategory,
      standards
    );
    const gmq = standards.gmqGPerDay[phase];
    const nextWeekDay = Math.min(cursorDay + 7 * MS_DAY, refDay);
    const days = (nextWeekDay - cursorDay) / MS_DAY;
    weightKg += (gmq / 1000) * days;
    cursorDay = nextWeekDay;
  }

  return Math.round(weightKg * 10) / 10;
}

/** Catégorie production après simulation (starter → fattening). */
export function resolveAutoProductionCategory(
  animal: AnimalGrowthInput,
  referenceDate: Date = new Date(),
  standards: GrowthStandards = DEFAULT_GROWTH_STANDARDS
): "starter" | "fattening" | null {
  const cat = (animal.productionCategory ?? "").toLowerCase();
  if (cat !== "starter") {
    return null;
  }

  const ageWeeks = calculateAnimalAgeWeeks(
    {
      birthDate: animal.birthDate ?? null,
      ageWeeksAtEntry: animal.ageWeeksAtEntry ?? null,
      entryDate: animal.entryDate ?? null
    },
    referenceDate
  );
  const weightKg = estimateAnimalWeightKg(animal, referenceDate, standards);

  const overAge =
    ageWeeks != null && ageWeeks > standards.ageWeeksStarterMax;
  const overWeight =
    weightKg != null && weightKg >= standards.weightKgStarterMax;

  if (overAge || overWeight) {
    return "fattening";
  }
  return "starter";
}

/** Phase aliment batch alignée sur les standards configurables. */
export function resolveBatchFeedPhaseFromStandards(
  params: {
    categoryKey: string | null | undefined;
    productionCategory?: string | null;
    avgAgeWeeks: number | null;
  },
  standards: GrowthStandards = DEFAULT_GROWTH_STANDARDS
): ProductionGrowthPhase {
  const phase = resolveProductionGrowthPhase(
    params.avgAgeWeeks,
    params.categoryKey ?? params.productionCategory,
    standards
  );
  return phase;
}

export function buildGrowthStandardsFromFarm(params: {
  gmqRefStarter?: number | null;
  gmqRefGrowth?: number | null;
  gmqRefFattening?: number | null;
  gmqTargetStarter?: number | null;
  gmqTargetGrowth?: number | null;
  gmqTargetFattening?: number | null;
  starterMaxAvgWeightKg?: number | null;
  starterMaxAvgAgeWeeks?: number | null;
}): GrowthStandards {
  const s = { ...DEFAULT_GROWTH_STANDARDS, gmqGPerDay: { ...DEFAULT_GROWTH_STANDARDS.gmqGPerDay } };

  const pick = (target: number | null | undefined, ref: number | null | undefined, fallback: number) =>
    target ?? ref ?? fallback;

  s.gmqGPerDay.starter = pick(
    params.gmqTargetStarter,
    params.gmqRefStarter,
    DEFAULT_GROWTH_STANDARDS.gmqGPerDay.starter
  );
  s.gmqGPerDay.growth = pick(
    params.gmqTargetGrowth,
    params.gmqRefGrowth,
    DEFAULT_GROWTH_STANDARDS.gmqGPerDay.growth
  );
  s.gmqGPerDay.fattening = pick(
    params.gmqTargetFattening,
    params.gmqRefFattening,
    DEFAULT_GROWTH_STANDARDS.gmqGPerDay.fattening
  );
  s.gmqGPerDay.transition = Math.round(
    (s.gmqGPerDay.starter + s.gmqGPerDay.growth) / 2
  );
  s.gmqGPerDay.sous_mere = Math.round(s.gmqGPerDay.starter * 0.85);

  if (params.starterMaxAvgWeightKg != null) {
    s.weightKgStarterMax = params.starterMaxAvgWeightKg;
  }
  if (params.starterMaxAvgAgeWeeks != null) {
    s.ageWeeksStarterMax = params.starterMaxAvgAgeWeeks;
  }

  return s;
}
