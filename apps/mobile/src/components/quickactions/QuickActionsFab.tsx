import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileColors, mobileShadows } from "../../theme/mobileTheme";
import {
  PRODUCER_QUICK_FAB_SIZE,
  producerQuickFabBottomOffset
} from "./producerQuickActions";

type Props = {
  onPress: () => void;
  /** Override pour tests (mock insets). */
  insetBottom?: number;
};

/**
 * Bouton flottant d’actions rapides producteur.
 * Positionné au-dessus de la MainTabBar via chrome mesuré + safe area.
 */
export function QuickActionsFab({ onPress, insetBottom }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = producerQuickFabBottomOffset(
    insetBottom ?? insets.bottom
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("quickActions.fabA11y")}
      testID="producer-quick-actions-fab"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom,
          opacity: pressed ? 0.9 : 1
        }
      ]}
    >
      <Ionicons name="flash" size={26} color={mobileColors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: PRODUCER_QUICK_FAB_SIZE,
    height: PRODUCER_QUICK_FAB_SIZE,
    borderRadius: PRODUCER_QUICK_FAB_SIZE / 2,
    backgroundColor: mobileColors.accent,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    ...mobileShadows.card,
    elevation: 6
  }
});
