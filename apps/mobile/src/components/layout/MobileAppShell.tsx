import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  topRight?: ReactNode;
  children: ReactNode;
};

export function MobileAppShell({
  title = "",
  customHeader,
  activeTab,
  onTabChange,
  tabBarTabs,
  topRight,
  children
}: MobileAppShellProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {customHeader ?? <TopBar title={title} rightSlot={topRight} />}
      <View style={styles.content}>{children}</View>
      {activeTab && onTabChange ? (
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
    backgroundColor: mobileColors.surface
  }
});
