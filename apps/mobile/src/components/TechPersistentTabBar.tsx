import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
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
import {
  resolveTechActiveFarm,
  useTechActiveFarm
} from "../context/TechActiveFarmContext";
import { fetchTechnicianDashboard } from "../lib/api";
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
  const { authMe, activeProfileId, accessToken, clientFeatures } = useSession();
  const { activeFarmId } = useTechActiveFarm();
  const [extendedOpen, setExtendedOpen] = useState(false);

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isTechnician = profileType === "technician";

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const dashQ = useQuery({
    queryKey: ["techDashboard", activeProfileId, "nav"],
    queryFn: () => fetchTechnicianDashboard(accessToken!, activeProfileId),
    enabled: Boolean(accessToken && isTechnician)
  });

  const farmContext = useMemo((): { farmId: string; farmName: string } | null => {
    const fromRouteId =
      typeof focused?.params?.farmId === "string" ? focused.params.farmId : undefined;
    const fromRouteName =
      typeof focused?.params?.farmName === "string" ? focused.params.farmName : undefined;
    if (fromRouteId) {
      return { farmId: fromRouteId, farmName: fromRouteName ?? "—" };
    }
    const farms = dashQ.data?.farms ?? [];
    const farm = resolveTechActiveFarm(
      farms,
      activeFarmId,
      dashQ.data?.activeFarmId
    );
    return farm ? { farmId: farm.farmId, farmName: farm.farmName } : null;
  }, [activeFarmId, dashQ.data?.activeFarmId, dashQ.data?.farms, focused?.params]);

  const activeTab = useMemo(
    () => techMainTabFromRoute(focused?.name, focused?.params),
    [focused?.name, focused?.params]
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
        case "vaccinations":
          if (farmContext) {
            navigation.navigate("FarmHealth", {
              farmId: farmContext.farmId,
              farmName: farmContext.farmName,
              initialTab: "vaccination"
            });
          } else {
            navigation.navigate("TechFarm");
          }
          return;
        case "weighings":
          if (farmContext) {
            navigation.navigate("FarmLivestock", {
              farmId: farmContext.farmId,
              farmName: farmContext.farmName,
              initialTab: "weight"
            });
          } else {
            navigation.navigate("TechFarm");
          }
          return;
        case "feedStock":
          if (farmContext) {
            navigation.navigate("FarmFeedStock", {
              farmId: farmContext.farmId,
              farmName: farmContext.farmName
            });
          } else {
            navigation.navigate("TechFarm");
          }
          return;
        default:
          return;
      }
    },
    [farmContext, navigation]
  );

  const extendedItems = useMemo(
    (): { id: ExtendedNavMenuId; label: string; a11y: string }[] => {
      const items: { id: ExtendedNavMenuId; label: string; a11y: string }[] = [
        {
          id: "communityFeed",
          label: t("navigation.main.feed"),
          a11y: t("navigation.main.feed")
        },
        {
          id: "farm",
          label: t("tech.extended.farm"),
          a11y: t("tech.extended.farm")
        },
        {
          id: "tracking",
          label: t("tech.extended.tracking"),
          a11y: t("tech.extended.tracking")
        },
        {
          id: "reports",
          label: t("tech.extended.reports"),
          a11y: t("tech.extended.reports")
        }
      ];
      if (clientFeatures.wallet) {
        items.push({
          id: "wallet",
          label: t("navigation.extended.wallet"),
          a11y: t("navigation.extended.walletDescription")
        });
      }
      items.push({
        id: "settings",
        label: t("navigation.extended.settings"),
        a11y: t("navigation.extended.settings")
      });
      return items;
    },
    [clientFeatures.wallet, t]
  );

  const onExtendedSelect = useCallback(
    (id: ExtendedNavMenuId) => {
      setExtendedOpen(false);
      switch (id) {
        case "communityFeed":
          navigation.navigate("CommunityFeed");
          return;
        case "farm":
          navigation.navigate("TechFarm");
          return;
        case "tracking":
          navigation.navigate("TechTracking");
          return;
        case "reports":
          if (farmContext) {
            navigation.navigate("FarmReports", {
              farmId: farmContext.farmId,
              farmName: farmContext.farmName
            });
          } else {
            navigation.navigate("TechTracking");
          }
          return;
        case "wallet":
          navigation.navigate("UserWallet");
          return;
        case "settings":
          navigation.navigate("ProducerFarmSettings");
          return;
        default:
          return;
      }
    },
    [farmContext, navigation]
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
