import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSession } from "../../context/SessionContext";
import type { FeedRationLineDto } from "../../lib/api/feed-composition";
import { apiGetJson } from "../../lib/api/http";
import { formatPct, rationLineName } from "../../lib/feedCompositionFormat";
import {
  mobileColors,
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
};

export function ProposeAdjustmentModal({
  visible,
  ration,
  onClose,
  onSubmit,
  submitting
}: Props) {
  const { accessToken, activeProfileId } = useSession();
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [addId, setAddId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [comment, setComment] = useState("");

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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="propose-adjustment-modal">
          <Text style={styles.title}>Proposer un autre mélange</Text>
          <Text style={styles.hint}>
            Enlevez un produit et choisissez-en un autre. L’appli recalcule toute
            seule — pas à la main.
          </Text>

          <Text style={styles.label}>1. Intrant à retirer</Text>
          <View style={styles.chips}>
            {ration.map((l) => {
              const on = removeId === l.feedIngredientId;
              return (
                <Pressable
                  key={l.feedIngredientId}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setRemoveId(l.feedIngredientId)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {rationLineName(l)} ({formatPct(l.proportionPct)})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>2. Substitut</Text>
          <TextInput
            style={styles.input}
            placeholder="Chercher un intrant (ex. soja)"
            value={q}
            onChangeText={setQ}
            testID="adjust-search"
          />
          {searchQ.isFetching ? (
            <ActivityIndicator color={mobileColors.accent} />
          ) : (
            <FlatList
              data={hits}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 140 }}
              renderItem={({ item }) => {
                const on = addId === item.id;
                return (
                  <Pressable
                    style={[styles.hit, on && styles.hitOn]}
                    onPress={() => setAddId(item.id)}
                  >
                    <Text style={styles.hitText}>{item.canonicalName}</Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                q.trim() ? (
                  <Text style={styles.hint}>Aucun résultat</Text>
                ) : null
              }
            />
          )}

          <Text style={styles.label}>Commentaire (optionnel)</Text>
          <TextInput
            style={[styles.input, { minHeight: 64 }]}
            multiline
            value={comment}
            onChangeText={setComment}
            placeholder="Ex. : baisse le tourteau, ajoute du calcium"
          />

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelLabel}>Annuler</Text>
            </Pressable>
            <Pressable
              style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
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
              <Text style={styles.submitLabel}>
                {submitting ? "Calcul…" : "Proposer"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: mobileColors.background,
    borderTopLeftRadius: mobileRadius.xl,
    borderTopRightRadius: mobileRadius.xl,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm,
    maxHeight: "90%"
  },
  title: {
    fontSize: mobileFontSize.lg,
    fontWeight: "800",
    color: mobileColors.textPrimary
  },
  hint: {
    fontSize: mobileFontSize.sm,
    color: mobileColors.textSecondary
  },
  label: {
    marginTop: 8,
    fontWeight: "700",
    color: mobileColors.textSecondary,
    fontSize: mobileFontSize.sm
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipOn: {
    backgroundColor: mobileColors.accentSoft,
    borderColor: mobileColors.accent
  },
  chipText: { fontWeight: "600", color: mobileColors.textPrimary },
  chipTextOn: { color: mobileColors.accent },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: mobileSpacing.md,
    fontSize: mobileFontSize.md
  },
  hit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  hitOn: { backgroundColor: mobileColors.accentSoft },
  hitText: { fontWeight: "600" },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  cancelLabel: { fontWeight: "700" },
  submit: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    backgroundColor: mobileColors.accent
  },
  submitLabel: { color: mobileColors.onAccent, fontWeight: "800" },
  disabled: { opacity: 0.5 }
});
