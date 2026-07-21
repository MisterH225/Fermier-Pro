import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { authColors, authRadii } from "../../theme/authTheme";
import { mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onReread: () => void;
  onQuit: () => void;
};

export function RefuseModal({ visible, onClose, onReread, onQuit }: Props) {
  const { t } = useTranslation();

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title={t("cgu.refuseModal.title")}
      footerPrimary={
        <Pressable style={styles.primaryBtn} onPress={onReread}>
          <Text style={styles.primaryLabel}>{t("cgu.refuseModal.reread")}</Text>
        </Pressable>
      }
      destructiveAction={{
        label: t("cgu.refuseModal.quit"),
        onPress: onQuit
      }}
    >
      <ModalSection>
        <View style={styles.body}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.message}>{t("cgu.refuseModal.message")}</Text>
        </View>
      </ModalSection>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", paddingVertical: 8, gap: 12 },
  icon: { fontSize: mobileFontSize.xxl },
  message: {
    fontSize: mobileFontSize.md,
    lineHeight: 22,
    color: authColors.body,
    textAlign: "center"
  },
  primaryBtn: {
    backgroundColor: authColors.lime,
    borderRadius: authRadii.pill,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryLabel: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700",
    color: authColors.forest
  }
});
