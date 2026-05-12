import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Tag } from "../ui/Tag";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type LotDetailHeaderProps = {
  lotName: string;
  farmName: string;
  headCount: number;
  speciesLabel: string;
  /** Statut métier affiché en tag (ex. statut bande côté API). */
  statusLabel: string;
  /** Optionnel : bâtiment / parc. */
  housingHint?: string;
};

function tagToneForStatus(
  status: string
): "neutral" | "success" | "warning" | "danger" {
  const s = status.toLowerCase();
  if (s.includes("urgent") || s.includes("mort") || s.includes("alerte")) {
    return "danger";
  }
  if (s.includes("surveill") || s.includes("watch")) {
    return "warning";
  }
  if (s.includes("actif") || s.includes("croissance") || s.includes("finition")) {
    return "success";
  }
  return "neutral";
}

/**
 * En-tête type « profil / post » pour un lot (bande) : infos clés + tag statut.
 */
export function LotDetailHeader({
  lotName,
  farmName,
  headCount,
  speciesLabel,
  statusLabel,
  housingHint
}: LotDetailHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {lotName}
          </Text>
          <Text style={styles.farmLine} numberOfLines={1}>
            {farmName} · {speciesLabel}
          </Text>
        </View>
        <Tag label={statusLabel} tone={tagToneForStatus(statusLabel)} />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Ionicons name="paw-outline" size={18} color={mobileColors.textSecondary} />
          <Text style={styles.metricText}>
            {headCount} tête{headCount > 1 ? "s" : ""}
          </Text>
        </View>
        {housingHint ? (
          <View style={styles.metric}>
            <Ionicons name="business-outline" size={18} color={mobileColors.textSecondary} />
            <Text style={styles.metricText} numberOfLines={1}>
              {housingHint}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    padding: mobileSpacing.lg,
    marginBottom: mobileSpacing.md
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: mobileSpacing.md
  },
  titleBlock: {
    flex: 1,
    minWidth: 0
  },
  title: {
    ...mobileTypography.title,
    fontSize: 20,
    color: mobileColors.textPrimary,
    marginBottom: 4
  },
  farmLine: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mobileSpacing.lg,
    marginTop: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: mobileColors.border
  },
  metric: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  metricText: {
    ...mobileTypography.body,
    fontSize: 14,
    color: mobileColors.textSecondary,
    flexShrink: 1
  }
});
