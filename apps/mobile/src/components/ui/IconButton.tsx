import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity } from "react-native";
import { mobileColors, mobileRadius } from "../../theme/mobileTheme";

type IconName = "add" | "person-circle-outline" | "ellipsis-horizontal" | "search";

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
};

export function IconButton({ icon, onPress }: IconButtonProps) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.9}>
      <Ionicons name={icon} size={20} color={mobileColors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: mobileRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: mobileColors.surface
  }
});
