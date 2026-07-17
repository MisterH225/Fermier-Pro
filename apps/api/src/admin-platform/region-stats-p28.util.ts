/**
 * Helpers P-28 : normalisation diagnostics, moyennes pondérées, taux à la lecture.
 * Aucun ratio n’est stocké en base — uniquement calculés ici.
 */

export function normalizeDiagnosis(raw: string | null | undefined): string {
  if (!raw?.trim()) return "non_renseigne";
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function safeRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10000) / 10000;
}

export function incidencePerThousand(
  suspicions: number,
  herdCount: number
): number | null {
  if (!Number.isFinite(suspicions) || !Number.isFinite(herdCount) || herdCount <= 0) {
    return null;
  }
  return Math.round((suspicions / (herdCount / 1000)) * 100) / 100;
}

/** Fusionne deux moyennes avec leurs effectifs (moyenne pondérée). */
export function mergeWeightedAvg(
  aAvg: number | null | undefined,
  aCount: number,
  bAvg: number | null | undefined,
  bCount: number
): { avg: number | null; count: number } {
  const ac = Math.max(0, aCount);
  const bc = Math.max(0, bCount);
  const total = ac + bc;
  if (total <= 0) return { avg: null, count: 0 };
  const a = aAvg != null && Number.isFinite(aAvg) ? aAvg : 0;
  const b = bAvg != null && Number.isFinite(bAvg) ? bAvg : 0;
  if (aAvg == null && bAvg == null) return { avg: null, count: total };
  const sum = (aAvg != null ? a * ac : 0) + (bAvg != null ? b * bc : 0);
  const counted = (aAvg != null ? ac : 0) + (bAvg != null ? bc : 0);
  if (counted <= 0) return { avg: null, count: 0 };
  return { avg: Math.round((sum / counted) * 100) / 100, count: counted };
}

export function sumJsonRecords(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export type ExitKindAgg = {
  headcount: number;
  totalWeightKg: number;
  totalPriceXof: number;
};

export function mergeExitsByKind(
  a: Record<string, ExitKindAgg>,
  b: Record<string, ExitKindAgg>
): Record<string, ExitKindAgg> {
  const out: Record<string, ExitKindAgg> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const left = a[k] ?? { headcount: 0, totalWeightKg: 0, totalPriceXof: 0 };
    const right = b[k] ?? { headcount: 0, totalWeightKg: 0, totalPriceXof: 0 };
    out[k] = {
      headcount: left.headcount + right.headcount,
      totalWeightKg: left.totalWeightKg + right.totalWeightKg,
      totalPriceXof: left.totalPriceXof + right.totalPriceXof
    };
  }
  return out;
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

/** Taux reproduction dérivés (lecture). */
export function computeReproductionRates(input: {
  littersCount: number;
  bornAlive: number;
  stillborn: number;
  mummifiedTotal: number;
  weanedEstimate: number;
  gestationsCompleted: number;
  gestationsAborted: number;
  gestationsLost: number;
  matingsNatural: number;
  matingsAI: number;
  activeSowsCount: number;
  farrowingIntervalSumDays: number;
  farrowingIntervalCount: number;
  gestationNumberSum: number;
  gestationNumberCount: number;
}) {
  const bornTotal =
    input.bornAlive + input.stillborn + input.mummifiedTotal;
  const gestationsEnded =
    input.gestationsCompleted +
    input.gestationsAborted +
    input.gestationsLost;
  const matingsTotal = input.matingsNatural + input.matingsAI;

  return {
    prolificiteNesTotaux: safeRate(bornTotal, input.littersCount),
    prolificiteNesVifs: safeRate(input.bornAlive, input.littersCount),
    tauxMortNes: safeRate(input.stillborn, bornTotal),
    tauxMomifies: safeRate(input.mummifiedTotal, bornTotal),
    tauxPertesGestation: safeRate(
      input.gestationsAborted + input.gestationsLost,
      gestationsEnded
    ),
    tauxMiseBas: safeRate(input.gestationsCompleted, gestationsEnded),
    partIA: safeRate(input.matingsAI, matingsTotal),
    /** Sevrés / truie active — annualisation hors scope journalier ; ratio brut période. */
    productiviteNumerique: safeRate(input.weanedEstimate, input.activeSowsCount),
    intervalleMiseBasJours: safeRate(
      input.farrowingIntervalSumDays,
      input.farrowingIntervalCount
    ),
    rangPorteeMoyen: safeRate(
      input.gestationNumberSum,
      input.gestationNumberCount
    )
  };
}

export function computeHealthRates(input: {
  diseaseSuspicionsByDiagnosis: Record<string, number>;
  mortalityByCause: Record<string, number>;
  herdCountForIncidence: number;
  mortalityHeadcount: number;
}) {
  const totalSuspicions = Object.values(
    input.diseaseSuspicionsByDiagnosis
  ).reduce((s, n) => s + n, 0);
  const incidence = incidencePerThousand(
    totalSuspicions,
    input.herdCountForIncidence
  );
  const byDiagnosis = Object.entries(input.diseaseSuspicionsByDiagnosis)
    .map(([diagnosis, count]) => ({
      diagnosis,
      suspicionsDeclared: count,
      incidencePerThousand: incidencePerThousand(
        count,
        input.herdCountForIncidence
      )
    }))
    .sort(
      (a, b) => (b.incidencePerThousand ?? 0) - (a.incidencePerThousand ?? 0)
    );

  return {
    /** Libellé API : suspicions déclarées (pas cas confirmés). */
    totalSuspicionsDeclared: totalSuspicions,
    incidencePerThousand: incidence,
    suspicionsByDiagnosis: byDiagnosis,
    mortalityByCause: input.mortalityByCause,
    /**
     * Létalité apparente = décès ÷ suspicions — corrélation déclarative uniquement.
     */
    letaliteApparenteDeclarative: safeRate(
      input.mortalityHeadcount,
      totalSuspicions
    )
  };
}

export function computeLifecycleRates(input: {
  exitsByKind: Record<string, ExitKindAgg>;
  herdCountForIncidence: number;
  avgAgeAtSaleDays: number | null;
  avgAgeAtSlaughterDays: number | null;
  avgAgeAtDeathDays: number | null;
  avgFatteningDurationDays: number | null;
  sowCullsCount: number;
  activeSowsCount: number;
  mortalityHeadcount: number;
}) {
  const sale = input.exitsByKind.sale?.headcount ?? 0;
  const slaughter = input.exitsByKind.slaughter?.headcount ?? 0;
  const mortality = input.exitsByKind.mortality?.headcount ?? input.mortalityHeadcount;
  const transfer = input.exitsByKind.transfer?.headcount ?? 0;
  const totalExits = sale + slaughter + mortality + transfer;

  return {
    exitsByKind: input.exitsByKind,
    tauxVenteCheptel: safeRate(sale, input.herdCountForIncidence),
    tauxMortaliteGlobal: safeRate(mortality, input.herdCountForIncidence),
    tauxReformeTruies: safeRate(input.sowCullsCount, input.activeSowsCount),
    avgAgeAtSaleDays: input.avgAgeAtSaleDays,
    avgAgeAtSlaughterDays: input.avgAgeAtSlaughterDays,
    avgAgeAtDeathDays: input.avgAgeAtDeathDays,
    avgFatteningDurationDays: input.avgFatteningDurationDays,
    repartitionSorties: {
      sale: safeRate(sale, totalExits),
      slaughter: safeRate(slaughter, totalExits),
      mortality: safeRate(mortality, totalExits),
      transfer: safeRate(transfer, totalExits)
    }
  };
}
