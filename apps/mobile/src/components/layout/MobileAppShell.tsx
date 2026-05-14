import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { mobileColors } from "../../theme/mobileTheme";
import { TopBar } from "./TopBar";

type MobileAppShellProps = {
  title?: string;
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
  customHeader,
  omitBottomTabBar,
  floatingAction,
  topRight,
  children
}: MobileAppShellProps) {
  const safeEdges: readonly Edge[] = omitBottomTabBar
    ? ["top"]
    : ["top", "bottom"];
  return (
    <SafeAreaView style={styles.safe} edges={safeEdges}>
      {customHeader ?? <TopBar title={title} rightSlot={topRight} />}
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
    backgroundColor: mobileColors.background
  },
  content: {
    flex: 1,
    backgroundColor: mobileColors.surface,
    position: "relative"
  },
  floatingLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    pointerEvents: "box-none"
  }
});
