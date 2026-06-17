import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CommunityFeedPostType,
  FeedUserStatus,
  ModerationSeverity,
  ProfileType,
  SanctionAppealStatus,
  type User
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { COMMUNITY_RULES } from "./constants/community-rules";
import {
  CreateFeedCommentDto,
  CreateFeedPostDto,
  CreateSanctionAppealDto,
  FEED_POST_TYPES_BY_PROFILE,
  PreModerateContentDto
} from "./dto/community-feed.dto";
import { FeedModerationAgentService } from "./services/feed-moderation-agent.service";
import { SanctionService } from "./services/sanction.service";

const MEDICAL_DISCLAIMER =
  "Ce conseil est partagé à titre informatif — consultez un vétérinaire pour un diagnostic.";

/** Seuil de présence en ligne (aligné sur la mise à jour horaire de lastActiveAt côté auth). */
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const RECENT_LIKERS_LIMIT = 8;

export type FeedLikerDto = {
  displayName: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
};

type ProfileSnapshot = {
  id: string;
  avatarUrl: string | null;
};

type AuthorUserSnapshot = {
  lastActiveAt: Date | null;
  avatarUrl: string | null;
};

export type MappedFeedComment = {
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
  replies: MappedFeedComment[];
};

export type AdminFeedCommentRow = {
  id: string;
  parentCommentId: string | null;
  authorUserId: string;
  authorEmail: string | null;
  authorName: string | null;
  authorProfileType: ProfileType;
  authorDisplayName: string | null;
  authorRegion: string | null;
  body: string;
  isAnonymous: boolean;
  isRemoved: boolean;
  removedReason: string | null;
  likeCount: number;
  createdAt: string;
  replies: AdminFeedCommentRow[];
};

@Injectable()
export class CommunityFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: FeedModerationAgentService,
    private readonly sanctions: SanctionService
  ) {}

  getRules() {
    return { rules: COMMUNITY_RULES };
  }

  async getMyStatus(user: User) {
    await this.sanctions.maybeReduceSanctionLevel(user);
    const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!refreshed) {
      throw new NotFoundException();
    }

    const canPost = this.sanctions.canPost(refreshed);
    const canRead = this.sanctions.canRead(refreshed);

    return {
      feedStatus: refreshed.feedStatus,
      feedSuspensionUntil: refreshed.feedSuspensionUntil?.toISOString() ?? null,
      feedViolationCount: refreshed.feedViolationCount,
      canPost,
      canRead,
      canComment: canPost
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    const total = await this.prisma.communityFeedPost.count({
      where: { isRemoved: false }
    });
    const read = await this.prisma.communityFeedRead.count({
      where: { userId }
    });
    return Math.max(0, total - read);
  }

  async listPosts(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const posts = await this.prisma.communityFeedPost.findMany({
      where: { isRemoved: false },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        authorUser: {
          select: { lastActiveAt: true, avatarUrl: true }
        },
        comments: {
          where: { isRemoved: false },
          orderBy: { createdAt: "asc" },
          take: 200,
          include: {
            authorUser: {
              select: { lastActiveAt: true, avatarUrl: true }
            },
            _count: { select: { likes: true } },
            likes: {
              where: { userId },
              select: { id: true },
              take: 1
            }
          }
        },
        _count: { select: { likes: true } },
        likes: {
          where: { userId },
          select: { id: true },
          take: 1
        }
      }
    });

    const postIds = posts.map((p) => p.id);
    if (postIds.length > 0) {
      await this.prisma.communityFeedRead.createMany({
        data: postIds.map((postId) => ({ userId, postId })),
        skipDuplicates: true
      });
    }

    const profileIds = [
      ...posts.map((p) => p.authorProfileId),
      ...posts.flatMap((p) => p.comments.map((c) => c.authorProfileId))
    ];
    const [profileMap, likersByPostId] = await Promise.all([
      this.loadProfileMap(profileIds),
      this.loadRecentLikersByPostId(postIds)
    ]);

    return {
      page,
      limit,
      items: posts.map((p) =>
        this.mapPost(p, userId, profileMap, likersByPostId.get(p.id) ?? [])
      )
    };
  }

  async listPostsAdmin(page = 1, limit = 20, includeRemoved = false) {
    const skip = (page - 1) * limit;
    const where = includeRemoved ? {} : { isRemoved: false };
    const [total, posts] = await Promise.all([
      this.prisma.communityFeedPost.count({ where }),
      this.prisma.communityFeedPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          authorUser: { select: { id: true, email: true, fullName: true } },
          comments: {
            where: includeRemoved ? {} : { isRemoved: false },
            orderBy: { createdAt: "asc" },
            take: 200,
            include: {
              authorUser: { select: { id: true, email: true, fullName: true } },
              _count: { select: { likes: true } }
            }
          },
          _count: { select: { likes: true, comments: true } }
        }
      })
    ]);

    return {
      page,
      limit,
      total,
      items: posts.map((p) => ({
        id: p.id,
        authorUserId: p.authorUserId,
        authorEmail: p.authorUser.email,
        authorName: p.authorUser.fullName,
        authorProfileType: p.authorProfileType,
        authorDisplayName: p.authorDisplayName,
        authorRegion: p.authorRegion,
        postType: p.postType,
        body: p.body,
        isAnonymous: p.isAnonymous,
        isRemoved: p.isRemoved,
        removedReason: p.removedReason,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        createdAt: p.createdAt.toISOString(),
        comments: this.nestCommentsForAdmin(p.comments)
      }))
    };
  }

  async adminRemovePost(postId: string) {
    const post = await this.prisma.communityFeedPost.findUnique({
      where: { id: postId }
    });
    if (!post) {
      throw new NotFoundException("Publication introuvable.");
    }
    if (post.isRemoved) {
      return { ok: true, alreadyRemoved: true };
    }

    await this.prisma.communityFeedPost.update({
      where: { id: postId },
      data: {
        isRemoved: true,
        removedReason: "admin_removal"
      }
    });

    await this.prisma.moderationEvent.create({
      data: {
        userId: post.authorUserId,
        postId,
        violationType: "admin_removal",
        severity: ModerationSeverity.medium,
        actionTaken: "removed_by_admin",
        contentSnapshot: post.body.slice(0, 2000),
        reviewedByAdmin: true
      }
    });

    return { ok: true };
  }

  async adminRemoveComment(commentId: string) {
    const comment = await this.prisma.communityFeedComment.findUnique({
      where: { id: commentId }
    });
    if (!comment) {
      throw new NotFoundException("Commentaire introuvable.");
    }
    if (comment.isRemoved) {
      return { ok: true, alreadyRemoved: true };
    }

    await this.prisma.communityFeedComment.update({
      where: { id: commentId },
      data: {
        isRemoved: true,
        removedReason: "admin_removal"
      }
    });

    await this.prisma.moderationEvent.create({
      data: {
        userId: comment.authorUserId,
        postId: comment.postId,
        commentId,
        violationType: "admin_removal",
        severity: ModerationSeverity.medium,
        actionTaken: "removed_by_admin",
        contentSnapshot: comment.body.slice(0, 2000),
        reviewedByAdmin: true
      }
    });

    return { ok: true };
  }

  async togglePostLike(userId: string, postId: string) {
    const post = await this.prisma.communityFeedPost.findUnique({
      where: { id: postId }
    });
    if (!post || post.isRemoved) {
      throw new NotFoundException("Publication introuvable.");
    }

    const existing = await this.prisma.communityFeedLike.findUnique({
      where: { userId_postId: { userId, postId } }
    });

    if (existing) {
      await this.prisma.communityFeedLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.communityFeedLike.create({
        data: { userId, postId }
      });
    }

    const likeCount = await this.prisma.communityFeedLike.count({
      where: { postId }
    });

    return { liked: !existing, likeCount };
  }

  async toggleCommentLike(userId: string, commentId: string) {
    const comment = await this.prisma.communityFeedComment.findUnique({
      where: { id: commentId }
    });
    if (!comment || comment.isRemoved) {
      throw new NotFoundException("Commentaire introuvable.");
    }

    const existing = await this.prisma.communityFeedLike.findUnique({
      where: { userId_commentId: { userId, commentId } }
    });

    if (existing) {
      await this.prisma.communityFeedLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.communityFeedLike.create({
        data: { userId, commentId }
      });
    }

    const likeCount = await this.prisma.communityFeedLike.count({
      where: { commentId }
    });

    return { liked: !existing, likeCount };
  }

  async preModerate(dto: PreModerateContentDto) {
    const result = await this.moderation.preSendCheck(dto.body);
    return {
      allowed: result.allowed,
      warningMessageFr: result.warningMessageFr,
      severity: result.severity,
      shouldBlock: result.shouldBlock,
      ruleId: result.ruleId
    };
  }

  async createPost(
    user: User,
    profileId: string,
    profileType: ProfileType,
    displayName: string | null,
    dto: CreateFeedPostDto
  ) {
    await this.assertCanPost(user);
    this.assertPostTypeAllowed(profileType, dto.postType);

    const mod = await this.moderation.preSendCheck(dto.body);
    if (mod.shouldBlock || !mod.allowed) {
      if (mod.isViolation && mod.severity) {
        await this.sanctions.recordViolation({
          userId: user.id,
          violationType: mod.violationType ?? "pre_send_block",
          severity: mod.severity,
          actionTaken: "blocked_pre_send",
          contentSnapshot: dto.body,
          aiConfidence: mod.aiConfidence,
          ruleId: mod.ruleId
        });
      }
      throw new BadRequestException({
        message: mod.warningMessageFr ?? "Message bloqué par la modération.",
        ruleId: mod.ruleId,
        severity: mod.severity
      });
    }

    const post = await this.prisma.communityFeedPost.create({
      data: {
        authorUserId: user.id,
        authorProfileId: profileId,
        authorProfileType: profileType,
        authorDisplayName: dto.isAnonymous ? null : displayName,
        authorRegion: dto.authorRegion ?? user.homeLocationLabel ?? null,
        postType: dto.postType,
        body: mod.maskedBody,
        isAnonymous: Boolean(dto.isAnonymous)
      }
    });

    if (mod.isViolation && mod.severity === ModerationSeverity.low) {
      await this.sanctions.recordViolation({
        userId: user.id,
        postId: post.id,
        violationType: mod.violationType ?? "low_warning",
        severity: mod.severity,
        actionTaken: "warn_pre_send",
        contentSnapshot: dto.body,
        aiConfidence: mod.aiConfidence,
        ruleId: mod.ruleId
      });
    }

    void this.reviewPostAsync(post.id, post.body, user.id);

    const [profileMap, authorUser] = await Promise.all([
      this.loadProfileMap([profileId]),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { lastActiveAt: true, avatarUrl: true }
      })
    ]);

    return this.mapPost(
      {
        ...post,
        comments: [],
        _count: { likes: 0 },
        likes: [],
        authorUser: authorUser ?? { lastActiveAt: null, avatarUrl: null }
      },
      user.id,
      profileMap,
      []
    );
  }

  async createComment(
    user: User,
    profileId: string,
    profileType: ProfileType,
    displayName: string | null,
    dto: CreateFeedCommentDto
  ) {
    await this.assertCanPost(user);

    const post = await this.prisma.communityFeedPost.findUnique({
      where: { id: dto.postId }
    });
    if (!post || post.isRemoved) {
      throw new NotFoundException("Publication introuvable.");
    }

    if (dto.parentCommentId) {
      const parent = await this.prisma.communityFeedComment.findUnique({
        where: { id: dto.parentCommentId }
      });
      if (!parent || parent.isRemoved || parent.postId !== dto.postId) {
        throw new BadRequestException("Commentaire parent invalide.");
      }
    }

    const mod = await this.moderation.preSendCheck(dto.body);
    if (mod.shouldBlock || !mod.allowed) {
      if (mod.isViolation && mod.severity) {
        await this.sanctions.recordViolation({
          userId: user.id,
          commentId: undefined,
          postId: dto.postId,
          violationType: mod.violationType ?? "pre_send_block",
          severity: mod.severity,
          actionTaken: "blocked_pre_send_comment",
          contentSnapshot: dto.body,
          aiConfidence: mod.aiConfidence,
          ruleId: mod.ruleId
        });
      }
      throw new BadRequestException({
        message: mod.warningMessageFr ?? "Commentaire bloqué par la modération.",
        ruleId: mod.ruleId,
        severity: mod.severity
      });
    }

    const comment = await this.prisma.communityFeedComment.create({
      data: {
        postId: dto.postId,
        parentCommentId: dto.parentCommentId ?? null,
        authorUserId: user.id,
        authorProfileId: profileId,
        authorProfileType: profileType,
        authorDisplayName: dto.isAnonymous ? null : displayName,
        authorRegion: dto.authorRegion ?? user.homeLocationLabel ?? null,
        body: mod.maskedBody,
        isAnonymous: Boolean(dto.isAnonymous)
      }
    });

    void this.reviewCommentAsync(comment.id, comment.body, user.id, dto.postId);

    const [profileMap, authorUser] = await Promise.all([
      this.loadProfileMap([profileId]),
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: { lastActiveAt: true, avatarUrl: true }
      })
    ]);

    return this.mapComment(
      {
        ...comment,
        _count: { likes: 0 },
        likes: [],
        authorUser: authorUser ?? { lastActiveAt: null, avatarUrl: null }
      },
      user.id,
      profileMap
    );
  }

  async moderatePostAsync(postId: string, userId: string) {
    const post = await this.prisma.communityFeedPost.findUnique({
      where: { id: postId }
    });
    if (!post || post.isRemoved) {
      return { ok: true, action: "none" as const };
    }
    await this.reviewPostAsync(postId, post.body, userId);
    return { ok: true, action: "reviewed" as const };
  }

  async createAppeal(user: User, dto: CreateSanctionAppealDto) {
    const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!refreshed) {
      throw new NotFoundException();
    }

    if (refreshed.feedStatus === FeedUserStatus.active) {
      throw new BadRequestException("Aucune sanction active à contester.");
    }

    const level = this.statusToLevel(refreshed.feedStatus);
    const existing = await this.prisma.sanctionAppeal.findFirst({
      where: {
        userId: user.id,
        status: SanctionAppealStatus.pending
      }
    });
    if (existing) {
      throw new BadRequestException("Une contestation est déjà en cours.");
    }

    const appeal = await this.prisma.sanctionAppeal.create({
      data: {
        userId: user.id,
        sanctionLevel: level,
        appealMessage: dto.appealMessage.trim()
      }
    });

    return {
      id: appeal.id,
      status: appeal.status,
      createdAt: appeal.createdAt.toISOString()
    };
  }

  async listModerationEvents(limit = 50) {
    const events = await this.prisma.moderationEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, email: true, fullName: true } }
      }
    });
    return events.map((e) => ({
      id: e.id,
      userId: e.userId,
      userEmail: e.user.email,
      userName: e.user.fullName,
      postId: e.postId,
      commentId: e.commentId,
      violationType: e.violationType,
      severity: e.severity,
      actionTaken: e.actionTaken,
      contentSnapshot: e.contentSnapshot,
      aiConfidence: e.aiConfidence ? Number(e.aiConfidence) : null,
      reviewedByAdmin: e.reviewedByAdmin,
      createdAt: e.createdAt.toISOString()
    }));
  }

  async listSanctionedUsers() {
    const users = await this.prisma.user.findMany({
      where: {
        feedStatus: { not: FeedUserStatus.active }
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        feedStatus: true,
        feedSuspensionUntil: true,
        feedViolationCount: true
      },
      orderBy: { updatedAt: "desc" },
      take: 100
    });
    return users.map((u) => ({
      ...u,
      feedSuspensionUntil: u.feedSuspensionUntil?.toISOString() ?? null
    }));
  }

  async listAppeals(status?: SanctionAppealStatus) {
    const appeals = await this.prisma.sanctionAppeal.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, fullName: true, feedStatus: true } }
      }
    });
    return appeals.map((a) => ({
      id: a.id,
      userId: a.userId,
      userEmail: a.user.email,
      userName: a.user.fullName,
      feedStatus: a.user.feedStatus,
      sanctionLevel: a.sanctionLevel,
      appealMessage: a.appealMessage,
      status: a.status,
      adminResponse: a.adminResponse,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null
    }));
  }

  async resolveAppeal(
    appealId: string,
    accepted: boolean,
    adminResponse: string
  ) {
    const appeal = await this.prisma.sanctionAppeal.findUnique({
      where: { id: appealId }
    });
    if (!appeal) {
      throw new NotFoundException();
    }
    if (appeal.status !== SanctionAppealStatus.pending) {
      throw new BadRequestException("Contestation déjà traitée.");
    }

    await this.prisma.sanctionAppeal.update({
      where: { id: appealId },
      data: {
        status: accepted ? SanctionAppealStatus.accepted : SanctionAppealStatus.rejected,
        adminResponse,
        resolvedAt: new Date()
      }
    });

    if (accepted) {
      await this.sanctions.clearSanction(appeal.userId);
    }

    return { ok: true };
  }

  getPostTypesForProfile(profileType: ProfileType) {
    return FEED_POST_TYPES_BY_PROFILE[profileType];
  }

  private async reviewCommentAsync(
    commentId: string,
    body: string,
    userId: string,
    postId: string
  ) {
    const review = await this.moderation.postSendReview(body);
    if (!review.isViolation || review.actionRecommended === "none") {
      return;
    }

    if (review.actionRecommended === "remove") {
      await this.prisma.communityFeedComment.update({
        where: { id: commentId },
        data: {
          isRemoved: true,
          removedReason: review.violationType ?? "comment_post_send_review"
        }
      });
    }

    if (review.severity) {
      await this.sanctions.recordViolation({
        userId,
        postId,
        commentId,
        violationType: review.violationType ?? "comment_post_send",
        severity: review.severity,
        actionTaken: review.actionRecommended,
        contentSnapshot: body,
        aiConfidence: review.aiConfidence
      });
    }
  }

  private async reviewPostAsync(postId: string, body: string, userId: string) {
    const review = await this.moderation.postSendReview(body);
    if (!review.isViolation || review.actionRecommended === "none") {
      return;
    }

    if (review.actionRecommended === "remove") {
      await this.prisma.communityFeedPost.update({
        where: { id: postId },
        data: {
          isRemoved: true,
          removedReason: review.violationType ?? "post_send_review"
        }
      });
    }

    if (review.severity) {
      await this.sanctions.recordViolation({
        userId,
        postId,
        violationType: review.violationType ?? "post_send",
        severity: review.severity,
        actionTaken: review.actionRecommended,
        contentSnapshot: body,
        aiConfidence: review.aiConfidence
      });
    }
  }

  private async assertCanPost(user: User) {
    await this.sanctions.maybeReduceSanctionLevel(user);
    const refreshed = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!refreshed) {
      throw new NotFoundException();
    }
    if (!this.sanctions.canPost(refreshed)) {
      throw new ForbiddenException({
        message: "Votre accès au Feed est suspendu.",
        feedStatus: refreshed.feedStatus,
        feedSuspensionUntil: refreshed.feedSuspensionUntil?.toISOString() ?? null
      });
    }
    return refreshed;
  }

  private assertPostTypeAllowed(profileType: ProfileType, postType: CommunityFeedPostType) {
    const allowed = FEED_POST_TYPES_BY_PROFILE[profileType];
    if (!allowed.includes(postType)) {
      throw new BadRequestException("Type de publication non autorisé pour ce profil.");
    }
  }

  private statusToLevel(status: FeedUserStatus): number {
    switch (status) {
      case FeedUserStatus.warned_1:
        return 1;
      case FeedUserStatus.warned_2:
        return 2;
      case FeedUserStatus.suspended_7d:
        return 3;
      case FeedUserStatus.suspended_30d:
        return 4;
      case FeedUserStatus.banned_permanent:
        return 5;
      default:
        return 0;
    }
  }

  private isUserOnline(lastActiveAt: Date | null | undefined): boolean {
    if (!lastActiveAt) {
      return false;
    }
    return Date.now() - lastActiveAt.getTime() < ONLINE_THRESHOLD_MS;
  }

  private async loadProfileMap(
    profileIds: string[]
  ): Promise<Map<string, ProfileSnapshot>> {
    const unique = [...new Set(profileIds.filter(Boolean))];
    if (!unique.length) {
      return new Map();
    }
    const profiles = await this.prisma.profile.findMany({
      where: { id: { in: unique } },
      select: { id: true, avatarUrl: true }
    });
    return new Map(profiles.map((p) => [p.id, p]));
  }

  private async loadRecentLikersByPostId(
    postIds: string[]
  ): Promise<Map<string, FeedLikerDto[]>> {
    const result = new Map<string, FeedLikerDto[]>();
    if (!postIds.length) {
      return result;
    }

    await Promise.all(
      postIds.map(async (postId) => {
        const likes = await this.prisma.communityFeedLike.findMany({
          where: { postId, commentId: null },
          orderBy: { createdAt: "desc" },
          take: RECENT_LIKERS_LIMIT,
          select: {
            user: {
              select: {
                fullName: true,
                avatarUrl: true,
                lastActiveAt: true,
                profiles: {
                  select: { avatarUrl: true, displayName: true },
                  orderBy: [{ isDefault: "desc" }],
                  take: 1
                }
              }
            }
          }
        });
        result.set(
          postId,
          likes.map((like) => this.mapLikerFromUser(like.user))
        );
      })
    );

    return result;
  }

  private mapLikerFromUser(user: {
    fullName: string | null;
    avatarUrl: string | null;
    lastActiveAt: Date | null;
    profiles: Array<{ avatarUrl: string | null; displayName: string | null }>;
  }): FeedLikerDto {
    const profile = user.profiles[0];
    return {
      displayName: profile?.displayName ?? user.fullName,
      avatarUrl: profile?.avatarUrl ?? user.avatarUrl,
      isOnline: this.isUserOnline(user.lastActiveAt)
    };
  }

  private resolveAuthorAvatarUrl(
    isAnonymous: boolean,
    authorProfileId: string,
    profileMap: Map<string, ProfileSnapshot>,
    fallbackAvatar: string | null | undefined
  ): string | null {
    if (isAnonymous) {
      return null;
    }
    return profileMap.get(authorProfileId)?.avatarUrl ?? fallbackAvatar ?? null;
  }

  private resolveAuthorIsOnline(
    isAnonymous: boolean,
    lastActiveAt: Date | null | undefined
  ): boolean {
    if (isAnonymous) {
      return false;
    }
    return this.isUserOnline(lastActiveAt);
  }

  private mapPost(
    post: {
      id: string;
      authorProfileId: string;
      authorProfileType: ProfileType;
      authorDisplayName: string | null;
      authorRegion: string | null;
      postType: CommunityFeedPostType;
      body: string;
      isAnonymous: boolean;
      createdAt: Date;
      authorUser?: AuthorUserSnapshot | null;
      _count?: { likes: number };
      likes?: Array<{ id: string }>;
      comments?: Array<{
        id: string;
        authorProfileId: string;
        parentCommentId?: string | null;
        authorProfileType: ProfileType;
        authorDisplayName: string | null;
        authorRegion: string | null;
        body: string;
        isAnonymous: boolean;
        createdAt: Date;
        authorUser?: AuthorUserSnapshot | null;
        _count?: { likes: number };
        likes?: Array<{ id: string }>;
      }>;
    },
    userId: string | undefined,
    profileMap: Map<string, ProfileSnapshot>,
    recentLikers: FeedLikerDto[]
  ) {
    const flatComments = (post.comments ?? []).map((c) =>
      this.mapComment(c, userId, profileMap)
    );

    return {
      id: post.id,
      authorProfileType: post.authorProfileType,
      authorDisplayName: post.isAnonymous ? null : post.authorDisplayName,
      authorRegion: post.authorRegion,
      authorAvatarUrl: this.resolveAuthorAvatarUrl(
        post.isAnonymous,
        post.authorProfileId,
        profileMap,
        post.authorUser?.avatarUrl
      ),
      authorIsOnline: this.resolveAuthorIsOnline(
        post.isAnonymous,
        post.authorUser?.lastActiveAt
      ),
      postType: post.postType,
      body: post.body,
      isAnonymous: post.isAnonymous,
      isVetHighlight: post.postType === CommunityFeedPostType.medical_tip,
      medicalDisclaimer:
        post.postType === CommunityFeedPostType.medical_tip
          ? MEDICAL_DISCLAIMER
          : null,
      likeCount: post._count?.likes ?? 0,
      likedByMe: (post.likes?.length ?? 0) > 0,
      recentLikers,
      createdAt: post.createdAt.toISOString(),
      comments: this.nestComments(flatComments)
    };
  }

  private mapComment(
    comment: {
      id: string;
      authorProfileId: string;
      parentCommentId?: string | null;
      authorProfileType: ProfileType;
      authorDisplayName: string | null;
      authorRegion: string | null;
      body: string;
      isAnonymous: boolean;
      createdAt: Date;
      authorUser?: AuthorUserSnapshot | null;
      _count?: { likes: number };
      likes?: Array<{ id: string }>;
    },
    _userId: string | undefined,
    profileMap: Map<string, ProfileSnapshot>
  ): MappedFeedComment {
    return {
      id: comment.id,
      parentCommentId: comment.parentCommentId ?? null,
      authorProfileType: comment.authorProfileType,
      authorDisplayName: comment.isAnonymous ? null : comment.authorDisplayName,
      authorRegion: comment.authorRegion,
      authorAvatarUrl: this.resolveAuthorAvatarUrl(
        comment.isAnonymous,
        comment.authorProfileId,
        profileMap,
        comment.authorUser?.avatarUrl
      ),
      authorIsOnline: this.resolveAuthorIsOnline(
        comment.isAnonymous,
        comment.authorUser?.lastActiveAt
      ),
      body: comment.body,
      isAnonymous: comment.isAnonymous,
      likeCount: comment._count?.likes ?? 0,
      likedByMe: (comment.likes?.length ?? 0) > 0,
      createdAt: comment.createdAt.toISOString(),
      replies: []
    };
  }

  private nestComments(flat: MappedFeedComment[]): MappedFeedComment[] {
    const byId = new Map(flat.map((c) => [c.id, c]));
    const roots: MappedFeedComment[] = [];

    for (const comment of flat) {
      if (comment.parentCommentId) {
        const parent = byId.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(comment);
        } else {
          roots.push(comment);
        }
      } else {
        roots.push(comment);
      }
    }

    return roots;
  }

  private nestCommentsForAdmin(
    flat: Array<{
      id: string;
      parentCommentId: string | null;
      authorUserId: string;
      authorUser: { id: string; email: string | null; fullName: string | null };
      authorProfileType: ProfileType;
      authorDisplayName: string | null;
      authorRegion: string | null;
      body: string;
      isAnonymous: boolean;
      isRemoved: boolean;
      removedReason: string | null;
      createdAt: Date;
      _count: { likes: number };
    }>
  ): AdminFeedCommentRow[] {
    const mapped: AdminFeedCommentRow[] = flat.map((c) => ({
      id: c.id,
      parentCommentId: c.parentCommentId,
      authorUserId: c.authorUserId,
      authorEmail: c.authorUser.email,
      authorName: c.authorUser.fullName,
      authorProfileType: c.authorProfileType,
      authorDisplayName: c.authorDisplayName,
      authorRegion: c.authorRegion,
      body: c.body,
      isAnonymous: c.isAnonymous,
      isRemoved: c.isRemoved,
      removedReason: c.removedReason,
      likeCount: c._count.likes,
      createdAt: c.createdAt.toISOString(),
      replies: []
    }));

    const byId = new Map(mapped.map((c) => [c.id, c]));
    const roots: AdminFeedCommentRow[] = [];

    for (const comment of mapped) {
      if (comment.parentCommentId) {
        const parent = byId.get(comment.parentCommentId);
        if (parent) {
          parent.replies.push(comment);
        } else {
          roots.push(comment);
        }
      } else {
        roots.push(comment);
      }
    }

    return roots;
  }
}
