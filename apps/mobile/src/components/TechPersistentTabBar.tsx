import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExtendedMenuGrid } from "./navigation/ExtendedMenuGrid";
import { TechTabBar } from "./navigation/technician/TechTabBar";
import { techMainTabFromRoute } from "./navigation/technician/techMainTabs";
import { TECH_NAV_FLOAT_BOTTOM } from "./navigation/technician/techNavMetrics";
import type { ExtendedNavMenuId } from "./navigation/types";
import type { TechMainTab } from "./navigation/technician/types";
import { useSession } from "../context/SessionContext";
import { mobileSpacing } from "../theme/mobileTheme";
import type { RootStackParamList } from "../types/navigation";

function getFocusedRoute(
  state: NavigationState | undefined
): { name: string; params?: Record<string, unknown> } | undefined {
  if (!state || typeof state.index !== "number") {
    return undefined;
  }
  let route = state.routes[state.index] as {
    name: string;
    params?: Record<string, unknown>;
    state?: NavigationState;
  };
  while (route?.state && typeof route.state.index === "number") {
    const inner = route.state.routes[route.state.index] as typeof route;
    route = inner;
  }
  return route
    ? { name: route.name, params: route.params as Record<string, unknown> | undefined }
    : undefined;
}

export function TechPersistentTabBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, activeProfileId } = useSession();
  const [extendedOpen, setExtendedOpen] = useState(false);

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isTechnician = profileType === "technician";

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(
    () => techMainTabFromRoute(focused?.name),
    [focused?.name]
  );

  const onTabPress = useCallback(
    (tab: TechMainTab) => {
      switch (tab) {
        case "home":
          navigation.navigate("TechnicianDashboard");
          return;
        case "tasks":
          navigation.navigate("TechTasks");
          return;
        case "farm":
          navigation.navigate("TechFarm");
          return;
        case "tracking":
          navigation.navigate("TechTracking");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  const extendedItems = useMemo(
    (): { id: ExtendedNavMenuId; label: string; a11y: string }[] => [
      {
        id: "communityFeed",
        label: t("navigation.main.feed"),
        a11y: t("navigation.main.feed")
      },
      { id: "vaccinations", label: t("tech.extended.vaccinations"), a11y: t("tech.extended.vaccinations") },
      { id: "weighings", label: t("tech.extended.weighings"), a11y: t("tech.extended.weighings") },
      { id: "feedStock", label: t("tech.extended.feedStock"), a11y: t("tech.extended.feedStock") },
      { id: "reports", label: t("tech.extended.reports"), a11y: t("tech.extended.reports") },
      {
        id: "wallet",
        label: t("navigation.extended.wallet"),
        a11y: t("navigation.extended.walletDescription")
      }
    ],
    [t]
  );

  const onExtendedSelect = useCallback(
    (id: ExtendedNavMenuId) => {
      setExtendedOpen(false);
      const farmId =
        typeof focused?.params?.farmId === "string" ? focused.params.farmId : undefined;
      const farmName =
        typeof focused?.params?.farmName === "string" ? focused.params.farmName : "—";
      switch (id) {
        case "communityFeed":
          navigation.navigate("CommunityFeed");
          return;
        case "vaccinations":
        case "weighings":
          if (farmId) {
            navigation.navigate("FarmHealth", { farmId, farmName });
          } else {
            navigation.navigate("TechFarm");
          }
          return;
        case "feedStock":
          if (farmId) {
            navigation.navigate("FarmFeedStock", { farmId, farmName });
          } else {
            navigation.navigate("TechFarm");
          }
          return;
        case "reports":
          if (farmId) {
            navigation.navigate("FarmReports", { farmId, farmName });
          } else {
            navigation.navigate("TechTracking");
          }
          return;
        case "wallet":
          navigation.navigate("UserWallet");
          return;
        default:
          return;
      }
    },
    [focused?.params, navigation]
  );

  if (!isTechnician) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[styles.barAnchor, { bottom: insets.bottom + TECH_NAV_FLOAT_BOTTOM }]}
        pointerEvents="box-none"
      >
        <TechTabBar
          activeTab={activeTab}
          onTabPress={onTabPress}
          onOpenExtended={() => setExtendedOpen(true)}
        />
      </View>
      <ExtendedMenuGrid
        visible={extendedOpen}
        onClose={() => setExtendedOpen(false)}
        items={[...extendedItems]}
        onSelect={onExtendedSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none"
  },
  barAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    paddingHorizontal: mobileSpacing.xs,
    alignItems: "stretch",
    pointerEvents: "box-none"
  }
});
