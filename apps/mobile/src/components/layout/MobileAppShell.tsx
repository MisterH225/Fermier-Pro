import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { mobileColors } from "../../theme/mobileTheme";
import { TopBar } from "./TopBar";

type MobileAppShellProps = {
  title?: string;
  /** Masque la TopBar interne quand le titre est déjà dans l'en-tête stack (`useScreenTitle`). */
  hideTopBar?: boolean;
  /** Si défini, remplace la barre titre standard (ex. accueil producteur). */
  customHeader?: ReactNode;
  /**
   * N’applique pas le safe area bas : le contenu s’étend sous la barre flottante producteur.
   */
  omitBottomTabBar?: boolean;
  /** Action flottante (hors barre), au-dessus du contenu. */
  floatingAction?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
};

export function MobileAppShell({
  title = "",
  hideTopBar = false,
  customHeader,
  omitBottomTabBar,
  floatingAction,
  topRight,
  children
}: MobileAppShellProps) {
  const safeEdges: readonly Edge[] = omitBottomTabBar
    ? ["top"]
    : ["top", "bottom"];
  const showTopBar = !hideTopBar && (customHeader != null || title.length > 0);
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      {showTopBar ? (customHeader ?? <TopBar title={title} rightSlot={topRight} />) : null}
      <View style={styles.content}>
        {children}
        {floatingAction ? (
          <View style={styles.floatingLayer} pointerEvents="box-none">
            {floatingAction}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: mobileColors.canvas
  },
  content: {
    flex: 1,
    backgroundColor: mobileColors.canvas,
    position: "relative"
  },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    pointerEvents: "box-none"
  }
});
