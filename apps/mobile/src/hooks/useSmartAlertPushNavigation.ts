import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, useRef, type RefObject } from "react";
import { useSession } from "../context/SessionContext";
import { resolveDeepNavProfile } from "../lib/resolveDeepNavProfile";
import {
  navigateFromGenericPushData,
  navigateFromPushData
} from "../services/navigation/DeepNavigationService";
import type { PushSmartAlertData } from "../services/navigation/deepNavigation.types";
import type { RootStackParamList } from "../types/navigation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

/** Évite de relire la dernière notification Expo à chaque remontage du hook. */
let coldStartNotificationFetched = false;
/** Évite de rejouer la navigation issue du cold start après un refresh auth / changement de profil. */
let coldStartNavigationHandled = false;
let pendingColdStartData: Record<string, unknown> | undefined;

function navigateFromNotificationData(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>,
  authMe: ReturnType<typeof useSession>["authMe"],
  activeProfileId: string | null,
  data: Record<string, unknown> | undefined
): boolean {
  if (!data?.type) {
    return false;
  }
  const nav = navigationRef.current;
  if (!nav?.isReady()) {
    return false;
  }
  const profile = resolveDeepNavProfile(authMe, activeProfileId);
  if (data.type === "smart_alert") {
    navigateFromPushData(nav, data as PushSmartAlertData, profile);
    return true;
  }
  return navigateFromGenericPushData(nav, data);
}

export function useSmartAlertPushNavigation(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>
) {
  const { authMe, activeProfileId } = useSession();
  const authMeRef = useRef(authMe);
  const activeProfileIdRef = useRef(activeProfileId);

  authMeRef.current = authMe;
  activeProfileIdRef.current = activeProfileId;

  useEffect(() => {
    if (coldStartNotificationFetched) {
      return;
    }
    coldStartNotificationFetched = true;

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }
      pendingColdStartData = response.notification.request.content
        .data as Record<string, unknown>;
    });
  }, [navigationRef]);

  useEffect(() => {
    if (coldStartNavigationHandled || !pendingColdStartData) {
      return;
    }
    const navigated = navigateFromNotificationData(
      navigationRef,
      authMeRef.current,
      activeProfileIdRef.current,
      pendingColdStartData
    );
    if (!navigated) {
      return;
    }
    coldStartNavigationHandled = true;
    pendingColdStartData = undefined;
  }, [navigationRef, authMe, activeProfileId]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromNotificationData(
        navigationRef,
        authMeRef.current,
        activeProfileIdRef.current,
        response.notification.request.content.data as Record<string, unknown>
      );
    });

    return () => sub.remove();
  }, [navigationRef]);
}
