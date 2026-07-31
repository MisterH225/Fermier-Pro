import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompositionDisclaimer } from "../../components/feed-composition/CompositionDisclaimer";
import { ProposeAdjustmentModal } from "../../components/feed-composition/ProposeAdjustmentModal";
import { FormulationResultCard } from "../../components/feed-composition/FormulationResultCard";
import { useSession } from "../../context/SessionContext";
import {
  getFeedComposition,
  listFarmCompositionVeterinarians,
  postFeedCompositionExplain,
  proposeCompositionAdjustment,
  requestCompositionVetReview,
  reviewFeedComposition,
  type FeedFormulateResultDto,
  type FeedNutritionResultDto
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import {
  buildLocalFactualExplanation,
  parseCachedExplanation
} from "../../lib/compositionExplanation";
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
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedCompositionDetail">;

export function FeedCompositionDetailScreen({ navigation, route }: Props) {
  const { farmId, farmName, compositionId } = route.params;
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myId = authMe?.user.id;
  const insets = useSafeAreaInsets();
  const [adjustOpen, setAdjustOpen] = useState(false);

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

  const isAssociatedVet = Boolean(
    myId && vetsQ.data?.some((v) => v.userId === myId)
  );

  const cachedExplanation = parseCachedExplanation(
    detailQ.data?.explanation
  );

  const explainQ = useQuery({
    queryKey: ["feed-composition-explain", compositionId],
    queryFn: async () => {
      const row = detailQ.data!;
      const ration = asRationLines(row.ration);
      const nutrition = (row.nutritionResult ??
        null) as FeedNutritionResultDto | null;
      if (!nutrition || ration.length === 0) {
        return buildLocalFactualExplanation({
          stage: row.stage,
          formulation: {
            feasible: ration.length > 0,
            ration,
            totalFeedKg: 0,
            dailyIntakeKg: 0,
            totalCostXof: 0,
            costPerKg: 0,
            nutritionResult: nutrition,
            deviations: [],
            warnings: [],
            infeasibilityReasons: []
          }
        });
      }
      const animalCount =
        typeof row.inputParams?.animalCount === "number"
          ? row.inputParams.animalCount
          : 1;
      const avgWeightKg =
        typeof row.inputParams?.avgWeightKg === "number"
          ? row.inputParams.avgWeightKg
          : undefined;
      try {
        const res = await postFeedCompositionExplain(
          accessToken!,
          {
            farmId,
            stage: row.stage,
            animalCount,
            avgWeightKg,
            ration,
            nutritionResult: nutrition,
            deviations: [],
            savedCompositionId: compositionId
          },
          activeProfileId
        );
        return res.explanation;
      } catch {
        return buildLocalFactualExplanation({
          stage: row.stage,
          animalCount,
          avgWeightKg,
          formulation: {
            feasible: true,
            ration,
            totalFeedKg: ration.reduce((s, l) => s + (l.quantityKg || 0), 0),
            dailyIntakeKg: 0,
            totalCostXof: 0,
            costPerKg: 0,
            nutritionResult: nutrition,
            deviations: [],
            warnings: [],
            infeasibilityReasons: []
          }
        });
      }
    },
    enabled: Boolean(
      accessToken && detailQ.data && !cachedExplanation
    )
  });

  const explanation = cachedExplanation ?? explainQ.data ?? null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["feed-composition", compositionId] });
    void qc.invalidateQueries({ queryKey: ["feed-compositions", farmId] });
  };

  const sendMut = useMutation({
    mutationFn: () =>
      requestCompositionVetReview(
        accessToken!,
        compositionId,
        {},
        activeProfileId
      ),
    onSuccess: (row) => {
      invalidate();
      Alert.alert("Envoyé", "Discussion ouverte avec votre vétérinaire.", [
        {
          text: "Ouvrir le fil",
          onPress: () => {
            if (row.chatRoomId) {
              navigation.navigate("ChatRoom", {
                roomId: row.chatRoomId,
                headline: "Composition — avis véto",
                farmId
              });
            }
          }
        },
        { text: "OK" }
      ]);
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const reviewMut = useMutation({
    mutationFn: (decision: "approve" | "request_changes") =>
      reviewFeedComposition(
        accessToken!,
        compositionId,
        { decision },
        activeProfileId
      ),
    onSuccess: (row) => {
      invalidate();
      Alert.alert(
        row.status === "validated" ? "Validée" : "Demande envoyée",
        row.status === "validated"
          ? "La composition est validée."
          : "Le producteur a été notifié."
      );
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const adjustMut = useMutation({
    mutationFn: (body: {
      removeIngredientId: string;
      addIngredientId: string;
      comment?: string;
    }) =>
      proposeCompositionAdjustment(
        accessToken!,
        compositionId,
        body,
        activeProfileId
      ),
    onSuccess: () => {
      setAdjustOpen(false);
      invalidate();
      const roomId = detailQ.data?.chatRoomId;
      Alert.alert("Ajustement proposé", "La nouvelle version est dans le fil.", [
        {
          text: "Voir le fil",
          onPress: () => {
            if (roomId) {
              navigation.navigate("ChatRoom", {
                roomId,
                headline: "Composition — avis véto",
                farmId
              });
            }
          }
        },
        { text: "OK" }
      ]);
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
  const nutrition = (row.nutritionResult ??
    null) as FeedNutritionResultDto | null;
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
  const canDiscuss =
    Boolean(row.chatRoomId) &&
    (row.status === "vet_review" || row.status === "validated");

  const onSendToVet = () => {
    if (!hasVets) {
      Alert.alert(
        "Aucun vétérinaire associé",
        "Ajoutez d’abord votre vétérinaire à cette ferme (Équipe / membres), puis renvoyez pour validation.",
        [
          {
            text: "Ouvrir l’équipe",
            onPress: () =>
              navigation.navigate("FarmMembers", { farmId, farmName })
          },
          { text: "OK", style: "cancel" }
        ]
      );
      return;
    }
    sendMut.mutate();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 48 }
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        testID="composition-detail"
      >
        <CompositionDisclaimer />
        <Text style={styles.title}>{stageLabelFr(row.stage)}</Text>
        <Text style={styles.meta}>
          {statusLabelFr(row.status)} · {formatXof(row.totalCostXof)} ·{" "}
          {new Date(row.createdAt).toLocaleDateString("fr-FR")}
        </Text>

        {row.status === "validated" && row.vetReviewedAt ? (
          <View style={styles.validatedBanner} testID="validated-banner">
            <Text style={styles.validatedText}>
              Validée par {row.vetReviewedByName ?? "votre vétérinaire"} le{" "}
              {new Date(row.vetReviewedAt).toLocaleDateString("fr-FR")}
            </Text>
          </View>
        ) : null}

        {row.vetComment ? (
          <Text style={styles.vetComment}>
            Message du véto : {row.vetComment}
          </Text>
        ) : null}

        <FormulationResultCard
          formulation={formulation}
          stage={row.stage}
          isTheoretical={row.isTheoretical}
          explanation={explanation}
          explanationLoading={explainQ.isPending && !cachedExplanation}
        />

        {row.status === "draft" ? (
          <>
            <Pressable
              style={styles.secondaryBtn}
              onPress={onSendToVet}
              disabled={sendMut.isPending}
              testID="detail-send-to-vet"
            >
              <Text style={styles.secondaryBtnLabel}>
                Envoyer à mon vétérinaire pour validation
              </Text>
            </Pressable>
            {!hasVets && !vetsQ.isPending ? (
              <Text style={styles.vetHint} testID="detail-no-vet-hint">
                Associez d’abord votre véto dans l’équipe de la ferme pour
                ouvrir la discussion.
              </Text>
            ) : (
              <Text style={styles.vetHint}>
                Une discussion s’ouvre automatiquement pour échanger et
                valider ce mélange.
              </Text>
            )}
          </>
        ) : null}

        {canDiscuss ? (
          <Pressable
            style={styles.primaryBtn}
            testID="discuss-with-vet"
            onPress={() =>
              navigation.navigate("ChatRoom", {
                roomId: row.chatRoomId!,
                headline: "Composition — avis véto",
                farmId
              })
            }
          >
            <Text style={styles.primaryBtnLabel}>
              Continuer la discussion avec mon vétérinaire
            </Text>
          </Pressable>
        ) : null}

        {isAssociatedVet && row.status === "vet_review" ? (
          <View style={styles.vetActions}>
            <Pressable
              style={styles.primaryBtn}
              testID="vet-approve"
              onPress={() => reviewMut.mutate("approve")}
              disabled={reviewMut.isPending}
            >
              <Text style={styles.primaryBtnLabel}>
                Valider ce mélange
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              testID="vet-request-changes"
              onPress={() => reviewMut.mutate("request_changes")}
              disabled={reviewMut.isPending}
            >
              <Text style={styles.secondaryBtnLabel}>
                Demander des changements
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              testID="vet-propose-adjustment"
              onPress={() => setAdjustOpen(true)}
            >
              <Text style={styles.secondaryBtnLabel}>
                Proposer un autre mélange
              </Text>
            </Pressable>
            {row.chatRoomId ? (
              <Pressable
                style={styles.linkBtn}
                onPress={() =>
                  navigation.navigate("ChatRoom", {
                    roomId: row.chatRoomId!,
                    headline: `Composition — ${farmName || "ferme"}`,
                    farmId
                  })
                }
              >
                <Text style={styles.linkLabel}>Ouvrir la discussion</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

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

        <ProposeAdjustmentModal
          visible={adjustOpen}
          ration={ration}
          submitting={adjustMut.isPending}
          onClose={() => setAdjustOpen(false)}
          onSubmit={(body) => adjustMut.mutate(body)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mobileColors.canvas },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  vetHint: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    textAlign: "center"
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
  validatedBanner: {
    backgroundColor: mobileStatusSurfaces.successBg,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md
  },
  validatedText: {
    color: mobileStatusSurfaces.successText,
    fontWeight: "800",
    fontSize: mobileFontSize.sm
  },
  vetComment: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.surfaceMuted,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md
  },
  vetActions: { gap: mobileSpacing.sm },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  disabledBtn: { opacity: 0.45 },
  primaryBtnLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800",
    textAlign: "center"
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
  },
  linkBtn: { paddingVertical: 8, alignItems: "center" },
  linkLabel: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  }
});
