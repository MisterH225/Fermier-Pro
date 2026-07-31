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
import type { FeedRationLineDto } from "../../lib/api/feed-composition";
import { apiGetJson } from "../../lib/api/http";
import { formatPct, rationLineName } from "../../lib/feedCompositionFormat";
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

type Props = {
  visible: boolean;
  ration: FeedRationLineDto[];
  onClose: () => void;
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

  useEffect(() => {
    if (!visible) {
      setRemoveId(null);
      setAddId(null);
      setQ("");
      setComment("");
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

  const canSubmit = Boolean(removeId && addId && removeId !== addId);

  const hits = useMemo(
    () => (searchQ.data ?? []).filter((h) => h.id !== removeId),
    [searchQ.data, removeId]
  );

  const scrollFocusedIntoView = () => {
    // Android : laisse le clavier s’ouvrir puis remonte le sheet.
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, Platform.OS === "android" ? 120 : 40);
    });
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
            contentContainerStyle={styles.sheetContent}
          >
            <Text style={[styles.title, { color: ui.textPrimary }]}>
              Proposer un autre mélange
            </Text>
            <Text style={[styles.hint, { color: ui.textSecondary }]}>
              Enlevez un produit et choisissez-en un autre. L’appli recalcule
              toute seule — pas à la main.
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
                    onPress={() => setRemoveId(l.feedIngredientId)}
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
              onChangeText={setQ}
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
                      onPress={() => setAddId(item.id)}
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
              placeholder="Ex. : baisse le tourteau, ajoute du calcium"
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
                  (!canSubmit || submitting) && styles.disabled
                ]}
                disabled={!canSubmit || submitting}
                testID="adjust-submit"
                onPress={() => {
                  if (!removeId || !addId) return;
                  onSubmit({
                    removeIngredientId: removeId,
                    addIngredientId: addId,
                    comment: comment.trim() || undefined
                  });
                }}
              >
                <Text style={[styles.submitLabel, { color: ui.onAccent }]}>
                  {submitting ? "Calcul…" : "Proposer"}
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
    gap: mobileSpacing.sm,
    paddingBottom: mobileSpacing.xl
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
