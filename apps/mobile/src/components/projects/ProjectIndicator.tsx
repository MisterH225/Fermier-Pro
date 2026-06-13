import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useActiveProject } from "../../context/ActiveProjectContext";
import {
  mobileColors,
  mobileRadius,
  mobileSpacing,
  mobileTypography
} from "../../theme/mobileTheme";

type ProjectIndicatorProps = {
  onPress: () => void;
};

export function ProjectIndicator({ onPress }: ProjectIndicatorProps) {
  const { activeFarm, farms } = useActiveProject();
  const totalFarms = farms.filter((f) => f.status === "active").length;

  if (totalFarms < 2 || !activeFarm) {
    return null;
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      <View style={styles.pill}>
        <Text style={styles.name} numberOfLines={1}>
          {activeFarm.name}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={mobileColors.textSecondary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: mobileSpacing.sm
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    backgroundColor: mobileColors.canvas,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: mobileRadius.pill,
    borderWidth: 1,
    borderColor: mobileColors.border
  },
  name: {
    ...mobileTypography.meta,
    color: mobileColors.textPrimary,
    fontWeight: "500",
    maxWidth: 200
  }
});
