import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AssistChatPanel } from "../../components/feed-composition/AssistChatPanel";
import { CompositionDisclaimer } from "../../components/feed-composition/CompositionDisclaimer";
import {
  FormulateForm,
  type FormulateFormValues
} from "../../components/feed-composition/FormulateForm";
import { FormulationResultCard } from "../../components/feed-composition/FormulationResultCard";
import { useSession } from "../../context/SessionContext";
import {
  listFarmCompositionVeterinarians,
  postFeedCompositionAssist,
  postFeedCompositionFormulate,
  requestCompositionVetReview,
  saveFeedComposition,
  type FeedCompositionChatMessage,
  type FeedFormulateResultDto,
  type ProductionStage,
  type SavedCompositionSource
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { isFeedCompositionModuleActive } from "../../lib/feedComposition";
import { isAiUnavailableError } from "../../lib/feedCompositionFormat";
import type { RootStackParamList } from "../../types/navigation";
import {
  mobileColors,
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type Props = NativeStackScreenProps<RootStackParamList, "FeedComposition">;
type Mode = "assist" | "form";

export function FeedCompositionScreen({ navigation, route }: Props) {
  const { farmId, farmName } = route.params;
  const { accessToken, activeProfileId, platformModules } = useSession();
  const compositionOn = isFeedCompositionModuleActive(platformModules);

  const [mode, setMode] = useState<Mode>("assist");
  const [messages, setMessages] = useState<FeedCompositionChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [degradedNote, setDegradedNote] = useState<string | null>(null);
  const [formulation, setFormulation] = useState<FeedFormulateResultDto | null>(
    null
  );
  const [stage, setStage] = useState<ProductionStage | undefined>();
  const [isTheoretical, setIsTheoretical] = useState(false);
  const [millProfileId, setMillProfileId] = useState<string | null>(null);
  const [source, setSource] = useState<SavedCompositionSource>("ai_assisted");
  const [lastInputParams, setLastInputParams] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<FormulateFormValues>({
    stage: "fattening",
    animalCount: "30",
    avgWeightKg: "70",
    avgAgeWeeks: "",
    durationDays: "30"
  });

  const vetsQ = useQuery({
    queryKey: ["feed-composition-vets", farmId, activeProfileId],
    queryFn: () =>
      listFarmCompositionVeterinarians(
        accessToken!,
        farmId,
        activeProfileId
      ),
    enabled: Boolean(accessToken && compositionOn)
  });

  const applyFormulation = useCallback(
    (
      f: FeedFormulateResultDto,
      meta: {
        isTheoretical?: boolean;
        millProfileId?: string | null;
        stage?: ProductionStage;
        source: SavedCompositionSource;
        inputParams: Record<string, unknown>;
      }
    ) => {
      setFormulation(f);
      setIsTheoretical(Boolean(meta.isTheoretical));
      setMillProfileId(meta.millProfileId ?? null);
      if (meta.stage) setStage(meta.stage);
      setSource(meta.source);
      setLastInputParams(meta.inputParams);
      setSavedId(null);
    },
    []
  );

  const assistMut = useMutation({
    mutationFn: async (message: string) => {
      if (!accessToken) throw new Error("Session expirée");
      return postFeedCompositionAssist(
        accessToken,
        {
          farmId,
          message,
          history: messages
        },
        activeProfileId
      );
    },
    onSuccess: (res, message) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: message },
        { role: "assistant", content: res.reply }
      ]);
      setDraft("");
      setDegradedNote(null);
      if (res.formulation) {
        const stageGuess =
          (typeof lastInputParams?.stage === "string"
            ? (lastInputParams.stage as ProductionStage)
            : undefined) ?? formValues.stage;
        applyFormulation(res.formulation, {
          isTheoretical: res.isTheoretical,
          millProfileId: res.millProfileId,
          stage: stageGuess,
          source: "ai_assisted",
          inputParams: {
            farmId,
            stage: stageGuess,
            via: "assist",
            message
          }
        });
      }
    },
    onError: (err, message) => {
      if (isAiUnavailableError(err)) {
        setMode("form");
        setDegradedNote(
          "Assistant temporairement indisponible — passez par le formulaire."
        );
        setMessages((prev) => [
          ...prev,
          { role: "user", content: message },
          {
            role: "assistant",
            content:
              "Je ne peux pas répondre pour le moment. Utilisez le formulaire ci-dessous — le calcul reste le même."
          }
        ]);
        setDraft("");
        return;
      }
      Alert.alert("Erreur", formatApiError(err));
    }
  });

  const formulateMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Session expirée");
      const animalCount = Number(formValues.animalCount);
      const avgWeightKg = Number(formValues.avgWeightKg);
      const durationDays = Number(formValues.durationDays);
      const avgAgeWeeks = formValues.avgAgeWeeks.trim()
        ? Number(formValues.avgAgeWeeks)
        : undefined;
      if (!(animalCount > 0) || !(avgWeightKg > 0) || !(durationDays > 0)) {
        throw new Error("Vérifiez effectif, poids et durée (nombres positifs).");
      }
      return postFeedCompositionFormulate(
        accessToken,
        {
          farmId,
          stage: formValues.stage,
          animalCount,
          avgWeightKg,
          avgAgeWeeks:
            avgAgeWeeks != null && Number.isFinite(avgAgeWeeks)
              ? avgAgeWeeks
              : undefined,
          durationDays
        },
        activeProfileId
      );
    },
    onSuccess: (res) => {
      applyFormulation(res.formulation, {
        isTheoretical: res.isTheoretical,
        millProfileId: res.millProfileId,
        stage: formValues.stage,
        source: "manual",
        inputParams: {
          farmId,
          stage: formValues.stage,
          animalCount: Number(formValues.animalCount),
          avgWeightKg: Number(formValues.avgWeightKg),
          avgAgeWeeks: formValues.avgAgeWeeks.trim()
            ? Number(formValues.avgAgeWeeks)
            : undefined,
          durationDays: Number(formValues.durationDays)
        }
      });
      if (res.warning) {
        setDegradedNote(res.warning);
      }
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!accessToken || !formulation?.feasible || !lastInputParams) {
        throw new Error("Aucune formulation à enregistrer");
      }
      const stageToSave =
        stage ??
        (typeof lastInputParams.stage === "string"
          ? (lastInputParams.stage as ProductionStage)
          : formValues.stage);
      return saveFeedComposition(
        accessToken,
        {
          farmId,
          stage: stageToSave,
          source,
          inputParams: lastInputParams,
          ration: formulation.ration,
          nutritionResult: formulation.nutritionResult ?? undefined,
          totalCostXof: formulation.totalCostXof,
          millProfileId: millProfileId ?? undefined,
          isTheoretical
        },
        activeProfileId
      );
    },
    onSuccess: (row) => {
      setSavedId(row.id);
      Alert.alert("Enregistré", "Composition sauvegardée.");
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const vetMut = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error("Session expirée");
      let id = savedId;
      if (!id) {
        const saved = await saveMut.mutateAsync();
        id = saved.id;
      }
      return requestCompositionVetReview(
        accessToken,
        id,
        {},
        activeProfileId
      );
    },
    onSuccess: () => {
      Alert.alert(
        "Envoyé",
        "Votre vétérinaire a été notifié pour valider la composition."
      );
      navigation.navigate("FeedCompositionsList", { farmId, farmName });
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const hasVets = (vetsQ.data?.length ?? 0) > 0;

  const modeSwitcher = useMemo(
    () => (
      <View style={styles.modeRow} testID="mode-switcher">
        <Pressable
          style={[styles.modeBtn, mode === "assist" && styles.modeBtnOn]}
          onPress={() => setMode("assist")}
          testID="mode-assist"
        >
          <Text style={[styles.modeText, mode === "assist" && styles.modeTextOn]}>
            Assistée
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "form" && styles.modeBtnOn]}
          onPress={() => setMode("form")}
          testID="mode-form"
        >
          <Text style={[styles.modeText, mode === "form" && styles.modeTextOn]}>
            Formulaire
          </Text>
        </Pressable>
      </View>
    ),
    [mode]
  );

  if (!compositionOn) {
    return (
      <View style={styles.root}>
        <Text style={styles.blocked}>
          La composition d’aliments n’est pas activée pour votre compte.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="feed-composition-screen"
    >
      <Text style={styles.farm}>{farmName}</Text>
      <CompositionDisclaimer />
      {modeSwitcher}
      {degradedNote ? (
        <Text style={styles.degraded} testID="degraded-note">
          {degradedNote}
        </Text>
      ) : null}

      {mode === "assist" ? (
        <View style={styles.chatBox}>
          <AssistChatPanel
            messages={messages}
            draft={draft}
            onChangeDraft={setDraft}
            sending={assistMut.isPending}
            onSend={() => {
              const msg = draft.trim();
              if (!msg) return;
              assistMut.mutate(msg);
            }}
          />
        </View>
      ) : (
        <FormulateForm
          values={formValues}
          onChange={setFormValues}
          onSubmit={() => formulateMut.mutate()}
          submitting={formulateMut.isPending}
        />
      )}

      {formulation ? (
        <>
          <FormulationResultCard
            formulation={formulation}
            stage={stage ?? formValues.stage}
            isTheoretical={isTheoretical}
          />
          {formulation.feasible ? (
            <View style={styles.actions}>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                testID="save-composition"
              >
                <Text style={styles.primaryBtnLabel}>
                  {savedId ? "Enregistrée" : "Enregistrer"}
                </Text>
              </Pressable>
              {hasVets ? (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => vetMut.mutate()}
                  disabled={vetMut.isPending}
                  testID="send-to-vet"
                >
                  <Text style={styles.secondaryBtnLabel}>
                    Envoyer à mon vétérinaire pour validation
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
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
  farm: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  blocked: {
    padding: mobileSpacing.xl,
    fontSize: mobileFontSize.md,
    color: mobileColors.textSecondary
  },
  modeRow: {
    flexDirection: "row",
    backgroundColor: mobileColors.surfaceMuted,
    borderRadius: mobileRadius.pill,
    padding: 4
  },
  modeBtn: {
    flex: 1,
    paddingVertical: mobileSpacing.sm,
    alignItems: "center",
    borderRadius: mobileRadius.pill
  },
  modeBtnOn: { backgroundColor: mobileColors.background },
  modeText: {
    fontWeight: "700",
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  modeTextOn: { color: mobileColors.accent },
  degraded: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    fontStyle: "italic"
  },
  chatBox: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md,
    minHeight: 280
  },
  actions: { gap: mobileSpacing.sm },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryBtnLabel: {
    color: mobileColors.onAccent,
    fontWeight: "800",
    fontSize: mobileFontSize.md
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: mobileColors.accent,
    borderRadius: mobileRadius.md,
    paddingVertical: mobileSpacing.md,
    paddingHorizontal: mobileSpacing.md,
    alignItems: "center"
  },
  secondaryBtnLabel: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm,
    textAlign: "center"
  }
});
