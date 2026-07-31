import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { CompositionDisclaimer } from "../../components/feed-composition/CompositionDisclaimer";
import { ProposeAdjustmentModal } from "../../components/feed-composition/ProposeAdjustmentModal";
import { FormulationResultCard } from "../../components/feed-composition/FormulationResultCard";
import { useSession } from "../../context/SessionContext";
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import {
  getFeedComposition,
  listFarmCompositionVeterinarians,
  postFeedCompositionExplain,
  previewCompositionAdjustment,
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
  computeDailyIntakeKg,
  formatXof,
  readPositiveInputNumber,
  stageLabelFr,
  statusLabelFr
} from "../../lib/feedCompositionFormat";
import type { RootStackParamList } from "../../types/navigation";
import {
  compositionDiscussLabel,
  compositionUiColors,
  type CompositionUiTone
} from "../../theme/compositionUiTone";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";
import { vetStackScreenOptions } from "../../theme/vetTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedCompositionDetail">;

export function FeedCompositionDetailScreen({ navigation, route }: Props) {
  const { farmId, farmName, compositionId } = route.params;
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myId = authMe?.user.id;
  /** Navbar flottante + FAB + marge pour la zone d’actions véto. */
  const scrollPad = useScrollBottomPad({ extra: 48 });
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [vetCommentDraft, setVetCommentDraft] = useState("");

  const profileType =
    authMe?.profiles?.find((p) => p.id === activeProfileId)?.type ??
    authMe?.activeProfile?.type;
  const isVetProfile = profileType === "veterinarian";
  const tone: CompositionUiTone = isVetProfile ? "vet" : "producer";
  const ui = compositionUiColors(tone);

  useLayoutEffect(() => {
    if (isVetProfile) {
      navigation.setOptions({
        ...vetStackScreenOptions,
        title: "Composition"
      });
    }
  }, [isVetProfile, navigation]);

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
      const animalCount =
        readPositiveInputNumber(row.inputParams, "animalCount") ?? 1;
      const durationDays = readPositiveInputNumber(
        row.inputParams,
        "durationDays"
      );
      const avgWeightKg =
        readPositiveInputNumber(row.inputParams, "avgWeightKg") ?? undefined;
      const totalKg = ration.reduce((s, l) => s + (l.quantityKg || 0), 0);
      const dailyKg = computeDailyIntakeKg(totalKg, animalCount, durationDays);
      if (!nutrition || ration.length === 0) {
        return buildLocalFactualExplanation({
          stage: row.stage,
          formulation: {
            feasible: ration.length > 0,
            ration,
            totalFeedKg: totalKg,
            dailyIntakeKg: dailyKg,
            totalCostXof: 0,
            costPerKg: 0,
            nutritionResult: nutrition,
            deviations: [],
            warnings: [],
            infeasibilityReasons: []
          }
        });
      }
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
            totalFeedKg: totalKg,
            dailyIntakeKg: dailyKg,
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
    mutationFn: (body: {
      decision: "approve" | "request_changes";
      comment?: string;
    }) =>
      reviewFeedComposition(
        accessToken!,
        compositionId,
        body,
        activeProfileId
      ),
    onSuccess: (row) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["vet-dashboard"] });
      void qc.invalidateQueries({ queryKey: ["vet-pending-compositions"] });
      setVetCommentDraft("");
      Alert.alert(
        row.status === "validated" ? "Validée" : "Commentaire envoyé",
        row.status === "validated"
          ? "La composition est validée. Le dossier de suivi est clôturé."
          : "Votre message a été envoyé au producteur dans le fil."
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
      <View style={[styles.center, { backgroundColor: ui.canvas }]}>
        <ActivityIndicator color={ui.accent} />
      </View>
    );
  }

  const row = detailQ.data;
  if (!row) {
    return (
      <View style={[styles.center, { backgroundColor: ui.canvas }]}>
        <Text style={{ color: ui.textPrimary }}>Composition introuvable.</Text>
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
  const animalCount = readPositiveInputNumber(row.inputParams, "animalCount");
  const durationDays = readPositiveInputNumber(row.inputParams, "durationDays");
  const dailyIntakeKg = computeDailyIntakeKg(
    totalFeedKg,
    animalCount,
    durationDays
  );
  const formulation: FeedFormulateResultDto = {
    feasible: ration.length > 0,
    ration,
    totalFeedKg,
    dailyIntakeKg,
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
  const discussTone: CompositionUiTone =
    isVetProfile || isAssociatedVet ? "vet" : "producer";

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
    <>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: ui.canvas }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 24}
      >
        <ScrollView
          style={styles.root}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: scrollPad }
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          testID="composition-detail"
        >
          <CompositionDisclaimer />
          <Text style={[styles.title, { color: ui.textPrimary }]}>
            {stageLabelFr(row.stage)}
          </Text>
          <Text style={[styles.meta, { color: ui.textSecondary }]}>
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
            <Text
              style={[
                styles.vetComment,
                {
                  color: ui.textPrimary,
                  backgroundColor: ui.surfaceMuted
                }
              ]}
            >
              Message du véto : {row.vetComment}
            </Text>
          ) : null}

          <FormulationResultCard
            formulation={formulation}
            stage={row.stage}
            isTheoretical={row.isTheoretical}
            explanation={explanation}
            explanationLoading={explainQ.isPending && !cachedExplanation}
            tone={tone}
          />

          {row.status === "draft" && !isVetProfile ? (
            <>
              <Pressable
                style={[styles.secondaryBtn, { borderColor: ui.accent }]}
                onPress={onSendToVet}
                disabled={sendMut.isPending}
                testID="detail-send-to-vet"
              >
                <Text style={[styles.secondaryBtnLabel, { color: ui.accent }]}>
                  Envoyer à mon vétérinaire pour validation
                </Text>
              </Pressable>
              {!hasVets && !vetsQ.isPending ? (
                <Text
                  style={[styles.vetHint, { color: ui.textSecondary }]}
                  testID="detail-no-vet-hint"
                >
                  Associez d’abord votre véto dans l’équipe de la ferme pour
                  ouvrir la discussion.
                </Text>
              ) : (
                <Text style={[styles.vetHint, { color: ui.textSecondary }]}>
                  Une discussion s’ouvre automatiquement pour échanger et
                  valider ce mélange.
                </Text>
              )}
            </>
          ) : null}

          {canDiscuss ? (
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: ui.accent }]}
              testID="discuss-with-peer"
              onPress={() =>
                navigation.navigate("ChatRoom", {
                  roomId: row.chatRoomId!,
                  headline: "Composition — avis véto",
                  farmId
                })
              }
            >
              <Text style={[styles.primaryBtnLabel, { color: ui.onAccent }]}>
                {compositionDiscussLabel(discussTone)}
              </Text>
            </Pressable>
          ) : null}

          {isAssociatedVet && row.status === "vet_review" ? (
            <View style={styles.vetActions} testID="vet-review-actions">
              <Pressable
                style={[styles.primaryBtn, { backgroundColor: ui.accent }]}
                testID="vet-approve"
                onPress={() => reviewMut.mutate({ decision: "approve" })}
                disabled={reviewMut.isPending}
              >
                <Text style={[styles.primaryBtnLabel, { color: ui.onAccent }]}>
                  Valider la composition
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, { borderColor: ui.accent }]}
                testID="vet-propose-adjustment"
                onPress={() => setAdjustOpen(true)}
              >
                <Text style={[styles.secondaryBtnLabel, { color: ui.accent }]}>
                  Proposer un ajustement
                </Text>
              </Pressable>
              <TextInput
                style={[
                  styles.commentInput,
                  {
                    color: ui.textPrimary,
                    borderColor: ui.accent + "55",
                    backgroundColor: ui.surfaceMuted
                  }
                ]}
                placeholder="Commentaire pour le producteur…"
                placeholderTextColor={ui.textSecondary}
                value={vetCommentDraft}
                onChangeText={setVetCommentDraft}
                multiline
                testID="vet-comment-input"
              />
              <Pressable
                style={[styles.secondaryBtn, { borderColor: ui.accent }]}
                testID="vet-comment"
                onPress={() => {
                  const comment = vetCommentDraft.trim();
                  if (!comment) {
                    Alert.alert(
                      "Commentaire requis",
                      "Écrivez un message avant d’envoyer."
                    );
                    return;
                  }
                  reviewMut.mutate({
                    decision: "request_changes",
                    comment
                  });
                }}
                disabled={reviewMut.isPending}
              >
                <Text style={[styles.secondaryBtnLabel, { color: ui.accent }]}>
                  Commenter
                </Text>
              </Pressable>
            </View>
          ) : null}

          {row.status === "validated" ? (
            <Pressable
              style={[
                styles.primaryBtn,
                styles.disabledBtn,
                { backgroundColor: ui.accent }
              ]}
              disabled
              testID="order-composition-disabled"
              accessibilityState={{ disabled: true }}
            >
              <Text style={[styles.primaryBtnLabel, { color: ui.onAccent }]}>
                Commander — bientôt
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ProposeAdjustmentModal
        visible={adjustOpen}
        ration={ration}
        submitting={adjustMut.isPending}
        tone={tone}
        onClose={() => setAdjustOpen(false)}
        onPreview={async (body) => {
          if (!accessToken) {
            throw new Error("Session expirée");
          }
          return previewCompositionAdjustment(
            accessToken,
            compositionId,
            body,
            activeProfileId
          );
        }}
        onSubmit={(body) => adjustMut.mutate(body)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.md
  },
  vetHint: {
    fontSize: mobileFontSize.xs,
    lineHeight: 18,
    textAlign: "center"
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: mobileFontSize.xl,
    fontWeight: "800"
  },
  meta: {
    fontSize: mobileFontSize.sm,
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
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md
  },
  vetActions: { gap: mobileSpacing.sm, marginTop: mobileSpacing.sm },
  commentInput: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    paddingHorizontal: mobileSpacing.md,
    paddingVertical: mobileSpacing.sm,
    minHeight: 72,
    textAlignVertical: "top",
    fontSize: mobileFontSize.sm
  },
  primaryBtn: {
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  disabledBtn: { opacity: 0.45 },
  primaryBtnLabel: {
    fontWeight: "800",
    textAlign: "center"
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryBtnLabel: {
    fontWeight: "700",
    textAlign: "center"
  }
});
