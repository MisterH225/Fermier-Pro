import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAdminMessagesInbox } from "../../hooks/useAdminMessagesInbox";
import { mobileColors, mobileSpacing, mobileTypography, mobileFontSize } from "../../theme/mobileTheme";
import { AdminMessageCard } from "./AdminMessageCard";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AdminMessagesModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { items, isLoading, markRead } = useAdminMessagesInbox(visible);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.topBar}>
          <Text style={styles.title}>
            {t("adminMessages.title")}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={t("producer.close")}
            style={styles.closeBtn}
          >
            <Text style={styles.closeTx}>{t("producer.close")}</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={mobileColors.accent} />
          ) : items.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons
                name="mail-open-outline"
                size={36}
                color={mobileColors.textSecondary}
              />
              <Text style={styles.emptyTx}>
                {t("adminMessages.empty")}
              </Text>
            </View>
          ) : (
            items.map((m) => (
              <AdminMessageCard
                key={m.id}
                msg={m}
                onMarkRead={(id) => void markRead(id)}
                adminTag={t("smartAlerts.adminTag")}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: mobileColors.canvas },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.title,
    fontSize: mobileFontSize.xl,
    color: mobileColors.textPrimary,
    flex: 1
  },
  closeBtn: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  closeTx: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "600"
  },
  scroll: {
    padding: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl,
    gap: mobileSpacing.md
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: mobileSpacing.xxl,
    gap: mobileSpacing.sm
  },
  emptyTx: { color: mobileColors.textSecondary }
});
