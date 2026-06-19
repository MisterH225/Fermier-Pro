import type { NavigationContainerRef } from "@react-navigation/native";
import { useEffect, type RefObject } from "react";
import {
  clearPendingInviteToken,
  getPendingInviteToken
} from "../lib/pendingInviteToken";
import type { RootStackParamList } from "../types/navigation";

/**
 * Après auth + onboarding, ouvre l'écran d'acceptation si un jeton a été
 * capturé avant que NavigationContainer ne soit disponible.
 */
export function usePendingInviteNavigation(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>
) {
  useEffect(() => {
    let cancelled = false;

    const tryNavigate = async () => {
      const nav = navigationRef.current;
      if (!nav?.isReady()) {
        return;
      }

      const token = await getPendingInviteToken();
      if (!token || cancelled) {
        return;
      }

      const current = nav.getCurrentRoute();
      if (current?.name === "AcceptFarmInvitation") {
        await clearPendingInviteToken();
        return;
      }

      await clearPendingInviteToken();
      nav.navigate("AcceptFarmInvitation", { prefilledToken: token });
    };

    const interval = setInterval(() => {
      void tryNavigate();
    }, 400);

    void tryNavigate();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigationRef]);
}
