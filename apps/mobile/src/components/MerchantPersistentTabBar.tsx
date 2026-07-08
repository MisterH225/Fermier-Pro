import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MerchantTabBar } from "./navigation/merchant/MerchantTabBar";
import { merchantMainTabFromRoute } from "./navigation/merchant/merchantMainTabs";
import { MERCHANT_NAV_FLOAT_BOTTOM } from "./navigation/merchant/merchantNavMetrics";
import type { MerchantMainTab } from "./navigation/merchant/types";
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

export function MerchantPersistentTabBar() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, activeProfileId } = useSession();

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isMerchant = profileType === "merchant";

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(
    () => merchantMainTabFromRoute(focused?.name, focused?.params),
    [focused?.name, focused?.params]
  );

  const onTabPress = useCallback(
    (tab: MerchantMainTab) => {
      switch (tab) {
        case "home":
          navigation.navigate("MerchantDashboard");
          return;
        case "shops":
          navigation.navigate("MerchantShops");
          return;
        case "products":
          navigation.navigate("MerchantProducts");
          return;
        case "marketplace":
          navigation.navigate("MerchantMarket");
          return;
        case "orders":
          navigation.navigate("MerchantOrders");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  if (!isMerchant) {
    return null;
  }

  const hideTabBarRoutes = new Set([
    "MerchantSubscription",
    "MerchantShop",
    "MerchantShopDetail",
    "MerchantProductForm",
    "MerchantProductDetail"
  ]);
  if (focused?.name && hideTabBarRoutes.has(focused.name)) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[styles.barAnchor, { bottom: insets.bottom + MERCHANT_NAV_FLOAT_BOTTOM }]}
        pointerEvents="box-none"
      >
        <MerchantTabBar activeTab={activeTab} onTabPress={onTabPress} />
      </View>
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
    paddingHorizontal: mobileSpacing.md,
    alignItems: "stretch",
    pointerEvents: "box-none"
  }
});
