import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
import { navigateFromPushData } from "../services/navigation/DeepNavigationService";
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
  useEffect(() => {
    const navigateFromData = (data: Record<string, unknown> | undefined) => {
      if (!data || data.type !== "smart_alert") {
        return;
      }
      const nav = navigationRef.current;
      if (!nav?.isReady()) {
        return;
      }
      navigateFromPushData(nav, data as PushSmartAlertData);
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
  }, [navigationRef]);
}
