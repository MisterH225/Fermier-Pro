import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type {
  PillarEvidence,
  TrustScoreDto,
  TrustScorePillarDto,
  TrustScoreProfileType
} from "../../lib/api/trustScore";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { MeteoProgressBar } from "../common/MeteoProgressBar";
import { BaseModal } from "../modals/BaseModal";
import { RatingStars } from "./RatingStars";
import {
  getTrustLevelPresentation,
  TRUST_LEVEL_ORDER
} from "./trustLevelPresentation";

type Props = {
  visible: boolean;
  trust: TrustScoreDto | null | undefined;
  loading?: boolean;
  onClose: () => void;
};

function formatEvidence(
  evidence: PillarEvidence,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  if (!evidence) return null;
  switch (evidence.kind) {
    case "ratio":
      return t("trustScore.evidence.ratio", {
        good: evidence.good,
        total: evidence.total
      });
    case "duration":
      return t("trustScore.evidence.duration", {
        minutes: Math.round(evidence.averageMinutes)
      });
    case "count":
      return t("trustScore.evidence.count", { value: evidence.value });
    case "rating":
      return t("trustScore.evidence.rating", {
        average: evidence.average.toFixed(1),
        count: evidence.count
      });
    default:
      return null;
  }
}

function pillarLabel(
  pillar: TrustScorePillarDto,
  profileType: TrustScoreProfileType,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (pillar.key === "ratings") {
    const contextual = t(`trustScore.pillars.${profileType}.ratings`, {
      defaultValue: ""
    });
    if (contextual) return contextual;
  }
  return t(`trustScore.pillars.${pillar.key}`, {
    defaultValue: pillar.key
  });
}

/**
 * Sheet explicatif trust-score — niveau + piliers + légende.
 * Commentaires jamais affichés ; étoiles seulement si ratingsSummary.count > 0.
 */
export function TrustMeteoSheet({ visible, trust, loading, onClose }: Props) {
  const { t } = useTranslation();
  const level = trust?.level ?? "nouvelle";
  const presentation = getTrustLevelPresentation(level);
  const levelLabel = t(`trustScore.level.${level}`, {
    defaultValue: presentation.id
  });
  const txCount = trust?.sampleSizes?.transactionCount ?? 0;
  const headerFact =
    txCount > 0
      ? t("trustScore.headerFact", { count: txCount })
      : t("trustScore.headerFactNone");
  const ratings = trust?.ratingsSummary;
  const showStars = Boolean(ratings && ratings.count > 0);

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("trustScore.sheetTitle")}
      sheetMaxHeight="85%"
    >
      {loading && !trust ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.levelIcon}>{presentation.icon}</Text>
            <View style={styles.headerTexts}>
              <Text style={[styles.levelTitle, { color: presentation.tint }]}>
                {levelLabel}
              </Text>
              <Text style={styles.headerFact}>{headerFact}</Text>
            </View>
          </View>

          {showStars && ratings ? (
            <View style={styles.ratingsRow}>
              <RatingStars value={ratings.average ?? 0} readonly />
              <Text style={styles.ratingsTx}>
                {t("trustScore.evidence.rating", {
                  average: (ratings.average ?? 0).toFixed(1),
                  count: ratings.count
                })}
              </Text>
            </View>
          ) : null}

          {trust?.pillars?.length ? (
            <View style={styles.pillars}>
              {trust.pillars.map((pillar) => {
                const evidenceText = formatEvidence(pillar.evidence, t);
                const showNotEnough =
                  pillar.evidence == null && pillar.sampleSize >= 0;
                return (
                  <View key={pillar.key} style={styles.pillarRow}>
                    <View style={styles.pillarHead}>
                      <Text style={styles.pillarLabel}>
                        {pillarLabel(pillar, trust.profileType, t)}
                      </Text>
                      <Text style={styles.pillarEvidence}>
                        {evidenceText ??
                          (showNotEnough
                            ? t("trustScore.notEnoughHistory")
                            : "")}
                      </Text>
                    </View>
                    <MeteoProgressBar
                      progress={Math.max(0, Math.min(1, pillar.score / 100))}
                      color={presentation.tint}
                      trackColor={mobileColors.border}
                      height={6}
                    />
                    {pillar.hintKey && trust.visibility === "self" ? (
                      <Text style={styles.hint}>
                        {t(pillar.hintKey, {
                          defaultValue: t(`trustScore.hints.${pillar.key}`, {
                            defaultValue: ""
                          })
                        })}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={styles.legendTitle}>{t("trustScore.legendTitle")}</Text>
          <View style={styles.legend}>
            {TRUST_LEVEL_ORDER.map((id) => {
              const p = getTrustLevelPresentation(id);
              const active = id === level;
              return (
                <View
                  key={id}
                  style={[styles.legendRow, active && styles.legendRowActive]}
                >
                  <Text style={styles.legendIcon}>{p.icon}</Text>
                  <View style={styles.legendTexts}>
                    <Text
                      style={[
                        styles.legendLabel,
                        active && { color: p.tint }
                      ]}
                    >
                      {t(`trustScore.level.${id}`)}
                    </Text>
                    <Text style={styles.legendMeta}>
                      {t(`trustScore.levelCriterion.${id}`)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    marginBottom: mobileSpacing.lg
  },
  levelIcon: { fontSize: 36 },
  headerTexts: { flex: 1, gap: 2 },
  levelTitle: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xl,
    fontWeight: "800"
  },
  headerFact: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  ratingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.sm,
    marginBottom: mobileSpacing.lg
  },
  ratingsTx: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  pillars: { gap: mobileSpacing.md, marginBottom: mobileSpacing.lg },
  pillarRow: {
    gap: 6,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  pillarHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: mobileSpacing.sm
  },
  pillarLabel: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.textPrimary,
    flex: 1
  },
  pillarEvidence: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    textAlign: "right",
    maxWidth: "48%"
  },
  hint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  legendTitle: {
    ...mobileTypography.meta,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  legend: { gap: 6 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.surfaceMuted
  },
  legendRowActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  legendIcon: { fontSize: mobileFontSize.xl },
  legendTexts: { flex: 1, gap: 1 },
  legendLabel: {
    ...mobileTypography.body,
    fontWeight: "600",
    color: mobileColors.textPrimary
  },
  legendMeta: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
