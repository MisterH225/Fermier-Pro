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
import type { CheptelPenRowDto } from "../../../lib/api";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing, mobileTypography, mobileStatusSurfaces, mobileFontSize } from "../../../theme/mobileTheme";
import {
  getPenVisualForPen,
  penVisualI18nKey,
  resolvePenVisualKey
} from "./penUsageVisual";
import { producerColors } from "../../../theme/producerTheme";
import { marketplaceColors } from "../../../theme/marketplaceTheme";
import { uiNamedColors } from "../../../theme/uiNamedColors";

type Props = {
  pen: CheptelPenRowDto;
  /** Libellé affiché (ex. A-1) ; défaut = pen.name */
  displayName?: string;
  /** stacked = colonne verticale ; grid = 2 cartes par ligne */
  layout?: "stacked" | "grid";
  onPress: () => void;
  onEditCapacity?: (pen: CheptelPenRowDto) => void;
  onToggleActive: (pen: CheptelPenRowDto, next: boolean) => void;
  onDelete: (pen: CheptelPenRowDto) => void;
  readOnly?: boolean;
};

export function PenCard({
  pen,
  displayName,
  layout = "grid",
  onPress,
  onEditCapacity,
  onToggleActive,
  onDelete,
  readOnly = false
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
        ? producerColors.warning
        : mobileColors.success;

  const visual = getPenVisualForPen(pen);
  const visualKey = resolvePenVisualKey(pen);
  const categoryLabel = t(`cheptel.pens.visual.${penVisualI18nKey(visualKey)}`);
  const ageData = pen.ageData;
  const sanitaryIcon =
    pen.vaccineOverdueCount > 0
      ? { bg: mobileStatusSurfaces.errorBg, icon: "medical-outline" as const, color: mobileColors.error }
      : pen.sanitaryTag === "overcrowded"
        ? { bg: mobileStatusSurfaces.errorBg, icon: "warning-outline" as const, color: mobileColors.error }
        : pen.sanitaryTag === "alert"
          ? { bg: uiNamedColors.cFFEDD5, icon: "alert-circle-outline" as const, color: marketplaceColors.pending }
          : { bg: uiNamedColors.cF3F4F6, icon: "checkmark-circle-outline" as const, color: mobileColors.textSecondary };

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
        {
          backgroundColor: visual.bg,
          borderColor: visual.border,
          borderLeftWidth: 4,
          borderLeftColor: visual.accent
        },
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
        <View style={[styles.iconCircle, { backgroundColor: visual.iconBg }]}>
          <Ionicons name={visual.icon} size={20} color={visual.accent} />
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
      <View style={[styles.categoryChip, { backgroundColor: visual.iconBg }]}>
        <Text style={[styles.category, { color: visual.accent }]}>{categoryLabel}</Text>
      </View>
      <View style={styles.divider} />
      <Text style={styles.meta}>
        {t("cheptel.pens.subjects", { count: pen.occupancy })}
      </Text>
      {pen.averageWeightKg != null ? (
        <Text style={styles.meta}>
          {t("cheptel.pens.avgWeight", { kg: pen.averageWeightKg })}
        </Text>
      ) : null}
      {ageData?.displayAgeWeeks != null ? (
        <Text style={styles.meta}>
          {ageData.isManual
            ? t("cheptel.pens.avgAgeWeeksManualShort", {
                weeks: ageData.displayAgeWeeks
              })
            : ageData.animalsWithoutAgeCount > 0
              ? t("cheptel.pens.avgAgeWeeksPartialShort", {
                  weeks: ageData.displayAgeWeeks,
                  without: ageData.animalsWithoutAgeCount
                })
              : t("cheptel.pens.avgAgeWeeksShort", {
                  weeks: ageData.displayAgeWeeks
                })}
        </Text>
      ) : (
        <Text style={[styles.meta, styles.metaMuted]}>
          {t("cheptel.pens.avgAgeWeeksEmpty")}
        </Text>
      )}
      <View style={styles.barTrack}>
        <View
          style={[styles.barFill, { width: `${rate}%`, backgroundColor: barColor }]}
        />
      </View>

      {!readOnly ? (
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {onEditCapacity ? (
              <Pressable
                onPress={() => onEditCapacity(pen)}
                hitSlop={8}
                accessibilityLabel={t("cheptel.pens.editCapacityA11y")}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={mobileColors.textSecondary}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onDeletePress}
              hitSlop={8}
              accessibilityLabel={t("cheptel.pens.deleteA11y")}
            >
              <Ionicons name="trash-outline" size={18} color={mobileColors.textSecondary} />
            </Pressable>
          </View>
          <Switch
            value={pen.isActive}
            onValueChange={(v) => onToggleActive(pen, v)}
            trackColor={{ false: uiNamedColors.cD1D5DB, true: mobileColors.accentSoft }}
            thumbColor={pen.isActive ? mobileColors.accent : uiNamedColors.cF4F4F5}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: mobileRadius.lg,
    padding: 14,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
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
    backgroundColor: mobileStatusSurfaces.errorBg,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6
  },
  badgeSoon: { backgroundColor: producerColors.kpiAmberSoft },
  badgeSick: { backgroundColor: mobileStatusSurfaces.warningBg },
  badgeCrowd: { backgroundColor: mobileStatusSurfaces.errorBg },
  badgeWarnTx: { fontSize: mobileFontSize.xs, fontWeight: "700", color: producerColors.dangerStrong },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: mobileRadius.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  name: {
    ...mobileTypography.cardTitle,
    fontSize: mobileFontSize.lg,
    color: mobileColors.textPrimary
  },
  categoryChip: {
    alignSelf: "flex-start",
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4
  },
  category: {
    fontSize: mobileFontSize.sm,
    fontWeight: "700"
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: mobileColors.border,
    marginVertical: 8,
    opacity: 0.5
  },
  meta: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    marginBottom: 2
  },
  metaMuted: { opacity: 0.65 },
  barTrack: {
    height: 6,
    borderRadius: mobileRadius.sm,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginTop: 8,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: mobileRadius.sm },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  }
});
