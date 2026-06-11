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
        comments: {
          where: { isRemoved: false },
          orderBy: { createdAt: "asc" },
          take: 50
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

    return {
      page,
      limit,
      items: posts.map((p) => this.mapPost(p))
    };
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

    return this.mapPost({ ...post, comments: [] });
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

    return this.mapComment(comment);
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

  private mapPost(
    post: {
      id: string;
      authorProfileType: ProfileType;
      authorDisplayName: string | null;
      authorRegion: string | null;
      postType: CommunityFeedPostType;
      body: string;
      isAnonymous: boolean;
      createdAt: Date;
      comments?: Array<{
        id: string;
        authorProfileType: ProfileType;
        authorDisplayName: string | null;
        authorRegion: string | null;
        body: string;
        isAnonymous: boolean;
        createdAt: Date;
      }>;
    }
  ) {
    return {
      id: post.id,
      authorProfileType: post.authorProfileType,
      authorDisplayName: post.isAnonymous ? null : post.authorDisplayName,
      authorRegion: post.authorRegion,
      postType: post.postType,
      body: post.body,
      isAnonymous: post.isAnonymous,
      isVetHighlight: post.postType === CommunityFeedPostType.medical_tip,
      medicalDisclaimer:
        post.postType === CommunityFeedPostType.medical_tip
          ? MEDICAL_DISCLAIMER
          : null,
      createdAt: post.createdAt.toISOString(),
      comments: (post.comments ?? []).map((c) => this.mapComment(c))
    };
  }

  private mapComment(comment: {
    id: string;
    authorProfileType: ProfileType;
    authorDisplayName: string | null;
    authorRegion: string | null;
    body: string;
    isAnonymous: boolean;
    createdAt: Date;
  }) {
    return {
      id: comment.id,
      authorProfileType: comment.authorProfileType,
      authorDisplayName: comment.isAnonymous ? null : comment.authorDisplayName,
      authorRegion: comment.authorRegion,
      body: comment.body,
      isAnonymous: comment.isAnonymous,
      createdAt: comment.createdAt.toISOString()
    };
  }
}
