import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { fetchGestationAiMatingPlan } from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import type { GestationAiMatingRecommendation } from "../../lib/api";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onApplyRow?: (sowId: string, boarId: string | null, date: string) => void;
};

export function SailliePlanningAI({
  farmId,
  accessToken,
  activeProfileId,
  onApplyRow
}: Props) {
  const { t } = useTranslation();
  const planQ = useQuery({
    queryKey: ["gestationAiPlan", farmId, activeProfileId],
    queryFn: () =>
      fetchGestationAiMatingPlan(accessToken, farmId, activeProfileId)
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("gestationScreen.aiPlanningTitle")}</Text>
      {planQ.isPending ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : null}
      {(planQ.data?.recommendations ?? []).map((r: GestationAiMatingRecommendation) => (
        <View key={`${r.sowId}-${r.suggestedDate}`} style={styles.row}>
          <Text style={styles.sow}>{r.sowLabel}</Text>
          <Text style={styles.meta}>
            {t("gestationScreen.aiPlanningBoar")}: {r.boarLabel ?? "—"}
          </Text>
          <Text style={styles.meta}>
            {t("gestationScreen.aiPlanningDate")}: {r.suggestedDate}
            {r.expectedBirthDate
              ? ` → ${t("gestationScreen.aiPlanningBirth")}: ${r.expectedBirthDate}`
              : ""}
          </Text>
          <Text style={styles.reason}>{r.reason}</Text>
          {onApplyRow ? (
            <Pressable
              style={styles.btn}
              onPress={() =>
                onApplyRow(r.sowId, r.boarId, r.suggestedDate)
              }
            >
              <Text style={styles.btnTx}>{t("gestationScreen.aiPlanningApply")}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {planQ.data?.aiPowered ? (
        <Text style={styles.badge}>✨ {t("gestationScreen.aiPowered")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm, marginBottom: mobileSpacing.md },
  title: { ...mobileTypography.sectionTitle, color: mobileColors.textPrimary },
  row: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  sow: { fontWeight: "700", fontSize: mobileFontSize.lg },
  meta: { ...mobileTypography.meta, color: mobileColors.textSecondary, marginTop: 4 },
  reason: { ...mobileTypography.body, marginTop: 6 },
  btn: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accentSoft
  },
  btnTx: { color: mobileColors.accent, fontWeight: "700" },
  badge: { fontSize: mobileFontSize.sm, color: mobileColors.accent, fontWeight: "600" }
});
