import { StyleSheet, View } from "react-native";
import { mobileColors } from "../../theme/mobileTheme";

/** Point discret pour signaler des insights IA disponibles (navigation). */
export function InsightBadge({ visible }: { visible?: boolean }) {
  if (!visible) {
    return null;
  }
  return <View style={styles.dot} accessibilityElementsHidden />;
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: mobileColors.background
  }
});
