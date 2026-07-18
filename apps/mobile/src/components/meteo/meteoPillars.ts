/**
 * Structure de piliers prête pour trust-score v2.
 * v1 alimente encore la liste via buildProducerScorePillarsV1.
 */
export type MeteoPillarView = {
  key: string;
  /** Clé i18n du libellé (ou libellé déjà résolu si label fourni). */
  labelKey: string;
  shortLabelKey?: string;
  /** Libellé déjà traduit (prioritaire sur labelKey si présent). */
  label?: string;
  shortLabel?: string;
  score: number;
  /** Conseil d'amélioration (texte ou clé i18n). */
  hint?: string;
  hintKey?: string;
};

export type ProducerScorePillarSource = {
  dataRegularityScore: number;
  platformUsageScore: number;
  responsivenessScore: number;
  chatScore: number;
  dataEntryDaysLast30: number;
  platformActiveDaysLast30: number;
  offersRespondedWithin48h: number;
  offersReceivedCount: number;
  chatRepliedWithin24h: number;
  chatBuyerMessagesCount: number;
};

/** Construit la liste dynamique des piliers à partir des données v1. */
export function buildProducerScorePillarsV1(
  source: ProducerScorePillarSource,
  t: (key: string, opts?: Record<string, unknown>) => string
): MeteoPillarView[] {
  return [
    {
      key: "data",
      labelKey: "producerScore.dashboard.dataRegularity",
      shortLabelKey: "producerScore.dashboard.pillarShort.data",
      label: t("producerScore.dashboard.dataRegularity"),
      shortLabel: t("producerScore.dashboard.pillarShort.data"),
      score: source.dataRegularityScore,
      hint: t("producerScore.dashboard.dataRegularityDetail", {
        days: source.dataEntryDaysLast30
      })
    },
    {
      key: "usage",
      labelKey: "producerScore.dashboard.platformUsage",
      shortLabelKey: "producerScore.dashboard.pillarShort.usage",
      label: t("producerScore.dashboard.platformUsage"),
      shortLabel: t("producerScore.dashboard.pillarShort.usage"),
      score: source.platformUsageScore,
      hint: t("producerScore.dashboard.platformUsageDetail", {
        days: source.platformActiveDaysLast30
      })
    },
    {
      key: "offers",
      labelKey: "producerScore.dashboard.responsiveness",
      shortLabelKey: "producerScore.dashboard.pillarShort.offers",
      label: t("producerScore.dashboard.responsiveness"),
      shortLabel: t("producerScore.dashboard.pillarShort.offers"),
      score: source.responsivenessScore,
      hint: t("producerScore.dashboard.responsivenessDetail", {
        responded: source.offersRespondedWithin48h,
        received: source.offersReceivedCount
      })
    },
    {
      key: "chat",
      labelKey: "producerScore.dashboard.chatResponsiveness",
      shortLabelKey: "producerScore.dashboard.pillarShort.chat",
      label: t("producerScore.dashboard.chatResponsiveness"),
      shortLabel: t("producerScore.dashboard.pillarShort.chat"),
      score: source.chatScore,
      hint: t("producerScore.dashboard.chatResponsivenessDetail", {
        replied: source.chatRepliedWithin24h,
        messages: source.chatBuyerMessagesCount
      })
    }
  ];
}
