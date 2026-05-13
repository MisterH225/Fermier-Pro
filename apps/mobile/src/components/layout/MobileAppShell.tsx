import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { mobileColors } from "../../theme/mobileTheme";
import { BottomTabBar, type AppTab } from "./BottomTabBar";
import { TopBar } from "./TopBar";

type MobileAppShellProps = {
  title?: string;
  /** Si défini, remplace la barre titre standard (ex. accueil producteur). */
  customHeader?: ReactNode;
  activeTab?: AppTab;
  onTabChange?: (tab: AppTab) => void;
  /** Onglets affichés (défaut : les 4). Ex. producteur sans « Profil ». */
  tabBarTabs?: AppTab[];
  /** Masque la barre d’onglets du shell (barre globale producteur à la place). */
  omitBottomTabBar?: boolean;
  /** Action flottante (ex. FAB événements), au-dessus du contenu, hors barre d’onglets. */
  floatingAction?: ReactNode;
  topRight?: ReactNode;
  children: ReactNode;
};

export function MobileAppShell({
  title = "",
  customHeader,
  activeTab,
  onTabChange,
  tabBarTabs,
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
      {activeTab && onTabChange && !omitBottomTabBar ? (
        <BottomTabBar
          activeTab={activeTab}
          onChange={onTabChange}
          tabs={tabBarTabs}
        />
      ) : null}
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
