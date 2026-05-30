import type { NavigationContainerRef } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import type {
  DeepNavProfile,
  DeepNavTarget,
  PushSmartAlertData,
  SmartAlertNavInput
} from "./deepNavigation.types";

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function farmContext(
  params?: Record<string, unknown>
): { farmId: string; farmName: string } | null {
  const farmId = str(params?.farmId);
  if (!farmId) return null;
  return {
    farmId,
    farmName: str(params?.farmName) ?? "—"
  };
}

function ruleSuffix(ruleKey: string): string | undefined {
  const i = ruleKey.indexOf(":");
  return i >= 0 ? ruleKey.slice(i + 1) : undefined;
}

function rulePrefix(ruleKey: string): string {
  const i = ruleKey.indexOf(":");
  return i >= 0 ? ruleKey.slice(0, i) : ruleKey;
}

/**
 * Résolution déterministe alerte → écran réel + paramètres contextuels.
 * Priorité : ruleKey > legacy action.route + params enrichis.
 */
export function resolveAlertNavigation(
  alert: SmartAlertNavInput,
  profile: DeepNavProfile = "producer"
): DeepNavTarget | null {
  const ctx = farmContext(alert.action?.params);
  const rk = alert.ruleKey?.trim() ?? "";
  const prefix = rk ? rulePrefix(rk) : "";
  const suffix = rk ? ruleSuffix(rk) : undefined;

  if (alert.module === "market" || prefix.startsWith("market-price")) {
    if (profile === "buyer") {
      return { screen: "BuyerMarket", params: undefined };
    }
    return { screen: "BuyerDashboard", params: undefined };
  }

  if (!ctx) {
    return null;
  }

  const { farmId, farmName } = ctx;
  const base = { farmId, farmName };

  switch (prefix) {
    case "cheptel-pen-full":
      return {
        screen: "FarmLivestock",
        params: {
          ...base,
          initialTab: "cheptel",
          openPenId: suffix ?? str(alert.action?.params?.penId),
          highlightPen: true
        }
      };
    case "cheptel-pen-requalify":
      return {
        screen: "FarmLivestock",
        params: {
          ...base,
          initialTab: "cheptel",
          openPenId: suffix ?? str(alert.action?.params?.penId),
          showRequalificationBanner: true,
          highlightPen: true
        }
      };
    case "cheptel-stale-animals":
      return {
        screen: "FarmLivestock",
        params: { ...base, initialTab: "cheptel" }
      };
    case "health-vac-overdue":
    case "health-vac-soon":
      return {
        screen: "FarmHealth",
        params: {
          ...base,
          initialTab: "vaccination",
          openVaccineName: suffix ?? str(alert.action?.params?.vaccineName)
        }
      };
    case "health-vet-visit":
      return {
        screen: "FarmHealth",
        params: {
          ...base,
          initialTab: "vet_visit",
          openVisitId: suffix ?? str(alert.action?.params?.recordId)
        }
      };
    case "health-disease-long":
      return {
        screen: "FarmHealth",
        params: {
          ...base,
          initialTab: "disease",
          openDiseaseId: suffix ?? str(alert.action?.params?.recordId)
        }
      };
    case "health-mortality-month":
      return {
        screen: "FarmHealth",
        params: { ...base, initialTab: "mortality" }
      };
    case "finance-cat-up": {
      const categoryId =
        suffix?.split(":")[0] ?? str(alert.action?.params?.categoryId);
      return {
        screen: "FarmFinance",
        params: {
          ...base,
          initialTab: "budget",
          openCategoryId: categoryId,
          highlightOverrun: true
        }
      };
    }
    case "finance-expenses-up-month":
    case "finance-low-balance":
      return {
        screen: "FarmFinance",
        params: { ...base, initialTab: "overview" }
      };
    case "finance-margin-negative":
      return {
        screen: "FarmFinance",
        params: { ...base, initialTab: "overview" }
      };
    case "stock-depletion-critical":
      return {
        screen: "FarmFeedStock",
        params: {
          ...base,
          feedTab: "overview",
          openFeedTypeId: suffix ?? str(alert.action?.params?.feedTypeId),
          highlightFeedType: true
        }
      };
    case "stock-depletion-warning":
      return {
        screen: "FarmFeedStock",
        params: {
          ...base,
          feedTab: "overview",
          openFeedTypeId: suffix ?? str(alert.action?.params?.feedTypeId)
        }
      };
    case "stock-check-stale":
    case "stock-never-checked":
      return {
        screen: "FarmFeedStock",
        params: {
          ...base,
          feedTab: "controls",
          autoOpenControl: true,
          openFeedTypeId: suffix ?? str(alert.action?.params?.feedTypeId)
        }
      };
    case "stock-cost-missing":
      return {
        screen: "FarmFeedStock",
        params: {
          ...base,
          feedTab: "movements",
          filterCostMissing: true,
          costFilter: "missing"
        }
      };
    case "stock-consumption-spike":
      return {
        screen: "FarmFeedStock",
        params: { ...base, feedTab: "overview" }
      };
    case "gestation-due-3d":
      return {
        screen: "FarmGestation",
        params: {
          ...base,
          initialTab: "active",
          highlightUrgent: true,
          autoOpenDetail: Boolean(
            str(alert.action?.params?.gestationId) ?? suffix
          ),
          openGestationId:
            str(alert.action?.params?.gestationId) ?? suffix
        }
      };
    case "gestation-due-7d":
      return {
        screen: "FarmGestation",
        params: { ...base, initialTab: "birth" }
      };
    case "gestation-overdue":
      return {
        screen: "FarmGestation",
        params: {
          ...base,
          initialTab: "active",
          openGestationId:
            str(alert.action?.params?.gestationId) ?? suffix,
          autoOpenDetail: true,
          highlightUrgent: true
        }
      };
    case "gestation-vaccine-overdue":
    case "gestation-vaccine-soon":
      return {
        screen: "FarmGestation",
        params: {
          ...base,
          initialTab: "active",
          openGestationId: str(alert.action?.params?.gestationId),
          autoOpenDetail: true
        }
      };
    case "gestation-sow-ready":
      return {
        screen: "FarmGestation",
        params: {
          ...base,
          initialTab: "planning",
          highlightSowId: suffix ?? str(alert.action?.params?.sowId)
        }
      };
    case "gestation-weaning-soon":
      return {
        screen: "FarmGestation",
        params: { ...base, initialTab: "birth" }
      };
    default:
      break;
  }

  return resolveLegacyActionNavigation(alert, profile);
}

function resolveLegacyActionNavigation(
  alert: SmartAlertNavInput,
  profile: DeepNavProfile
): DeepNavTarget | null {
  const route = alert.action?.route;
  if (!route) return null;

  const params = { ...(alert.action?.params ?? {}) } as Record<string, unknown>;

  if (route === "LogeDetail" && params.penId) {
    return resolveAlertNavigation(
      {
        ...alert,
        ruleKey: `cheptel-pen-requalify:${params.penId}`,
        action: { ...alert.action!, route: "FarmLivestock" }
      },
      profile
    );
  }

  if (route === "FarmBarns" && alert.module === "cheptel") {
    const ctx = farmContext(params);
    if (!ctx) return null;
    return {
      screen: "FarmLivestock",
      params: { ...ctx, initialTab: "cheptel" }
    };
  }

  if (route === "FarmFeedStock") {
    const ctx = farmContext(params);
    if (!ctx) return null;
    const feedTab = str(params.feedTab) as
      | "overview"
      | "movements"
      | "controls"
      | undefined;
    const costFilter = str(params.costFilter);
    return {
      screen: "FarmFeedStock",
      params: {
        ...ctx,
        feedTab,
        filterCostMissing: costFilter === "missing" || params.filterCostMissing === true,
        openFeedTypeId: str(params.feedTypeId),
        autoOpenControl: params.autoOpenControl === true
      }
    };
  }

  if (route === "FarmGestation") {
    const ctx = farmContext(params);
    if (!ctx) return null;
    const tab = str(params.tab);
    const initialTab =
      tab === "planning"
        ? "planning"
        : (str(params.initialTab) as FarmGestationDeepTab | undefined);
    return {
      screen: "FarmGestation",
      params: {
        ...ctx,
        initialTab,
        openGestationId: str(params.gestationId),
        autoOpenDetail: params.autoOpenDetail === true
      }
    };
  }

  if (route === "FarmHealth") {
    const ctx = farmContext(params);
    if (!ctx) return null;
    return {
      screen: "FarmHealth",
      params: {
        ...ctx,
        initialTab: params.initialTab as RootStackParamList["FarmHealth"]["initialTab"]
      }
    };
  }

  if (route === "FarmFinance") {
    const ctx = farmContext(params);
    if (!ctx) return null;
    return {
      screen: "FarmFinance",
      params: ctx
    };
  }

  if (route === "BuyerDashboard" && profile === "buyer") {
    return { screen: "BuyerDashboard", params: undefined };
  }

  const ctx = farmContext(params);
  if (!ctx && route !== "BuyerDashboard" && route !== "BuyerMarket") {
    return null;
  }

  return {
    screen: route as keyof RootStackParamList,
    params: (ctx ?? params) as RootStackParamList[keyof RootStackParamList]
  } as DeepNavTarget;
}

type FarmGestationDeepTab = "overview" | "active" | "planning" | "birth" | "history";

function parsePushParams(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function navigateToAlert(
  navigation:
    | NativeStackNavigationProp<RootStackParamList>
    | NavigationContainerRef<RootStackParamList>,
  alert: SmartAlertNavInput,
  profile: DeepNavProfile = "producer"
): boolean {
  const target = resolveAlertNavigation(alert, profile);
  if (!target) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation.navigate(target.screen as any, target.params as any);
  return true;
}

export function navigateFromPushData(
  navigationRef: NavigationContainerRef<RootStackParamList>,
  data: PushSmartAlertData | undefined,
  profile: DeepNavProfile = "producer"
): boolean {
  if (!data || data.type !== "smart_alert") return false;
  const nav = navigationRef;
  if (!nav?.isReady()) return false;

  const params = parsePushParams(data.params);
  const alert: SmartAlertNavInput = {
    id: "",
    module: data.module ?? "stock",
    ruleKey: data.ruleKey,
    action: data.route
      ? {
          label: "",
          route: data.route,
          params
        }
      : params
        ? {
            label: "",
            route: "FarmLivestock",
            params: {
              ...params,
              farmId: data.farmId ?? params.farmId
            }
          }
        : undefined
  };

  return navigateToAlert(nav, alert, profile);
}
