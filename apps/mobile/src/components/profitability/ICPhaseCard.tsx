import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { IcPhaseResultDto } from "../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import { formatIc } from "./profitabilityFormat";

type Props = { phase: IcPhaseResultDto };

function statusEmoji(status: IcPhaseResultDto["status"]) {
  if (status === "ok") return "✅";
  if (status === "warning") return "⚠️";
  if (status === "critical") return "🔴";
  return "—";
}

export function ICPhaseCard({ phase }: Props) {
  const { t } = useTranslation();
  const ic = phase.icCalculated;
  const target = phase.icTarget;
  const pct =
    ic != null && target > 0 ? Math.round(((ic - target) / target) * 100) : null;
  const barPct =
    ic != null && target > 0 ? Math.min(100, (ic / (target + 0.5)) * 100) : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.phase}>{phase.label}</Text>
      <Text style={styles.ic}>{formatIc(ic)}</Text>
      <Text style={styles.target}>
        {t("profitability.icTarget")} {formatIc(target)}
      </Text>
      <Text style={styles.status}>
        {statusEmoji(phase.status)}{" "}
        {pct != null
          ? pct > 0
            ? t("profitability.icAbove", { pct })
            : t("profitability.icBelow", { pct: Math.abs(pct) })
          : t("profitability.icUnavailable")}
      </Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${barPct}%` }]} />
      </View>
      <Text style={styles.meta}>
        {t("profitability.feedConsumed")}: {phase.feedConsumedKg.toFixed(0)} kg
      </Text>
      <Text style={styles.meta}>
        {t("profitability.kgGained")}: {phase.kgGained.toFixed(0)} kg
      </Text>
      <Text style={styles.metaSmall}>{phase.kgGainedLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  phase: { ...mobileTypography.cardTitle, fontWeight: "600" },
  ic: { fontSize: 28, fontWeight: "700", marginVertical: 4 },
  target: { ...mobileTypography.meta, color: mobileColors.textSecondary },
  status: { ...mobileTypography.meta, marginTop: 4 },
  barTrack: {
    height: 6,
    backgroundColor: mobileColors.border,
    borderRadius: 3,
    marginTop: mobileSpacing.sm,
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    backgroundColor: mobileColors.accent,
    borderRadius: 3
  },
  meta: { ...mobileTypography.meta, marginTop: 6 },
  metaSmall: {
    ...mobileTypography.meta,
    fontSize: 11,
    color: mobileColors.textSecondary,
    marginTop: 2
  }
});
