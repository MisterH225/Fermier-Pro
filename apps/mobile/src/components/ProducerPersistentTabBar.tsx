import { useNavigation, useNavigationState } from "@react-navigation/native";
import type { NavigationState } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomTabBar,
  type AppTab
} from "./layout/BottomTabBar";
import { useSession } from "../context/SessionContext";
import { fetchFarms } from "../lib/api";
import { producerShellTabs } from "../lib/producerShellTabs";
import { resolveProducerHomeFarm } from "../lib/producerHomeFarm";
import { mobileColors } from "../theme/mobileTheme";
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

function producerActiveTabFromRoute(
  name: string,
  financeEnabled: boolean
): AppTab {
  switch (name) {
    case "FarmFinance":
    case "CreateFarmExpense":
    case "CreateFarmRevenue":
    case "EditFarmExpense":
    case "EditFarmRevenue":
    case "ProducerFarmSettings":
      return "home";
    case "FarmLivestock":
    case "AnimalDetail":
    case "BatchDetail":
    case "FarmBarns":
    case "BarnDetail":
    case "PenDetail":
    case "CreateBarn":
    case "CreatePen":
    case "CreatePenLog":
    case "PenMove":
      return "cheptel";
    case "FarmHealth":
    case "FarmVetConsultations":
    case "VetConsultationDetail":
    case "CreateVetConsultation":
    case "AddVetConsultationAttachment":
      return "health";
    default:
      return "home";
  }
}

/**
 * Barre d’onglets producteur fixée sous le stack : visible sur tous les écrans du profil producteur.
 */
export function ProducerPersistentTabBar() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { accessToken, activeProfileId, authMe, clientFeatures } = useSession();

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
  const tabs = useMemo(
    () => producerShellTabs(financeEnabled).filter((t) => t !== "profile"),
    [financeEnabled]
  );

  const focused = useNavigationState((state) =>
    getFocusedRoute(state as NavigationState | undefined)
  );

  const activeTab = useMemo(() => {
    if (!focused?.name) {
      return "home" as AppTab;
    }
    return producerActiveTabFromRoute(focused.name, financeEnabled);
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

  const onChange = useCallback(
    (tab: AppTab) => {
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
      }
    },
    [navigation, farmContext, clientFeatures.finance]
  );

  if (!isProducer) {
    return null;
  }

  return (
    <View
      style={{
        paddingBottom: insets.bottom,
        backgroundColor: mobileColors.background
      }}
    >
      <BottomTabBar activeTab={activeTab} onChange={onChange} tabs={tabs} />
    </View>
  );
}
