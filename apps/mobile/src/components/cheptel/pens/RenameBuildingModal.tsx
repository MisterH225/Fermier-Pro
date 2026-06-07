import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { updateFarmBarn } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileTypography
} from "../../../theme/mobileTheme";

type BarnRef = {
  id: string;
  name: string;
  code?: string | null;
};

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  barn: BarnRef | null;
  onClose: () => void;
  onRenamed: () => void;
};

export function RenameBuildingModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  barn,
  onClose,
  onRenamed
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (visible && barn) {
      setName(barn.name);
    }
  }, [visible, barn]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!barn) {
        throw new Error("Bâtiment introuvable.");
      }
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Indiquez un nom.");
      }
      await updateFarmBarn(
        accessToken,
        farmId,
        barn.id,
        { name: trimmed },
        activeProfileId
      );
    },
    onSuccess: () => {
      onRenamed();
      onClose();
    },
    onError: (e: Error) => Alert.alert("", e.message)
  });

  if (!barn) {
    return null;
  }

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Renommer le bâtiment"
      footerPrimary={
        <Pressable
          style={styles.primary}
          onPress={() => saveMut.mutate()}
          disabled={saveMut.isPending}
        >
          {saveMut.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryTx}>Enregistrer</Text>
          )}
        </Pressable>
      }
    >
      <Text style={styles.label}>Nom du bâtiment</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        autoFocus
        placeholderTextColor={mobileColors.textSecondary}
      />
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
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: mobileColors.background,
    ...mobileTypography.body,
    color: mobileColors.textPrimary
  },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" }
});
