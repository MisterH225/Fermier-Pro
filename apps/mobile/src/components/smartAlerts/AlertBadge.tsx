import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileRadius, mobileTypography } from "../../theme/mobileTheme";

type AlertBadgeProps = {
  count: number;
  max?: number;
};

export function AlertBadge({ count, max = 99 }: AlertBadgeProps) {
  if (count <= 0) {
    return null;
  }
  const label = count > max ? `${max}+` : String(count);
  return (
    <View style={styles.badge} accessibilityLabel={`${count} alertes critiques`}>
      <Text style={styles.tx}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.error,
    alignItems: "center",
    justifyContent: "center"
  },
  tx: {
    ...mobileTypography.meta,
    fontSize: 10,
    fontWeight: "800",
    color: "#fff"
  }
});
