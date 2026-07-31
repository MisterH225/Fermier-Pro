/**
 * Seed FeedRequirementProfile — besoins nutritionnels par stade porcin.
 *
 * IMPORTANT — valeurs INDICATIVES (ordres de grandeur INRAE / NRC porcs) :
 * à valider par un nutritionniste / vétérinaire avant mise en service
 * du moteur de formulation. Le superadmin peut tout corriger en console.
 *
 * Contrainte « porc sans graisse » (fattening + finishing) :
 * 1) plafond d'énergie métabolisable (maxMetabolizableEnergyKcal) ;
 * 2) ratio lysine/énergie minimal (minLysinePerMcal, g lysine / Mcal EM)
 *    — favorise les acides aminés plutôt que l'excès calorique (dépôt gras).
 */

export type ProductionStageSeed =
  | "piglet_weaning"
  | "growing"
  | "fattening"
  | "finishing"
  | "gestating_sow"
  | "lactating_sow";

export type FeedRequirementSeed = {
  stage: ProductionStageSeed;
  minCrudeProteinPct: number;
  maxCrudeProteinPct?: number;
  minMetabolizableEnergyKcal: number;
  maxMetabolizableEnergyKcal?: number;
  minLysinePct: number;
  minMethioninePct: number;
  minCalciumPct: number;
  maxCalciumPct?: number;
  minPhosphorusPct: number;
  maxFiberPct?: number;
  /** g lysine / Mcal EM — levier anti-gras si renseigné. */
  minLysinePerMcal?: number;
  targetDailyIntakeKg?: number;
  notes: string;
};

export const FEED_REQUIREMENTS_SEED: FeedRequirementSeed[] = [
  {
    stage: "piglet_weaning",
    minCrudeProteinPct: 18,
    maxCrudeProteinPct: 22,
    minMetabolizableEnergyKcal: 3200,
    maxMetabolizableEnergyKcal: 3450,
    minLysinePct: 1.2,
    minMethioninePct: 0.35,
    minCalciumPct: 0.7,
    maxCalciumPct: 1.0,
    minPhosphorusPct: 0.55,
    maxFiberPct: 4.5,
    targetDailyIntakeKg: 0.5,
    notes:
      "INRAE/NRC indicatif — post-sevrage (~7–15 kg). À valider par un nutritionniste avant mise en service."
  },
  {
    stage: "growing",
    minCrudeProteinPct: 16,
    maxCrudeProteinPct: 19,
    minMetabolizableEnergyKcal: 3100,
    maxMetabolizableEnergyKcal: 3350,
    minLysinePct: 0.95,
    minMethioninePct: 0.28,
    minCalciumPct: 0.65,
    maxCalciumPct: 0.95,
    minPhosphorusPct: 0.5,
    maxFiberPct: 5.5,
    targetDailyIntakeKg: 1.5,
    notes:
      "INRAE/NRC indicatif — croissance (~20–50 kg). À valider par un nutritionniste avant mise en service."
  },
  {
    stage: "fattening",
    minCrudeProteinPct: 14,
    maxCrudeProteinPct: 17,
    minMetabolizableEnergyKcal: 3000,
    // Levier anti-gras n°1 : plafond EM (évite ration trop calorique).
    maxMetabolizableEnergyKcal: 3200,
    minLysinePct: 0.78,
    minMethioninePct: 0.24,
    minCalciumPct: 0.6,
    maxCalciumPct: 0.9,
    minPhosphorusPct: 0.45,
    maxFiberPct: 6,
    // Levier anti-gras n°2 : lysine/énergie — densifie les AA vs calories.
    minLysinePerMcal: 2.6,
    targetDailyIntakeKg: 2.4,
    notes:
      "INRAE/NRC indicatif — engraissement (~50–80 kg). Anti-gras : max EM 3200 kcal/kg + minLysinePerMcal 2.6 g/Mcal. À valider par un nutritionniste avant mise en service."
  },
  {
    stage: "finishing",
    minCrudeProteinPct: 13,
    maxCrudeProteinPct: 16,
    minMetabolizableEnergyKcal: 2900,
    // Levier anti-gras n°1 : plafond EM plus strict en finition.
    maxMetabolizableEnergyKcal: 3100,
    minLysinePct: 0.68,
    minMethioninePct: 0.22,
    minCalciumPct: 0.55,
    maxCalciumPct: 0.85,
    minPhosphorusPct: 0.4,
    maxFiberPct: 6.5,
    // Levier anti-gras n°2 : ratio lysine/énergie renforcé.
    minLysinePerMcal: 2.4,
    targetDailyIntakeKg: 2.9,
    notes:
      "INRAE/NRC indicatif — finition (~80–110 kg). Anti-gras : max EM 3100 kcal/kg + minLysinePerMcal 2.4 g/Mcal. À valider par un nutritionniste avant mise en service."
  },
  {
    stage: "gestating_sow",
    minCrudeProteinPct: 12,
    maxCrudeProteinPct: 15,
    minMetabolizableEnergyKcal: 2800,
    maxMetabolizableEnergyKcal: 3100,
    minLysinePct: 0.55,
    minMethioninePct: 0.18,
    minCalciumPct: 0.75,
    maxCalciumPct: 1.1,
    minPhosphorusPct: 0.55,
    maxFiberPct: 8,
    targetDailyIntakeKg: 2.5,
    notes:
      "INRAE/NRC indicatif — truie gestante. À valider par un nutritionniste avant mise en service."
  },
  {
    stage: "lactating_sow",
    minCrudeProteinPct: 16,
    maxCrudeProteinPct: 19,
    minMetabolizableEnergyKcal: 3250,
    maxMetabolizableEnergyKcal: 3450,
    minLysinePct: 0.9,
    minMethioninePct: 0.28,
    minCalciumPct: 0.8,
    maxCalciumPct: 1.15,
    minPhosphorusPct: 0.6,
    maxFiberPct: 6,
    targetDailyIntakeKg: 6.0,
    notes:
      "INRAE/NRC indicatif — truie allaitante. À valider par un nutritionniste avant mise en service."
  }
];
