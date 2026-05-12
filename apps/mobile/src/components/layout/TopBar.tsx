import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mobileColors, mobileSpacing, mobileTypography } from "../../theme/mobileTheme";

type TopBarProps = {
  title: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export function TopBar({ title, leftSlot, rightSlot }: TopBarProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.side}>{leftSlot}</View>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: mobileColors.border,
    backgroundColor: mobileColors.background,
    paddingHorizontal: mobileSpacing.lg
  },
  side: {
    width: 48,
    alignItems: "flex-start"
  },
  sideRight: {
    alignItems: "flex-end"
  },
  title: {
    flex: 1,
    textAlign: "center",
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  }
});
