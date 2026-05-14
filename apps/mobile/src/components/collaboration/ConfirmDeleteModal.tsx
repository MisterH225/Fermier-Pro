import { Pressable, StyleSheet, Text, View } from "react-native";
import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ConfirmDeleteModal({
  visible,
  title,
  body,
  confirmLabel = "Confirmer",
  onConfirm,
  onCancel,
  loading
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, styles.cancelBtn]}
              accessibilityRole="button"
            >
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[styles.btn, styles.confirmBtn, loading && styles.btnDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.confirmTxt}>
                {loading ? "…" : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.xl
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.xl,
    width: "100%",
    maxWidth: 360,
    gap: mobileSpacing.md
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  },
  body: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    lineHeight: 22
  },
  actions: {
    flexDirection: "row",
    gap: mobileSpacing.sm,
    marginTop: mobileSpacing.sm
  },
  btn: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.pill,
    alignItems: "center"
  },
  cancelBtn: {
    backgroundColor: mobileColors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border
  },
  confirmBtn: {
    backgroundColor: mobileColors.error
  },
  btnDisabled: { opacity: 0.5 },
  cancelTxt: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    fontWeight: "600"
  },
  confirmTxt: {
    ...mobileTypography.body,
    color: "#fff",
    fontWeight: "700"
  }
});
