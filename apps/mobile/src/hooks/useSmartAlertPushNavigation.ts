import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
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

export function useSmartAlertPushNavigation(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>
) {
  const { authMe, activeProfileId } = useSession();

  useEffect(() => {
    const navigateFromData = (data: Record<string, unknown> | undefined) => {
      if (!data?.type) {
        return;
      }
      const nav = navigationRef.current;
      if (!nav?.isReady()) {
        return;
      }
      const profile = resolveDeepNavProfile(authMe, activeProfileId);
      if (data.type === "smart_alert") {
        navigateFromPushData(nav, data as PushSmartAlertData, profile);
        return;
      }
      navigateFromGenericPushData(nav, data);
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        navigateFromData(
          response.notification.request.content.data as Record<string, unknown>
        );
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromData(
        response.notification.request.content.data as Record<string, unknown>
      );
    });

    return () => sub.remove();
  }, [navigationRef, authMe, activeProfileId]);
}
