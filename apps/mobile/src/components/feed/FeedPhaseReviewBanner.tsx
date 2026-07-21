import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  fetchFeedTypesPhaseReview,
  updateFarmFeedType,
  type FeedProductionPhaseDto,
  type FeedTypeDto
} from "../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

const PHASE_OPTIONS: FeedProductionPhaseDto[] = [
  "sous_mere",
  "transition",
  "starter",
  "growth",
  "fattening",
  "breeder"
];

type Props = {
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
};

export function FeedPhaseReviewBanner({
  farmId,
  accessToken,
  activeProfileId
}: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const reviewQ = useQuery({
    queryKey: ["feedPhaseReview", farmId, activeProfileId],
    queryFn: () =>
      fetchFeedTypesPhaseReview(accessToken, farmId, activeProfileId)
  });

  const mutation = useMutation({
    mutationFn: (params: { id: string; phase: FeedProductionPhaseDto }) =>
      updateFarmFeedType(
        accessToken,
        farmId,
        params.id,
        { productionPhase: params.phase },
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feedPhaseReview", farmId] });
      void qc.invalidateQueries({ queryKey: ["farmFeedTypes", farmId] });
      void qc.invalidateQueries({ queryKey: ["batchProfitability", farmId] });
    }
  });

  const items = reviewQ.data ?? [];
  if (reviewQ.isPending || reviewQ.isError || items.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t("feedStock.phaseReviewTitle")}</Text>
      <Text style={styles.sub}>{t("feedStock.phaseReviewBody")}</Text>
      {items.slice(0, 3).map((ft) => (
        <FeedPhaseRow
          key={ft.id}
          feedType={ft}
          saving={mutation.isPending && mutation.variables?.id === ft.id}
          onPick={(phase) => mutation.mutate({ id: ft.id, phase })}
          phaseLabel={(p) => t(`feedStock.phases.${p}`)}
          suggestionLabel={
            ft.phaseSuggestion
              ? t("feedStock.phaseSuggestion", {
                  phase: t(`feedStock.phases.${ft.phaseSuggestion.phase}`)
                })
              : undefined
          }
        />
      ))}
    </View>
  );
}

function FeedPhaseRow({
  feedType,
  saving,
  onPick,
  phaseLabel,
  suggestionLabel
}: {
  feedType: FeedTypeDto;
  saving: boolean;
  onPick: (phase: FeedProductionPhaseDto) => void;
  phaseLabel: (p: FeedProductionPhaseDto) => string;
  suggestionLabel?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowName}>{feedType.name}</Text>
      {suggestionLabel ? (
        <Text style={styles.suggestion}>{suggestionLabel}</Text>
      ) : null}
      {saving ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <View style={styles.pills}>
          {PHASE_OPTIONS.map((p) => (
            <Pressable
              key={p}
              style={[
                styles.pill,
                feedType.phaseSuggestion?.phase === p && styles.pillSuggested
              ]}
              onPress={() => onPick(p)}
            >
              <Text style={styles.pillTx}>{phaseLabel(p)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: mobileColors.accentSoft,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.md,
    marginBottom: mobileSpacing.md
  },
  title: { fontWeight: "700", color: mobileColors.textPrimary },
  sub: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 4,
    marginBottom: mobileSpacing.sm
  },
  row: { marginTop: mobileSpacing.sm },
  rowName: { fontWeight: "600" },
  suggestion: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginTop: 2
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pill: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: mobileColors.surface
  },
  pillSuggested: { borderColor: mobileColors.accent },
  pillTx: { ...mobileTypography.meta, fontSize: mobileFontSize.xs }
});
