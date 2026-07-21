import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View
} from "react-native";
import {
  fetchFarmVaccineSubjects,
  type VaccineCoverageItemDto,
  type VaccineSubjectRowDto
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { VaccineExpandableList } from "./VaccineExpandableList";
import { producerColors } from "../../theme/producerTheme";
import { uiNamedColors } from "../../theme/uiNamedColors";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  item: VaccineCoverageItemDto;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  livestockMode: "individual" | "batch" | "hybrid";
  onBulkVaccinate: (vaccineId: string, subjects: VaccineSubjectRowDto[]) => void;
};

function coverageBarColor(rate: number): string {
  if (rate >= 80) {
    return uiNamedColors.c1D9E75;
  }
  if (rate >= 60) {
    return uiNamedColors.cBA7517;
  }
  return uiNamedColors.cE24B4A;
}

function typeBadgeStyle(type: string): { bg: string; fg: string } {
  switch (type) {
    case "viral":
      return { bg: uiNamedColors.cEFF6FF, fg: uiNamedColors.c2563EB };
    case "bacterial":
      return { bg: producerColors.successMintBg, fg: uiNamedColors.c059669 };
    case "antiparasitic":
      return { bg: uiNamedColors.cFFF7ED, fg: uiNamedColors.cEA580C };
    default:
      return { bg: uiNamedColors.cF4F4F5, fg: mobileColors.textSecondary };
  }
}

export function VaccineCard({
  item,
  farmId,
  accessToken,
  activeProfileId,
  livestockMode,
  onBulkVaccinate
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const { vaccine, stats } = item;
  const barColor = coverageBarColor(stats.coverageRate);
  const badge = typeBadgeStyle(vaccine.vaccineType);

  const unvaccinatedQ = useQuery({
    queryKey: [
      "farmVaccineSubjects",
      farmId,
      vaccine.id,
      "unvaccinated",
      "bulk",
      activeProfileId
    ],
    queryFn: () =>
      fetchFarmVaccineSubjects(
        accessToken,
        farmId,
        vaccine.id,
        "unvaccinated",
        activeProfileId
      ),
    enabled: Boolean(accessToken && farmId && vaccine.id)
  });

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.icon}>{vaccine.icon}</Text>
        <View style={styles.headerText}>
          <Text style={styles.name}>{vaccine.name}</Text>
          <View style={styles.badges}>
            <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.typeBadgeTx, { color: badge.fg }]}>
                {t(`health.vaccines.type.${vaccine.vaccineType}` as const)}
              </Text>
            </View>
            <Text style={styles.freq}>{vaccine.frequency}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.sub}>
        {vaccine.targetLabel} · {vaccine.recommendedTiming}
      </Text>
      <Text style={styles.stats}>
        ✅ {t("health.vaccines.statUpToDate", { count: stats.upToDate })} · 🔴{" "}
        {t("health.vaccines.statOverdue", { count: stats.overdue })} · ⏳{" "}
        {t("health.vaccines.statUpcoming", { count: stats.upcoming })}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${Math.min(100, Math.max(0, stats.coverageRate))}%`,
              backgroundColor: barColor
            }
          ]}
        />
      </View>
      <Text style={styles.coverageLabel}>
        {t("health.vaccines.coverage", { rate: stats.coverageRate })}
      </Text>
      {stats.overdue > 0 ? (
        <Pressable
          style={styles.bulkBtn}
          onPress={() =>
            onBulkVaccinate(vaccine.id, unvaccinatedQ.data?.subjects ?? [])
          }
        >
          <Text style={styles.bulkBtnTx}>
            {t("health.vaccines.vaccinateAll")}
          </Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.expandBtn} onPress={toggleExpand}>
        <Text style={styles.expandTx}>
          {expanded ? "▲" : "▼"} {t("health.vaccines.toggleDetail")}
        </Text>
      </Pressable>
      {expanded ? (
        <VaccineExpandableList
          farmId={farmId}
          accessToken={accessToken}
          activeProfileId={activeProfileId}
          vaccine={vaccine}
          livestockMode={livestockMode}
          onVaccinateNow={(subs) => onBulkVaccinate(vaccine.id, subs)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md,
    ...mobileShadows.card
  },
  header: { flexDirection: "row", gap: mobileSpacing.sm },
  icon: { fontSize: mobileFontSize.xxl },
  headerText: { flex: 1 },
  name: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    fontWeight: "700"
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: mobileSpacing.xs,
    marginTop: 4
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: mobileRadius.pill
  },
  typeBadgeTx: { fontSize: mobileFontSize.xs, fontWeight: "700" },
  freq: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.xs
  },
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: mobileSpacing.sm
  },
  stats: {
    ...mobileTypography.body,
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    marginTop: mobileSpacing.sm
  },
  barTrack: {
    height: 8,
    backgroundColor: mobileColors.border,
    borderRadius: mobileRadius.sm,
    marginTop: mobileSpacing.sm,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: mobileRadius.sm },
  coverageLabel: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4
  },
  bulkBtn: {
    marginTop: mobileSpacing.sm,
    alignSelf: "flex-start",
    backgroundColor: mobileColors.accent,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.sm
  },
  bulkBtnTx: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.sm },
  expandBtn: {
    marginTop: mobileSpacing.md,
    alignItems: "center",
    paddingVertical: mobileSpacing.xs
  },
  expandTx: {
    color: mobileColors.accent,
    fontWeight: "600",
    fontSize: mobileFontSize.sm
  }
});
