import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../../theme/mobileTheme";

type BarnRef = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  barn: BarnRef | null;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddPen: () => void;
};

export function BuildingActionsSheet({
  visible,
  barn,
  onClose,
  onRename,
  onDelete,
  onAddPen
}: Props) {
  const insets = useSafeAreaInsets();

  if (!barn) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>{barn.name}</Text>
          <Pressable style={styles.row} onPress={onRename}>
            <Text style={styles.rowTx}>✏️ Renommer le bâtiment</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={onAddPen}>
            <Text style={styles.rowTx}>➕ Ajouter une loge</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={onDelete}>
            <Text style={[styles.rowTx, styles.dangerTx]}>🗑️ Supprimer ce bâtiment</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelTx}>Annuler</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: 10,
    paddingBottom: 8
  },
  sheet: {
    backgroundColor: mobileColors.background,
    borderRadius: 24,
    overflow: "hidden",
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.lg
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    marginBottom: mobileSpacing.md,
    textAlign: "center"
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  rowTx: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  dangerTx: { color: mobileColors.error },
  cancel: {
    paddingVertical: 16,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  cancelTx: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    fontWeight: "600"
  }
});
