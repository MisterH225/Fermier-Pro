import { useLayoutEffect } from "react";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";

export type ScreenTitleOptions = {
  headerRight?: () => React.ReactNode;
  headerShown?: boolean;
};

/**
 * Affiche le titre une seule fois dans l'en-tête de navigation natif.
 * Ne pas répéter ce titre dans le contenu — utiliser `TabScreenHeader` pour le reste.
 */
export function useScreenTitle(
  navigation: NavigationProp<ParamListBase>,
  title: string,
  options?: ScreenTitleOptions
) {
  const headerRight = options?.headerRight;
  const headerShown = options?.headerShown ?? true;

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerShown,
      headerBackTitle: "",
      ...(headerRight !== undefined ? { headerRight } : {})
    });
  }, [navigation, title, headerRight, headerShown]);
}
