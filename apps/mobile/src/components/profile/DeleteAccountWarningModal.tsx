import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onContinue: () => void;
};

const CONSEQUENCE_KEYS = [
  "account.deleteAccount.consequences.farm",
  "account.deleteAccount.consequences.animals",
  "account.deleteAccount.consequences.finance",
  "account.deleteAccount.consequences.reports",
  "account.deleteAccount.consequences.collaborators",
  "account.deleteAccount.consequences.health"
] as const;

export function DeleteAccountWarningModal({
  visible,
  onClose,
  onContinue
}: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("account.deleteAccount.warningTitle")}
      footerPrimary={
        <View style={styles.footerCol}>
          <Pressable
            style={styles.primaryBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.primaryTx}>
              {t("account.deleteAccount.cancel")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.outlineBtn}
            onPress={onContinue}
            accessibilityRole="button"
          >
            <Text style={styles.outlineTx}>
              {t("account.deleteAccount.continueDelete")}
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{t("account.deleteAccount.warningMessage")}</Text>
      <View style={styles.list}>
        {CONSEQUENCE_KEYS.map((key) => (
          <Text key={key} style={styles.listItem}>
            {t(key)}
          </Text>
        ))}
      </View>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 40,
    textAlign: "center",
    marginBottom: mobileSpacing.md
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textPrimary,
    lineHeight: 22,
    marginBottom: mobileSpacing.md
  },
  list: {
    gap: 6,
    marginBottom: mobileSpacing.sm
  },
  listItem: {
    fontSize: 14,
    color: mobileColors.textSecondary,
    lineHeight: 20
  },
  footerCol: {
    gap: 10
  },
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff"
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: mobileColors.error,
    borderRadius: mobileRadius.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  outlineTx: {
    fontSize: 15,
    fontWeight: "600",
    color: mobileColors.error
  }
});
