import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

export type BaseModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Contenu scrollable */
  children: React.ReactNode;
  /** Bouton confirmation (optionnel) */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  /** Bouton destructif rouge (optionnel) */
  dangerLabel?: string;
  onDanger?: () => void;
};

export function BaseModal({
  visible,
  title,
  onClose,
  children,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  confirmLoading,
  dangerLabel,
  onDanger
}: BaseModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={14}
            style={styles.closeBtn}
            accessibilityRole="button"
          >
            <Ionicons
              name="close"
              size={24}
              color={mobileColors.textSecondary}
            />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {confirmLabel && onConfirm ? (
            <Pressable
              onPress={onConfirm}
              disabled={confirmDisabled || confirmLoading}
              hitSlop={14}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.confirmTxt,
                  (confirmDisabled || confirmLoading) && styles.confirmDisabled
                ]}
              >
                {confirmLoading ? "…" : confirmLabel}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {children}

          {dangerLabel && onDanger ? (
            <Pressable
              onPress={onDanger}
              style={styles.dangerBtn}
              accessibilityRole="button"
            >
              <Text style={styles.dangerTxt}>{dangerLabel}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.background
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: mobileSpacing.lg,
    paddingVertical: mobileSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border
  },
  closeBtn: {
    padding: 4
  },
  title: {
    flex: 1,
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary,
    textAlign: "center",
    marginHorizontal: mobileSpacing.sm
  },
  headerSpacer: {
    width: 32
  },
  confirmTxt: {
    ...mobileTypography.body,
    color: mobileColors.accent,
    fontWeight: "700"
  },
  confirmDisabled: {
    opacity: 0.4
  },
  scroll: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.lg,
    paddingBottom: mobileSpacing.xxl
  },
  dangerBtn: {
    marginTop: mobileSpacing.xl,
    paddingVertical: mobileSpacing.md,
    alignItems: "center",
    borderRadius: mobileRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.error
  },
  dangerTxt: {
    ...mobileTypography.body,
    color: mobileColors.error,
    fontWeight: "600"
  }
});
