/** Phase de croissance porcine (cycle de production). */
export type ProductionGrowthPhase =
  | "sous_mere"
  | "transition"
  | "starter"
  | "growth"
  | "fattening";

export type GrowthStandards = {
  /** GMQ (g/j) par phase — valeurs ferme ou défauts métier. */
  gmqGPerDay: Record<ProductionGrowthPhase, number>;
  /** Seuils d'âge (semaines) pour sous_mère / transition. */
  ageWeeksSousMereMax: number;
  ageWeeksTransitionMax: number;
  /** Seuil démarrage → croissance (semaines), depuis paramètres ferme. */
  ageWeeksStarterMax: number;
  /** Seuil croissance → engraissement (semaines). */
  ageWeeksGrowthMax: number;
  /** Poids seuil démarrage → engraissement (kg), depuis paramètres ferme. */
  weightKgStarterMax: number;
  /** Poids à la naissance porcelet (kg). */
  birthWeightKg: number;
  /** Poids type au sevrage (~3 sem.). */
  weaningWeightKg: number;
};

export const DEFAULT_GROWTH_STANDARDS: GrowthStandards = {
  gmqGPerDay: {
    sous_mere: 250,
    transition: 350,
    starter: 300,
    growth: 450,
    fattening: 650
  },
  ageWeeksSousMereMax: 3,
  ageWeeksTransitionMax: 5,
  ageWeeksStarterMax: 10,
  ageWeeksGrowthMax: 20,
  weightKgStarterMax: 30,
  birthWeightKg: 1.4,
  weaningWeightKg: 7
};

export type AnimalGrowthInput = {
  birthDate?: Date | null;
  ageWeeksAtEntry?: number | null;
  entryDate?: Date | null;
  entryWeightKg?: number | null;
  lastWeightKg?: number | null;
  lastWeightAt?: Date | null;
  productionCategory?: string | null;
};
