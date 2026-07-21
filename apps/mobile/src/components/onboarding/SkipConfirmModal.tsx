import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinueSetup: () => void;
  onSkipAnyway: () => void;
  titleKey?: string;
  messageKey?: string;
  continueKey?: string;
  skipAnywayKey?: string;
};

export function SkipConfirmModal({
  visible,
  onClose,
  onContinueSetup,
  onSkipAnyway,
  titleKey = "onboarding.skipModal.title",
  messageKey = "onboarding.skipModal.message",
  continueKey = "onboarding.skipModal.continue",
  skipAnywayKey = "onboarding.skipModal.skipAnyway"
}: Props) {
  const { t } = useTranslation();
  return (
    <BaseModal visible={visible} onClose={onClose} title={t(titleKey)}>
      <View style={styles.body}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={styles.message}>{t(messageKey)}</Text>
        <Pressable style={styles.primary} onPress={onContinueSetup}>
          <Text style={styles.primaryText}>{t(continueKey)}</Text>
        </Pressable>
        <Pressable style={styles.outline} onPress={onSkipAnyway}>
          <Text style={styles.outlineText}>{t(skipAnywayKey)}</Text>
        </Pressable>
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { gap: mobileSpacing.md, paddingBottom: mobileSpacing.md },
  icon: { fontSize: mobileFontSize.xxl, textAlign: "center" },
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
  primaryText: { color: mobileColors.onAccent, fontWeight: "700", fontSize: mobileFontSize.lg },
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
