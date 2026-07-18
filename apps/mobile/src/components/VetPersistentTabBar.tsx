import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ExtendedMenuGrid } from "./navigation/ExtendedMenuGrid";
import { VetTabBar } from "./navigation/vet/VetTabBar";
import { vetMainTabFromRoute } from "./navigation/vet/vetMainTabs";
import { VET_NAV_FLOAT_BOTTOM } from "./navigation/vet/vetNavMetrics";
import type { ExtendedNavMenuId } from "./navigation/types";
import type { VetMainTab } from "./navigation/vet/types";
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

export function VetPersistentTabBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMe, activeProfileId, clientFeatures } = useSession();
  const [extendedOpen, setExtendedOpen] = useState(false);

  const profileType = authMe?.profiles.find((p) => p.id === activeProfileId)?.type;
  const isVet = profileType === "veterinarian";

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(
    () => vetMainTabFromRoute(focused?.name),
    [focused?.name]
  );

  const onTabPress = useCallback(
    (tab: VetMainTab) => {
      switch (tab) {
        case "home":
          navigation.navigate("VeterinarianDashboard");
          return;
        case "agenda":
          navigation.navigate("VetAgenda");
          return;
        case "farms":
          navigation.navigate("VetFarms");
          return;
        case "messages":
          navigation.navigate("VetMessages");
          return;
        default:
          return;
      }
    },
    [navigation]
  );

  const extendedItems = useMemo(
    (): { id: ExtendedNavMenuId; label: string; a11y: string }[] => {
      const items: { id: ExtendedNavMenuId; label: string; a11y: string }[] = [
        {
          id: "communityFeed",
          label: t("navigation.main.feed"),
          a11y: t("navigation.main.feed")
        },
        { id: "tasks", label: t("vet.extended.tasks"), a11y: t("vet.extended.tasks") },
        { id: "reports", label: t("vet.extended.reports"), a11y: t("vet.extended.reports") },
        {
          id: "prescriptions",
          label: t("vet.extended.prescriptions"),
          a11y: t("vet.extended.prescriptions")
        }
      ];
      if (clientFeatures.wallet) {
        items.splice(3, 0, {
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
        case "tasks":
          navigation.navigate("VetTasks");
          return;
        case "reports":
          navigation.navigate("VetReports");
          return;
        case "wallet":
          navigation.navigate("UserWallet");
          return;
        case "prescriptions":
          navigation.navigate("ModuleRoadmap", {
            title: t("vet.extended.prescriptions"),
            body: t("vet.extended.prescriptionsRoadmap")
          });
          return;
        case "settings":
          navigation.navigate("ProducerFarmSettings");
          return;
        default:
          return;
      }
    },
    [navigation, t]
  );

  if (!isVet) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[styles.barAnchor, { bottom: insets.bottom + VET_NAV_FLOAT_BOTTOM }]}
        pointerEvents="box-none"
      >
        <VetTabBar
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
