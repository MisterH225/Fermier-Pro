import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { ProposeAdjustmentModal } from "../../components/feed-composition/ProposeAdjustmentModal";
import { FormulationResultCard } from "../../components/feed-composition/FormulationResultCard";
import { useSession } from "../../context/SessionContext";
import {
  getFeedComposition,
  listFarmCompositionVeterinarians,
  proposeCompositionAdjustment,
  requestCompositionVetReview,
  reviewFeedComposition,
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
  mobileSpacing,
  mobileStatusSurfaces
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedCompositionDetail">;

export function FeedCompositionDetailScreen({ navigation, route }: Props) {
  const { farmId, farmName, compositionId } = route.params;
  const { accessToken, activeProfileId, authMe } = useSession();
  const qc = useQueryClient();
  const myId = authMe?.user.id;
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

      {row.status === "validated" && row.vetReviewedAt ? (
        <View style={styles.validatedBanner} testID="validated-banner">
          <Text style={styles.validatedText}>
            Validée par {row.vetReviewedByName ?? "votre vétérinaire"} le{" "}
            {new Date(row.vetReviewedAt).toLocaleDateString("fr-FR")}
          </Text>
        </View>
      ) : null}

      {row.vetComment ? (
        <Text style={styles.vetComment}>Avis véto : {row.vetComment}</Text>
      ) : null}

      <FormulationResultCard
        formulation={formulation}
        stage={row.stage}
        isTheoretical={row.isTheoretical}
      />

      {hasVets && row.status === "draft" ? (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => sendMut.mutate()}
          disabled={sendMut.isPending}
          testID="detail-send-to-vet"
        >
          <Text style={styles.secondaryBtnLabel}>
            Envoyer à mon vétérinaire pour validation
          </Text>
        </Pressable>
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
            Discuter avec mon vétérinaire
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
            <Text style={styles.primaryBtnLabel}>Valider cette composition</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            testID="vet-request-changes"
            onPress={() => reviewMut.mutate("request_changes")}
            disabled={reviewMut.isPending}
          >
            <Text style={styles.secondaryBtnLabel}>
              Demander des ajustements
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            testID="vet-propose-adjustment"
            onPress={() => setAdjustOpen(true)}
          >
            <Text style={styles.secondaryBtnLabel}>
              Proposer un ajustement (moteur)
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
              <Text style={styles.linkLabel}>Ouvrir le fil de discussion</Text>
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
