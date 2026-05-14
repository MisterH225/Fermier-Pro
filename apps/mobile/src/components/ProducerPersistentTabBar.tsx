import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ExtendedMenuGrid,
  MainTabBar,
  producerMainTabFromRoute,
  producerMainTabs,
  PRODUCER_NAV_FLOAT_BOTTOM,
  type ExtendedNavMenuId,
  type ProducerMainTab
} from "./navigation";
import { useSession } from "../context/SessionContext";
import { fetchFarms } from "../lib/api";
import { resolveProducerHomeFarm } from "../lib/producerHomeFarm";
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

function farmPairFromParams(
  params: Record<string, unknown> | undefined
): { farmId: string; farmName: string } | null {
  if (!params || typeof params.farmId !== "string") {
    return null;
  }
  const name =
    typeof params.farmName === "string" && params.farmName.trim()
      ? params.farmName
      : "—";
  return { farmId: params.farmId, farmName: name };
}

export function ProducerPersistentTabBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();
  const [extendedOpen, setExtendedOpen] = useState(false);

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isProducer = profileType === "producer";

  const farmsQuery = useQuery({
    queryKey: ["farms", activeProfileId, "producerPersistentShell"],
    queryFn: () => fetchFarms(accessToken!, activeProfileId),
    enabled: Boolean(
      accessToken && activeProfileId && isProducer && !authMe?.primaryFarm
    )
  });

  const producerHome = useMemo(
    () => resolveProducerHomeFarm(authMe, farmsQuery.data),
    [authMe, farmsQuery.data]
  );

  const financeEnabled = Boolean(isProducer && clientFeatures.finance);
  const tabs = useMemo(() => producerMainTabs(financeEnabled), [financeEnabled]);

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(() => {
    if (!focused?.name) {
      return null;
    }
    return producerMainTabFromRoute(focused.name, financeEnabled);
  }, [focused?.name, financeEnabled]);

  const farmContext = useMemo((): { farmId: string; farmName: string } | null => {
    const fromRoute = farmPairFromParams(focused?.params);
    if (fromRoute) {
      return fromRoute;
    }
    if (producerHome) {
      return { farmId: producerHome.id, farmName: producerHome.name };
    }
    return null;
  }, [focused?.params, producerHome]);

  const onTabPress = useCallback(
    (tab: ProducerMainTab) => {
      if (tab === "home") {
        navigation.navigate("ProducerDashboard");
        return;
      }
      if (tab === "cheptel") {
        if (farmContext) {
          navigation.navigate("FarmLivestock", {
            farmId: farmContext.farmId,
            farmName: farmContext.farmName
          });
        } else {
          navigation.navigate("FarmList");
        }
        return;
      }
      if (tab === "health") {
        if (farmContext) {
          navigation.navigate("FarmHealth", {
            farmId: farmContext.farmId,
            farmName: farmContext.farmName
          });
        } else {
          navigation.navigate("FarmList");
        }
        return;
      }
      if (tab === "finance") {
        if (!clientFeatures.finance) {
          return;
        }
        if (farmContext) {
          navigation.navigate("FarmFinance", {
            farmId: farmContext.farmId,
            farmName: farmContext.farmName
          });
        } else {
          navigation.navigate("FarmList");
        }
        return;
      }
      if (tab === "collaboration") {
        if (farmContext) {
          navigation.navigate("Collaboration", {
            farmId: farmContext.farmId,
            farmName: farmContext.farmName
          });
        } else {
          navigation.navigate("FarmList");
        }
      }
    },
    [navigation, farmContext, clientFeatures.finance]
  );

  const extendedItems = useMemo(
    () =>
      [
        {
          id: "nutrition" as const,
          emoji: "🌾",
          label: t("navigation.extended.nutrition"),
          a11y: t("navigation.extended.nutrition")
        },
        {
          id: "collaboration" as const,
          emoji: "🤝",
          label: t("navigation.extended.collaboration"),
          a11y: t("navigation.extended.collaboration")
        },
        {
          id: "market" as const,
          emoji: "🛒",
          label: t("navigation.extended.market"),
          a11y: t("navigation.extended.market")
        },
        {
          id: "gestation" as const,
          emoji: "🐣",
          label: t("navigation.extended.gestation"),
          a11y: t("navigation.extended.gestation")
        },
        {
          id: "tasks" as const,
          emoji: "✅",
          label: t("navigation.extended.tasks"),
          a11y: t("navigation.extended.tasks")
        },
        {
          id: "event" as const,
          emoji: "📅",
          label: t("navigation.extended.event"),
          a11y: t("navigation.extended.event")
        },
        {
          id: "reports" as const,
          emoji: "📊",
          label: t("navigation.extended.reports"),
          a11y: t("navigation.extended.reports")
        }
      ] as const,
    [t]
  );

  const onExtendedSelect = useCallback(
    (id: ExtendedNavMenuId) => {
      setExtendedOpen(false);
      const ctx = farmContext;
      switch (id) {
        case "nutrition":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          if (!clientFeatures.feedStock) {
            navigation.navigate("ModuleRoadmap", {
              title: t("navigation.extended.nutrition"),
              body: t("navigation.extended.nutritionRoadmap")
            });
            return;
          }
          navigation.navigate("FarmFeedStock", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
        case "collaboration":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("FarmMembers", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
        case "market":
          navigation.navigate("MarketplaceList");
          return;
        case "gestation":
          navigation.navigate("ProducerDashboard");
          return;
        case "tasks":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("FarmTasks", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
        case "event":
          navigation.navigate("FarmEventsFeed");
          return;
        case "reports":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("FarmReports", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
        default:
          return;
      }
    },
    [navigation, farmContext, clientFeatures.feedStock, t]
  );

  if (!isProducer) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[
          styles.barAnchor,
          { bottom: insets.bottom + PRODUCER_NAV_FLOAT_BOTTOM }
        ]}
        pointerEvents="box-none"
      >
        <MainTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={onTabPress}
          onOpenExtended={() => setExtendedOpen(true)}
          financeEnabled={financeEnabled}
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
