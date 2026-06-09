import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { ActiveProfile } from "../auth/decorators/active-profile.decorator";
import { SupabaseJwtGuard } from "../auth/guards/supabase-jwt.guard";
import { ActiveProfileGuard } from "../auth/guards/active-profile.guard";
import type { ActiveProfilePayload } from "../auth/decorators/active-profile.decorator";
import { CommunityFeedService } from "./community-feed.service";
import {
  CreateFeedCommentDto,
  CreateFeedPostDto,
  CreateSanctionAppealDto,
  ListFeedPostsQueryDto,
  PostSendModerateDto,
  PreModerateContentDto
} from "./dto/community-feed.dto";

@Controller("feed")
@UseGuards(SupabaseJwtGuard, ActiveProfileGuard)
export class CommunityFeedController {
  constructor(private readonly feed: CommunityFeedService) {}

  @Get("rules")
  getRules() {
    return this.feed.getRules();
  }

  @Get("my-status")
  getMyStatus(@CurrentUser() user: User) {
    return this.feed.getMyStatus(user);
  }

  @Get("unread-count")
  getUnreadCount(@CurrentUser() user: User) {
    return this.feed.getUnreadCount(user.id).then((count) => ({ count }));
  }

  @Get("post-types")
  getPostTypes(@ActiveProfile() profile: ActiveProfilePayload) {
    return {
      types: this.feed.getPostTypesForProfile(profile.type)
    };
  }

  @Get("posts")
  listPosts(
    @CurrentUser() user: User,
    @Query() query: ListFeedPostsQueryDto
  ) {
    return this.feed.listPosts(user.id, query.page ?? 1, query.limit ?? 20);
  }

  @Post("moderate/pre-check")
  preModerate(@Body() dto: PreModerateContentDto) {
    return this.feed.preModerate(dto);
  }

  @Post("posts")
  createPost(
    @CurrentUser() user: User,
    @ActiveProfile() profile: ActiveProfilePayload,
    @Body() dto: CreateFeedPostDto
  ) {
    return this.feed.createPost(
      user,
      profile.id,
      profile.type,
      profile.displayName,
      dto
    );
  }

  @Post("comments")
  createComment(
    @CurrentUser() user: User,
    @ActiveProfile() profile: ActiveProfilePayload,
    @Body() dto: CreateFeedCommentDto
  ) {
    return this.feed.createComment(
      user,
      profile.id,
      profile.type,
      profile.displayName,
      dto
    );
  }

  @Post("moderate")
  moderatePost(
    @CurrentUser() user: User,
    @Body() dto: PostSendModerateDto
  ) {
    return this.feed.moderatePostAsync(dto.postId, user.id);
  }

  @Post("appeal")
  createAppeal(@CurrentUser() user: User, @Body() dto: CreateSanctionAppealDto) {
    return this.feed.createAppeal(user, dto);
  }
}
