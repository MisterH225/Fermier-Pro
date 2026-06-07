import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
import { navigateFromGenericPushData } from "../services/navigation/DeepNavigationService";
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
      if (!data?.type) {
        return;
      }
      const nav = navigationRef.current;
      if (!nav?.isReady()) {
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
  }, [navigationRef]);
}
