import * as Linking from "expo-linking";
import { useEffect } from "react";
import {
  parseInviteTokenFromUrl,
  savePendingInviteToken
} from "../lib/pendingInviteToken";

/**
 * Capture les deep links d'invitation avant que NavigationContainer soit monté
 * (login, CGU, onboarding) pour ne pas perdre le jeton.
 */
export function PendingInviteLinkListener() {
  useEffect(() => {
    const handleUrl = (url: string | null | undefined) => {
      if (!url) {
        return;
      }
      const token = parseInviteTokenFromUrl(url);
      if (token) {
        void savePendingInviteToken(token);
      }
    };

    void Linking.getInitialURL().then(handleUrl);

    const sub = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => sub.remove();
  }, []);

  return null;
}
