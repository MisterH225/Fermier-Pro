import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExtendedMenuGrid } from "./navigation/ExtendedMenuGrid";
import { BuyerTabBar } from "./navigation/buyer/BuyerTabBar";
import { buyerMainTabFromRoute } from "./navigation/buyer/buyerMainTabs";
import { BUYER_NAV_FLOAT_BOTTOM, BUYER_NAV_BAR_HEIGHT } from "./navigation/buyer/buyerNavMetrics";
import type { ExtendedNavMenuId } from "./navigation/types";
import type { BuyerMainTab } from "./navigation/buyer/types";
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

export function BuyerPersistentTabBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, activeProfileId } = useSession();
  const [extendedOpen, setExtendedOpen] = useState(false);

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isBuyer = profileType === "buyer";

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(
    () => buyerMainTabFromRoute(focused?.name, focused?.params),
    [focused?.name, focused?.params]
  );

  const onTabPress = useCallback(
    (tab: BuyerMainTab) => {
      switch (tab) {
        case "home":
          navigation.navigate("BuyerDashboard");
          return;
        case "market":
          navigation.navigate("BuyerMarket");
          return;
        case "messages":
          navigation.navigate("BuyerMessages");
          return;
        case "history":
          navigation.navigate("BuyerHistory");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  const extendedItems = useMemo(
    (): { id: ExtendedNavMenuId; label: string; a11y: string }[] => [
      { id: "favorites", label: t("buyer.extended.favorites"), a11y: t("buyer.extended.favorites") },
      { id: "priceAlerts", label: t("buyer.extended.priceAlerts"), a11y: t("buyer.extended.priceAlerts") },
      { id: "reviews", label: t("buyer.extended.reviews"), a11y: t("buyer.extended.reviews") },
      { id: "preferences", label: t("buyer.extended.preferences"), a11y: t("buyer.extended.preferences") }
    ],
    [t]
  );

  const onExtendedSelect = useCallback(
    (id: ExtendedNavMenuId) => {
      setExtendedOpen(false);
      switch (id) {
        case "favorites":
          navigation.navigate("BuyerFavorites");
          return;
        case "priceAlerts":
          navigation.navigate("BuyerAlerts");
          return;
        case "reviews":
          navigation.navigate("BuyerHistory", { initialTab: "reviews" });
          return;
        case "preferences":
          navigation.navigate("BuyerDashboard");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  if (!isBuyer) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[styles.barAnchor, { bottom: insets.bottom + BUYER_NAV_FLOAT_BOTTOM }]}
        pointerEvents="box-none"
      >
        <BuyerTabBar
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
        navFloatBottom={BUYER_NAV_FLOAT_BOTTOM}
        navBarHeight={BUYER_NAV_BAR_HEIGHT}
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
