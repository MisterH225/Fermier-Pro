import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing
} from "../../../theme/mobileTheme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

function ActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  secondary
}: Props & { secondary?: boolean }) {
  const unavailable = loading || disabled;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        unavailable && styles.disabled,
        pressed && !unavailable && styles.pressed,
        style
      ]}
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={secondary ? mobileColors.accent : mobileColors.onAccent}
        />
      ) : (
        <Text
          style={[
            styles.label,
            secondary ? styles.secondaryLabel : styles.primaryLabel
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function PrimaryButton(props: Props) {
  return <ActionButton {...props} />;
}

export function SecondaryButton(props: Props) {
  return <ActionButton {...props} secondary />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: mobileRadius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: mobileSpacing.lg,
    borderWidth: 1.5
  },
  primary: {
    backgroundColor: mobileColors.accent,
    borderColor: mobileColors.accent
  },
  secondary: {
    backgroundColor: mobileColors.background,
    borderColor: mobileColors.accent
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
  label: { fontSize: 15, fontWeight: "800", textAlign: "center" },
  primaryLabel: { color: mobileColors.onAccent },
  secondaryLabel: { color: mobileColors.accent }
});
