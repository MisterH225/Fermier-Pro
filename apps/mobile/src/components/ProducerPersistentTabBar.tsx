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
import { fetchFarmTasksPendingCount, fetchFarms } from "../lib/api";
import { fetchFeedUnreadCount } from "../lib/api/community-feed";
import { useFarmTasksSocket } from "../hooks/useFarmTasksSocket";
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

  const tasksEnabled = Boolean(isProducer && clientFeatures.tasks && farmContext);

  const { tasksSocketStatus } = useFarmTasksSocket({
    farmId: farmContext?.farmId ?? "",
    accessToken: accessToken ?? "",
    enabled: tasksEnabled
  });

  const pendingTasksQ = useQuery({
    queryKey: ["farmTasksPendingCount", farmContext?.farmId, activeProfileId],
    queryFn: () =>
      fetchFarmTasksPendingCount(
        accessToken!,
        farmContext!.farmId,
        activeProfileId
      ),
    enabled: tasksEnabled && Boolean(accessToken),
    refetchInterval:
      tasksSocketStatus === "connected" ? false : 60_000
  });

  const pendingTasksCount = pendingTasksQ.data?.pendingCount ?? 0;

  const feedUnreadQ = useQuery({
    queryKey: ["feedUnreadCount", activeProfileId],
    queryFn: async () => {
      try {
        return await fetchFeedUnreadCount(accessToken!, activeProfileId!);
      } catch {
        return { count: 0 };
      }
    },
    enabled: Boolean(accessToken && activeProfileId && isProducer),
    refetchInterval: 60_000
  });

  const feedUnreadCount = feedUnreadQ.data?.count ?? 0;

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
      if (tab === "feed") {
        navigation.navigate("CommunityFeed");
      }
    },
    [navigation, farmContext, clientFeatures.finance]
  );

  const extendedItems = useMemo(
    () =>
      [
        {
          id: "team" as const,
          label: t("navigation.extended.team"),
          a11y: t("navigation.extended.teamDescription")
        },
        {
          id: "market" as const,
          label: t("navigation.extended.market"),
          a11y: t("navigation.extended.market")
        },
        {
          id: "nutrition" as const,
          label: t("navigation.extended.nutrition"),
          a11y: t("navigation.extended.nutrition")
        },
        {
          id: "gestation" as const,
          label: t("navigation.extended.gestation"),
          a11y: t("navigation.extended.gestation")
        },
        {
          id: "tasks" as const,
          label: t("navigation.extended.tasks"),
          a11y: t("navigation.extended.tasks"),
          badgeCount: pendingTasksCount
        },
        {
          id: "reports" as const,
          label: t("navigation.extended.reports"),
          a11y: t("navigation.extended.reports")
        },
        {
          id: "messages" as const,
          label: t("navigation.extended.messages"),
          a11y: t("navigation.screenTitles.messages")
        },
        {
          id: "wallet" as const,
          label: t("navigation.extended.wallet"),
          a11y: t("navigation.extended.walletDescription")
        },
        {
          id: "settings" as const,
          label: t("navigation.extended.settings"),
          a11y: t("navigation.extended.settings")
        }
      ] as const,
    [t, pendingTasksCount]
  );

  const onExtendedSelect = useCallback(
    (id: ExtendedNavMenuId) => {
      setExtendedOpen(false);
      const ctx = farmContext;
      switch (id) {
        case "team":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("Collaboration", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
        case "settings":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("ProducerFarmSettings", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
          return;
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
        case "market":
          navigation.navigate("MarketplaceList");
          return;
        case "gestation":
          if (!ctx) {
            navigation.navigate("FarmList");
            return;
          }
          navigation.navigate("FarmGestation", {
            farmId: ctx.farmId,
            farmName: ctx.farmName
          });
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
        case "messages":
          navigation.navigate("ProducerMessages");
          return;
        case "wallet":
          navigation.navigate("UserWallet");
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
          feedBadgeCount={feedUnreadCount}
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
