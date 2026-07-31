import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CompositionDisclaimer } from "../../components/feed-composition/CompositionDisclaimer";
import { FormulationResultCard } from "../../components/feed-composition/FormulationResultCard";
import { useSession } from "../../context/SessionContext";
import {
  getFeedComposition,
  listFarmCompositionVeterinarians,
  requestCompositionVetReview,
  type FeedFormulateResultDto,
  type FeedNutritionResultDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import {
  asRationLines,
  formatXof,
  stageLabelFr,
  statusLabelFr
} from "../../lib/feedCompositionFormat";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedCompositionDetail">;

export function FeedCompositionDetailScreen({ route }: Props) {
  const { farmId, compositionId } = route.params;
  const { accessToken, activeProfileId } = useSession();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["feed-composition", compositionId],
    queryFn: () =>
      getFeedComposition(accessToken!, compositionId, activeProfileId),
    enabled: Boolean(accessToken)
  });

  const vetsQ = useQuery({
    queryKey: ["feed-composition-vets", farmId, activeProfileId],
    queryFn: () =>
      listFarmCompositionVeterinarians(
        accessToken!,
        farmId,
        activeProfileId
      ),
    enabled: Boolean(accessToken)
  });

  const vetMut = useMutation({
    mutationFn: () =>
      requestCompositionVetReview(
        accessToken!,
        compositionId,
        {},
        activeProfileId
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed-composition", compositionId] });
      void qc.invalidateQueries({ queryKey: ["feed-compositions", farmId] });
      Alert.alert("Envoyé", "Le vétérinaire a été notifié.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  if (detailQ.isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={mobileColors.accent} />
      </View>
    );
  }

  const row = detailQ.data;
  if (!row) {
    return (
      <View style={styles.center}>
        <Text>Composition introuvable.</Text>
      </View>
    );
  }

  const ration = asRationLines(row.ration);
  const nutrition = (row.nutritionResult ?? null) as FeedNutritionResultDto | null;
  const totalCost =
    typeof row.totalCostXof === "string"
      ? Number(row.totalCostXof)
      : row.totalCostXof;
  const totalFeedKg = ration.reduce((s, l) => s + (l.quantityKg || 0), 0);
  const formulation: FeedFormulateResultDto = {
    feasible: ration.length > 0,
    ration,
    totalFeedKg,
    dailyIntakeKg: 0,
    totalCostXof: Number.isFinite(totalCost) ? totalCost : 0,
    costPerKg:
      totalFeedKg > 0 && Number.isFinite(totalCost) ? totalCost / totalFeedKg : 0,
    nutritionResult: nutrition,
    deviations: [],
    warnings: [],
    infeasibilityReasons:
      ration.length === 0
        ? ["Aucune ligne d’intrant enregistrée pour cette composition."]
        : []
  };

  const hasVets = (vetsQ.data?.length ?? 0) > 0;
  const canRequestVet =
    hasVets && (row.status === "draft" || row.status === "vet_review");

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      testID="composition-detail"
    >
      <CompositionDisclaimer />
      <Text style={styles.title}>{stageLabelFr(row.stage)}</Text>
      <Text style={styles.meta}>
        {statusLabelFr(row.status)} · {formatXof(row.totalCostXof)} ·{" "}
        {new Date(row.createdAt).toLocaleDateString("fr-FR")}
      </Text>
      {row.vetComment ? (
        <Text style={styles.vetComment}>Avis véto : {row.vetComment}</Text>
      ) : null}

      <FormulationResultCard
        formulation={formulation}
        stage={row.stage}
        isTheoretical={row.isTheoretical}
      />

      {canRequestVet && row.status === "draft" ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => vetMut.mutate()}
          disabled={vetMut.isPending}
          testID="detail-send-to-vet"
        >
          <Text style={styles.secondaryBtnLabel}>
            Envoyer à mon vétérinaire pour validation
          </Text>
        </Pressable>
      ) : null}

      {/* J4 : commande moulin — bouton visible mais désactivé tant que le flux n’existe pas. */}
      {row.status === "validated" ? (
        <Pressable
          style={[styles.primaryBtn, styles.disabledBtn]}
          disabled
          testID="order-composition-disabled"
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.primaryBtnLabel}>Commander — bientôt</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md,
    paddingBottom: 48
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.canvas
  },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  meta: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  },
  vetComment: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  disabledBtn: { opacity: 0.45 },
  primaryBtnLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryBtnLabel: {
    color: mobileColors.accent,
    fontWeight: "700",
    textAlign: "center"
  }
});
