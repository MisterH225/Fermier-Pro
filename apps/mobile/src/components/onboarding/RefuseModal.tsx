import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BaseModal } from "../modals/BaseModal";
import { ModalSection } from "../modals/ModalSection";
import { authColors, authRadii } from "../../theme/authTheme";

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
  icon: { fontSize: 40 },
  message: {
    fontSize: 15,
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
    fontSize: 16,
    fontWeight: "700",
    color: authColors.forest
  }
});
