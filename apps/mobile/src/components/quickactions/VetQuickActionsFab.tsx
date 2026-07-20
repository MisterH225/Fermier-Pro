import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileShadows } from "../../theme/mobileTheme";
import { vetColors } from "../../theme/vetTheme";
import {
  VET_QUICK_FAB_SIZE,
  vetQuickFabBottomOffset
} from "./vetQuickActions";

type Props = {
  onPress: () => void;
  /** Override pour tests (mock insets). */
  insetBottom?: number;
};

/**
 * Bouton flottant d’actions rapides vétérinaire.
 * Positionné au-dessus de la VetTabBar via chrome mesuré + safe area.
 */
export function VetQuickActionsFab({ onPress, insetBottom }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottom = vetQuickFabBottomOffset(insetBottom ?? insets.bottom);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("vet.quickActions.fabA11y")}
      testID="vet-quick-actions-fab"
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          bottom,
          opacity: pressed ? 0.9 : 1
        }
      ]}
    >
      <Ionicons name="flash" size={26} color={vetColors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: VET_QUICK_FAB_SIZE,
    height: VET_QUICK_FAB_SIZE,
    borderRadius: VET_QUICK_FAB_SIZE / 2,
    backgroundColor: vetColors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    ...mobileShadows.card,
    elevation: 6
  }
});
