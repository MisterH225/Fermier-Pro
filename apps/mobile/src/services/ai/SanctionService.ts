import {
  fetchFeedMyStatus,
  submitFeedAppeal,
  type FeedMyStatusDto,
  type FeedUserStatus
} from "../../lib/api/community-feed";

export type { FeedMyStatusDto, FeedUserStatus };

export async function getMyFeedStatus(
  accessToken: string,
  profileId: string
): Promise<FeedMyStatusDto> {
  return fetchFeedMyStatus(accessToken, profileId);
}

export async function appealFeedSanction(
  accessToken: string,
  profileId: string,
  appealMessage: string
) {
  return submitFeedAppeal(accessToken, profileId, appealMessage);
}

export function isFeedSuspended(status: FeedUserStatus): boolean {
  return (
    status === "suspended_7d" ||
    status === "suspended_30d" ||
    status === "banned_permanent"
  );
}
