import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { mobileSpacing } from "../../theme/mobileTheme";

type TabContentProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Conteneur de contenu pour un onglet (padding horizontal standard). */
export function TabContent({ children, style }: TabContentProps) {
  return <View style={[styles.wrap, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    paddingBottom: mobileSpacing.xxl * 2,
    gap: mobileSpacing.md
  }
});
