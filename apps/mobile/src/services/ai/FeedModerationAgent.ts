import { containsPhone } from "../chat/PhoneNumberDetector";
import {
  preModerateFeedContent,
  type PreModerateResultDto
} from "../../lib/api/community-feed";

export type FeedModerationCheckResult = PreModerateResultDto & {
  hasPhone: boolean;
};

/**
 * Vérification pré-envoi côté client (PhoneNumberDetector + API modération).
 */
export async function checkFeedContentBeforeSend(
  accessToken: string,
  profileId: string,
  body: string
): Promise<FeedModerationCheckResult> {
  const hasPhone = containsPhone(body);
  const remote = await preModerateFeedContent(accessToken, profileId, body);
  return { ...remote, hasPhone };
}
