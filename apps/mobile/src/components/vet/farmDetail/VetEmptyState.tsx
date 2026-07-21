import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  vetColors,
  vetRadius,
  vetType
} from "../../../theme/vetTheme";
import { mobileSpacing } from "../../../theme/mobileTheme";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
  icon: IconName;
  message: string;
};

/** État vide soigné — illustration légère + libellé, jamais un 0 trompeur. */
export function VetEmptyState({ icon, message }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <View style={styles.illo}>
        <Ionicons name={icon} size={28} color={vetColors.primarySoft} />
      </View>
      <Text style={styles.tx}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: mobileSpacing.sm,
    paddingVertical: mobileSpacing.xl,
    paddingHorizontal: mobileSpacing.lg,
    backgroundColor: vetColors.primaryLight,
    borderRadius: vetRadius.card
  },
  illo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: vetColors.cardBg,
    alignItems: "center",
    justifyContent: "center"
  },
  tx: { ...vetType.label, textAlign: "center", maxWidth: 260 }
});
