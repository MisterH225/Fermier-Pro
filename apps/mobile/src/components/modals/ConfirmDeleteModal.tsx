import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import type { ConfirmDeleteModalPayload } from "../../context/ModalContext";

type ConfirmDeleteModalProps = {
  visible: boolean;
  payload: ConfirmDeleteModalPayload;
  onClose: () => void;
};

export function ConfirmDeleteModal({
  visible,
  payload,
  onClose
}: ConfirmDeleteModalProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const onConfirmPress = async () => {
    setBusy(true);
    try {
      await Promise.resolve(payload.onConfirm());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={32} color={mobileColors.error} />
          </View>
          <Text style={styles.title}>
            {payload.title ?? t("modals.confirmDelete.title")}
          </Text>
          <Text style={styles.message}>{payload.message}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.btn, styles.btnOutline]}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
            >
              <Text style={styles.btnOutlineTx}>
                {payload.cancelLabel ?? t("modals.confirmDelete.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnDanger]}
              onPress={() => void onConfirmPress()}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnDangerTx}>
                  {payload.confirmLabel ?? t("modals.confirmDelete.confirm")}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: mobileSpacing.lg
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    padding: mobileSpacing.xl,
    alignItems: "center"
  },
  iconWrap: {
    marginBottom: mobileSpacing.md
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginBottom: mobileSpacing.xl
  },
  row: {
    flexDirection: "row",
    gap: mobileSpacing.md,
    width: "100%"
  },
  btn: {
    flex: 1,
    paddingVertical: mobileSpacing.md,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    backgroundColor: mobileColors.background
  },
  btnOutlineTx: {
    fontWeight: "700",
    color: mobileColors.textPrimary
  },
  btnDanger: {
    backgroundColor: mobileColors.error
  },
  btnDangerTx: {
    color: "#FFFFFF",
    fontWeight: "800"
  }
});
