import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import {
  vetColors,
  vetRadius,
  vetShadow,
  vetStatus,
  vetType,
  type VetStatusKey
} from "../../../theme/vetTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

type Props = {
  /** Statut API: good | warning | critical */
  globalHealthStatus: string | undefined;
  activeDiseaseCount: number;
};

function mapApiStatus(raw: string | undefined, cases: number): VetStatusKey {
  if (raw === "critical" || cases >= 3) {
    return "alert";
  }
  if (raw === "warning" || cases > 0) {
    return "watch";
  }
  return "ok";
}

export function HealthStatusBanner({
  globalHealthStatus,
  activeDiseaseCount
}: Props) {
  const { t } = useTranslation();
  const level = mapApiStatus(globalHealthStatus, activeDiseaseCount);
  const token = vetStatus[level];
  const label = t(`vet.farmDetail.healthStatus.${level}`);

  return (
    <View
      style={[styles.banner, { backgroundColor: token.bg }]}
      accessibilityRole="summary"
      accessibilityLabel={label}
    >
      <Ionicons name={token.icon} size={22} color={token.fg} />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: token.fg }]}>{label}</Text>
        <Text style={styles.meta}>
          {t("vet.farmDetail.healthStatus.meta", {
            count: activeDiseaseCount
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: mobileSpacing.md,
    padding: mobileSpacing.lg,
    borderRadius: vetRadius.card,
    ...vetShadow.soft
  },
  textCol: { flex: 1, gap: 2 },
  title: { ...vetType.title, fontWeight: "800" },
  meta: { ...vetType.label, color: vetColors.textSecondary }
});
