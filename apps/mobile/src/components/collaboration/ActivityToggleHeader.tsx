import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  mobileColors,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type Props = {
  expanded: boolean;
  onToggle: () => void;
  title: string;
};

export function ActivityToggleHeader({ expanded, onToggle, title }: Props) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.header}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <Text style={styles.title}>{title}</Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={18}
        color={mobileColors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: mobileSpacing.sm
  },
  title: {
    ...mobileTypography.cardTitle,
    color: mobileColors.textPrimary
  }
});
