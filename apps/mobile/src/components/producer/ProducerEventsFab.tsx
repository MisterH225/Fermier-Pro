import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProducerFabBottomLift } from "../../context/ProducerFabBottomLiftContext";
import { mobileColors, mobileRadius, mobileShadows, mobileSpacing } from "../../theme/mobileTheme";

type ProducerEventsFabProps = {
  onPress: () => void;
};

/**
 * Accès rapide au fil d’événements terrain (hors barre d’onglets).
 */
export function ProducerEventsFab({ onPress }: ProducerEventsFabProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarLift = useProducerFabBottomLift();
  const marginBottom =
    tabBarLift > 0
      ? tabBarLift + mobileSpacing.sm
      : Math.max(insets.bottom, mobileSpacing.sm);
  return (
    <View
      style={[
        styles.wrap,
        {
          marginBottom,
          marginRight: Math.max(insets.right, mobileSpacing.md)
        }
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("shell.eventsFab.a11y")}
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.emoji}>📅</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    pointerEvents: "box-none"
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: mobileRadius.pill,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...mobileShadows.card
  },
  fabPressed: {
    opacity: 0.88
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30
  }
});
