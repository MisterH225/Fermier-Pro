import { useMutation } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { BaseModal } from "../../modals/BaseModal";
import { useModal } from "../../modals/useModal";
import { deleteFarmBarn, type CheptelPenRowDto } from "../../../lib/api";
import {
  mobileColors,
  mobileRadius,
  mobileTypography
} from "../../../theme/mobileTheme";

type BarnRef = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  farmId: string;
  accessToken: string;
  activeProfileId?: string | null;
  barn: BarnRef | null;
  pens: CheptelPenRowDto[];
  onClose: () => void;
  onDeleted: () => void;
  onTransferFirst: () => void;
};

export function DeleteBuildingModal({
  visible,
  farmId,
  accessToken,
  activeProfileId,
  barn,
  pens,
  onClose,
  onDeleted,
  onTransferFirst
}: Props) {
  const { open } = useModal();

  const barnPens = barn ? pens.filter((p) => p.barnId === barn.id) : [];
  const animalCount = barnPens.reduce((sum, p) => sum + p.occupancy, 0);
  const occupiedPenCount = barnPens.filter((p) => p.occupancy > 0).length;
  const hasAnimals = animalCount > 0;

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!barn) {
        throw new Error("Bâtiment introuvable.");
      }
      await deleteFarmBarn(accessToken, farmId, barn.id, activeProfileId);
    },
    onSuccess: () => {
      onDeleted();
      onClose();
      open("success", {
        message: "Bâtiment supprimé.",
        autoDismissMs: 2000
      });
    },
    onError: (e: Error) => Alert.alert("", e.message)
  });

  if (!barn) {
    return null;
  }

  return (
    <BaseModal visible={visible} onClose={onClose} title="Supprimer ce bâtiment">
      {hasAnimals ? (
        <>
          <Text style={styles.warning}>
            ⚠️ Ce bâtiment contient {animalCount} animaux dans {occupiedPenCount} loge
            {occupiedPenCount > 1 ? "s" : ""}.
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.primary} onPress={onTransferFirst}>
              <Text style={styles.primaryTx}>Transférer les animaux d&apos;abord</Text>
            </Pressable>
            <Pressable
              style={styles.outlineDanger}
              onPress={() => deleteMut.mutate()}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? (
                <ActivityIndicator color={mobileColors.error} />
              ) : (
                <Text style={styles.outlineDangerTx}>Supprimer quand même</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Ce bâtiment et ses loges seront supprimés.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
          >
            {deleteMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryTx}>Confirmer la suppression</Text>
            )}
          </Pressable>
        </>
      )}
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22
  },
  warning: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    marginBottom: 8
  },
  actions: { gap: 10 },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: { color: "#fff", fontWeight: "700" },
  outlineDanger: {
    borderWidth: 1,
    borderColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineDangerTx: {
    color: mobileColors.error,
    fontWeight: "700"
  }
});
