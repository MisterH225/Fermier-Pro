import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { mobileSpacing } from "../../theme/mobileTheme";
import type { RolePalette } from "./rolePalette";

type Props = {
  children: ReactNode;
  palette: RolePalette;
  onPress?: () => void;
  /** Défaut true. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Carte surface générique paramétrée par RolePalette.
 * Remplace les `card: { backgroundColor, borderRadius, border… }` locaux répétés.
 */
export function SurfaceCard({
  children,
  palette,
  onPress,
  padded = true,
  style,
  testID
}: Props) {
  const base = [
    styles.card,
    {
      backgroundColor: palette.cardBg,
      borderRadius: palette.radiusCard,
      borderColor: palette.border
    },
    palette.shadowCard,
    padded && styles.padded,
    style
  ];

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [...base, pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={base}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: mobileSpacing.md
  },
  padded: {
    padding: mobileSpacing.lg
  }
});
