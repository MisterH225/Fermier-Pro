import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { ModalSection } from "../../modals/ModalSection";
import { useModal } from "../../modals/useModal";
import {
  createFarmBarn,
  createPen,
  deleteFarmBarn,
  patchPen,
  type PenCategoryKey
} from "../../../lib/api";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../../theme/mobileTheme";
import { PEN_TYPE_OPTIONS, penTypeLabel } from "./penTypeOptions";

type PenDraft = {
  key: string;
  name: string;
  capacity: string;
  category: PenCategoryKey;
};

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  onClose: () => void;
  onCreated: () => void;
};

let penKeyCounter = 0;

function newPenDraft(): PenDraft {
  penKeyCounter += 1;
  return {
    key: `pen-${penKeyCounter}`,
    name: "",
    capacity: "15",
    category: "mixed"
  };
}

export function CreateBuildingModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  onClose,
  onCreated
}: Props) {
  const { t } = useTranslation();
  const { open } = useModal();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [pens, setPens] = useState<PenDraft[]>([newPenDraft()]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setName("");
    setCode("");
    setNotes("");
    setPens([newPenDraft()]);
  }, [visible]);

  const updatePen = (key: string, patch: Partial<PenDraft>) => {
    setPens((prev) =>
      prev.map((p) => (p.key === key ? { ...p, ...patch } : p))
    );
  };

  const removePen = (key: string) => {
    setPens((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((p) => p.key !== key);
    });
  };

  const pickPenType = (key: string) => {
    Alert.alert(
      "Type de loge",
      undefined,
      [
        ...PEN_TYPE_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => updatePen(key, { category: opt.category })
        })),
        { text: "Annuler", style: "cancel" as const }
      ],
      { cancelable: true }
    );
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const buildingName = name.trim();
      if (!buildingName) {
        throw new Error("Indiquez le nom du bâtiment.");
      }

      const validPens = pens.filter((p) => p.name.trim());
      if (validPens.length === 0) {
        throw new Error("Ajoutez au moins une loge avec un nom.");
      }

      const barn = await createFarmBarn(
        accessToken,
        farmId,
        {
          name: buildingName,
          ...(code.trim() ? { code: code.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {})
        },
        activeProfileId
      );

      try {
        for (const [index, pen] of validPens.entries()) {
          const cap = Number.parseInt(pen.capacity, 10);
          const created = await createPen(
            accessToken,
            farmId,
            barn.id,
            {
              name: pen.name.trim(),
              capacity: Number.isFinite(cap) && cap > 0 ? cap : undefined,
              sortOrder: index
            },
            activeProfileId
          );
          await patchPen(
            accessToken,
            farmId,
            created.id,
            {
              category: pen.category,
              categoryForced: true
            },
            activeProfileId
          );
        }
        return { barnId: barn.id, penCount: validPens.length };
      } catch (e) {
        await deleteFarmBarn(accessToken, farmId, barn.id, activeProfileId).catch(
          () => undefined
        );
        throw e;
      }
    },
    onSuccess: (result) => {
      onCreated();
      onClose();
      open("success", {
        message: `Bâtiment créé avec ${result.penCount} loge${result.penCount > 1 ? "s" : ""}.`,
        autoDismissMs: 2200
      });
    },
    onError: (e: Error) => Alert.alert(t("common.error"), e.message)
  });

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Nouveau bâtiment"
      footerPrimary={
        <Pressable
          style={styles.primary}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color={mobileColors.onAccent} />
          ) : (
            <Text style={styles.primaryTx}>Créer le bâtiment</Text>
          )}
        </Pressable>
      }
    >
      <ModalSection title="Bâtiment">
        <Text style={styles.label}>Nom du bâtiment *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ex. Nurserie nord"
          placeholderTextColor={mobileColors.textSecondary}
        />
        <Text style={styles.label}>Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Ex. N1"
          placeholderTextColor={mobileColors.textSecondary}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Accès, équipements…"
          placeholderTextColor={mobileColors.textSecondary}
          multiline
        />
      </ModalSection>

      <ModalSection title="Loges de ce bâtiment">
        <Text style={styles.sectionHint}>Ajoutez les loges directement</Text>
        {pens.map((pen) => (
          <View key={pen.key} style={styles.penRow}>
            <TextInput
              style={[styles.input, styles.penName]}
              value={pen.name}
              onChangeText={(v) => updatePen(pen.key, { name: v })}
              placeholder="Ex. Loge 1"
              placeholderTextColor={mobileColors.textSecondary}
            />
            <TextInput
              style={[styles.input, styles.penCapacity]}
              value={pen.capacity}
              onChangeText={(v) => updatePen(pen.key, { capacity: v })}
              placeholder="15"
              placeholderTextColor={mobileColors.textSecondary}
              keyboardType="number-pad"
            />
            <Pressable
              style={[styles.input, styles.penType]}
              onPress={() => pickPenType(pen.key)}
            >
              <Text style={styles.penTypeTx} numberOfLines={1}>
                {penTypeLabel(pen.category)}
              </Text>
            </Pressable>
            <Pressable
              style={styles.removeBtn}
              onPress={() => removePen(pen.key)}
              accessibilityLabel="Supprimer la loge"
            >
              <Text style={styles.removeTx}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.addPenBtn} onPress={() => setPens((p) => [...p, newPenDraft()])}>
          <Text style={styles.addPenTx}>+ Ajouter une loge</Text>
        </Pressable>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  label: {
    ...mobileTypography.meta,
    fontWeight: "600",
    marginBottom: 4,
    color: mobileColors.textSecondary
  },
  sectionHint: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary,
    marginBottom: mobileSpacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: mobileColors.background,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  penRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: mobileSpacing.sm
  },
  penName: { flex: 4, minWidth: 0 },
  penCapacity: { flex: 2.5, minWidth: 0, textAlign: "center" },
  penType: {
    flex: 3,
    minWidth: 0,
    justifyContent: "center"
  },
  penTypeTx: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  removeBtn: {
    width: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  removeTx: {
    color: mobileColors.error,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  },
  addPenBtn: {
    alignSelf: "flex-start",
    paddingVertical: mobileSpacing.sm
  },
  addPenTx: {
    ...mobileTypography.body,
    fontWeight: "700",
    color: mobileColors.accent
  },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: { color: mobileColors.onAccent, fontWeight: "700" }
});
