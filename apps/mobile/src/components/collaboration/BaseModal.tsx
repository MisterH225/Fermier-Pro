import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";
import {
  BaseModal as DesignBaseModal,
  type BaseModalProps as DesignBaseModalProps
} from "../modals/BaseModal";

export type BaseModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  dangerLabel?: string;
  onDanger?: () => void;
};

/** Adaptateur collaboration → design system `modals/BaseModal`. */
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
  const footerPrimary =
    confirmLabel && onConfirm ? (
      <Pressable
        onPress={onConfirm}
        disabled={confirmDisabled || confirmLoading}
        style={[
          styles.primaryBtn,
          (confirmDisabled || confirmLoading) && styles.primaryDisabled
        ]}
        accessibilityRole="button"
      >
        {confirmLoading ? (
          <ActivityIndicator color={mobileColors.onAccent} />
        ) : (
          <Text style={styles.primaryTxt}>{confirmLabel}</Text>
        )}
      </Pressable>
    ) : undefined;

  const destructiveAction =
    dangerLabel && onDanger
      ? { label: dangerLabel, onPress: onDanger }
      : undefined;

  const sheetProps: DesignBaseModalProps = {
    visible,
    onClose,
    title,
    children,
    footerPrimary,
    destructiveAction,
    sheetMaxHeight: "92%"
  };

  return <DesignBaseModal {...sheetProps} />;
}

const styles = StyleSheet.create({
  primaryBtn: {
    backgroundColor: mobileColors.accent,
    borderRadius: mobileRadius.pill,
    paddingVertical: mobileSpacing.md,
    alignItems: "center"
  },
  primaryDisabled: { opacity: 0.45 },
  primaryTxt: {
    ...mobileTypography.body,
    color: mobileColors.onAccent,
    fontWeight: "700"
  }
});
