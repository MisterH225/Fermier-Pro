import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { FeedUserStatus, SanctionAppealStatus } from "@prisma/client";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { SuperAdminGuard } from "../admin-platform/super-admin.guard";
import { CommunityFeedService } from "./community-feed.service";
import { AdminFeedSanctionDto, AdminListFeedPostsQueryDto } from "./dto/community-feed.dto";
import { SanctionService } from "./services/sanction.service";

@Controller("admin/feed")
@UseGuards(SupabaseJwtGuard, SuperAdminGuard)
export class CommunityFeedAdminController {
  constructor(
    private readonly feed: CommunityFeedService,
    private readonly sanctions: SanctionService
  ) {}

  @Get("moderation-events")
  listEvents(@Query("limit") limit?: string) {
    const n = Number(limit);
    return this.feed.listModerationEvents(Number.isFinite(n) && n > 0 ? n : 50);
  }

  @Get("sanctioned-users")
  listSanctionedUsers() {
    return this.feed.listSanctionedUsers();
  }

  @Get("appeals")
  listAppeals(@Query("status") status?: SanctionAppealStatus) {
    return this.feed.listAppeals(status);
  }

  @Patch("users/:id/sanction")
  async sanctionUser(
    @Param("id") userId: string,
    @Body() dto: AdminFeedSanctionDto
  ) {
    await this.sanctions.setManualSanction(
      userId,
      dto.feedStatus as FeedUserStatus,
      dto.reason
    );
    return { ok: true };
  }

  @Patch("users/:id/unsanction")
  async unsanctionUser(@Param("id") userId: string) {
    await this.sanctions.clearSanction(userId);
    return { ok: true };
  }

  @Post("appeals/:id/resolve")
  resolveAppeal(
    @Param("id") appealId: string,
    @Body() body: { accepted: boolean; adminResponse: string }
  ) {
    return this.feed.resolveAppeal(appealId, body.accepted, body.adminResponse);
  }

  @Get("posts")
  listPosts(@Query() query: AdminListFeedPostsQueryDto) {
    return this.feed.listPostsAdmin(
      query.page ?? 1,
      query.limit ?? 20,
      Boolean(query.includeRemoved)
    );
  }

  @Delete("posts/:id")
  removePost(@Param("id") postId: string) {
    return this.feed.adminRemovePost(postId);
  }

  @Delete("comments/:id")
  removeComment(@Param("id") commentId: string) {
    return this.feed.adminRemoveComment(commentId);
  }
}
