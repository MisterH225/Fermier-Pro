import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRolePalette } from "../../hooks/useRolePalette";
import { mobileRadius, mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";

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
  const palette = useRolePalette();
  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: palette.primary },
        (loading || disabled) && styles.btnDisabled
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator color={palette.onPrimary} />
      ) : (
        <Text style={[styles.label, { color: palette.onPrimary }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.xl
  },
  btnDisabled: {
    opacity: 0.55
  },
  label: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  }
});
