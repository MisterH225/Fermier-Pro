import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useScrollBottomPad } from "../../hooks/useScrollBottomPad";
import {
  listFarmCompositionVeterinarians,
  postFeedCompositionAssist,
  postFeedCompositionExplain,
  postFeedCompositionFormulate,
  requestCompositionVetReview,
  saveFeedComposition,
  type CompositionExplanationDto,
  type FeedCompositionChatMessage,
  type FeedFormulateResultDto,
  type ProductionStage,
  type SavedCompositionSource
} from "../../lib/api";
import { formatApiError } from "../../lib/apiErrors";
import { isFeedCompositionModuleActive } from "../../lib/feedComposition";
import {
  buildLocalFactualExplanation,
  nutritionFromFormulation
} from "../../lib/compositionExplanation";
import { asRationLines, isAiUnavailableError } from "../../lib/feedCompositionFormat";
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
  /** Navbar + FAB + marge pour boutons Enregistrer / Envoyer au véto. */
  const scrollPad = useScrollBottomPad({ extra: 160 });
  const scrollRef = useRef<ScrollView>(null);

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
  const [explanation, setExplanation] =
    useState<CompositionExplanationDto | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const [formValues, setFormValues] = useState<FormulateFormValues>({
    stage: "fattening",
    animalCount: "30",
    avgWeightKg: "70",
    avgAgeWeeks: "",
    durationDays: "30"
  });

  const scrollTowardBottom = useCallback(() => {
    // Délai court : laisse le clavier s’ouvrir puis ramène la zone de saisie.
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

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

  const fetchExplanation = useCallback(
    async (
      f: FeedFormulateResultDto,
      meta: {
        stage: ProductionStage;
        animalCount?: number;
        avgWeightKg?: number;
        avgAgeWeeks?: number;
        savedCompositionId?: string;
      }
    ) => {
      const nutrition = nutritionFromFormulation(f);
      if (!f.feasible || !nutrition || !accessToken) {
        setExplanation(null);
        return;
      }
      setExplanationLoading(true);
      try {
        const res = await postFeedCompositionExplain(
          accessToken,
          {
            farmId,
            stage: meta.stage,
            animalCount: meta.animalCount && meta.animalCount > 0
              ? meta.animalCount
              : 1,
            avgWeightKg: meta.avgWeightKg,
            avgAgeWeeks: meta.avgAgeWeeks,
            ration: asRationLines(f.ration),
            nutritionResult: nutrition,
            deviations: f.deviations,
            savedCompositionId: meta.savedCompositionId
          },
          activeProfileId
        );
        setExplanation(res.explanation);
      } catch {
        setExplanation(
          buildLocalFactualExplanation({
            stage: meta.stage,
            animalCount: meta.animalCount,
            avgWeightKg: meta.avgWeightKg,
            formulation: f
          })
        );
      } finally {
        setExplanationLoading(false);
      }
    },
    [accessToken, activeProfileId, farmId]
  );

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
      setExplanation(null);
      scrollTowardBottom();

      const stageForExplain =
        meta.stage ??
        (typeof meta.inputParams.stage === "string"
          ? (meta.inputParams.stage as ProductionStage)
          : formValues.stage);
      void fetchExplanation(f, {
        stage: stageForExplain,
        animalCount:
          typeof meta.inputParams.animalCount === "number"
            ? meta.inputParams.animalCount
            : Number(formValues.animalCount) || undefined,
        avgWeightKg:
          typeof meta.inputParams.avgWeightKg === "number"
            ? meta.inputParams.avgWeightKg
            : Number(formValues.avgWeightKg) || undefined,
        avgAgeWeeks:
          typeof meta.inputParams.avgAgeWeeks === "number"
            ? meta.inputParams.avgAgeWeeks
            : undefined
      });
    },
    [scrollTowardBottom, fetchExplanation, formValues]
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
      } else {
        scrollTowardBottom();
      }
    },
    onError: (err, message) => {
      if (isAiUnavailableError(err)) {
        setMode("form");
        setDegradedNote(
          "L’assistant ne répond pas pour le moment — utilisez le formulaire, le calcul reste le même."
        );
        setMessages((prev) => [
          ...prev,
          { role: "user", content: message },
          {
            role: "assistant",
            content:
              "Je ne peux pas discuter pour le moment. Passez par « Remplir moi-même » plus bas — on calcule quand même votre mélange."
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
        throw new Error(
          "Vérifiez le nombre d’animaux, le poids et le nombre de jours (nombres positifs)."
        );
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
        throw new Error("Aucune composition à enregistrer");
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
      // Persister l'explication en cache côté composition sauvegardée.
      if (formulation?.feasible) {
        void fetchExplanation(formulation, {
          stage: row.stage,
          animalCount:
            typeof lastInputParams?.animalCount === "number"
              ? lastInputParams.animalCount
              : Number(formValues.animalCount) || undefined,
          avgWeightKg:
            typeof lastInputParams?.avgWeightKg === "number"
              ? lastInputParams.avgWeightKg
              : Number(formValues.avgWeightKg) || undefined,
          savedCompositionId: row.id
        });
      }
      Alert.alert(
        "Enregistré",
        "Composition sauvegardée. Vous pouvez l’envoyer à votre vétérinaire pour validation."
      );
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const openChat = useCallback(
    (chatRoomId: string | null | undefined) => {
      if (!chatRoomId) {
        navigation.navigate("FeedCompositionsList", { farmId, farmName });
        return;
      }
      navigation.navigate("ChatRoom", {
        roomId: chatRoomId,
        headline: "Composition — avis véto",
        farmId
      });
    },
    [farmId, farmName, navigation]
  );

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
    onSuccess: (row) => {
      setSavedId(row.id);
      Alert.alert(
        "Envoyé au vétérinaire",
        "Une discussion a été ouverte. Vous pouvez échanger autour de cette composition.",
        [
          {
            text: "Ouvrir la discussion",
            onPress: () => openChat(row.chatRoomId)
          },
          {
            text: "Plus tard",
            onPress: () =>
              navigation.navigate("FeedCompositionsList", { farmId, farmName })
          }
        ]
      );
    },
    onError: (err) => Alert.alert("Erreur", formatApiError(err))
  });

  const hasVets = (vetsQ.data?.length ?? 0) > 0;

  const onRequestVet = () => {
    if (!formulation?.feasible) return;
    if (!hasVets) {
      Alert.alert(
        "Aucun vétérinaire associé",
        "Ajoutez d’abord votre vétérinaire à cette ferme (Équipe / membres), puis renvoyez la composition pour validation.",
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
    vetMut.mutate();
  };

  const modeSwitcher = useMemo(
    () => (
      <View style={styles.modeRow} testID="mode-switcher">
        <Pressable
          style={[styles.modeBtn, mode === "assist" && styles.modeBtnOn]}
          onPress={() => setMode("assist")}
          testID="mode-assist"
        >
          <Text style={[styles.modeText, mode === "assist" && styles.modeTextOn]}>
            Discuter
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, mode === "form" && styles.modeBtnOn]}
          onPress={() => setMode("form")}
          testID="mode-form"
        >
          <Text style={[styles.modeText, mode === "form" && styles.modeTextOn]}>
            Remplir moi-même
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
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        contentContainerStyle={[styles.content, { paddingBottom: scrollPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator
        testID="feed-composition-screen"
      >
        <Text style={styles.farm}>{farmName}</Text>
        <Text style={styles.intro}>
          Préparez un mélange pour vos porcs, puis envoyez-le à votre
          vétérinaire pour qu’il le valide.
        </Text>
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
              onInputFocus={scrollTowardBottom}
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
            onFieldFocus={scrollTowardBottom}
          />
        )}

        {formulation ? (
          <>
            <FormulationResultCard
              formulation={formulation}
              stage={stage ?? formValues.stage}
              isTheoretical={isTheoretical}
              explanation={explanation}
              explanationLoading={explanationLoading}
            />
            {formulation.feasible ? (
              <View style={styles.actions}>
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => saveMut.mutate()}
                  disabled={saveMut.isPending || vetMut.isPending}
                  testID="save-composition"
                >
                  <Text style={styles.primaryBtnLabel}>
                    {savedId ? "Enregistrée" : "Enregistrer"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={onRequestVet}
                  disabled={vetMut.isPending || saveMut.isPending}
                  testID="send-to-vet"
                >
                  <Text style={styles.secondaryBtnLabel}>
                    Envoyer à mon vétérinaire pour validation
                  </Text>
                </Pressable>
                {!hasVets && !vetsQ.isPending ? (
                  <Text style={styles.vetHint} testID="no-vet-hint">
                    Astuce : associez d’abord votre véto dans l’équipe de la
                    ferme pour ouvrir la discussion.
                  </Text>
                ) : (
                  <Text style={styles.vetHint}>
                    Le véto reçoit la composition et peut discuter / valider
                    avec vous dans le fil de messages.
                  </Text>
                )}
              </View>
            ) : null}
          </>
        ) : null}
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
  farm: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  intro: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary,
    lineHeight: 20,
    marginTop: -4
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
    fontStyle: "italic",
    lineHeight: 20
  },
  chatBox: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: 1,
    borderColor: mobileColors.border,
    padding: mobileSpacing.md
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
    alignItems: "center",
    backgroundColor: mobileColors.background
  },
  secondaryBtnLabel: {
    color: mobileColors.accent,
    fontWeight: "700",
    fontSize: mobileFontSize.sm,
    textAlign: "center"
  },
  vetHint: {
    fontSize: mobileFontSize.xs,
    color: mobileColors.textSecondary,
    lineHeight: 18,
    textAlign: "center"
  }
});
