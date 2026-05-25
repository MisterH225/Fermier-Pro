import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import type { CheptelPenRowDto, PenUsageTag } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

const USAGE_ICON: Record<
  PenUsageTag,
  { bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  starter: { bg: "#DBEAFE", icon: "egg-outline" },
  fattening: { bg: "#DCFCE7", icon: "nutrition-outline" },
  sows: { bg: "#FCE7F3", icon: "heart-outline" },
  boar: { bg: "#E0E7FF", icon: "male-outline" },
  boars: { bg: "#E0E7FF", icon: "male-outline" },
  mixed: { bg: "#E5E7EB", icon: "grid-outline" },
  empty: { bg: "#F3F4F6", icon: "cube-outline" }
};

type Props = {
  pen: CheptelPenRowDto;
  /** Libellé affiché (ex. A-1) ; défaut = pen.name */
  displayName?: string;
  /** stacked = colonne verticale ; grid = 2 cartes par ligne */
  layout?: "stacked" | "grid";
  onPress: () => void;
  onToggleActive: (pen: CheptelPenRowDto, next: boolean) => void;
  onDelete: (pen: CheptelPenRowDto) => void;
};

export function PenCard({
  pen,
  displayName,
  layout = "grid",
  onPress,
  onToggleActive,
  onDelete
}: Props) {
  const label = displayName ?? pen.code?.trim() ?? pen.name;
  const { t } = useTranslation();
  const rate =
    pen.capacity > 0
      ? Math.min(100, Math.round((pen.occupancy / pen.capacity) * 100))
      : 0;
  const barColor =
    rate >= 100
      ? mobileColors.error
      : rate >= 80
        ? "#F59E0B"
        : mobileColors.success;

  const usage: PenUsageTag =
    pen.usageTag ??
    (pen.category === "maternity"
      ? "sows"
      : pen.category === "starter" ||
          pen.category === "fattening" ||
          pen.category === "empty"
        ? pen.category
        : "mixed");
  const catStyle = USAGE_ICON[usage] ?? USAGE_ICON.mixed;
  const categoryLabel = t(`cheptel.pens.usage.${usage}`, {
    defaultValue: t(`cheptel.pens.category.${pen.category}`)
  });
  const sanitaryIcon =
    pen.vaccineOverdueCount > 0
      ? { bg: "#FEE2E2", icon: "medical-outline" as const, color: mobileColors.error }
      : pen.sanitaryTag === "overcrowded"
        ? { bg: "#FEE2E2", icon: "warning-outline" as const, color: mobileColors.error }
        : pen.sanitaryTag === "alert"
          ? { bg: "#FFEDD5", icon: "alert-circle-outline" as const, color: "#D97706" }
          : { bg: "#F3F4F6", icon: "checkmark-circle-outline" as const, color: mobileColors.textSecondary };

  const onDeletePress = () => {
    if (pen.occupancy > 0) {
      Alert.alert(
        t("cheptel.pens.deleteBlockedTitle"),
        t("cheptel.pens.deleteBlockedBody")
      );
      return;
    }
    Alert.alert(
      t("cheptel.pens.deleteConfirmTitle"),
      t("cheptel.pens.deleteConfirmBody", { name: pen.name }),
      [
        { text: t("cheptel.pens.cancel"), style: "cancel" },
        {
          text: t("cheptel.pens.deleteConfirmAction"),
          style: "destructive",
          onPress: () => onDelete(pen)
        }
      ]
    );
  };

  return (
    <Pressable
      style={[
        styles.card,
        layout === "stacked" ? styles.cardStacked : styles.cardGrid,
        !pen.isActive && styles.cardInactive
      ]}
      onPress={onPress}
    >
      {pen.activeDiseaseCount > 0 ? (
        <View style={[styles.badgeWarn, styles.badgeSick]}>
          <Text style={styles.badgeWarnTx}>
            {t("cheptel.pens.badgeActiveDisease")}
          </Text>
        </View>
      ) : null}
      {pen.vaccineOverdueCount > 0 ? (
        <View style={styles.badgeWarn}>
          <Text style={styles.badgeWarnTx}>
            {t("cheptel.pens.badgeVaccineLate")}
          </Text>
        </View>
      ) : null}
      {pen.gestationImminent ? (
        <View style={[styles.badgeWarn, styles.badgeSoon]}>
          <Text style={styles.badgeWarnTx}>
            {t("cheptel.pens.badgeFarrowingSoon")}
          </Text>
        </View>
      ) : null}
      {rate >= 100 ? (
        <View style={[styles.badgeWarn, styles.badgeCrowd]}>
          <Text style={styles.badgeWarnTx}>{t("cheptel.pens.badgeOvercrowded")}</Text>
        </View>
      ) : null}

      <View style={styles.topRow}>
        <View style={[styles.iconCircle, { backgroundColor: catStyle.bg }]}>
          <Ionicons name={catStyle.icon} size={20} color={mobileColors.textPrimary} />
        </View>
        <View style={[styles.iconCircle, { backgroundColor: sanitaryIcon.bg }]}>
          <Ionicons
            name={sanitaryIcon.icon}
            size={18}
            color={sanitaryIcon.color}
          />
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.category}>{categoryLabel}</Text>
      <View style={styles.divider} />
      <Text style={styles.meta}>
        {t("cheptel.pens.subjects", { count: pen.occupancy })}
      </Text>
      {pen.averageWeightKg != null ? (
        <Text style={styles.meta}>
          {t("cheptel.pens.avgWeight", { kg: pen.averageWeightKg })}
        </Text>
      ) : null}
      {pen.averageAgeWeeks != null ? (
        <Text style={styles.meta}>
          {t("cheptel.pens.avgAgeWeeksShort", { weeks: pen.averageAgeWeeks })}
        </Text>
      ) : null}
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${rate}%`, backgroundColor: barColor }]}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={onDeletePress}
          hitSlop={8}
          accessibilityLabel={t("cheptel.pens.deleteA11y")}
        >
          <Ionicons name="trash-outline" size={18} color={mobileColors.textSecondary} />
        </Pressable>
        <Switch
          value={pen.isActive}
          onValueChange={(v) => onToggleActive(pen, v)}
          trackColor={{ false: "#D1D5DB", true: mobileColors.accentSoft }}
          thumbColor={pen.isActive ? mobileColors.accent : "#f4f4f5"}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: 16,
    padding: 14,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  cardGrid: {
    width: "48%"
  },
  cardStacked: {
    width: "100%"
  },
  cardInactive: { opacity: 0.55 },
  badgeWarn: {
    alignSelf: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6
  },
  badgeSoon: { backgroundColor: "#FEF3C7" },
  badgeSick: { backgroundColor: "#FFF3E0" },
  badgeCrowd: { backgroundColor: "#FEE2E2" },
  badgeWarnTx: { fontSize: 10, fontWeight: "700", color: "#B91C1C" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  name: {
    ...mobileTypography.cardTitle,
    fontSize: 16,
    color: mobileColors.textPrimary
  },
  category: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginVertical: 8
  },
  meta: {
    fontSize: 13,
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: mobileColors.border,
    marginTop: 8,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: 3 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10
  }
});
