import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import type { UpgradeLimitModalPayload } from "../../context/ModalContext";
import { upgradeLimitCopy } from "../../lib/subscriptionLimitsUi";
import { mobileColors, mobileRadius, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";
import { producerColors } from "../../theme/producerTheme";

type Props = {
  visible: boolean;
  payload: UpgradeLimitModalPayload;
  onClose: () => void;
};

export function UpgradeLimitModal({ visible, payload, onClose }: Props) {
  const { t } = useTranslation();
  const { title, body } = upgradeLimitCopy(t, payload.code, payload.limit);

  const onUpgrade = () => {
    onClose();
    payload.onUpgrade();
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
        <Pressable
          style={styles.card}
          onPress={(e) => e.stopPropagation()}
          testID="upgrade-limit-modal"
        >
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={28} color={producerColors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{body}</Text>
          <Pressable
            style={styles.primary}
            onPress={onUpgrade}
            accessibilityRole="button"
            testID="upgrade-limit-premium"
          >
            <Text style={styles.primaryTx}>
              {t("subscriptionLimits.upgrade.upgradeCta")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={onClose}
            accessibilityRole="button"
            testID="upgrade-limit-later"
          >
            <Text style={styles.secondaryTx}>
              {t("subscriptionLimits.upgrade.laterCta")}
            </Text>
          </Pressable>
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
    paddingHorizontal: mobileSpacing.lg
  },
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.xl,
    padding: mobileSpacing.lg,
    gap: mobileSpacing.sm
  },
  iconWrap: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: producerColors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: mobileSpacing.xs
  },
  title: {
    ...mobileTypography.title,
    color: mobileColors.textPrimary,
    textAlign: "center"
  },
  message: {
    ...mobileTypography.body,
    color: mobileColors.textSecondary,
    textAlign: "center",
    marginBottom: mobileSpacing.sm
  },
  primary: {
    backgroundColor: producerColors.primary,
    borderRadius: mobileRadius.lg,
    paddingVertical: 14,
    alignItems: "center"
  },
  primaryTx: {
    color: mobileColors.onAccent,
    fontWeight: "700"
  },
  secondary: {
    paddingVertical: 12,
    alignItems: "center"
  },
  secondaryTx: {
    ...mobileTypography.meta,
    color: mobileColors.textSecondary
  }
});
