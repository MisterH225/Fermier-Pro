import * as Notifications from "expo-notifications";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
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

function parsePushParams(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "string" || !raw.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function useSmartAlertPushNavigation(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>
) {
  useEffect(() => {
    const navigateFromData = (data: Record<string, unknown> | undefined) => {
      if (!data || data.type !== "smart_alert" || typeof data.route !== "string") {
        return;
      }
      const nav = navigationRef.current;
      if (!nav?.isReady()) {
        return;
      }
      const route = data.route as keyof RootStackParamList;
      const params = parsePushParams(data.params);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nav.navigate(route as any, (params ?? undefined) as any);
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
