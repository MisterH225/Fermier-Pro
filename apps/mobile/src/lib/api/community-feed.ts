import { apiGetJson, apiPostJson } from "./http";
import type { ProfileType } from "@fermier/types";

export type CommunityFeedPostType =
  | "question"
  | "tip"
  | "observation"
  | "alert"
  | "success"
  | "medical_tip"
  | "technical_tip";

export type FeedUserStatus =
  | "active"
  | "warned_1"
  | "warned_2"
  | "suspended_7d"
  | "suspended_30d"
  | "banned_permanent";

export type CommunityRuleDto = {
  id: string;
  label: string;
  description: string;
  severity: "low" | "medium" | "high";
  autoHandled?: boolean;
};

export type FeedLikerDto = {
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
};

export type FeedCommentDto = {
  id: string;
  parentCommentId: string | null;
  authorProfileType: ProfileType;
  authorDisplayName: string | null;
  authorRegion: string | null;
  authorAvatarUrl: string | null;
  authorIsOnline: boolean;
  body: string;
  isAnonymous: boolean;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  replies: FeedCommentDto[];
};

export type FeedPostDto = {
  id: string;
  authorProfileType: ProfileType;
  authorDisplayName: string | null;
  authorRegion: string | null;
  authorAvatarUrl: string | null;
  authorIsOnline: boolean;
  postType: CommunityFeedPostType;
  body: string;
  isAnonymous: boolean;
  isVetHighlight: boolean;
  medicalDisclaimer: string | null;
  likeCount: number;
  likedByMe: boolean;
  recentLikers: FeedLikerDto[];
  createdAt: string;
  comments: FeedCommentDto[];
};

export type FeedMyStatusDto = {
  feedStatus: FeedUserStatus;
  feedSuspensionUntil: string | null;
  feedViolationCount: number;
  canPost: boolean;
  canRead: boolean;
  canComment: boolean;
};

export type PreModerateResultDto = {
  allowed: boolean;
  warningMessageFr: string | null;
  severity: "low" | "medium" | "high" | null;
  shouldBlock: boolean;
  ruleId: string | null;
};

export async function fetchFeedRules(
  accessToken: string,
  profileId: string
): Promise<{ rules: CommunityRuleDto[] }> {
  return apiGetJson("/feed/rules", accessToken, profileId);
}

export async function fetchFeedMyStatus(
  accessToken: string,
  profileId: string
): Promise<FeedMyStatusDto> {
  return apiGetJson("/feed/my-status", accessToken, profileId);
}

export async function fetchFeedUnreadCount(
  accessToken: string,
  profileId: string
): Promise<{ count: number }> {
  return apiGetJson("/feed/unread-count", accessToken, profileId);
}

export async function fetchFeedPostTypes(
  accessToken: string,
  profileId: string
): Promise<{ types: CommunityFeedPostType[] }> {
  return apiGetJson("/feed/post-types", accessToken, profileId);
}

export async function fetchFeedPosts(
  accessToken: string,
  profileId: string,
  page = 1
): Promise<{ page: number; limit: number; items: FeedPostDto[] }> {
  return apiGetJson(`/feed/posts?page=${page}`, accessToken, profileId);
}

export async function preModerateFeedContent(
  accessToken: string,
  profileId: string,
  body: string
): Promise<PreModerateResultDto> {
  return apiPostJson("/feed/moderate/pre-check", { body }, accessToken, profileId);
}

export async function createFeedPost(
  accessToken: string,
  profileId: string,
  input: {
    postType: CommunityFeedPostType;
    body: string;
    isAnonymous?: boolean;
    authorRegion?: string;
  }
): Promise<FeedPostDto> {
  return apiPostJson("/feed/posts", input, accessToken, profileId);
}

export async function createFeedComment(
  accessToken: string,
  profileId: string,
  input: { postId: string; body: string; isAnonymous?: boolean; parentCommentId?: string }
): Promise<FeedCommentDto> {
  return apiPostJson("/feed/comments", input, accessToken, profileId);
}

export async function toggleFeedPostLike(
  accessToken: string,
  profileId: string,
  postId: string
): Promise<{ liked: boolean; likeCount: number }> {
  return apiPostJson(`/feed/posts/${postId}/like`, {}, accessToken, profileId);
}

export async function toggleFeedCommentLike(
  accessToken: string,
  profileId: string,
  commentId: string
): Promise<{ liked: boolean; likeCount: number }> {
  return apiPostJson(`/feed/comments/${commentId}/like`, {}, accessToken, profileId);
}

export async function submitFeedAppeal(
  accessToken: string,
  profileId: string,
  appealMessage: string
): Promise<{ id: string; status: string; createdAt: string }> {
  return apiPostJson("/feed/appeal", { appealMessage }, accessToken, profileId);
}
