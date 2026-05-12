import type { ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  mobileColors,
  mobileRadius,
  mobileShadows,
  mobileSpacing
} from "../../theme/mobileTheme";

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
};

export function Card({ children, onPress, padded = true }: CardProps) {
  if (!onPress) {
    return <View style={[styles.card, padded && styles.padded]}>{children}</View>;
  }
  return (
    <TouchableOpacity
      style={[styles.card, padded && styles.padded]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mobileColors.background,
    borderRadius: mobileRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: mobileColors.border,
    ...mobileShadows.card
  },
  padded: {
    padding: mobileSpacing.lg
  }
});
