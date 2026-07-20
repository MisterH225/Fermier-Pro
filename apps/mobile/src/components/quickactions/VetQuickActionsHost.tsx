import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import type { RootStackParamList } from "../../types/navigation";
import { VetQuickActionsFab } from "./VetQuickActionsFab";
import { VetQuickActionsSheet } from "./VetQuickActionsSheet";
import {
  isVetQuickActionRootRoute,
  type VetQuickActionId
} from "./vetQuickActions";

type Props = {
  visible: boolean;
  focusedRouteName: string | undefined;
};

/**
 * FAB + feuille d’actions rapides vétérinaire (écrans racine uniquement).
 */
export function VetQuickActionsHost({ visible, focusedRouteName }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sheetOpen, setSheetOpen] = useState(false);

  const showFab = visible && isVetQuickActionRootRoute(focusedRouteName);

  useEffect(() => {
    if (!showFab) {
      setSheetOpen(false);
    }
  }, [showFab]);

  const onAction = useCallback(
    (id: VetQuickActionId) => {
      switch (id) {
        case "farms":
          navigation.navigate("VetFarms");
          return;
        case "schedule":
          navigation.navigate("VetAgenda");
          return;
        case "case":
          navigation.navigate("VetFarms");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  if (!showFab) {
    return null;
  }

  return (
    <>
      <VetQuickActionsFab onPress={() => setSheetOpen(true)} />
      <VetQuickActionsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSelect={onAction}
      />
    </>
  );
}
