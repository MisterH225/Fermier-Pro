import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../context/SessionContext";
import type {
  FeedFormulateResultDto,
  FeedRationLineDto
} from "../../lib/api/feed-composition";
import { apiGetJson } from "../../lib/api/http";
import { formatApiError } from "../../lib/apiErrors";
import {
  formatPct,
  formatXof,
  rationLineName
} from "../../lib/feedCompositionFormat";
import {
  compositionUiColors,
  type CompositionUiTone
} from "../../theme/compositionUiTone";
import {
  mobileFontSize,
  mobileRadius,
  mobileSpacing
} from "../../theme/mobileTheme";

type IngredientHit = {
  id: string;
  canonicalName: string;
  category: string;
};

export type AdjustmentPreview = {
  feasible: boolean;
  formulation: FeedFormulateResultDto;
  deviationFromCurrent: {
    crudeProteinPct: number;
    metabolizableEnergyKcal: number;
    lysinePct: number;
    energyChangePct: number | null;
    fatRiskAlert: boolean;
    energyCapKcal: number | null;
  };
  fatRiskAlert: boolean;
  infeasibilityReasons: string[];
};

type Props = {
  visible: boolean;
  ration: FeedRationLineDto[];
  onClose: () => void;
  /** Recalcule via le moteur — sans envoyer. */
  onPreview: (args: {
    removeIngredientId: string;
    addIngredientId: string;
  }) => Promise<AdjustmentPreview>;
  /** Confirme l'envoi de la proposition. */
  onSubmit: (args: {
    removeIngredientId: string;
    addIngredientId: string;
    comment?: string;
  }) => void;
  submitting?: boolean;
  tone?: CompositionUiTone;
};

export function ProposeAdjustmentModal({
  visible,
  ration,
  onClose,
  onPreview,
  onSubmit,
  submitting,
  tone = "producer"
}: Props) {
  const { accessToken, activeProfileId } = useSession();
  const insets = useSafeAreaInsets();
  const ui = compositionUiColors(tone);
  const scrollRef = useRef<ScrollView>(null);
  const commentRef = useRef<TextInputType>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [addId, setAddId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [comment, setComment] = useState("");
  const [preview, setPreview] = useState<AdjustmentPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setRemoveId(null);
      setAddId(null);
      setQ("");
      setComment("");
      setPreview(null);
      setPreviewError(null);
      setPreviewing(false);
    }
  }, [visible]);

  const searchQ = useQuery({
    queryKey: ["feed-ingredients-search", q, activeProfileId],
    queryFn: () =>
      apiGetJson<IngredientHit[]>(
        `/feed-composition/ingredients?q=${encodeURIComponent(q.trim())}`,
        accessToken!,
        activeProfileId
      ),
    enabled: Boolean(accessToken && visible && q.trim().length >= 1)
  });

  const canRecalc = Boolean(removeId && addId && removeId !== addId);
  const canConfirm =
    Boolean(preview?.feasible) && canRecalc && !submitting && !previewing;

  const hits = useMemo(
    () => (searchQ.data ?? []).filter((h) => h.id !== removeId),
    [searchQ.data, removeId]
  );

  const scrollFocusedIntoView = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, Platform.OS === "android" ? 120 : 40);
    });
  };

  const runPreview = async () => {
    if (!removeId || !addId) return;
    setPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const result = await onPreview({
        removeIngredientId: removeId,
        addIngredientId: addId
      });
      setPreview(result);
      scrollFocusedIntoView();
    } catch (err) {
      setPreviewError(formatApiError(err));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.kav}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <Pressable style={styles.backdropTap} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: ui.background,
              paddingBottom: Math.max(insets.bottom, 12)
            }
          ]}
          testID="propose-adjustment-modal"
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 32 }
            ]}
          >
            <Text style={[styles.title, { color: ui.textPrimary }]}>
              Proposer un autre mélange
            </Text>
            <Text style={[styles.hint, { color: ui.textSecondary }]}>
              Enlevez un produit et choisissez-en un autre. L’appli recalcule
              toute seule — pas à la main. Vérifiez le résultat avant d’envoyer.
            </Text>

            <Text style={[styles.label, { color: ui.textSecondary }]}>
              1. Intrant à retirer
            </Text>
            <View style={styles.chips}>
              {ration.map((l) => {
                const on = removeId === l.feedIngredientId;
                return (
                  <Pressable
                    key={l.feedIngredientId}
                    style={[
                      styles.chip,
                      { borderColor: ui.border },
                      on && {
                        backgroundColor: ui.accentSoft,
                        borderColor: ui.accent
                      }
                    ]}
                    onPress={() => {
                      setRemoveId(l.feedIngredientId);
                      setPreview(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: ui.textPrimary },
                        on && { color: ui.accent }
                      ]}
                    >
                      {rationLineName(l)} ({formatPct(l.proportionPct)})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: ui.textSecondary }]}>
              2. Substitut
            </Text>
            <TextInput
              style={[
                styles.input,
                { borderColor: ui.border, color: ui.textPrimary }
              ]}
              placeholder="Chercher un intrant (ex. soja)"
              placeholderTextColor={ui.textSecondary}
              value={q}
              onChangeText={(t) => {
                setQ(t);
                setPreview(null);
              }}
              onFocus={scrollFocusedIntoView}
              testID="adjust-search"
            />
            {searchQ.isFetching ? (
              <ActivityIndicator color={ui.accent} />
            ) : (
              <FlatList
                data={hits}
                keyExtractor={(i) => i.id}
                style={{ maxHeight: 140 }}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={hits.length > 3}
                renderItem={({ item }) => {
                  const on = addId === item.id;
                  return (
                    <Pressable
                      style={[
                        styles.hit,
                        { borderBottomColor: ui.border },
                        on && { backgroundColor: ui.accentSoft }
                      ]}
                      onPress={() => {
                        setAddId(item.id);
                        setPreview(null);
                      }}
                    >
                      <Text
                        style={[styles.hitText, { color: ui.textPrimary }]}
                      >
                        {item.canonicalName}
                      </Text>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  q.trim() ? (
                    <Text style={[styles.hint, { color: ui.textSecondary }]}>
                      Aucun résultat
                    </Text>
                  ) : null
                }
              />
            )}

            <Pressable
              style={[
                styles.recalcBtn,
                { borderColor: ui.accent },
                (!canRecalc || previewing) && styles.disabled
              ]}
              disabled={!canRecalc || previewing}
              testID="adjust-recalculate"
              onPress={() => void runPreview()}
            >
              <Text style={[styles.recalcLabel, { color: ui.accent }]}>
                {previewing ? "Recalcul…" : "Recalculer"}
              </Text>
            </Pressable>

            {previewError ? (
              <Text style={styles.error} testID="adjust-preview-error">
                {previewError}
              </Text>
            ) : null}

            {preview ? (
              <View style={styles.previewBox} testID="adjust-preview">
                {!preview.feasible ? (
                  <Text style={styles.error}>
                    Cet ajustement rend le mélange infaisable avec les intrants
                    disponibles.
                    {preview.infeasibilityReasons[0]
                      ? ` ${preview.infeasibilityReasons[0]}`
                      : ""}
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[styles.previewTitle, { color: ui.textPrimary }]}
                    >
                      Nouveau mélange ·{" "}
                      {formatXof(preview.formulation.totalCostXof)}
                    </Text>
                    {(preview.formulation.ration ?? []).slice(0, 6).map((l) => (
                      <Text
                        key={l.feedIngredientId}
                        style={[styles.previewLine, { color: ui.textSecondary }]}
                      >
                        {rationLineName(l)} · {formatPct(l.proportionPct)}
                      </Text>
                    ))}
                    <Text
                      style={[styles.previewDelta, { color: ui.textPrimary }]}
                    >
                      Énergie :{" "}
                      {preview.deviationFromCurrent.energyChangePct != null
                        ? `${preview.deviationFromCurrent.energyChangePct.toFixed(1)} %`
                        : "—"}
                      {" · "}
                      Protéines :{" "}
                      {preview.deviationFromCurrent.crudeProteinPct >= 0
                        ? "+"
                        : ""}
                      {preview.deviationFromCurrent.crudeProteinPct.toFixed(2)}{" "}
                      pts
                    </Text>
                    {preview.fatRiskAlert ? (
                      <Text style={styles.fatRisk} testID="adjust-fat-risk">
                        Risque de gras : l’énergie dépasse le plafond de ce
                        stade.
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            ) : null}

            <Text style={[styles.label, { color: ui.textSecondary }]}>
              Commentaire (optionnel)
            </Text>
            <TextInput
              ref={commentRef}
              style={[
                styles.input,
                {
                  borderColor: ui.border,
                  color: ui.textPrimary,
                  minHeight: 64
                }
              ]}
              multiline
              value={comment}
              onChangeText={setComment}
              onFocus={scrollFocusedIntoView}
              placeholder="Ex. : plus de soja pour les protéines"
              placeholderTextColor={ui.textSecondary}
              testID="adjust-comment"
            />

            <View style={styles.actions}>
              <Pressable
                style={[styles.cancel, { borderColor: ui.border }]}
                onPress={onClose}
              >
                <Text style={[styles.cancelLabel, { color: ui.textPrimary }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.submit,
                  { backgroundColor: ui.accent },
                  (!canConfirm || submitting) && styles.disabled
                ]}
                disabled={!canConfirm || submitting}
                testID="adjust-submit"
                onPress={() => {
                  if (!removeId || !addId || !preview?.feasible) return;
                  onSubmit({
                    removeIngredientId: removeId,
                    addIngredientId: addId,
                    comment: comment.trim() || undefined
                  });
                }}
              >
                <Text style={[styles.submitLabel, { color: ui.onAccent }]}>
                  {submitting ? "Envoi…" : "Envoyer au producteur"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)"
  },
  backdropTap: {
    flex: 1
  },
  sheet: {
    borderTopLeftRadius: mobileRadius.xl,
    borderTopRightRadius: mobileRadius.xl,
    maxHeight: "92%"
  },
  sheetContent: {
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  title: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800"
  },
  hint: {
    fontSize: mobileFontSize.sm
  },
  label: {
    marginTop: 8,
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipText: { fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    fontSize: mobileFontSize.md
  },
  hit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  hitText: { fontWeight: "600" },
  recalcBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    borderWidth: 1.5
  },
  recalcLabel: { fontWeight: "800" },
  previewBox: {
    marginTop: 4,
    padding: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    backgroundColor: "rgba(0,0,0,0.04)",
    gap: 4
  },
  previewTitle: { fontWeight: "800", fontSize: mobileFontSize.md },
  previewLine: { fontSize: mobileFontSize.sm },
  previewDelta: { marginTop: 4, fontWeight: "600", fontSize: mobileFontSize.sm },
  fatRisk: {
    marginTop: 4,
    color: "#B45309",
    fontWeight: "700",
    fontSize: mobileFontSize.sm
  },
  error: {
    color: "#B91C1C",
    fontWeight: "600",
    fontSize: mobileFontSize.sm
  },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    borderWidth: 1
  },
  cancelLabel: { fontWeight: "700" },
  submit: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: mobileRadius.md
  },
  submitLabel: { fontWeight: "800" },
  disabled: { opacity: 0.5 }
});
