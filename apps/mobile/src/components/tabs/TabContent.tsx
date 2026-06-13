import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useBottomInset } from "../../hooks/useBottomInset";
import { mobileSpacing } from "../../theme/mobileTheme";

type TabContentProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Conteneur de contenu pour un onglet (padding horizontal standard). */
export function TabContent({ children, style }: TabContentProps) {
  const bottomInset = useBottomInset();
  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: bottomInset },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: mobileSpacing.md,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.lg
  }
});
