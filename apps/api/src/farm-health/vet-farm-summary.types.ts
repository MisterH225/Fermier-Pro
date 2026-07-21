/** Statut sémantique dossier vétérinaire (lot / biosécurité / bandeau). */
export type VetStatusLevel = "ok" | "watch" | "alert";

export type VetHealthTimelineType =
  | "disease"
  | "vet_visit"
  | "treatment_open"
  | "treatment_closed"
  | "batch_entry"
  | "vaccination"
  | "mortality";

export type VetHealthTimelineSeverity = "info" | "watch" | "alert";

export type VetHealthTimelineItem = {
  date: string;
  type: VetHealthTimelineType;
  label: string;
  severity: VetHealthTimelineSeverity;
  batchId?: string | null;
};

export type VetMortalityMonth = {
  month: string;
  count: number;
  /** null si dénominateur indisponible — jamais 0 trompeur. */
  ratePercent: number | null;
};

export type VetGmqWeek = {
  week: string;
  avgGmq: number | null;
};

export type VetBatchSummary = {
  id: string;
  name: string;
  stage: string | null;
  headcount: number;
  ageWeeks: number | null;
  avgGmq: number | null;
  targetGmq: number | null;
  activeCases: number;
  status: VetStatusLevel;
};

export type VetUpcomingFarrowing = {
  gestationId: string;
  sowLabel: string;
  expectedBirthDate: string;
  daysRemaining: number;
};

export type VetReproductionSummary = {
  activeSows: number | null;
  ongoingGestations: number | null;
  avgBornAlive: number | null;
  sucklingMortalityPercent: number | null;
  upcomingFarrowings: VetUpcomingFarrowing[] | null;
};

export type VetBiosecurityBarn = {
  name: string;
  /** m²/porc — null si surface bâtiment non disponible. */
  densitySqmPerPig: number | null;
  /** Seuil m²/porc de référence — null si non configurable. */
  thresholdSqm: number | null;
  status: VetStatusLevel;
};

export type VetQuarantineCompliance = {
  lastEntryAt: string;
  penName: string;
  /** Jours écoulés depuis l'entrée. */
  daysElapsed: number;
  /** Durée minimale attendue (convention métier). */
  minDaysRequired: number;
  status: "compliant" | "pending" | "non_compliant";
};

export type VetBiosecuritySummary = {
  barns: VetBiosecurityBarn[] | null;
  quarantineCompliance: VetQuarantineCompliance | null;
};

export type VetGmqWeeklyBlock = {
  weeks: VetGmqWeek[] | null;
  targetGmq: number | null;
};

/** Encarta « Lecture vétérinaire » (règles déterministes, pas d'IA). */
export type VetReadingKind =
  | "triple_signal"
  | "density_gmq"
  | "vaccine_priority";

export type VetReadingAction = "open_batch" | "schedule_visit";

export type VetReading = {
  kind: VetReadingKind;
  /** Clé i18n côté mobile. */
  messageKey: string;
  batchId?: string | null;
  barnName?: string | null;
  action: VetReadingAction;
};

export type VetReadings = {
  /** Max 1 encart pour l'onglet Cheptel. */
  livestock: VetReading | null;
  /** Max 1 encart pour l'onglet Repro & biosécurité. */
  repro: VetReading | null;
};

export type VetFarmSummaryResponse = {
  farmId: string;
  health: {
    activeDiseaseCount: number;
    overdueVaccineCount: number;
    activeTreatmentCount: number;
    globalHealthStatus: string;
    mortalityRate30d: string;
  };
  vaccineCoveragePercent: number | null;
  livestock: {
    activeHeadcount: number;
    activeBatchesCount: number;
    avgGmqGPerDay: number | null;
    /** GMQ moyen sur ~30 j (pesées récentes) — null si indisponible. */
    avgGmq30d: number | null;
    /** Indice de consommation (FCR) — null si non calculable. */
    feedConversionIndex: number | null;
  };
  lastVisit: {
    id: string;
    at: string;
    label: string;
    source: "appointment" | "consultation" | "health_record";
  } | null;
  healthTimeline: VetHealthTimelineItem[] | null;
  mortalityMonthly: VetMortalityMonth[] | null;
  gmqWeekly: VetGmqWeeklyBlock | null;
  batches: VetBatchSummary[] | null;
  reproduction: VetReproductionSummary | null;
  biosecurity: VetBiosecuritySummary | null;
  readings: VetReadings;
};
