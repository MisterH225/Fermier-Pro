import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle
} from "react-native";
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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        (loading || disabled) && styles.btnDisabled,
        pressed && !disabled && !loading && styles.btnPressed,
        style
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={mobileColors.accent} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 48,
    borderRadius: mobileRadius.pill,
    borderWidth: 1.5,
    borderColor: mobileColors.accent,
    backgroundColor: mobileColors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.xl
  },
  btnPressed: { opacity: 0.9, backgroundColor: mobileColors.accentSoft },
  btnDisabled: { opacity: 0.55 },
  label: {
    color: mobileColors.accent,
    fontSize: mobileFontSize.lg,
    fontWeight: "700"
  }
});
