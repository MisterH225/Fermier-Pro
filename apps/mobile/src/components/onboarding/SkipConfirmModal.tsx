import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinueSetup: () => void;
  onSkipAnyway: () => void;
};

export function SkipConfirmModal({
  visible,
  onClose,
  onContinueSetup,
  onSkipAnyway
}: Props) {
  const { t } = useTranslation();
  return (
    <BaseModal visible={visible} onClose={onClose} title={t("onboarding.skipModal.title")}>
      <View style={styles.body}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.message}>{t("onboarding.skipModal.message")}</Text>
        <Pressable style={styles.primary} onPress={onContinueSetup}>
          <Text style={styles.primaryText}>{t("onboarding.skipModal.continue")}</Text>
        </Pressable>
        <Pressable style={styles.outline} onPress={onSkipAnyway}>
          <Text style={styles.outlineText}>{t("onboarding.skipModal.skipAnyway")}</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.md },
  icon: { fontSize: 32, textAlign: "center" },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    lineHeight: 22
  },
  primary: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: mobileSpacing.sm
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  outline: {
    borderWidth: 1,
    borderColor: mobileColors.border,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineText: {
    color: mobileColors.textPrimary,
    fontWeight: "600"
  }
});
