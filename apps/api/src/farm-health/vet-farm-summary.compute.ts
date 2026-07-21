import type {
  VetBatchSummary,
  VetBiosecurityBarn,
  VetGmqWeek,
  VetHealthTimelineItem,
  VetHealthTimelineSeverity,
  VetHealthTimelineType,
  VetMortalityMonth,
  VetQuarantineCompliance,
  VetReading,
  VetReadings,
  VetStatusLevel,
  VetUpcomingFarrowing
} from "./vet-farm-summary.types";

/** Durée minimale de quarantaine (jours) — convention porcin. */
export const QUARANTINE_MIN_DAYS = 21;

/** Seuil GMQ sous-performance (ratio vs objectif). */
export const GMQ_UNDERPERFORM_RATIO = 0.85;

/** Couverture vaccinale minimale avant priorité rappel. */
export const VACCINE_COVERAGE_PRIORITY_THRESHOLD = 90;

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function weekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // ISO week: Thursday determines year
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** 6 dernières clés mois UTC (du plus ancien au plus récent). */
export function lastMonthKeys(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

/** 8 dernières clés semaines ISO (du plus ancien au plus récent). */
export function lastWeekKeys(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    keys.push(weekKey(d));
  }
  // Déduplique si chevauchement de fuseau / bordure
  const unique: string[] = [];
  for (const k of keys) {
    if (!unique.includes(k)) {
      unique.push(k);
    }
  }
  while (unique.length < count) {
    const first = unique[0];
    if (!first) {
      break;
    }
    const [y, w] = first.split("-W");
    const weekNum = Number(w) - 1;
    const prev =
      weekNum < 1
        ? `${Number(y) - 1}-W52`
        : `${y}-W${String(weekNum).padStart(2, "0")}`;
    unique.unshift(prev);
  }
  return unique.slice(-count);
}

export type MortalityExitInput = {
  occurredAt: Date;
  headcountAffected: number | null;
};

/**
 * Mortalité mensuelle sur `months` mois.
 * ratePercent = count / denom * 100 ; denom = activeHeadcount + morts du mois.
 * Sans aucune sortie mortalité sur la fenêtre → null (ferme sans données).
 */
export function buildMortalityMonthly(
  exits: MortalityExitInput[],
  activeHeadcount: number,
  months = 6,
  now = new Date()
): VetMortalityMonth[] | null {
  if (exits.length === 0) {
    return null;
  }
  const keys = lastMonthKeys(months, now);
  const counts: Record<string, number> = {};
  for (const k of keys) {
    counts[k] = 0;
  }
  for (const ex of exits) {
    const k = monthKey(ex.occurredAt);
    if (k in counts) {
      counts[k] += ex.headcountAffected ?? 1;
    }
  }
  return keys.map((month) => {
    const count = counts[month] ?? 0;
    const denom = activeHeadcount + count;
    const ratePercent =
      denom > 0 ? Math.round((count / denom) * 1000) / 10 : null;
    return { month, count, ratePercent };
  });
}

export type WeightPointInput = {
  animalId: string;
  weightKg: number;
  measuredAt: Date;
};

/**
 * GMQ moyen hebdomadaire (g/j) sur `weeks` semaines.
 * Pour chaque animal, GMQ entre les deux dernières pesées dont la plus récente
 * tombe dans la semaine ; moyenne des animaux.
 * Sans pesées → null.
 */
export function buildGmqWeekly(
  weights: WeightPointInput[],
  weeks = 8,
  now = new Date()
): VetGmqWeek[] | null {
  if (weights.length === 0) {
    return null;
  }
  const keys = lastWeekKeys(weeks, now);
  const byAnimal = new Map<string, WeightPointInput[]>();
  for (const w of weights) {
    const arr = byAnimal.get(w.animalId) ?? [];
    arr.push(w);
    byAnimal.set(w.animalId, arr);
  }
  for (const arr of byAnimal.values()) {
    arr.sort((a, b) => a.measuredAt.getTime() - b.measuredAt.getTime());
  }

  const series = keys.map((week) => {
    const gmqs: number[] = [];
    for (const arr of byAnimal.values()) {
      // Dernière pesée dans cette semaine + précédente
      let lastInWeekIdx = -1;
      for (let i = 0; i < arr.length; i += 1) {
        if (weekKey(arr[i]!.measuredAt) === week) {
          lastInWeekIdx = i;
        }
      }
      if (lastInWeekIdx <= 0) {
        continue;
      }
      const prev = arr[lastInWeekIdx - 1]!;
      const curr = arr[lastInWeekIdx]!;
      const days =
        (curr.measuredAt.getTime() - prev.measuredAt.getTime()) / 86_400_000;
      if (days <= 0) {
        continue;
      }
      const gmq = ((curr.weightKg - prev.weightKg) / days) * 1000;
      if (Number.isFinite(gmq)) {
        gmqs.push(gmq);
      }
    }
    const avgGmq =
      gmqs.length > 0
        ? Math.round(gmqs.reduce((a, b) => a + b, 0) / gmqs.length)
        : null;
    return { week, avgGmq };
  });

  const anyData = series.some((s) => s.avgGmq != null);
  return anyData ? series : null;
}

export function mapDiseaseSeverity(
  severity: string | null | undefined
): VetHealthTimelineSeverity {
  if (severity === "severe" || severity === "urgent") {
    return "alert";
  }
  if (severity === "moderate" || severity === "watch") {
    return "watch";
  }
  return "info";
}

export type HealthRecordInput = {
  occurredAt: Date;
  kind: string;
  entityType?: string | null;
  entityId?: string | null;
  disease?: {
    diagnosis?: string | null;
    severity?: string | null;
    caseStatus?: string | null;
  } | null;
  vaccination?: { vaccineName?: string | null } | null;
  vetVisit?: { reason?: string | null; vetName?: string | null } | null;
  treatment?: {
    drugName?: string | null;
    endDate?: Date | null;
  } | null;
  mortality?: { cause?: string | null } | null;
};

export type BatchEntryInput = {
  id: string;
  name: string;
  createdAt: Date;
};

/** Fusionne événements sanitaires + entrées de lot, trie, coupe à `limit`. */
export function buildHealthTimeline(
  records: HealthRecordInput[],
  batchEntries: BatchEntryInput[],
  limit = 15
): VetHealthTimelineItem[] | null {
  const items: VetHealthTimelineItem[] = [];

  for (const r of records) {
    const batchId =
      r.entityType === "group" && r.entityId ? r.entityId : null;
    let type: VetHealthTimelineType;
    let label: string;
    let severity: VetHealthTimelineSeverity = "info";

    switch (r.kind) {
      case "disease":
        type = "disease";
        label = r.disease?.diagnosis?.trim() || "Déclaration sanitaire";
        severity = mapDiseaseSeverity(r.disease?.severity);
        break;
      case "vet_visit":
        type = "vet_visit";
        label =
          r.vetVisit?.reason?.trim() ||
          r.vetVisit?.vetName?.trim() ||
          "Visite vétérinaire";
        severity = "info";
        break;
      case "treatment": {
        const closed =
          r.treatment?.endDate != null &&
          r.treatment.endDate.getTime() <= Date.now();
        type = closed ? "treatment_closed" : "treatment_open";
        label = r.treatment?.drugName?.trim() || "Traitement";
        severity = closed ? "info" : "watch";
        break;
      }
      case "vaccination":
        type = "vaccination";
        label = r.vaccination?.vaccineName?.trim() || "Vaccination";
        severity = "info";
        break;
      case "mortality":
        type = "mortality";
        label = r.mortality?.cause
          ? `Mortalité (${r.mortality.cause})`
          : "Mortalité";
        severity = "alert";
        break;
      default:
        continue;
    }

    items.push({
      date: r.occurredAt.toISOString(),
      type,
      label,
      severity,
      batchId
    });
  }

  for (const b of batchEntries) {
    items.push({
      date: b.createdAt.toISOString(),
      type: "batch_entry",
      label: `Entrée de lot · ${b.name}`,
      severity: "info",
      batchId: b.id
    });
  }

  if (items.length === 0) {
    return null;
  }

  items.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return items.slice(0, limit);
}

export function resolveBatchStatus(input: {
  avgGmq: number | null;
  targetGmq: number | null;
  activeCases: number;
  mortalityPeak: boolean;
}): VetStatusLevel {
  if (input.activeCases > 0 || input.mortalityPeak) {
    return "alert";
  }
  if (
    input.avgGmq != null &&
    input.targetGmq != null &&
    input.targetGmq > 0 &&
    input.avgGmq < input.targetGmq * GMQ_UNDERPERFORM_RATIO
  ) {
    return "watch";
  }
  if (
    input.avgGmq != null &&
    input.targetGmq != null &&
    input.targetGmq > 0 &&
    input.avgGmq < input.targetGmq
  ) {
    return "watch";
  }
  return "ok";
}

export function resolveTargetGmq(
  categoryKey: string | null | undefined,
  settings: Array<{ categoryKey: string; targetGmqGPerDay: number | null }>
): number | null {
  if (settings.length === 0) {
    return null;
  }
  const key = (categoryKey ?? "").toLowerCase();
  const aliases: string[] = [];
  if (key.includes("finish") || key.includes("engrais") || key === "fattening") {
    aliases.push("finishing", "fattening");
  } else if (key.includes("grow") || key.includes("croissance")) {
    aliases.push("growth");
  } else if (key.includes("start") || key.includes("demarr") || key === "starter") {
    aliases.push("starter");
  } else if (key) {
    aliases.push(key);
  }
  for (const a of aliases) {
    const hit = settings.find(
      (s) => s.categoryKey.toLowerCase() === a.toLowerCase()
    );
    if (hit?.targetGmqGPerDay != null) {
      return hit.targetGmqGPerDay;
    }
  }
  const finishing = settings.find(
    (s) =>
      s.categoryKey === "finishing" || s.categoryKey === "fattening"
  );
  return finishing?.targetGmqGPerDay ?? settings[0]?.targetGmqGPerDay ?? null;
}

export function ageWeeksFromAvgBirth(
  avgBirthDate: Date | null | undefined,
  now = new Date()
): number | null {
  if (!avgBirthDate) {
    return null;
  }
  const days =
    (now.getTime() - avgBirthDate.getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) {
    return null;
  }
  return Math.round((days / 7) * 10) / 10;
}

/**
 * Densité biosécurité par bâtiment.
 * Sans surface (m²) en base → densitySqmPerPig et thresholdSqm restent null ;
 * le statut dérive de l'occupation vs capacité (données producteur existantes).
 */
export function buildBiosecurityBarns(
  barns: Array<{
    name: string;
    pens: Array<{ occupancy: number; capacity: number | null }>;
  }>
): VetBiosecurityBarn[] | null {
  if (barns.length === 0) {
    return null;
  }
  return barns.map((barn) => {
    const occupied = barn.pens.filter((p) => p.occupancy > 0);
    const overcrowded = occupied.some(
      (p) => p.capacity != null && p.capacity > 0 && p.occupancy >= p.capacity
    );
    const nearCap = occupied.some(
      (p) =>
        p.capacity != null &&
        p.capacity > 0 &&
        p.occupancy / p.capacity >= 0.9 &&
        p.occupancy < p.capacity
    );
    let status: VetStatusLevel = "ok";
    if (overcrowded) {
      status = "alert";
    } else if (nearCap) {
      status = "watch";
    }
    return {
      name: barn.name,
      densitySqmPerPig: null,
      thresholdSqm: null,
      status
    };
  });
}

export function buildQuarantineCompliance(
  lastEntry: {
    startedAt: Date;
    endedAt: Date | null;
    penName: string;
  } | null,
  minDays = QUARANTINE_MIN_DAYS,
  now = new Date()
): VetQuarantineCompliance | null {
  if (!lastEntry) {
    return null;
  }
  const end = lastEntry.endedAt ?? now;
  const daysElapsed = Math.max(
    0,
    Math.floor((end.getTime() - lastEntry.startedAt.getTime()) / 86_400_000)
  );
  let status: VetQuarantineCompliance["status"];
  if (lastEntry.endedAt == null) {
    status = daysElapsed >= minDays ? "compliant" : "pending";
  } else {
    status = daysElapsed >= minDays ? "compliant" : "non_compliant";
  }
  return {
    lastEntryAt: lastEntry.startedAt.toISOString(),
    penName: lastEntry.penName,
    daysElapsed,
    minDaysRequired: minDays,
    status
  };
}

export function filterUpcomingFarrowings(
  items: Array<{
    gestationId: string;
    sowLabel: string;
    expectedBirthDate: Date;
  }>,
  daysAhead = 21,
  now = new Date()
): VetUpcomingFarrowing[] | null {
  const horizon = new Date(now.getTime() + daysAhead * 86_400_000);
  const upcoming = items
    .filter(
      (g) => g.expectedBirthDate >= now && g.expectedBirthDate <= horizon
    )
    .map((g) => ({
      gestationId: g.gestationId,
      sowLabel: g.sowLabel,
      expectedBirthDate: g.expectedBirthDate.toISOString(),
      daysRemaining: Math.max(
        0,
        Math.ceil(
          (g.expectedBirthDate.getTime() - now.getTime()) / 86_400_000
        )
      )
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  return upcoming.length > 0 ? upcoming : null;
}

export type CorrelationInput = {
  batches: VetBatchSummary[];
  mortalityMonthly: VetMortalityMonth[] | null;
  barns: VetBiosecurityBarn[] | null;
  /** Barn name → batch ids hébergés (approximation placements actifs). */
  barnBatchIds?: Map<string, string[]>;
  vaccineCoveragePercent: number | null;
  activeDiseaseCount: number;
};

function mortalityPeakMonths(
  series: VetMortalityMonth[] | null
): Set<string> {
  if (!series || series.length === 0) {
    return new Set();
  }
  const max = Math.max(...series.map((m) => m.count));
  if (max <= 0) {
    return new Set();
  }
  return new Set(series.filter((m) => m.count === max).map((m) => m.month));
}

/**
 * Règles déterministes — max 1 encart Cheptel + 1 encart Repro.
 * Ordre de priorité Cheptel : triple_signal > vaccine_priority.
 * Repro : density_gmq.
 */
export function buildVetReadings(input: CorrelationInput): VetReadings {
  const peakMonths = mortalityPeakMonths(input.mortalityMonthly);
  const hasMortalityPeak = peakMonths.size > 0;

  let livestock: VetReading | null = null;
  let repro: VetReading | null = null;

  // 1) Lot GMQ < 85% objectif ET cas actif ET/OU pic mortalité
  const triple = input.batches.find((b) => {
    const underGmq =
      b.avgGmq != null &&
      b.targetGmq != null &&
      b.targetGmq > 0 &&
      b.avgGmq < b.targetGmq * GMQ_UNDERPERFORM_RATIO;
    const casesOrPeak = b.activeCases > 0 || hasMortalityPeak;
    return underGmq && casesOrPeak && b.activeCases > 0;
  });
  // Relâchement : cas actif OU pic — la règle dit "cas actif ET/OU pic"
  const tripleLoose =
    triple ??
    input.batches.find((b) => {
      const underGmq =
        b.avgGmq != null &&
        b.targetGmq != null &&
        b.targetGmq > 0 &&
        b.avgGmq < b.targetGmq * GMQ_UNDERPERFORM_RATIO;
      return underGmq && (b.activeCases > 0 || hasMortalityPeak);
    });

  if (tripleLoose) {
    livestock = {
      kind: "triple_signal",
      messageKey: "vet.farmDetail.readings.tripleSignal",
      batchId: tripleLoose.id,
      action: "open_batch"
    };
  } else if (
    input.vaccineCoveragePercent != null &&
    input.vaccineCoveragePercent < VACCINE_COVERAGE_PRIORITY_THRESHOLD &&
    input.activeDiseaseCount > 0
  ) {
    livestock = {
      kind: "vaccine_priority",
      messageKey: "vet.farmDetail.readings.vaccinePriority",
      action: "schedule_visit"
    };
  }

  // 2) Bâtiment alerte densité hébergeant un lot sous-performant
  if (input.barns && input.barnBatchIds) {
    const underBatchIds = new Set(
      input.batches
        .filter(
          (b) =>
            b.avgGmq != null &&
            b.targetGmq != null &&
            b.targetGmq > 0 &&
            b.avgGmq < b.targetGmq * GMQ_UNDERPERFORM_RATIO
        )
        .map((b) => b.id)
    );
    for (const barn of input.barns) {
      if (barn.status !== "alert") {
        continue;
      }
      const ids = input.barnBatchIds.get(barn.name) ?? [];
      const hit = ids.find((id) => underBatchIds.has(id));
      if (hit) {
        repro = {
          kind: "density_gmq",
          messageKey: "vet.farmDetail.readings.densityGmq",
          batchId: hit,
          barnName: barn.name,
          action: "open_batch"
        };
        break;
      }
    }
  }

  return { livestock, repro };
}
