import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { CheptelPenRowDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

const BORDER: Record<CheptelPenRowDto["borderStatus"], string> = {
  healthy: mobileColors.success,
  warning: "#F59E0B",
  critical: mobileColors.error,
  empty: mobileColors.border
};

type Props = {
  pen: CheptelPenRowDto;
  onPress: () => void;
};

export function PenBloc({ pen, onPress }: Props) {
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

  return (
    <Pressable
      style={[styles.card, { borderLeftColor: BORDER[pen.borderStatus] }]}
      onPress={onPress}
    >
      <Text style={styles.name}>{pen.name}</Text>
      <Text style={styles.meta}>
        {pen.occupancy}/{pen.capacity || "—"}{" "}
        {t("cheptel.pens.places")}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${rate}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.tags}>
        {pen.batchTypeTag ? (
          <Text
            style={[
              styles.tag,
              pen.batchTypeTag === "starter" ? styles.tagBlue : styles.tagGreen
            ]}
          >
            {pen.batchTypeTag === "starter"
              ? t("cheptel.pens.tagStarter")
              : t("cheptel.pens.tagFattening")}
          </Text>
        ) : null}
        <Text style={styles.tagSanitary}>
          {t(`cheptel.pens.sanitary.${pen.sanitaryTag}`)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    borderLeftWidth: 4
  },
  name: { fontWeight: "700", fontSize: 15, color: mobileColors.textPrimary },
  meta: {
    ...mobileTypography.meta,
    marginTop: 4,
    color: mobileColors.textSecondary
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: mobileColors.border,
    marginTop: 8,
    overflow: "hidden"
  },
  barFill: { height: "100%", borderRadius: 3 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  tag: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden"
  },
  tagBlue: { backgroundColor: "#DBEAFE", color: "#1D4ED8" },
  tagGreen: { backgroundColor: "#DCFCE7", color: "#15803D" },
  tagSanitary: {
    fontSize: 10,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  }
});
