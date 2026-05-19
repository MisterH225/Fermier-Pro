import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useProducerBottomChromePad } from "../../context/ProducerBottomChromeContext";
import { mobileSpacing } from "../../theme/mobileTheme";

type TabContentProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Conteneur de contenu pour un onglet (padding horizontal standard). */
const BASE_BOTTOM_PAD = mobileSpacing.xxl * 2;

export function TabContent({ children, style }: TabContentProps) {
  const bottomChromePad = useProducerBottomChromePad();
  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: BASE_BOTTOM_PAD + bottomChromePad },
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: mobileSpacing.lg,
    paddingTop: mobileSpacing.md,
    gap: mobileSpacing.md
  }
});
