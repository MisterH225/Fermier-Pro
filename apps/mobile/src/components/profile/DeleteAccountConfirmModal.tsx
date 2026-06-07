import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

const CONFIRM_WORD = "SUPPRIMER";

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteAccountConfirmModal({
  visible,
  onClose,
  onConfirm
}: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const canConfirm = useMemo(
    () => text.trim() === CONFIRM_WORD,
    [text]
  );

  const handleClose = () => {
    setText("");
    onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm) {
      return;
    }
    setText("");
    onConfirm();
  };

  return (
    <BaseModal
      visible={visible}
      onClose={handleClose}
      title={t("account.deleteAccount.confirmTitle")}
      footerPrimary={
        <Pressable
          style={[styles.deleteBtn, !canConfirm && styles.deleteBtnOff]}
          onPress={handleConfirm}
          disabled={!canConfirm}
          accessibilityRole="button"
        >
          <Text style={styles.deleteTx}>
            {t("account.deleteAccount.confirmAction")}
          </Text>
        </Pressable>
      }
      secondaryActions={[
        {
          key: "cancel",
          icon: "close-outline",
          label: t("account.deleteAccount.cancel"),
          onPress: handleClose
        }
      ]}
    >
      <ModalSection>
        <Text style={styles.icon}>🔴</Text>
        <Text style={styles.message}>{t("account.deleteAccount.confirmMessage")}</Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={t("account.deleteAccount.confirmPlaceholder")}
          placeholderTextColor={mobileColors.textSecondary}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 36,
    textAlign: "center",
    marginBottom: mobileSpacing.md
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    marginBottom: mobileSpacing.md
  },
  input: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.md,
    padding: 12,
    fontSize: 16,
    color: mobileColors.textPrimary,
    backgroundColor: mobileColors.background,
    marginBottom: mobileSpacing.sm
  },
  deleteBtn: {
    backgroundColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  deleteBtnOff: {
    opacity: 0.45
  },
  deleteTx: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff"
  }
});
