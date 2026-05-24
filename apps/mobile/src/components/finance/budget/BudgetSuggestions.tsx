import { StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import type { FarmBudgetSuggestionDto } from "../../../lib/api";
import { patchFarmBudgetSuggestion } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";
import { useOfflineMutation } from "../../../hooks/useOfflineMutation";
import { BUDGET_INVALIDATE_ROOTS } from "../../../lib/offline/budgetOffline";

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  suggestions: FarmBudgetSuggestionDto[];
  onChange: () => void;
};

export function BudgetSuggestions({
  farmId,
  accessToken,
  activeProfileId,
  suggestions,
  onChange
}: Props) {
  const { t } = useTranslation();

  const patchMut = useOfflineMutation<{
    id: string;
    apply?: boolean;
    dismiss?: boolean;
  }>({
    farmId,
    type: "budget.patchSuggestion",
    label: t("budgetScreen.suggestionsTitle"),
    mutationFn: (p) =>
      patchFarmBudgetSuggestion(
        accessToken,
        farmId,
        p.id,
        { apply: p.apply, dismiss: p.dismiss },
        activeProfileId
      ),
    buildOfflineItem: (p) => ({
      calls: [
        {
          method: "PATCH",
          path: `/farms/${farmId}/finance/budget-suggestions/${p.id}`,
          body: { apply: p.apply, dismiss: p.dismiss }
        }
      ],
      invalidateRoots: [...BUDGET_INVALIDATE_ROOTS]
    }),
    onSuccess: () => onChange(),
    onQueued: () => onChange()
  });

  if (!suggestions.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("budgetScreen.suggestionsTitle")}</Text>
      {suggestions.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.msg}>{s.message}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.apply]}
              onPress={() => patchMut.mutate({ id: s.id, apply: true })}
              disabled={patchMut.isPending}
            >
              {patchMut.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.applyTx}>{t("budgetScreen.suggestionApply")}</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() => patchMut.mutate({ id: s.id, dismiss: true })}
              disabled={patchMut.isPending}
            >
              <Text style={styles.btnTx}>{t("budgetScreen.suggestionDismiss")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: mobileSpacing.sm },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  card: {
    backgroundColor: mobileColors.surface,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    gap: mobileSpacing.sm
  },
  msg: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  row: { flexDirection: "row", gap: mobileSpacing.sm },
  btn: {
    flex: 1,
    paddingVertical: mobileSpacing.sm,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    backgroundColor: mobileColors.surfaceMuted
  },
  apply: { backgroundColor: mobileColors.accent },
  applyTx: { ...mobileTypography.meta, color: "#fff", fontWeight: "600" },
  btnTx: { ...mobileTypography.meta, color: mobileColors.textPrimary }
});
