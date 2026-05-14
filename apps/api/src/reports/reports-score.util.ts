export type ScoreBreakdown = {
  dataRegularity: { score: number; detail: string };
  financialHealth: { score: number; detail: string };
  herdHealth: { score: number; detail: string };
  productivity: { score: number; detail: string };
  historyCompleteness: { score: number; detail: string };
};

const W = {
  dataRegularity: 0.2,
  financialHealth: 0.25,
  herdHealth: 0.2,
  productivity: 0.2,
  historyCompleteness: 0.15
} as const;

export function computeFarmScore(input: {
  entryDensity: number;
  marginRatio: number;
  mortalityRate: number;
  vaccineOverdueCount: number;
  farrowingsCount: number;
  farmAgeMonths: number;
  monthsWithFinanceData: number;
}): { global: number; band: string; breakdown: ScoreBreakdown } {
  const reg = Math.min(100, Math.round((input.entryDensity / 25) * 100));
  const regScore = Number.isFinite(reg) ? reg : 40;

  let fin = 55;
  if (input.marginRatio >= 0.15) fin = 92;
  else if (input.marginRatio >= 0.05) fin = 78;
  else if (input.marginRatio >= 0) fin = 65;
  else if (input.marginRatio >= -0.1) fin = 48;
  else fin = 30;

  let herd = 85;
  if (input.mortalityRate > 0.08) herd = 35;
  else if (input.mortalityRate > 0.04) herd = 55;
  else if (input.mortalityRate > 0.02) herd = 72;
  if (input.vaccineOverdueCount > 0) {
    herd = Math.max(25, herd - Math.min(40, input.vaccineOverdueCount * 8));
  }

  let prod = 60;
  if (input.farrowingsCount >= 4) prod = 88;
  else if (input.farrowingsCount >= 2) prod = 75;
  else if (input.farrowingsCount >= 1) prod = 68;

  const histRaw =
    Math.min(
      100,
      Math.round(
        (Math.min(input.farmAgeMonths, 36) / 36) * 50 +
          (Math.min(input.monthsWithFinanceData, 12) / 12) * 50
      )
    );
  const hist = Number.isFinite(histRaw) ? histRaw : 45;

  const breakdown: ScoreBreakdown = {
    dataRegularity: {
      score: regScore,
      detail: `Densité de saisie sur la période (écritures / mouvements).`
    },
    financialHealth: {
      score: fin,
      detail: `Marge nette relative sur la période.`
    },
    herdHealth: {
      score: herd,
      detail: `Mortalité et vaccins en retard (indicateurs sanitaires).`
    },
    productivity: {
      score: prod,
      detail: `Mises bas enregistrées sur la période.`
    },
    historyCompleteness: {
      score: hist,
      detail: `Ancienneté de la ferme et continuité des données financières.`
    }
  };

  const global = Math.round(
    breakdown.dataRegularity.score * W.dataRegularity +
      breakdown.financialHealth.score * W.financialHealth +
      breakdown.herdHealth.score * W.herdHealth +
      breakdown.productivity.score * W.productivity +
      breakdown.historyCompleteness.score * W.historyCompleteness
  );

  let band = "Faible";
  if (global >= 85) band = "Excellent";
  else if (global >= 65) band = "Bon";
  else if (global >= 45) band = "Moyen";

  return { global, band, breakdown };
}
