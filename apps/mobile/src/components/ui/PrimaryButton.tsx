import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { mobileColors, mobileRadius, mobileSpacing } from "../../theme/mobileTheme";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false
}: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, (loading || disabled) && styles.btnDisabled]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={mobileColors.background} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.xl
  },
  btnDisabled: {
    opacity: 0.55
  },
  label: {
    color: mobileColors.background,
    fontSize: 16,
    fontWeight: "700"
  }
});
