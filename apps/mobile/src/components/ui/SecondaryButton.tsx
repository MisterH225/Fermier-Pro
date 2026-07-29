import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useRolePalette } from "../../hooks/useRolePalette";
import { mobileColors, mobileRadius, mobileSpacing, mobileFontSize } from "../../theme/mobileTheme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style
}: Props) {
  const palette = useRolePalette();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: palette.primary,
          backgroundColor: pressed && !disabled && !loading
            ? palette.primaryLight
            : mobileColors.background
        },
        (loading || disabled) && styles.btnDisabled,
        style
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={palette.primary} />
      ) : (
        <Text style={[styles.label, { color: palette.primary }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: mobileRadius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.xl
  },
  btnDisabled: { opacity: 0.55 },
  label: {
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  }
});
